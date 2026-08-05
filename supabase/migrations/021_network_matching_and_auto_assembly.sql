-- Beyond-the-job-board features, round 1:
--   1. Network-matched warm intros — cross-reference imported connections
--      against companies the discovery engine already surfaces.
--   2. Auto-assembly threshold lives in settings (reused by the edge function
--      change in this same feature set); no schema needed for that part beyond
--      what job_scores/applications/resume_versions already provide.
--   3. "Today's 5" reads existing tables directly — no new schema required.

CREATE TABLE IF NOT EXISTS job_search.network_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  company_raw text,
  title text,
  linkedin_url text,
  email text,
  relationship_note text,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'linkedin_csv')),
  imported_batch_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_network_contacts_company_raw
  ON job_search.network_contacts (company_raw);

-- Cheap, dependency-free company-name normalizer: lowercase, strip common
-- legal suffixes and punctuation, collapse whitespace. Good enough to match
-- "BrokerLink Inc." (companies.name) against "Brokerlink" (a LinkedIn export
-- company field) without pulling in a fuzzy-matching extension.
CREATE OR REPLACE FUNCTION job_search.normalize_company_name(raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(
    trim(
      regexp_replace(
        regexp_replace(
          lower(coalesce(raw, '')),
          '\s+(inc|ltd|llc|corp|corporation|co|company|group|canada|the)\.?\s*$',
          '', 'g'
        ),
        '[^a-z0-9]+', ' ', 'g'
      )
    ),
    ''
  )
$$;

-- Warm-intro matches: every (network contact, company Tyler is tracking)
-- pair where the normalized names agree. Feeds both the Prospects/Jobs UI
-- ("you know someone here") and Today's 5.
CREATE OR REPLACE VIEW job_search.network_matches AS
SELECT
  nc.id AS network_contact_id,
  nc.name AS contact_name,
  nc.title AS contact_title,
  nc.linkedin_url AS contact_linkedin_url,
  nc.company_raw AS contact_company,
  c.id AS company_id,
  c.name AS company_name
FROM job_search.network_contacts nc
JOIN job_search.companies c
  ON job_search.normalize_company_name(c.name) = job_search.normalize_company_name(nc.company_raw)
WHERE job_search.normalize_company_name(nc.company_raw) IS NOT NULL;

ALTER TABLE job_search.network_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "client read access" ON job_search.network_contacts;
CREATE POLICY "client read access" ON job_search.network_contacts
  FOR SELECT TO anon, authenticated USING (true);
-- No insert/update/delete policy: writes go through the operator-authorized
-- server action, same read-only-for-clients boundary as every other table
-- since migration 010_operator_boundary_rls.

GRANT SELECT ON job_search.network_contacts TO anon, authenticated;
GRANT SELECT ON job_search.network_matches TO anon, authenticated;
GRANT ALL ON job_search.network_contacts TO service_role;

-- Auto-assembly threshold, editable from Settings without a redeploy.
INSERT INTO job_search.settings (key, value)
VALUES ('auto_assembly', jsonb_build_object('min_score', 75, 'max_per_run', 10, 'enabled', true))
ON CONFLICT (key) DO NOTHING;
