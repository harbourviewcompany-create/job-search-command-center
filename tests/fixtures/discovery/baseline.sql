CREATE SCHEMA IF NOT EXISTS job_search;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
END
$$;

SET search_path = job_search, public;

CREATE OR REPLACE FUNCTION job_search.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END
$$;

CREATE TABLE job_search.companies (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  domain text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE job_search.jobs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  source text NOT NULL,
  external_id text,
  title text NOT NULL,
  company_id uuid REFERENCES job_search.companies(id) ON DELETE SET NULL,
  location text,
  remote boolean DEFAULT false,
  job_type text,
  description text,
  url text,
  posted_at date,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'found',
  fit_score integer,
  fit_reasons text[],
  CONSTRAINT jobs_source_check CHECK (source IN ('indeed','ziprecruiter','manual','adzuna','linkedin','remoteok')),
  UNIQUE (source, external_id)
);

CREATE TABLE job_search.applications (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id uuid NOT NULL UNIQUE REFERENCES job_search.jobs(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'interested',
  applied_at date,
  resume_version_id uuid,
  cover_note text,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE job_search.resume_versions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id uuid NOT NULL REFERENCES job_search.applications(id) ON DELETE CASCADE,
  content text,
  docx_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE job_search.contacts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id uuid NOT NULL REFERENCES job_search.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  title text,
  email text,
  linkedin_url text,
  source text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE job_search.outreach_messages (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id uuid NOT NULL REFERENCES job_search.applications(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES job_search.contacts(id) ON DELETE SET NULL,
  type text NOT NULL,
  draft_body text,
  status text NOT NULL DEFAULT 'drafted',
  scheduled_for date,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE job_search.settings (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE job_search.opportunities (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  type text NOT NULL,
  title text NOT NULL,
  description text,
  company_or_channel text,
  estimated_value text,
  effort text,
  time_to_cash text,
  fit_score integer,
  fit_reasons text[],
  status text NOT NULL DEFAULT 'active',
  action_url text,
  draft_pitch text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO job_search.companies (id, name, domain)
VALUES ('00000000-0000-0000-0000-000000000001', 'Acme Markets', 'acme.example');

INSERT INTO job_search.jobs (
  id, source, external_id, title, company_id, location, remote, job_type,
  description, url, posted_at, fetched_at, status, fit_score, fit_reasons
) VALUES (
  '00000000-0000-0000-0000-000000000101',
  'manual',
  'legacy-101',
  'Strategic Partnerships Manager',
  '00000000-0000-0000-0000-000000000001',
  'Remote, Canada',
  true,
  'full_time',
  'Own strategic alliances and channel partnerships.',
  'https://acme.example/jobs/101',
  '2026-08-01',
  '2026-08-01T12:00:00Z',
  'interested',
  82,
  ARRAY['Legacy fit reason']
);

INSERT INTO job_search.applications (id, job_id, status, notes)
VALUES (
  '00000000-0000-0000-0000-000000000201',
  '00000000-0000-0000-0000-000000000101',
  'interested',
  'Existing application must remain linked.'
);

INSERT INTO job_search.settings (key, value)
VALUES
  ('search_terms', '{"terms":["Strategic Partnerships Manager","Business Development Manager"],"locations":["Ottawa","Remote","Canada"]}'),
  ('follow_up_offsets', '{"follow_up_1_days":5,"follow_up_2_days":12}'),
  ('base_resume', '{"content":"Fixture resume"}');
