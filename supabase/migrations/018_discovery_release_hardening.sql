-- Job Discovery V2 release hardening: private control-plane reads, atomic budgets,
-- transactional ATS source writes, bounded query seeds, and aggregate lifecycle.

-- Discovery configuration and evidence are operator-only. Application reads use
-- a server-only service-role client after requireOperatorAccess().
DO $private_discovery$
DECLARE
  relation_name text;
BEGIN
  FOREACH relation_name IN ARRAY ARRAY[
    'search_profiles',
    'search_profile_queries',
    'company_job_sources',
    'search_profile_company_sources',
    'job_source_postings',
    'discovery_runs',
    'discovery_run_steps',
    'provider_rate_budgets',
    'scoring_configs',
    'job_scores'
  ] LOOP
    IF to_regclass(format('job_search.%I', relation_name)) IS NULL THEN
      CONTINUE;
    END IF;
    EXECUTE format('DROP POLICY IF EXISTS %I ON job_search.%I', 'client read access', relation_name);
    EXECUTE format('REVOKE ALL PRIVILEGES ON job_search.%I FROM anon, authenticated', relation_name);
    EXECUTE format('GRANT ALL PRIVILEGES ON job_search.%I TO service_role', relation_name);
  END LOOP;
END
$private_discovery$;

REVOKE ALL PRIVILEGES ON job_search.canonical_job_sources FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON job_search.job_discovery_feed FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON job_search.discovery_profile_summary FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON job_search.source_health FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON job_search.discovery_run_summary FROM anon, authenticated;
GRANT SELECT ON job_search.canonical_job_sources TO service_role;
GRANT SELECT ON job_search.job_discovery_feed TO service_role;
GRANT SELECT ON job_search.discovery_profile_summary TO service_role;
GRANT SELECT ON job_search.source_health TO service_role;
GRANT SELECT ON job_search.discovery_run_summary TO service_role;

-- Keep one enabled aggregator query per profile/provider by default. Operators
-- may add more deliberately after reviewing daily provider budgets.
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY search_profile_id, provider
           ORDER BY priority, created_at, id
         ) AS ordinal
  FROM job_search.search_profile_queries
  WHERE enabled
)
UPDATE job_search.search_profile_queries query
SET enabled = false,
    updated_at = now()
FROM ranked
WHERE ranked.id = query.id
  AND ranked.ordinal > 1;

