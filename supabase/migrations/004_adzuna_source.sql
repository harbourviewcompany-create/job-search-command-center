-- Allow adzuna as a job source (daily pull provider)
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_source_check;
ALTER TABLE jobs ADD CONSTRAINT jobs_source_check
  CHECK (source IN ('indeed', 'ziprecruiter', 'manual', 'adzuna'));
