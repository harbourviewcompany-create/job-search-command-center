-- Allow RemoteOK as a job source (free public API)
DO $$
BEGIN
  ALTER TABLE job_search.jobs DROP CONSTRAINT IF EXISTS jobs_source_check;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE job_search.jobs
  DROP CONSTRAINT IF EXISTS jobs_source_check;

-- Recreate with expanded set if a check exists under another name; safe no-op pattern:
-- Prefer expanding via constraint recreation only when present in your project.
-- For projects using ENUM, alter type instead:
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'job_source' AND n.nspname = 'job_search'
  ) THEN
    ALTER TYPE job_search.job_source ADD VALUE IF NOT EXISTS 'remoteok';
  END IF;
END $$;
