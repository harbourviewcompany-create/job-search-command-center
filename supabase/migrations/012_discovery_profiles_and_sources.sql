-- Job Discovery V2: configurable search lanes and target-company ATS sources.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS job_search.search_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  enabled boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 100 CHECK (priority >= 0),
  country_code text NOT NULL DEFAULT 'CA',
  remote_policy text NOT NULL DEFAULT 'remote_or_local'
    CHECK (remote_policy IN ('any', 'remote_only', 'remote_or_local', 'local_only')),
  locations text[] NOT NULL DEFAULT '{}',
  employment_types text[] NOT NULL DEFAULT '{}',
  primary_titles text[] NOT NULL DEFAULT '{}',
  title_aliases text[] NOT NULL DEFAULT '{}',
  required_terms text[] NOT NULL DEFAULT '{}',
  preferred_terms text[] NOT NULL DEFAULT '{}',
  excluded_terms text[] NOT NULL DEFAULT '{}',
  excluded_companies text[] NOT NULL DEFAULT '{}',
  maximum_posting_age_days integer NOT NULL DEFAULT 45 CHECK (maximum_posting_age_days > 0),
  minimum_salary_cad integer CHECK (minimum_salary_cad IS NULL OR minimum_salary_cad >= 0),
  result_budget_per_run integer NOT NULL DEFAULT 100 CHECK (result_budget_per_run > 0),
  source_priority jsonb NOT NULL DEFAULT '{"greenhouse":100,"lever":100,"ashby":100,"smartrecruiters":100,"adzuna":60,"remoteok":50}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS job_search.search_profile_queries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  search_profile_id uuid NOT NULL REFERENCES job_search.search_profiles(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('adzuna', 'remoteok')),
  query_type text NOT NULL DEFAULT 'keyword' CHECK (query_type IN ('keyword', 'exact_title', 'broad')),
  query_text text NOT NULL,
  location text,
  priority integer NOT NULL DEFAULT 100 CHECK (priority >= 0),
  enabled boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  last_result_count integer NOT NULL DEFAULT 0,
  last_new_job_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (search_profile_id, provider, query_type, query_text, location)
);

CREATE TABLE IF NOT EXISTS job_search.company_job_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES job_search.companies(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('greenhouse', 'lever', 'ashby', 'smartrecruiters')),
  board_key text NOT NULL,
  careers_url text,
  api_base_url text,
  enabled boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 100 CHECK (priority >= 0),
  poll_interval_minutes integer NOT NULL DEFAULT 360 CHECK (poll_interval_minutes >= 15),
  last_checked_at timestamptz,
  last_success_at timestamptz,
  last_error_at timestamptz,
  last_error text,
  consecutive_failures integer NOT NULL DEFAULT 0,
  etag text,
  last_modified text,
  active_job_count integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, board_key)
);

CREATE TABLE IF NOT EXISTS job_search.search_profile_company_sources (
  search_profile_id uuid NOT NULL REFERENCES job_search.search_profiles(id) ON DELETE CASCADE,
  company_job_source_id uuid NOT NULL REFERENCES job_search.company_job_sources(id) ON DELETE CASCADE,
  weight numeric(6,3) NOT NULL DEFAULT 1 CHECK (weight >= 0),
  enabled boolean NOT NULL DEFAULT true,
  PRIMARY KEY (search_profile_id, company_job_source_id)
);

CREATE INDEX IF NOT EXISTS idx_search_profiles_enabled_priority
  ON job_search.search_profiles (enabled, priority, name);
CREATE INDEX IF NOT EXISTS idx_search_profile_queries_due
  ON job_search.search_profile_queries (enabled, priority, last_run_at);
CREATE INDEX IF NOT EXISTS idx_company_job_sources_due
  ON job_search.company_job_sources (enabled, priority, last_checked_at);
CREATE INDEX IF NOT EXISTS idx_company_job_sources_company
  ON job_search.company_job_sources (company_id);

DROP TRIGGER IF EXISTS search_profiles_updated_at ON job_search.search_profiles;
CREATE TRIGGER search_profiles_updated_at
  BEFORE UPDATE ON job_search.search_profiles
  FOR EACH ROW EXECUTE FUNCTION job_search.update_updated_at_column();
DROP TRIGGER IF EXISTS search_profile_queries_updated_at ON job_search.search_profile_queries;
CREATE TRIGGER search_profile_queries_updated_at
  BEFORE UPDATE ON job_search.search_profile_queries
  FOR EACH ROW EXECUTE FUNCTION job_search.update_updated_at_column();
DROP TRIGGER IF EXISTS company_job_sources_updated_at ON job_search.company_job_sources;
CREATE TRIGGER company_job_sources_updated_at
  BEFORE UPDATE ON job_search.company_job_sources
  FOR EACH ROW EXECUTE FUNCTION job_search.update_updated_at_column();

