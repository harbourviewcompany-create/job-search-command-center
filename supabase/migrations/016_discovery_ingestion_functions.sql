-- Job Discovery V2: deterministic normalization, canonical ingestion, lifecycle, and budget RPCs.

CREATE OR REPLACE FUNCTION job_search.normalize_discovery_text(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT trim(regexp_replace(lower(unaccent(coalesce(value, ''))), '[^a-z0-9+#.]+', ' ', 'g'));
$$;

CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE OR REPLACE FUNCTION job_search.discovery_canonical_key(
  company_name text,
  job_title text,
  job_location text,
  posted_at timestamptz,
  apply_url text DEFAULT NULL
)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT encode(
    digest(
      CASE
        WHEN nullif(trim(coalesce(apply_url, '')), '') IS NOT NULL THEN
          'url|' || regexp_replace(lower(apply_url), '[?#].*$', '')
        ELSE
          'job|' || job_search.normalize_discovery_text(company_name) || '|' ||
          job_search.normalize_discovery_text(job_title) || '|' ||
          job_search.normalize_discovery_text(job_location) || '|' ||
          coalesce(to_char(date_trunc('week', posted_at), 'YYYY-MM-DD'), 'unknown')
      END,
      'sha256'
    ),
    'hex'
  );
$$;

CREATE OR REPLACE FUNCTION job_search.recompute_job_lifecycle(target_job_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = job_search, public
AS $$
DECLARE
  open_count integer;
  unverified_count integer;
  active_count integer;
  previous_status text;
  next_status text;
BEGIN
  SELECT lifecycle_status INTO previous_status
  FROM jobs WHERE id = target_job_id FOR UPDATE;

  SELECT
    count(*) FILTER (WHERE lifecycle_status = 'open'),
    count(*) FILTER (WHERE lifecycle_status = 'unverified'),
    count(*) FILTER (WHERE lifecycle_status IN ('open','unverified'))
  INTO open_count, unverified_count, active_count
  FROM job_source_postings
  WHERE job_id = target_job_id;

  next_status := CASE
    WHEN open_count > 0 THEN 'open'
    WHEN unverified_count > 0 THEN 'unverified'
    WHEN active_count = 0 THEN 'closed'
    ELSE 'expired'
  END;

  UPDATE jobs
  SET lifecycle_status = next_status,
      closed_at = CASE WHEN next_status IN ('closed','expired') THEN coalesce(closed_at, now()) ELSE NULL END,
      last_verified_at = (
        SELECT max(last_verified_at) FROM job_source_postings WHERE job_id = target_job_id
      ),
      last_seen_at = (
        SELECT max(last_seen_at) FROM job_source_postings WHERE job_id = target_job_id
      ),
      source_count = (
        SELECT count(*)::integer FROM job_source_postings WHERE job_id = target_job_id
      )
  WHERE id = target_job_id;
END;
$$;

CREATE OR REPLACE FUNCTION job_search.ingest_job_source_posting(
  p_source text,
  p_external_id text,
  p_company_name text,
  p_title text,
  p_location text DEFAULT NULL,
  p_remote boolean DEFAULT false,
  p_description text DEFAULT NULL,
  p_source_url text DEFAULT NULL,
  p_apply_url text DEFAULT NULL,
  p_posted_at timestamptz DEFAULT NULL,
  p_employment_type text DEFAULT NULL,
  p_seniority text DEFAULT NULL,
  p_remote_type text DEFAULT NULL,
  p_salary_min numeric DEFAULT NULL,
  p_salary_max numeric DEFAULT NULL,
  p_salary_currency text DEFAULT NULL,
  p_company_job_source_id uuid DEFAULT NULL,
  p_search_profile_id uuid DEFAULT NULL,
  p_content_hash text DEFAULT NULL,
  p_raw_payload jsonb DEFAULT '{}'::jsonb,
  p_verified_at timestamptz DEFAULT now()
)
RETURNS TABLE(job_id uuid, source_posting_id uuid, ingest_action text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = job_search, public
AS $$
DECLARE
  resolved_company_id uuid;
  resolved_job_id uuid;
  resolved_posting_id uuid;
  existing_posting record;
  canonical_value text;
  normalized_title_value text;
  normalized_company_value text;
  normalized_location_value text;
  primary_source text;
  source_rank integer;
  current_rank integer;
BEGIN
  IF p_external_id IS NULL OR trim(p_external_id) = '' THEN
    RAISE EXCEPTION 'external_id is required';
  END IF;
  IF p_company_name IS NULL OR trim(p_company_name) = '' THEN
    RAISE EXCEPTION 'company_name is required';
  END IF;
  IF p_title IS NULL OR trim(p_title) = '' THEN
    RAISE EXCEPTION 'title is required';
  END IF;

  normalized_title_value := job_search.normalize_discovery_text(p_title);
  normalized_company_value := job_search.normalize_discovery_text(p_company_name);
  normalized_location_value := job_search.normalize_discovery_text(p_location);
  canonical_value := job_search.discovery_canonical_key(
    p_company_name, p_title, p_location, p_posted_at, p_apply_url
  );

  SELECT id INTO resolved_company_id
  FROM companies
  WHERE job_search.normalize_discovery_text(name) = normalized_company_value
  ORDER BY created_at
  LIMIT 1;

  IF resolved_company_id IS NULL THEN
    INSERT INTO companies(name)
    VALUES (trim(p_company_name))
    RETURNING id INTO resolved_company_id;
  END IF;

  SELECT * INTO existing_posting
  FROM job_source_postings
  WHERE source = p_source
    AND external_id = p_external_id
    AND company_job_source_id IS NOT DISTINCT FROM p_company_job_source_id
  LIMIT 1
  FOR UPDATE;

  IF existing_posting.id IS NOT NULL THEN
    UPDATE job_source_postings
    SET search_profile_id = coalesce(p_search_profile_id, search_profile_id),
        source_url = coalesce(p_source_url, source_url),
        apply_url = coalesce(p_apply_url, apply_url),
        raw_title = p_title,
        raw_company_name = p_company_name,
        raw_location = p_location,
        raw_description = p_description,
        raw_payload = coalesce(p_raw_payload, '{}'::jsonb),
        posted_at = coalesce(p_posted_at, posted_at),
        last_seen_at = p_verified_at,
        last_verified_at = p_verified_at,
        removed_at = NULL,
        lifecycle_status = 'open',
        missed_snapshots = 0,
        content_hash = coalesce(p_content_hash, content_hash)
    WHERE id = existing_posting.id
    RETURNING id, job_source_postings.job_id INTO resolved_posting_id, resolved_job_id;

    UPDATE jobs
    SET title = p_title,
        company_id = resolved_company_id,
        location = p_location,
        remote = p_remote,
        description = coalesce(p_description, description),
        url = coalesce(p_apply_url, p_source_url, url),
        posted_at = coalesce(p_posted_at::date, posted_at),
        fetched_at = p_verified_at,
        employment_type = coalesce(p_employment_type, employment_type),
        seniority = coalesce(p_seniority, seniority),
        remote_type = coalesce(p_remote_type, remote_type),
        salary_min = coalesce(p_salary_min, salary_min),
        salary_max = coalesce(p_salary_max, salary_max),
        salary_currency = coalesce(p_salary_currency, salary_currency),
        normalized_title = normalized_title_value,
        normalized_company = normalized_company_value,
        normalized_location = normalized_location_value,
        last_seen_at = p_verified_at,
        last_verified_at = p_verified_at,
        lifecycle_status = 'open',
        closed_at = NULL,
        description_changed_at = CASE
          WHEN p_content_hash IS DISTINCT FROM content_hash THEN p_verified_at
          ELSE description_changed_at
        END,
        content_hash = coalesce(p_content_hash, content_hash)
    WHERE id = resolved_job_id;

    PERFORM job_search.recompute_job_lifecycle(resolved_job_id);
    RETURN QUERY SELECT resolved_job_id, resolved_posting_id, 'updated'::text;
    RETURN;
  END IF;

  SELECT id INTO resolved_job_id
  FROM jobs
  WHERE canonical_key = canonical_value
  ORDER BY first_seen_at NULLS LAST, fetched_at
  LIMIT 1
  FOR UPDATE;

  IF resolved_job_id IS NULL THEN
    INSERT INTO jobs (
      source, external_id, title, company_id, location, remote, job_type,
      description, url, posted_at, fetched_at, status,
      canonical_key, normalized_title, normalized_company, normalized_location,
      employment_type, seniority, remote_type, salary_min, salary_max,
      salary_currency, first_seen_at, last_seen_at, last_verified_at,
      lifecycle_status, preferred_source, source_count, content_hash,
      canonicalization_version
    ) VALUES (
      p_source, p_external_id, p_title, resolved_company_id, p_location, p_remote,
      p_employment_type, p_description, coalesce(p_apply_url, p_source_url),
      p_posted_at::date, p_verified_at, 'found',
      canonical_value, normalized_title_value, normalized_company_value,
      normalized_location_value, p_employment_type, p_seniority,
      coalesce(p_remote_type, CASE WHEN p_remote THEN 'remote' ELSE 'unknown' END),
      p_salary_min, p_salary_max, p_salary_currency,
      p_verified_at, p_verified_at, p_verified_at,
      'open', p_source, 1, p_content_hash, 1
    ) RETURNING id INTO resolved_job_id;
    ingest_action := 'created';
  ELSE
    ingest_action := 'merged';
  END IF;

  INSERT INTO job_source_postings (
    job_id, source, external_id, company_job_source_id, search_profile_id,
    source_url, apply_url, raw_title, raw_company_name, raw_location,
    raw_description, raw_payload, posted_at, first_seen_at, last_seen_at,
    last_verified_at, lifecycle_status, content_hash,
    canonical_match_confidence, canonical_match_method
  ) VALUES (
    resolved_job_id, p_source, p_external_id, p_company_job_source_id,
    p_search_profile_id, p_source_url, p_apply_url, p_title, p_company_name,
    p_location, p_description, coalesce(p_raw_payload, '{}'::jsonb), p_posted_at,
    p_verified_at, p_verified_at, p_verified_at, 'open', p_content_hash,
    CASE WHEN ingest_action = 'created' THEN 1 ELSE 0.9 END,
    CASE WHEN ingest_action = 'created' THEN 'created' ELSE 'canonical_key' END
  ) RETURNING id INTO resolved_posting_id;

  source_rank := CASE p_source
    WHEN 'greenhouse' THEN 100 WHEN 'lever' THEN 100 WHEN 'ashby' THEN 100
    WHEN 'smartrecruiters' THEN 100 WHEN 'manual' THEN 90 WHEN 'linkedin' THEN 80
    WHEN 'adzuna' THEN 60 WHEN 'remoteok' THEN 50 ELSE 40 END;

  SELECT preferred_source INTO primary_source FROM jobs WHERE id = resolved_job_id;
  current_rank := CASE primary_source
    WHEN 'greenhouse' THEN 100 WHEN 'lever' THEN 100 WHEN 'ashby' THEN 100
    WHEN 'smartrecruiters' THEN 100 WHEN 'manual' THEN 90 WHEN 'linkedin' THEN 80
    WHEN 'adzuna' THEN 60 WHEN 'remoteok' THEN 50 ELSE 40 END;

  UPDATE jobs
  SET first_seen_at = coalesce(first_seen_at, p_verified_at),
      last_seen_at = greatest(coalesce(last_seen_at, p_verified_at), p_verified_at),
      last_verified_at = greatest(coalesce(last_verified_at, p_verified_at), p_verified_at),
      lifecycle_status = 'open',
      closed_at = NULL,
      source_count = (SELECT count(*)::integer FROM job_source_postings WHERE job_id = resolved_job_id),
      preferred_source = CASE WHEN source_rank > current_rank THEN p_source ELSE coalesce(preferred_source, p_source) END,
      url = CASE WHEN source_rank > current_rank THEN coalesce(p_apply_url, p_source_url, url) ELSE url END,
      description = CASE WHEN source_rank > current_rank AND p_description IS NOT NULL THEN p_description ELSE description END,
      content_hash = coalesce(p_content_hash, content_hash)
  WHERE id = resolved_job_id;

  UPDATE job_source_postings
  SET is_primary = (source = (SELECT preferred_source FROM jobs WHERE id = resolved_job_id))
  WHERE job_source_postings.job_id = resolved_job_id;

  RETURN QUERY SELECT resolved_job_id, resolved_posting_id, ingest_action;
END;
$$;

CREATE OR REPLACE FUNCTION job_search.mark_source_snapshot_complete(
  p_company_job_source_id uuid,
  p_observed_external_ids text[],
  p_complete boolean DEFAULT true,
  p_verified_at timestamptz DEFAULT now()
)
RETURNS TABLE(closed_postings integer, reopened_postings integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = job_search, public
AS $$
DECLARE
  affected_job uuid;
  closed_count integer := 0;
  reopened_count integer := 0;
BEGIN
  IF NOT p_complete THEN
    UPDATE company_job_sources
    SET last_checked_at = p_verified_at
    WHERE id = p_company_job_source_id;
    RETURN QUERY SELECT 0, 0;
    RETURN;
  END IF;

  WITH reopened AS (
    UPDATE job_source_postings
    SET lifecycle_status = 'open', missed_snapshots = 0, removed_at = NULL,
        last_seen_at = p_verified_at, last_verified_at = p_verified_at
    WHERE company_job_source_id = p_company_job_source_id
      AND external_id = ANY(coalesce(p_observed_external_ids, ARRAY[]::text[]))
      AND lifecycle_status <> 'open'
    RETURNING 1
  ) SELECT count(*) INTO reopened_count FROM reopened;

  UPDATE job_source_postings
  SET missed_snapshots = 0,
      lifecycle_status = 'open',
      removed_at = NULL,
      last_seen_at = p_verified_at,
      last_verified_at = p_verified_at
  WHERE company_job_source_id = p_company_job_source_id
    AND external_id = ANY(coalesce(p_observed_external_ids, ARRAY[]::text[]));

  WITH changed AS (
    UPDATE job_source_postings
    SET missed_snapshots = missed_snapshots + 1,
        lifecycle_status = CASE WHEN missed_snapshots + 1 >= 2 THEN 'closed' ELSE 'unverified' END,
        removed_at = CASE WHEN missed_snapshots + 1 >= 2 THEN p_verified_at ELSE removed_at END,
        last_verified_at = p_verified_at
    WHERE company_job_source_id = p_company_job_source_id
      AND NOT (external_id = ANY(coalesce(p_observed_external_ids, ARRAY[]::text[])))
      AND lifecycle_status IN ('open','unverified')
    RETURNING lifecycle_status
  ) SELECT count(*) FILTER (WHERE lifecycle_status = 'closed') INTO closed_count FROM changed;

  FOR affected_job IN
    SELECT DISTINCT job_id FROM job_source_postings
    WHERE company_job_source_id = p_company_job_source_id
  LOOP
    PERFORM job_search.recompute_job_lifecycle(affected_job);
  END LOOP;

  UPDATE company_job_sources
  SET last_checked_at = p_verified_at,
      last_success_at = p_verified_at,
      last_error = NULL,
      consecutive_failures = 0,
      active_job_count = (
        SELECT count(*)::integer FROM job_source_postings
        WHERE company_job_source_id = p_company_job_source_id
          AND lifecycle_status = 'open'
      )
  WHERE id = p_company_job_source_id;

  RETURN QUERY SELECT closed_count, reopened_count;
END;
$$;

CREATE OR REPLACE FUNCTION job_search.expire_stale_aggregator_postings(
  p_max_age interval DEFAULT interval '60 days',
  p_verified_at timestamptz DEFAULT now()
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = job_search, public
AS $$
DECLARE
  changed_count integer;
  affected_job uuid;
BEGIN
  WITH changed AS (
    UPDATE job_source_postings
    SET lifecycle_status = 'expired', removed_at = coalesce(removed_at, p_verified_at)
    WHERE source IN ('adzuna','remoteok','indeed','ziprecruiter')
      AND lifecycle_status IN ('open','unverified')
      AND last_seen_at < p_verified_at - p_max_age
    RETURNING job_id
  ) SELECT count(*) INTO changed_count FROM changed;

  FOR affected_job IN
    SELECT DISTINCT job_id FROM job_source_postings
    WHERE source IN ('adzuna','remoteok','indeed','ziprecruiter')
      AND lifecycle_status = 'expired'
  LOOP
    PERFORM job_search.recompute_job_lifecycle(affected_job);
  END LOOP;

  RETURN changed_count;
END;
$$;

CREATE OR REPLACE FUNCTION job_search.reserve_provider_request(
  p_provider text,
  p_bucket_type text,
  p_bucket_start timestamptz,
  p_request_limit integer,
  p_reserved_requests integer,
  p_reset_at timestamptz,
  p_manual boolean DEFAULT false
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = job_search, public
AS $$
DECLARE
  budget_row provider_rate_budgets%ROWTYPE;
  usable_limit integer;
BEGIN
  INSERT INTO provider_rate_budgets (
    provider, bucket_type, bucket_start, request_limit, requests_used,
    reserved_requests, reset_at
  ) VALUES (
    p_provider, p_bucket_type, p_bucket_start, p_request_limit, 0,
    p_reserved_requests, p_reset_at
  ) ON CONFLICT (provider, bucket_type, bucket_start)
  DO UPDATE SET request_limit = EXCLUDED.request_limit,
                reserved_requests = EXCLUDED.reserved_requests,
                reset_at = EXCLUDED.reset_at,
                updated_at = now();

  SELECT * INTO budget_row
  FROM provider_rate_budgets
  WHERE provider = p_provider
    AND bucket_type = p_bucket_type
    AND bucket_start = p_bucket_start
  FOR UPDATE;

  usable_limit := CASE
    WHEN p_manual THEN budget_row.request_limit
    ELSE greatest(0, budget_row.request_limit - budget_row.reserved_requests)
  END;

  IF budget_row.requests_used >= usable_limit THEN
    RETURN false;
  END IF;

  UPDATE provider_rate_budgets
  SET requests_used = requests_used + 1, updated_at = now()
  WHERE provider = p_provider
    AND bucket_type = p_bucket_type
    AND bucket_start = p_bucket_start;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION job_search.ingest_job_source_posting(text,text,text,text,text,boolean,text,text,text,timestamptz,text,text,text,numeric,numeric,text,uuid,uuid,text,jsonb,timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION job_search.mark_source_snapshot_complete(uuid,text[],boolean,timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION job_search.expire_stale_aggregator_postings(interval,timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION job_search.reserve_provider_request(text,text,timestamptz,integer,integer,timestamptz,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION job_search.ingest_job_source_posting(text,text,text,text,text,boolean,text,text,text,timestamptz,text,text,text,numeric,numeric,text,uuid,uuid,text,jsonb,timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION job_search.mark_source_snapshot_complete(uuid,text[],boolean,timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION job_search.expire_stale_aggregator_postings(interval,timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION job_search.reserve_provider_request(text,text,timestamptz,integer,integer,timestamptz,boolean) TO service_role;