CREATE OR REPLACE FUNCTION job_search.recompute_job_lifecycle(target_job_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = job_search, public
AS $$
DECLARE
  v_open integer := 0;
  v_unverified integer := 0;
  v_expired integer := 0;
  v_total integer := 0;
  v_next text;
BEGIN
  SELECT
    count(*) FILTER (WHERE lifecycle_status = 'open'),
    count(*) FILTER (WHERE lifecycle_status = 'unverified'),
    count(*) FILTER (WHERE lifecycle_status = 'expired'),
    count(*)
  INTO v_open, v_unverified, v_expired, v_total
  FROM job_source_postings
  WHERE job_id = target_job_id;

  v_next := CASE
    WHEN v_open > 0 THEN 'open'
    WHEN v_unverified > 0 THEN 'unverified'
    WHEN v_total > 0 AND v_expired = v_total THEN 'expired'
    ELSE 'closed'
  END;

  UPDATE jobs
  SET lifecycle_status = v_next,
      closed_at = CASE WHEN v_next IN ('closed', 'expired') THEN coalesce(closed_at, now()) ELSE NULL END,
      last_verified_at = (SELECT max(last_verified_at) FROM job_source_postings WHERE job_id = target_job_id),
      last_seen_at = (SELECT max(last_seen_at) FROM job_source_postings WHERE job_id = target_job_id),
      source_count = v_total
  WHERE id = target_job_id;
END;
$$;

REVOKE ALL ON FUNCTION job_search.recompute_job_lifecycle(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION job_search.recompute_job_lifecycle(uuid) TO service_role;

CREATE OR REPLACE FUNCTION job_search.reserve_provider_requests(
  p_provider text,
  p_minute_bucket_start timestamptz,
  p_minute_limit integer,
  p_minute_reserved integer,
  p_minute_reset_at timestamptz,
  p_daily_bucket_start timestamptz,
  p_daily_limit integer,
  p_daily_reserved integer,
  p_daily_reset_at timestamptz,
  p_manual boolean DEFAULT false
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = job_search, public
AS $$
DECLARE
  v_minute provider_rate_budgets%ROWTYPE;
  v_daily provider_rate_budgets%ROWTYPE;
  v_minute_usable integer;
  v_daily_usable integer;
BEGIN
  INSERT INTO provider_rate_budgets(provider, bucket_type, bucket_start, request_limit, requests_used, reserved_requests, reset_at)
  VALUES
    (p_provider, 'minute', p_minute_bucket_start, p_minute_limit, 0, p_minute_reserved, p_minute_reset_at),
    (p_provider, 'daily', p_daily_bucket_start, p_daily_limit, 0, p_daily_reserved, p_daily_reset_at)
  ON CONFLICT (provider, bucket_type, bucket_start)
  DO UPDATE SET request_limit = EXCLUDED.request_limit,
                reserved_requests = EXCLUDED.reserved_requests,
                reset_at = EXCLUDED.reset_at,
                updated_at = now();

  SELECT * INTO v_daily
  FROM provider_rate_budgets
  WHERE provider = p_provider AND bucket_type = 'daily' AND bucket_start = p_daily_bucket_start
  FOR UPDATE;

  SELECT * INTO v_minute
  FROM provider_rate_budgets
  WHERE provider = p_provider AND bucket_type = 'minute' AND bucket_start = p_minute_bucket_start
  FOR UPDATE;

  v_minute_usable := CASE WHEN p_manual THEN v_minute.request_limit ELSE greatest(0, v_minute.request_limit - v_minute.reserved_requests) END;
  v_daily_usable := CASE WHEN p_manual THEN v_daily.request_limit ELSE greatest(0, v_daily.request_limit - v_daily.reserved_requests) END;

  IF v_minute.requests_used >= v_minute_usable OR v_daily.requests_used >= v_daily_usable THEN
    RETURN false;
  END IF;

  UPDATE provider_rate_budgets
  SET requests_used = requests_used + 1, updated_at = now()
  WHERE provider = p_provider
    AND ((bucket_type = 'minute' AND bucket_start = p_minute_bucket_start)
      OR (bucket_type = 'daily' AND bucket_start = p_daily_bucket_start));

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION job_search.reserve_provider_requests(text,timestamptz,integer,integer,timestamptz,timestamptz,integer,integer,timestamptz,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION job_search.reserve_provider_requests(text,timestamptz,integer,integer,timestamptz,timestamptz,integer,integer,timestamptz,boolean) TO service_role;

CREATE OR REPLACE FUNCTION job_search.save_company_job_source(
  p_source_id uuid,
  p_company_id uuid,
  p_new_company_name text,
  p_provider text,
  p_board_key text,
  p_careers_url text,
  p_api_base_url text,
  p_enabled boolean,
  p_priority integer,
  p_poll_interval_minutes integer,
  p_profile_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = job_search, public
AS $$
DECLARE
  v_company_id uuid := p_company_id;
  v_source_id uuid := p_source_id;
BEGIN
  IF v_company_id IS NULL THEN
    IF nullif(trim(coalesce(p_new_company_name, '')), '') IS NULL THEN
      RAISE EXCEPTION 'A company is required';
    END IF;
    SELECT id INTO v_company_id FROM companies
    WHERE normalize_discovery_text(name) = normalize_discovery_text(p_new_company_name)
    ORDER BY created_at, id LIMIT 1;
    IF v_company_id IS NULL THEN
      INSERT INTO companies(name) VALUES (trim(p_new_company_name)) RETURNING id INTO v_company_id;
    END IF;
  END IF;

  IF v_source_id IS NULL THEN
    INSERT INTO company_job_sources(
      company_id, provider, board_key, careers_url, api_base_url,
      enabled, priority, poll_interval_minutes, last_error, consecutive_failures
    ) VALUES (
      v_company_id, p_provider, p_board_key, p_careers_url, p_api_base_url,
      p_enabled, p_priority, p_poll_interval_minutes, NULL, 0
    ) RETURNING id INTO v_source_id;
  ELSE
    UPDATE company_job_sources
    SET company_id = v_company_id,
        provider = p_provider,
        board_key = p_board_key,
        careers_url = p_careers_url,
        api_base_url = p_api_base_url,
        enabled = p_enabled,
        priority = p_priority,
        poll_interval_minutes = p_poll_interval_minutes,
        last_error = NULL,
        consecutive_failures = 0
    WHERE id = v_source_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'ATS source not found'; END IF;
  END IF;

  DELETE FROM search_profile_company_sources WHERE company_job_source_id = v_source_id;
  INSERT INTO search_profile_company_sources(search_profile_id, company_job_source_id, enabled, weight)
  SELECT DISTINCT profile_id, v_source_id, true, 1
  FROM unnest(coalesce(p_profile_ids, ARRAY[]::uuid[])) AS profile_id;

  RETURN v_source_id;
END;
$$;

REVOKE ALL ON FUNCTION job_search.save_company_job_source(uuid,uuid,text,text,text,text,text,boolean,integer,integer,uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION job_search.save_company_job_source(uuid,uuid,text,text,text,text,text,boolean,integer,integer,uuid[]) TO service_role;

CREATE OR REPLACE VIEW job_search.discovery_profile_summary
WITH (security_invoker = true)
AS
SELECT
  profile.id,
  profile.name,
  profile.slug,
  profile.enabled,
  profile.priority,
  coalesce(query_totals.query_count, 0) AS query_count,
  coalesce(source_totals.company_source_count, 0) AS company_source_count,
  coalesce(score_totals.matched_job_count, 0) AS matched_job_count,
  query_totals.last_query_run_at
FROM job_search.search_profiles profile
LEFT JOIN LATERAL (
  SELECT count(*) AS query_count, max(last_run_at) AS last_query_run_at
  FROM job_search.search_profile_queries query
  WHERE query.search_profile_id = profile.id
) query_totals ON true
LEFT JOIN LATERAL (
  SELECT count(*) AS company_source_count
  FROM job_search.search_profile_company_sources link
  WHERE link.search_profile_id = profile.id AND link.enabled
) source_totals ON true
LEFT JOIN LATERAL (
  SELECT count(DISTINCT score.job_id) FILTER (WHERE NOT score.hard_disqualified) AS matched_job_count
  FROM job_search.job_scores score
  WHERE score.search_profile_id = profile.id
) score_totals ON true;

REVOKE ALL PRIVILEGES ON job_search.discovery_profile_summary FROM anon, authenticated;
GRANT SELECT ON job_search.discovery_profile_summary TO service_role;

UPDATE job_search.settings
SET value = '{"version":3,"migrations":[12,13,14,15,16,17,18]}'::jsonb,
    updated_at = now()
WHERE key = 'discovery_schema_version';