INSERT INTO job_search.search_profiles (
  name, slug, description, priority, locations, primary_titles, title_aliases,
  preferred_terms, excluded_terms
) VALUES
  ('Strategic Business Development', 'strategic-business-development', 'Business development, revenue growth, market expansion, and commercial development roles.', 10,
   ARRAY['Ottawa','Ontario','Canada','Remote'],
   ARRAY['Business Development Manager','Business Development Director','Director of Business Development','Commercial Development Manager','Market Development Manager'],
   ARRAY['Growth Partnerships Manager','New Business Manager','Commercial Manager'],
   ARRAY['b2b','revenue growth','market expansion','strategic accounts'],
   ARRAY['door to door','commission only','entry level']),
  ('Enterprise Account Management', 'enterprise-account-management', 'Strategic, key, senior, and enterprise account management roles.', 20,
   ARRAY['Ottawa','Ontario','Canada','Remote'],
   ARRAY['Strategic Account Manager','Key Account Manager','Senior Account Manager','Enterprise Account Manager'],
   ARRAY['National Account Manager','Client Partner','Account Director'],
   ARRAY['portfolio','enterprise','key accounts','retention','expansion'],
   ARRAY['junior account manager','retail sales']),
  ('Partnerships and Alliances', 'partnerships-and-alliances', 'Strategic partnerships, channel, alliance, ecosystem, and client partnership roles.', 30,
   ARRAY['Ottawa','Ontario','Canada','Remote'],
   ARRAY['Partnerships Manager','Strategic Partnerships Manager','Channel Partnerships Manager','Alliance Manager'],
   ARRAY['Ecosystem Manager','Partner Development Manager','Commercial Partnerships Manager','Client Partnerships Manager'],
   ARRAY['alliances','channel','ecosystem','partner development'],
   ARRAY['affiliate sales']),
  ('Commercial Leadership', 'commercial-leadership', 'Sales leadership, revenue leadership, and commercial team management roles.', 40,
   ARRAY['Ottawa','Ontario','Canada','Remote'],
   ARRAY['Sales Manager','Head of Sales','Commercial Director','Revenue Leader'],
   ARRAY['Director of Sales','VP Sales','General Manager'],
   ARRAY['team leadership','forecasting','go-to-market','p&l'],
   ARRAY['sales development representative','junior sdr']),
  ('Market Access and International Trade', 'market-access-international-trade', 'Market access, export development, international trade, and cross-border commercial roles.', 50,
   ARRAY['Ottawa','Ontario','Canada','Remote'],
   ARRAY['Market Access Manager','International Trade Manager','Export Development Manager'],
   ARRAY['Trade Development Manager','International Business Development Manager','Global Partnerships Manager'],
   ARRAY['cross-border','export','import','market entry','international'],
   ARRAY['customs clerk']),
  ('Recruiting and Client Partnerships', 'recruiting-client-partnerships', 'Recruiting leadership, staffing partnerships, and client development roles.', 60,
   ARRAY['Ottawa','Ontario','Canada','Remote'],
   ARRAY['Talent Acquisition Manager','Recruiting Manager','Client Partnerships Manager'],
   ARRAY['Staffing Manager','Recruitment Business Partner','Client Solutions Manager'],
   ARRAY['full-cycle recruiting','staffing','client development'],
   ARRAY['recruiting coordinator']),
  ('Industry-Adjacent Opportunities', 'industry-adjacent', 'Transferable commercial roles in HVAC, building solutions, insurance, automotive, logistics, regulated markets, and B2B SaaS.', 70,
   ARRAY['Ottawa','Ontario','Canada','Remote'],
   ARRAY['Account Manager','Business Development Manager','Partnerships Manager'],
   ARRAY['Territory Manager','Regional Sales Manager','Customer Success Manager'],
   ARRAY['hvac','building solutions','insurance','automotive','logistics','regulated markets','b2b saas'],
   ARRAY['retail associate']),
  ('Stretch Opportunities', 'stretch-opportunities', 'Senior or adjacent roles worth reviewing despite imperfect title alignment.', 90,
   ARRAY['Ottawa','Ontario','Canada','Remote'],
   ARRAY['Director','Head','General Manager'],
   ARRAY['Vice President','Country Manager','Chief Commercial Officer'],
   ARRAY['strategy','commercial','growth','operations'],
   ARRAY['internship'])
ON CONFLICT (slug) DO NOTHING;

DO $seed_queries$
DECLARE
  profile_row record;
  title_value text;
  location_value text;
BEGIN
  FOR profile_row IN SELECT id, primary_titles, locations FROM job_search.search_profiles LOOP
    FOREACH title_value IN ARRAY profile_row.primary_titles LOOP
      FOREACH location_value IN ARRAY profile_row.locations LOOP
        INSERT INTO job_search.search_profile_queries (
          search_profile_id, provider, query_type, query_text, location
        ) VALUES (profile_row.id, 'adzuna', 'exact_title', title_value, location_value)
        ON CONFLICT DO NOTHING;
      END LOOP;
    END LOOP;
  END LOOP;
END
$seed_queries$;

DO $read_policies$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'search_profiles', 'search_profile_queries', 'company_job_sources', 'search_profile_company_sources'
  ] LOOP
    EXECUTE format('ALTER TABLE job_search.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON job_search.%I', 'client read access', table_name);
    EXECUTE format('CREATE POLICY %I ON job_search.%I FOR SELECT TO anon, authenticated USING (true)', 'client read access', table_name);
    EXECUTE format('GRANT SELECT ON job_search.%I TO anon, authenticated', table_name);
    EXECUTE format('GRANT ALL PRIVILEGES ON job_search.%I TO service_role', table_name);
  END LOOP;
END
$read_policies$;
