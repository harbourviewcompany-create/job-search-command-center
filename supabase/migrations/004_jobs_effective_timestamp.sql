-- Preserve the UI's posted_at ?? fetched_at semantics while allowing
-- newest/oldest pagination to stay inside PostgREST instead of loading all rows.

ALTER TABLE job_search.jobs
  ADD COLUMN IF NOT EXISTS effective_at timestamptz
  GENERATED ALWAYS AS (COALESCE(posted_at, fetched_at)) STORED;

CREATE INDEX IF NOT EXISTS idx_jobs_effective_at
  ON job_search.jobs (effective_at DESC, id ASC);
