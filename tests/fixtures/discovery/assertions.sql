\set ON_ERROR_STOP on
SET search_path = job_search, public;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM jobs WHERE id = '00000000-0000-0000-0000-000000000101'
  ) THEN
    RAISE EXCEPTION 'Legacy job ID was not preserved';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM applications
    WHERE id = '00000000-0000-0000-0000-000000000201'
      AND job_id = '00000000-0000-0000-0000-000000000101'
  ) THEN
    RAISE EXCEPTION 'Existing application relationship was not preserved';
  END IF;

  IF (SELECT count(*) FROM job_source_postings WHERE job_id = '00000000-0000-0000-0000-000000000101') <> 1 THEN
    RAISE EXCEPTION 'Legacy job was not backfilled to exactly one source posting';
  END IF;
END
$$;

INSERT INTO company_job_sources (
  id, company_id, provider, board_key, careers_url, enabled, priority
) VALUES (
  '00000000-0000-0000-0000-000000000301',
  '00000000-0000-0000-0000-000000000001',
  'greenhouse',
  'acme',
  'https://boards.greenhouse.io/acme',
  true,
  10
);

SELECT * FROM ingest_job_source_posting(
  p_source => 'greenhouse',
  p_external_id => 'greenhouse-101',
  p_company_name => 'Acme Markets',
  p_title => 'Strategic Partnerships Manager',
  p_location => 'Remote, Canada',
  p_remote => true,
  p_description => 'Own strategic alliances and channel partnerships.',
  p_source_url => 'https://boards.greenhouse.io/acme/jobs/101',
  p_apply_url => 'https://boards.greenhouse.io/acme/jobs/101',
  p_posted_at => '2026-08-01T10:00:00Z',
  p_employment_type => 'full_time',
  p_seniority => 'manager',
  p_remote_type => 'remote',
  p_salary_min => 110000,
  p_salary_max => 135000,
  p_salary_currency => 'CAD',
  p_company_job_source_id => '00000000-0000-0000-0000-000000000301',
  p_content_hash => 'greenhouse-content',
  p_raw_payload => '{"fixture":"greenhouse"}'::jsonb,
  p_verified_at => '2026-08-03T14:00:00Z'
);

SELECT * FROM ingest_job_source_posting(
  p_source => 'adzuna',
  p_external_id => 'adzuna-101',
  p_company_name => 'Acme Markets',
  p_title => 'Strategic Partnerships Manager',
  p_location => 'Remote, Canada',
  p_remote => true,
  p_description => 'Own strategic alliances and channel partnerships.',
  p_source_url => 'https://www.adzuna.ca/details/adzuna-101',
  p_apply_url => 'https://www.adzuna.ca/details/adzuna-101',
  p_posted_at => '2026-08-01T11:00:00Z',
  p_employment_type => 'full_time',
  p_seniority => 'manager',
  p_remote_type => 'remote',
  p_salary_min => 110000,
  p_salary_max => 135000,
  p_salary_currency => 'CAD',
  p_content_hash => 'adzuna-content',
  p_raw_payload => '{"fixture":"adzuna"}'::jsonb,
  p_verified_at => '2026-08-03T14:05:00Z'
);

DO $$
BEGIN
  IF (SELECT count(*) FROM jobs) <> 1 THEN
    RAISE EXCEPTION 'Cross-source canonicalization created duplicate jobs';
  END IF;

  IF (SELECT count(*) FROM job_source_postings) <> 3 THEN
    RAISE EXCEPTION 'Expected legacy, Greenhouse, and Adzuna source postings';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM jobs
    WHERE id = '00000000-0000-0000-0000-000000000101'
      AND preferred_source = 'greenhouse'
      AND source_count = 3
      AND lifecycle_status = 'open'
  ) THEN
    RAISE EXCEPTION 'Canonical job preference or source count is incorrect';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM applications
    WHERE id = '00000000-0000-0000-0000-000000000201'
      AND job_id = '00000000-0000-0000-0000-000000000101'
  ) THEN
    RAISE EXCEPTION 'Application relationship changed after canonical ingestion';
  END IF;
END
$$;

SELECT * FROM mark_source_snapshot_complete(
  '00000000-0000-0000-0000-000000000301',
  ARRAY[]::text[],
  true,
  '2026-08-04T14:00:00Z'
);
SELECT * FROM mark_source_snapshot_complete(
  '00000000-0000-0000-0000-000000000301',
  ARRAY[]::text[],
  true,
  '2026-08-05T14:00:00Z'
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM job_source_postings
    WHERE source = 'greenhouse'
      AND external_id = 'greenhouse-101'
      AND lifecycle_status = 'closed'
      AND missed_snapshots = 2
  ) THEN
    RAISE EXCEPTION 'Two-snapshot ATS closure rule failed';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM jobs
    WHERE id = '00000000-0000-0000-0000-000000000101'
      AND lifecycle_status = 'open'
  ) THEN
    RAISE EXCEPTION 'Canonical job closed while other sources remained active';
  END IF;
END
$$;

DO $$
DECLARE
  bucket timestamptz := date_trunc('day', now());
BEGIN
  IF NOT reserve_provider_request('fixture', 'day', bucket, 5, 2, bucket + interval '1 day', false) THEN
    RAISE EXCEPTION 'First automated budget reservation failed';
  END IF;
  IF NOT reserve_provider_request('fixture', 'day', bucket, 5, 2, bucket + interval '1 day', false) THEN
    RAISE EXCEPTION 'Second automated budget reservation failed';
  END IF;
  IF NOT reserve_provider_request('fixture', 'day', bucket, 5, 2, bucket + interval '1 day', false) THEN
    RAISE EXCEPTION 'Third automated budget reservation failed';
  END IF;
  IF reserve_provider_request('fixture', 'day', bucket, 5, 2, bucket + interval '1 day', false) THEN
    RAISE EXCEPTION 'Automated requests consumed the manual reserve';
  END IF;
  IF NOT reserve_provider_request('fixture', 'day', bucket, 5, 2, bucket + interval '1 day', true) THEN
    RAISE EXCEPTION 'Manual request could not use reserved capacity';
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass('job_search.job_discovery_feed') IS NULL THEN RAISE EXCEPTION 'job_discovery_feed view missing'; END IF;
  IF to_regclass('job_search.source_health') IS NULL THEN RAISE EXCEPTION 'source_health view missing'; END IF;
  IF to_regclass('job_search.discovery_run_summary') IS NULL THEN RAISE EXCEPTION 'discovery_run_summary view missing'; END IF;
  IF (SELECT value->>'version' FROM settings WHERE key = 'discovery_schema_version') <> '2' THEN
    RAISE EXCEPTION 'Discovery schema version marker missing';
  END IF;
END
$$;

SELECT json_build_object(
  'jobs', (SELECT count(*) FROM jobs),
  'source_postings', (SELECT count(*) FROM job_source_postings),
  'applications', (SELECT count(*) FROM applications),
  'profiles', (SELECT count(*) FROM search_profiles),
  'views_verified', true,
  'canonical_job_id', '00000000-0000-0000-0000-000000000101'
) AS migration_evidence;
