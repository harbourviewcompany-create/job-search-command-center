-- CRITICAL FIX: schema mismatch between app clients and where tables live.
--
-- src/lib/supabase/server.ts and client.ts both connect with:
--   db: { schema: 'job_search' }
-- but migrations 001-006 create every table (companies, jobs, applications,
-- resume_versions, contacts, outreach_messages, settings, opportunities) in
-- the default 'public' schema. Migration 007 already assumes job_search.jobs
-- exists (wrapped in a silent exception handler), but nothing before it ever
-- creates that schema or moves the tables into it.
--
-- Net effect if this isn't run: every query the app makes fails with
-- "relation does not exist" against a fresh database — the app will not
-- work end to end (dashboard, jobs, applications, package generation, etc.)
-- despite all of that code being fully implemented.
--
-- Safe to run whether your tables currently live in public (fresh setup
-- following the README) or were already manually moved to job_search.

CREATE SCHEMA IF NOT EXISTS job_search;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'companies', 'jobs', 'applications', 'resume_versions', 'contacts',
    'outreach_messages', 'settings', 'opportunities'
  ]
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t
    ) AND NOT EXISTS (
      SELECT 1 FROM pg_tables WHERE schemaname = 'job_search' AND tablename = t
    ) THEN
      EXECUTE format('ALTER TABLE public.%I SET SCHEMA job_search', t);
    END IF;
  END LOOP;
END $$;

-- Move the shared updated_at trigger function too — triggers on applications
-- and opportunities call it by name and need it resolvable from job_search.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'update_updated_at_column' AND n.nspname = 'public'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'update_updated_at_column' AND n.nspname = 'job_search'
  ) THEN
    ALTER FUNCTION public.update_updated_at_column() SET SCHEMA job_search;
  END IF;
END $$;

-- Grant usage so the anon/authenticated roles the app connects with can see
-- the schema at all (SET SCHEMA on tables does not grant schema USAGE).
GRANT USAGE ON SCHEMA job_search TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA job_search TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA job_search TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA job_search
  GRANT ALL ON TABLES TO anon, authenticated, service_role;
