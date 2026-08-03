-- Job Discovery V2: canonical jobs and source-specific posting observations.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE job_search.jobs
  ADD COLUMN IF NOT EXISTS canonical_key text,
  ADD COLUMN IF NOT EXISTS normalized_title text,
  ADD COLUMN IF NOT EXISTS normalized_company text,
  ADD COLUMN IF NOT EXISTS normalized_location text,
  ADD COLUMN IF NOT EXISTS employment_type text,
  ADD COLUMN IF NOT EXISTS seniority text,
  ADD COLUMN IF NOT EXISTS remote_type text CHECK (remote_type IS NULL OR remote_type IN ('remote','hybrid','onsite','unknown')),
  ADD COLUMN IF NOT EXISTS salary_min numeric,
  ADD COLUMN IF NOT EXISTS salary_max numeric,
  ADD COLUMN IF NOT EXISTS salary_currency text,
  ADD COLUMN IF NOT EXISTS first_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS lifecycle_status text NOT NULL DEFAULT 'open'
    CHECK (lifecycle_status IN ('open','unverified','closed','expired')),
  ADD COLUMN IF NOT EXISTS preferred_source text,
  ADD COLUMN IF NOT EXISTS source_count integer NOT NULL DEFAULT 1 CHECK (source_count >= 0),
  ADD COLUMN IF NOT EXISTS content_hash text,
  ADD COLUMN IF NOT EXISTS description_changed_at timestamptz,
  ADD COLUMN IF NOT EXISTS canonicalization_version integer NOT NULL DEFAULT 1;

ALTER TABLE job_search.jobs DROP CONSTRAINT IF EXISTS jobs_source_check;
ALTER TABLE job_search.jobs ADD CONSTRAINT jobs_source_check CHECK (
  source IN (
    'indeed','ziprecruiter','manual','adzuna','linkedin','remoteok',
    'greenhouse','lever','ashby','smartrecruiters'
  )
);

CREATE TABLE IF NOT EXISTS job_search.job_source_postings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES job_search.jobs(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (
    source IN (
      'indeed','ziprecruiter','manual','adzuna','linkedin','remoteok',
      'greenhouse','lever','ashby','smartrecruiters'
    )
  ),
  external_id text NOT NULL,
  company_job_source_id uuid REFERENCES job_search.company_job_sources(id) ON DELETE SET NULL,
  search_profile_id uuid REFERENCES job_search.search_profiles(id) ON DELETE SET NULL,
  source_url text,
  apply_url text,
  raw_title text NOT NULL,
  raw_company_name text NOT NULL,
  raw_location text,
  raw_description text,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  posted_at timestamptz,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  last_verified_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz,
  lifecycle_status text NOT NULL DEFAULT 'open'
    CHECK (lifecycle_status IN ('open','unverified','closed','expired')),
  missed_snapshots integer NOT NULL DEFAULT 0 CHECK (missed_snapshots >= 0),
  content_hash text,
  etag text,
  last_modified text,
  is_primary boolean NOT NULL DEFAULT false,
  canonical_match_confidence numeric(5,4) NOT NULL DEFAULT 1 CHECK (canonical_match_confidence BETWEEN 0 AND 1),
  canonical_match_method text NOT NULL DEFAULT 'source_identity',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_job_source_postings_identity
  ON job_search.job_source_postings (
    source,
    external_id,
    COALESCE(company_job_source_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );
CREATE INDEX IF NOT EXISTS idx_job_source_postings_job
  ON job_search.job_source_postings (job_id, lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_job_source_postings_registry
  ON job_search.job_source_postings (company_job_source_id, lifecycle_status, external_id);
CREATE INDEX IF NOT EXISTS idx_job_source_postings_profile
  ON job_search.job_source_postings (search_profile_id, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_source_postings_verification
  ON job_search.job_source_postings (lifecycle_status, last_verified_at);
CREATE INDEX IF NOT EXISTS idx_jobs_canonical_key
  ON job_search.jobs (canonical_key);
CREATE INDEX IF NOT EXISTS idx_jobs_lifecycle
  ON job_search.jobs (lifecycle_status, last_verified_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_normalized_title
  ON job_search.jobs USING gin (normalized_title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_jobs_normalized_company
  ON job_search.jobs USING gin (normalized_company gin_trgm_ops);

DROP TRIGGER IF EXISTS job_source_postings_updated_at ON job_search.job_source_postings;
CREATE TRIGGER job_source_postings_updated_at
  BEFORE UPDATE ON job_search.job_source_postings
  FOR EACH ROW EXECUTE FUNCTION job_search.update_updated_at_column();

ALTER TABLE job_search.job_source_postings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "client read access" ON job_search.job_source_postings;
CREATE POLICY "client read access" ON job_search.job_source_postings
  FOR SELECT TO anon, authenticated USING (true);
GRANT SELECT ON job_search.job_source_postings TO anon, authenticated;
GRANT ALL PRIVILEGES ON job_search.job_source_postings TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA job_search TO service_role;
