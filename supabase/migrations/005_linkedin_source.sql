-- Allow linkedin as a job source (manual import + future partner API)
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_source_check;
ALTER TABLE jobs ADD CONSTRAINT jobs_source_check
  CHECK (source IN ('indeed', 'ziprecruiter', 'manual', 'adzuna', 'linkedin'));
