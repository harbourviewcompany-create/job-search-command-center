-- Job Discovery V2: run history, provider steps, and explicit request budgets.

CREATE TABLE IF NOT EXISTS job_search.discovery_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_type text NOT NULL DEFAULT 'scheduled'
    CHECK (trigger_type IN ('scheduled','manual','profile','company','verification')),
  requested_profile_id uuid REFERENCES job_search.search_profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'running'
    CHECK (status IN ('queued','running','completed','partial','failed','cancelled')),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  providers_attempted text[] NOT NULL DEFAULT '{}',
  requests_used integer NOT NULL DEFAULT 0,
  postings_fetched integer NOT NULL DEFAULT 0,
  canonical_jobs_created integer NOT NULL DEFAULT 0,
  canonical_jobs_updated integer NOT NULL DEFAULT 0,
  postings_merged integer NOT NULL DEFAULT 0,
  jobs_closed integer NOT NULL DEFAULT 0,
  jobs_reopened integer NOT NULL DEFAULT 0,
  errors_count integer NOT NULL DEFAULT 0,
  budget_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_summary text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS job_search.discovery_run_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discovery_run_id uuid NOT NULL REFERENCES job_search.discovery_runs(id) ON DELETE CASCADE,
  provider text NOT NULL,
  search_profile_id uuid REFERENCES job_search.search_profiles(id) ON DELETE SET NULL,
  search_profile_query_id uuid REFERENCES job_search.search_profile_queries(id) ON DELETE SET NULL,
  company_job_source_id uuid REFERENCES job_search.company_job_sources(id) ON DELETE SET NULL,
  page_number integer,
  cursor text,
  request_started_at timestamptz NOT NULL DEFAULT now(),
  request_finished_at timestamptz,
  http_status integer,
  results_received integer NOT NULL DEFAULT 0,
  new_jobs integer NOT NULL DEFAULT 0,
  updated_jobs integer NOT NULL DEFAULT 0,
  merged_postings integer NOT NULL DEFAULT 0,
  rate_limit_remaining integer,
  retry_after_seconds integer,
  status text NOT NULL DEFAULT 'running'
    CHECK (status IN ('queued','running','completed','skipped','failed','rate_limited')),
  error text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS job_search.provider_rate_budgets (
  provider text NOT NULL,
  bucket_type text NOT NULL CHECK (bucket_type IN ('minute','day','week','month')),
  bucket_start timestamptz NOT NULL,
  request_limit integer NOT NULL CHECK (request_limit > 0),
  requests_used integer NOT NULL DEFAULT 0 CHECK (requests_used >= 0),
  reserved_requests integer NOT NULL DEFAULT 0 CHECK (reserved_requests >= 0),
  reset_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, bucket_type, bucket_start)
);

CREATE INDEX IF NOT EXISTS idx_discovery_runs_started
  ON job_search.discovery_runs (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_discovery_runs_status
  ON job_search.discovery_runs (status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_discovery_run_steps_run
  ON job_search.discovery_run_steps (discovery_run_id, request_started_at);
CREATE INDEX IF NOT EXISTS idx_discovery_run_steps_provider
  ON job_search.discovery_run_steps (provider, status, request_started_at DESC);
CREATE INDEX IF NOT EXISTS idx_provider_rate_budgets_reset
  ON job_search.provider_rate_budgets (provider, reset_at);

DO $read_policies$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'discovery_runs', 'discovery_run_steps', 'provider_rate_budgets'
  ] LOOP
    EXECUTE format('ALTER TABLE job_search.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON job_search.%I', 'client read access', table_name);
    EXECUTE format('CREATE POLICY %I ON job_search.%I FOR SELECT TO anon, authenticated USING (true)', 'client read access', table_name);
    EXECUTE format('GRANT SELECT ON job_search.%I TO anon, authenticated', table_name);
    EXECUTE format('GRANT ALL PRIVILEGES ON job_search.%I TO service_role', table_name);
  END LOOP;
END
$read_policies$;

INSERT INTO job_search.provider_rate_budgets (
  provider, bucket_type, bucket_start, request_limit, requests_used, reserved_requests, reset_at
) VALUES
  ('adzuna', 'minute', date_trunc('minute', now()), 25, 0, 2, date_trunc('minute', now()) + interval '1 minute'),
  ('adzuna', 'day', date_trunc('day', now()), 250, 0, 20, date_trunc('day', now()) + interval '1 day')
ON CONFLICT DO NOTHING;
