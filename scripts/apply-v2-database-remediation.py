from pathlib import Path


def replace(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise SystemExit(f'Expected text not found in {path}: {old[:120]!r}')
    file.write_text(text.replace(old, new, 1))


replace(
    'supabase/migrations/013_job_canonicalization.sql',
    "company_job_source_id uuid REFERENCES job_search.company_job_sources(id) ON DELETE SET NULL,",
    "company_job_source_id uuid REFERENCES job_search.company_job_sources(id) ON DELETE RESTRICT,",
)

replace(
    'supabase/migrations/016_discovery_ingestion_functions.sql',
    """  v_canonical_key := job_search.discovery_canonical_key(
    p_company_name,
    p_title,
    p_location,
    p_posted_at,
    p_apply_url
  );

  SELECT id""",
    """  v_canonical_key := job_search.discovery_canonical_key(
    p_company_name,
    p_title,
    p_location,
    p_posted_at,
    p_apply_url
  );

  -- Serialize all ingestion for one canonical identity. The second concurrent
  -- transaction waits, then observes the first transaction's canonical job.
  PERFORM pg_advisory_xact_lock(hashtextextended(v_canonical_key, 0));

  SELECT id""",
)

replace(
    'supabase/migrations/016_discovery_ingestion_functions.sql',
    """  IF NOT p_complete THEN
    UPDATE company_job_sources
    SET last_checked_at = p_verified_at
    WHERE id = p_company_job_source_id;
    RETURN QUERY SELECT 0, 0;
    RETURN;
  END IF;

  WITH reopened AS (""",
    """  IF NOT p_complete THEN
    UPDATE company_job_sources
    SET last_checked_at = p_verified_at
    WHERE id = p_company_job_source_id;
    RETURN QUERY SELECT 0, 0;
    RETURN;
  END IF;

  -- An empty complete response can be a provider outage, bad board key, or
  -- upstream contract change. Never convert it into a mass-closure event.
  IF cardinality(v_observed) = 0 THEN
    UPDATE company_job_sources
    SET last_checked_at = p_verified_at,
        last_error = 'Complete snapshot returned zero postings; lifecycle changes suppressed.',
        last_error_at = p_verified_at,
        consecutive_failures = consecutive_failures + 1
    WHERE id = p_company_job_source_id;
    RETURN QUERY SELECT 0, 0;
    RETURN;
  END IF;

  WITH reopened AS (""",
)

replace(
    'supabase/migrations/016_discovery_ingestion_functions.sql',
    """REVOKE ALL ON FUNCTION job_search.ingest_job_source_posting(text,text,text,text,text,boolean,text,text,text,timestamptz,text,text,text,numeric,numeric,text,uuid,uuid,text,jsonb,timestamptz) FROM PUBLIC;""",
    """REVOKE ALL ON FUNCTION job_search.recompute_job_lifecycle(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION job_search.ingest_job_source_posting(text,text,text,text,text,boolean,text,text,text,timestamptz,text,text,text,numeric,numeric,text,uuid,uuid,text,jsonb,timestamptz) FROM PUBLIC;""",
)

path = Path('supabase/migrations/017_discovery_backfill_and_views.sql')
text = path.read_text()
text = text.replace('j.posted_at::timestamptz', "(j.posted_at::timestamp AT TIME ZONE 'UTC')")
text = text.replace('posted_at::timestamptz', "(posted_at::timestamp AT TIME ZONE 'UTC')")
old_locations = "locations = CASE WHEN cardinality(legacy_locations) > 0 THEN legacy_locations ELSE locations END"
new_locations = "locations = ARRAY(SELECT DISTINCT value FROM unnest(locations || legacy_locations) AS value WHERE nullif(trim(value), '') IS NOT NULL)"
if old_locations not in text:
    raise SystemExit('Legacy location replacement target not found')
path.write_text(text.replace(old_locations, new_locations, 1))
