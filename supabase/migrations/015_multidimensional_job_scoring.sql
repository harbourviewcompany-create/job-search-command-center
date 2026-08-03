-- Job Discovery V2: versioned profile-specific scoring with explainable dimensions.

CREATE TABLE IF NOT EXISTS job_search.scoring_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  search_profile_id uuid NOT NULL REFERENCES job_search.search_profiles(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  enabled boolean NOT NULL DEFAULT true,
  weights jsonb NOT NULL DEFAULT '{
    "title":0.22,
    "responsibility":0.16,
    "experience":0.14,
    "industry":0.10,
    "seniority":0.08,
    "location":0.10,
    "compensation":0.05,
    "freshness":0.06,
    "company_priority":0.05,
    "source_quality":0.03,
    "application_effort":0.01
  }'::jsonb,
  thresholds jsonb NOT NULL DEFAULT '{"strong":75,"good":55,"review":40}'::jsonb,
  hard_rules jsonb NOT NULL DEFAULT '{
    "exclude_closed":true,
    "exclude_expired":true,
    "respect_excluded_terms":true,
    "respect_remote_policy":true,
    "respect_minimum_salary":true,
    "respect_maximum_age":true
  }'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (search_profile_id, version)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_scoring_configs_active
  ON job_search.scoring_configs (search_profile_id)
  WHERE enabled;

CREATE TABLE IF NOT EXISTS job_search.job_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES job_search.jobs(id) ON DELETE CASCADE,
  search_profile_id uuid NOT NULL REFERENCES job_search.search_profiles(id) ON DELETE CASCADE,
  scoring_config_id uuid NOT NULL REFERENCES job_search.scoring_configs(id) ON DELETE RESTRICT,
  scoring_version integer NOT NULL,
  overall_score numeric(5,2) NOT NULL CHECK (overall_score BETWEEN 0 AND 100),
  title_score numeric(5,2) NOT NULL DEFAULT 0 CHECK (title_score BETWEEN 0 AND 100),
  responsibility_score numeric(5,2) NOT NULL DEFAULT 0 CHECK (responsibility_score BETWEEN 0 AND 100),
  experience_score numeric(5,2) NOT NULL DEFAULT 0 CHECK (experience_score BETWEEN 0 AND 100),
  industry_score numeric(5,2) NOT NULL DEFAULT 0 CHECK (industry_score BETWEEN 0 AND 100),
  seniority_score numeric(5,2) NOT NULL DEFAULT 0 CHECK (seniority_score BETWEEN 0 AND 100),
  location_score numeric(5,2) NOT NULL DEFAULT 0 CHECK (location_score BETWEEN 0 AND 100),
  compensation_score numeric(5,2) NOT NULL DEFAULT 0 CHECK (compensation_score BETWEEN 0 AND 100),
  freshness_score numeric(5,2) NOT NULL DEFAULT 0 CHECK (freshness_score BETWEEN 0 AND 100),
  company_priority_score numeric(5,2) NOT NULL DEFAULT 0 CHECK (company_priority_score BETWEEN 0 AND 100),
  source_quality_score numeric(5,2) NOT NULL DEFAULT 0 CHECK (source_quality_score BETWEEN 0 AND 100),
  application_effort_score numeric(5,2) NOT NULL DEFAULT 0 CHECK (application_effort_score BETWEEN 0 AND 100),
  hard_disqualified boolean NOT NULL DEFAULT false,
  disqualifiers text[] NOT NULL DEFAULT '{}',
  reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  scored_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, search_profile_id, scoring_version)
);

CREATE INDEX IF NOT EXISTS idx_job_scores_profile_score
  ON job_search.job_scores (search_profile_id, hard_disqualified, overall_score DESC);
CREATE INDEX IF NOT EXISTS idx_job_scores_job
  ON job_search.job_scores (job_id, overall_score DESC);

INSERT INTO job_search.scoring_configs (search_profile_id, version)
SELECT id, 1
FROM job_search.search_profiles
ON CONFLICT (search_profile_id, version) DO NOTHING;

DO $read_policies$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['scoring_configs', 'job_scores'] LOOP
    EXECUTE format('ALTER TABLE job_search.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON job_search.%I', 'client read access', table_name);
    EXECUTE format('CREATE POLICY %I ON job_search.%I FOR SELECT TO anon, authenticated USING (true)', 'client read access', table_name);
    EXECUTE format('GRANT SELECT ON job_search.%I TO anon, authenticated', table_name);
    EXECUTE format('GRANT ALL PRIVILEGES ON job_search.%I TO service_role', table_name);
  END LOOP;
END
$read_policies$;
