-- Job Discovery V2: compatibility backfill and read-optimized views.

UPDATE job_search.jobs j
SET normalized_title = job_search.normalize_discovery_text(j.title),
    normalized_company = job_search.normalize_discovery_text(c.name),
    normalized_location = job_search.normalize_discovery_text(j.location),
    canonical_key = coalesce(
      j.canonical_key,
      job_search.discovery_canonical_key(
        c.name,
        j.title,
        j.location,
        coalesce(j.posted_at::timestamptz, j.fetched_at),
        j.url
      )
    ),
    employment_type = coalesce(j.employment_type, j.job_type),
    remote_type = coalesce(j.remote_type, CASE WHEN j.remote THEN 'remote' ELSE 'unknown' END),
    first_seen_at = coalesce(j.first_seen_at, j.posted_at::timestamptz, j.fetched_at),
    last_seen_at = coalesce(j.last_seen_at, j.fetched_at),
    last_verified_at = coalesce(j.last_verified_at, j.fetched_at),
    lifecycle_status = coalesce(j.lifecycle_status, 'open'),
    preferred_source = coalesce(j.preferred_source, j.source),
    source_count = greatest(coalesce(j.source_count, 1), 1),
    canonicalization_version = 1
FROM job_search.companies c
WHERE c.id = j.company_id;

UPDATE job_search.jobs
SET normalized_title = job_search.normalize_discovery_text(title),
    normalized_company = coalesce(normalized_company, ''),
    normalized_location = job_search.normalize_discovery_text(location),
    canonical_key = coalesce(
      canonical_key,
      job_search.discovery_canonical_key(
        coalesce(normalized_company, 'unknown company'),
        title,
        location,
        coalesce(posted_at::timestamptz, fetched_at),
        url
      )
    ),
    employment_type = coalesce(employment_type, job_type),
    remote_type = coalesce(remote_type, CASE WHEN remote THEN 'remote' ELSE 'unknown' END),
    first_seen_at = coalesce(first_seen_at, posted_at::timestamptz, fetched_at),
    last_seen_at = coalesce(last_seen_at, fetched_at),
    last_verified_at = coalesce(last_verified_at, fetched_at),
    preferred_source = coalesce(preferred_source, source),
    source_count = greatest(coalesce(source_count, 1), 1)
WHERE company_id IS NULL;

INSERT INTO job_search.job_source_postings (
  job_id, source, external_id, source_url, apply_url,
  raw_title, raw_company_name, raw_location, raw_description,
  posted_at, first_seen_at, last_seen_at, last_verified_at,
  lifecycle_status, content_hash, is_primary,
  canonical_match_confidence, canonical_match_method
)
SELECT
  j.id,
  j.source,
  coalesce(nullif(j.external_id, ''), 'legacy:' || j.id::text),
  j.url,
  j.url,
  j.title,
  coalesce(c.name, 'Unknown'),
  j.location,
  j.description,
  j.posted_at::timestamptz,
  coalesce(j.first_seen_at, j.posted_at::timestamptz, j.fetched_at),
  coalesce(j.last_seen_at, j.fetched_at),
  coalesce(j.last_verified_at, j.fetched_at),
  coalesce(j.lifecycle_status, 'open'),
  j.content_hash,
  true,
  1,
  'legacy_backfill'
FROM job_search.jobs j
LEFT JOIN job_search.companies c ON c.id = j.company_id
WHERE NOT EXISTS (
  SELECT 1 FROM job_search.job_source_postings p WHERE p.job_id = j.id
)
ON CONFLICT DO NOTHING;

UPDATE job_search.jobs j
SET source_count = source_totals.source_count,
    preferred_source = coalesce(j.preferred_source, source_totals.primary_source)
FROM (
  SELECT
    job_id,
    count(*)::integer AS source_count,
    (array_agg(source ORDER BY
      CASE source
        WHEN 'greenhouse' THEN 100 WHEN 'lever' THEN 100 WHEN 'ashby' THEN 100
        WHEN 'smartrecruiters' THEN 100 WHEN 'manual' THEN 90 WHEN 'linkedin' THEN 80
        WHEN 'adzuna' THEN 60 WHEN 'remoteok' THEN 50 ELSE 40
      END DESC
    ))[1] AS primary_source
  FROM job_search.job_source_postings
  GROUP BY job_id
) source_totals
WHERE source_totals.job_id = j.id;

UPDATE job_search.job_source_postings p
SET is_primary = p.source = j.preferred_source
FROM job_search.jobs j
WHERE j.id = p.job_id;

DO $migrate_legacy_search$
DECLARE
  legacy jsonb;
  legacy_terms text[];
  legacy_locations text[];
  profile_id uuid;
  term_value text;
  location_value text;
