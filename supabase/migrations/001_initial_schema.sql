-- Job Search Command Center — Initial Schema
-- Run this in Supabase SQL Editor or via supabase db push

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Companies
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  domain TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_companies_name ON companies (name);
CREATE INDEX idx_companies_domain ON companies (domain);

-- Jobs (raw + deduped postings)
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source TEXT NOT NULL CHECK (source IN ('indeed', 'ziprecruiter', 'manual')),
  external_id TEXT,
  title TEXT NOT NULL,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  location TEXT,
  remote BOOLEAN DEFAULT FALSE,
  job_type TEXT, -- fulltime / contract / parttime / etc
  description TEXT,
  url TEXT,
  posted_at DATE,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'found' CHECK (status IN ('found', 'interested', 'dismissed')),
  UNIQUE (source, external_id)
);

CREATE INDEX idx_jobs_status ON jobs (status);
CREATE INDEX idx_jobs_fetched_at ON jobs (fetched_at DESC);
CREATE INDEX idx_jobs_company_id ON jobs (company_id);

-- Applications (one per job Tyler pursues)
CREATE TABLE applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'interested'
    CHECK (status IN ('interested', 'applied', 'interview', 'offer', 'rejected', 'closed')),
  applied_at DATE,
  resume_version_id UUID, -- filled in Phase 2
  cover_note TEXT,
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (job_id)
);

CREATE INDEX idx_applications_status ON applications (status);
CREATE INDEX idx_applications_applied_at ON applications (applied_at);

-- Resume versions (Phase 2)
CREATE TABLE resume_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  content TEXT, -- generated resume markdown
  docx_url TEXT, -- Supabase Storage path
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add FK after resume_versions exists
ALTER TABLE applications
  ADD CONSTRAINT applications_resume_version_id_fkey
  FOREIGN KEY (resume_version_id) REFERENCES resume_versions(id) ON DELETE SET NULL;

-- Contacts
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  title TEXT,
  email TEXT,
  linkedin_url TEXT,
  source TEXT, -- apollo / manual / etc
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_contacts_company_id ON contacts (company_id);

-- Outreach messages
CREATE TABLE outreach_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('initial', 'follow_up_1', 'follow_up_2')),
  draft_body TEXT,
  status TEXT NOT NULL DEFAULT 'drafted' CHECK (status IN ('drafted', 'sent', 'skipped')),
  scheduled_for DATE,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_outreach_application_id ON outreach_messages (application_id);
CREATE INDEX idx_outreach_scheduled_for ON outreach_messages (scheduled_for) WHERE status = 'drafted';

-- Saved search config (single-user settings)
CREATE TABLE settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Default settings seed
INSERT INTO settings (key, value) VALUES
  ('search_terms', '{"terms": ["software engineer", "full stack developer"], "locations": ["Remote", "United States"]}'),
  ('follow_up_offsets', '{"follow_up_1_days": 5, "follow_up_2_days": 12}'),
  ('base_resume', '{"content": ""}');

-- Updated_at trigger helper
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER applications_updated_at
  BEFORE UPDATE ON applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER settings_updated_at
  BEFORE UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS (single-user for v1 — enable when auth is wired)
-- ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
-- etc. For Phase 1 we keep open for simplicity with service role / anon key.
