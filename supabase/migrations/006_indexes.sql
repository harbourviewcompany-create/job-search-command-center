-- Indexes for hot query paths that were missing:
-- applications.updated_at (kanban ORDER BY), applications.resume_version_id
-- (dashboard "needs package" filter), outreach_messages.contact_id,
-- resume_versions.application_id (FK lookups).

CREATE INDEX IF NOT EXISTS idx_applications_updated_at ON applications (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_applications_resume_version_id ON applications (resume_version_id);
CREATE INDEX IF NOT EXISTS idx_outreach_messages_contact_id ON outreach_messages (contact_id);
CREATE INDEX IF NOT EXISTS idx_resume_versions_application_id ON resume_versions (application_id);