BEGIN
  SELECT value INTO legacy FROM job_search.settings WHERE key = 'search_terms';
  IF legacy IS NULL THEN
    RETURN;
  END IF;

  SELECT coalesce(array_agg(value), ARRAY[]::text[])
  INTO legacy_terms
  FROM jsonb_array_elements_text(coalesce(legacy->'terms', '[]'::jsonb));

  SELECT coalesce(array_agg(value), ARRAY[]::text[])
  INTO legacy_locations
  FROM jsonb_array_elements_text(coalesce(legacy->'locations', '[]'::jsonb));

  SELECT id INTO profile_id
  FROM job_search.search_profiles
  WHERE slug = 'strategic-business-development';

  IF profile_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE job_search.search_profiles
  SET title_aliases = (
        SELECT ARRAY(SELECT DISTINCT unnest(title_aliases || legacy_terms))
      ),
      locations = CASE WHEN cardinality(legacy_locations) > 0 THEN legacy_locations ELSE locations END
  WHERE id = profile_id;

  FOREACH term_value IN ARRAY legacy_terms LOOP
    IF cardinality(legacy_locations) = 0 THEN
      INSERT INTO job_search.search_profile_queries (
        search_profile_id, provider, query_type, query_text, location
      ) VALUES (profile_id, 'adzuna', 'keyword', term_value, 'Canada')
      ON CONFLICT DO NOTHING;
    ELSE
      FOREACH location_value IN ARRAY legacy_locations LOOP
        INSERT INTO job_search.search_profile_queries (
          search_profile_id, provider, query_type, query_text, location
        ) VALUES (profile_id, 'adzuna', 'keyword', term_value, location_value)
        ON CONFLICT DO NOTHING;
      END LOOP;
    END IF;
  END LOOP;
END
$migrate_legacy_search$;

CREATE OR REPLACE VIEW job_search.canonical_job_sources
WITH (security_invoker = true)
AS
SELECT
  j.id AS job_id,
  j.preferred_source,
  j.source_count,
  jsonb_agg(
    jsonb_build_object(
      'id', p.id,
      'source', p.source,
      'external_id', p.external_id,
      'source_url', p.source_url,
      'apply_url', p.apply_url,
      'lifecycle_status', p.lifecycle_status,
      'first_seen_at', p.first_seen_at,
      'last_seen_at', p.last_seen_at,
      'last_verified_at', p.last_verified_at,
      'is_primary', p.is_primary
    ) ORDER BY p.is_primary DESC, p.last_verified_at DESC
  ) AS sources
FROM job_search.jobs j
JOIN job_search.job_source_postings p ON p.job_id = j.id
GROUP BY j.id, j.preferred_source, j.source_count;

CREATE OR REPLACE VIEW job_search.job_discovery_feed
WITH (security_invoker = true)
AS
SELECT
  j.*,
  c.name AS company_name,
  best.search_profile_id AS best_profile_id,
  best.overall_score AS best_profile_score,
  best.hard_disqualified,
  best.reasons AS score_reasons,
  coalesce(j.source_count, 0) AS corroborating_source_count
FROM job_search.jobs j
LEFT JOIN job_search.companies c ON c.id = j.company_id
LEFT JOIN LATERAL (
  SELECT s.search_profile_id, s.overall_score, s.hard_disqualified, s.reasons
  FROM job_search.job_scores s
  WHERE s.job_id = j.id
  ORDER BY s.hard_disqualified ASC, s.overall_score DESC
  LIMIT 1
) best ON true;

CREATE OR REPLACE VIEW job_search.discovery_profile_summary
WITH (security_invoker = true)
AS
SELECT
  p.id,
  p.name,
  p.slug,
  p.enabled,
  p.priority,
  count(DISTINCT q.id) AS query_count,
  count(DISTINCT link.company_job_source_id) AS company_source_count,
  count(DISTINCT s.job_id) FILTER (WHERE NOT s.hard_disqualified) AS matched_job_count,
  max(q.last_run_at) AS last_query_run_at
FROM job_search.search_profiles p
LEFT JOIN job_search.search_profile_queries q ON q.search_profile_id = p.id
LEFT JOIN job_search.search_profile_company_sources link ON link.search_profile_id = p.id AND link.enabled
LEFT JOIN job_search.job_scores s ON s.search_profile_id = p.id
GROUP BY p.id, p.name, p.slug, p.enabled, p.priority;

CREATE OR REPLACE VIEW job_search.source_health
WITH (security_invoker = true)
AS
SELECT
  s.id,
  s.provider,
  s.board_key,
  s.company_id,
  c.name AS company_name,
  s.enabled,
  s.priority,
  s.last_checked_at,
  s.last_success_at,
  s.last_error_at,
  s.last_error,
  s.consecutive_failures,
  s.active_job_count,
  CASE
    WHEN NOT s.enabled THEN 'disabled'
    WHEN s.consecutive_failures >= 3 THEN 'failing'
    WHEN s.last_success_at IS NULL THEN 'never_run'
    WHEN s.last_success_at < now() - make_interval(mins => s.poll_interval_minutes * 2) THEN 'stale'
    ELSE 'healthy'
  END AS health
FROM job_search.company_job_sources s
JOIN job_search.companies c ON c.id = s.company_id;

CREATE OR REPLACE VIEW job_search.discovery_run_summary
WITH (security_invoker = true)
AS
SELECT
  r.*,
  count(step.id) AS step_count,
  count(step.id) FILTER (WHERE step.status = 'failed') AS failed_step_count,
  count(step.id) FILTER (WHERE step.status = 'rate_limited') AS rate_limited_step_count
FROM job_search.discovery_runs r
LEFT JOIN job_search.discovery_run_steps step ON step.discovery_run_id = r.id
GROUP BY r.id;

GRANT SELECT ON job_search.canonical_job_sources TO anon, authenticated, service_role;
GRANT SELECT ON job_search.job_discovery_feed TO anon, authenticated, service_role;
GRANT SELECT ON job_search.discovery_profile_summary TO anon, authenticated, service_role;
GRANT SELECT ON job_search.source_health TO anon, authenticated, service_role;
GRANT SELECT ON job_search.discovery_run_summary TO anon, authenticated, service_role;

INSERT INTO job_search.settings (key, value)
VALUES ('discovery_schema_version', '{"version":2,"migrations":[12,13,14,15,16,17]}'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
