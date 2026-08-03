\set ON_ERROR_STOP on
SET search_path = job_search, public;

UPDATE company_job_sources
SET last_checked_at = now() - interval '5 minutes',
    last_success_at = now() - interval '5 minutes',
    last_error_at = NULL,
    last_error = NULL,
    consecutive_failures = 0,
    active_job_count = 1
WHERE id = '00000000-0000-0000-0000-000000000301';

INSERT INTO companies (id, name, domain)
VALUES
  ('00000000-0000-0000-0000-000000000002', 'Northstar Systems', 'northstar.example'),
  ('00000000-0000-0000-0000-000000000003', 'Atlas Trade', 'atlas.example'),
  ('00000000-0000-0000-0000-000000000004', 'Capital Networks', 'capital.example')
ON CONFLICT (id) DO NOTHING;

INSERT INTO company_job_sources (
  id, company_id, provider, board_key, careers_url, enabled, priority,
  poll_interval_minutes, last_checked_at, last_success_at, consecutive_failures,
  active_job_count
) VALUES
  (
    '00000000-0000-0000-0000-000000000302',
    '00000000-0000-0000-0000-000000000002',
    'lever', 'northstar', 'https://jobs.lever.co/northstar', true, 20,
    360, now() - interval '8 minutes', now() - interval '8 minutes', 0, 8
  ),
  (
    '00000000-0000-0000-0000-000000000303',
    '00000000-0000-0000-0000-000000000003',
    'ashby', 'atlas', 'https://jobs.ashbyhq.com/atlas', true, 30,
    360, now() - interval '12 minutes', now() - interval '12 minutes', 0, 6
  ),
  (
    '00000000-0000-0000-0000-000000000304',
    '00000000-0000-0000-0000-000000000004',
    'smartrecruiters', 'CapitalNetworks', 'https://jobs.smartrecruiters.com/CapitalNetworks', true, 40,
    360, now() - interval '16 minutes', now() - interval '16 minutes', 0, 11
  )
ON CONFLICT (id) DO UPDATE SET
  last_checked_at = EXCLUDED.last_checked_at,
  last_success_at = EXCLUDED.last_success_at,
  last_error_at = NULL,
  last_error = NULL,
  consecutive_failures = 0,
  active_job_count = EXCLUDED.active_job_count;

INSERT INTO search_profile_company_sources (
  search_profile_id, company_job_source_id, weight, enabled
)
SELECT profile.id, source.id, 1, true
FROM search_profiles profile
CROSS JOIN company_job_sources source
WHERE profile.slug IN (
  'strategic-business-development',
  'enterprise-account-management',
  'partnerships-and-alliances',
  'market-access-international-trade'
)
AND source.id IN (
  '00000000-0000-0000-0000-000000000301',
  '00000000-0000-0000-0000-000000000302',
  '00000000-0000-0000-0000-000000000303',
  '00000000-0000-0000-0000-000000000304'
)
ON CONFLICT (search_profile_id, company_job_source_id) DO NOTHING;

INSERT INTO discovery_runs (
  id, trigger_type, status, started_at, finished_at, providers_attempted,
  requests_used, postings_fetched, canonical_jobs_created,
  canonical_jobs_updated, postings_merged, jobs_closed, jobs_reopened,
  errors_count, budget_snapshot, summary
) VALUES (
  '00000000-0000-0000-0000-000000000401',
  'scheduled', 'completed', now() - interval '20 minutes', now() - interval '18 minutes',
  ARRAY['greenhouse','lever','ashby','smartrecruiters','adzuna','remoteok'],
  24, 186, 27, 68, 91, 3, 1, 0,
  '{"adzuna":{"minuteLimit":25,"dailyLimit":250,"manualReserve":20}}'::jsonb,
  '{"profileCount":8,"companySourceCount":4,"queryCount":37}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  started_at = EXCLUDED.started_at,
  finished_at = EXCLUDED.finished_at,
  status = EXCLUDED.status,
  providers_attempted = EXCLUDED.providers_attempted,
  requests_used = EXCLUDED.requests_used,
  postings_fetched = EXCLUDED.postings_fetched,
  canonical_jobs_created = EXCLUDED.canonical_jobs_created,
  canonical_jobs_updated = EXCLUDED.canonical_jobs_updated,
  postings_merged = EXCLUDED.postings_merged,
  jobs_closed = EXCLUDED.jobs_closed,
  jobs_reopened = EXCLUDED.jobs_reopened,
  errors_count = EXCLUDED.errors_count,
  summary = EXCLUDED.summary;

INSERT INTO discovery_run_steps (
  id, discovery_run_id, provider, company_job_source_id, page_number,
  request_started_at, request_finished_at, http_status, results_received,
  new_jobs, updated_jobs, merged_postings, status, metadata
) VALUES
  (
    '00000000-0000-0000-0000-000000000411',
    '00000000-0000-0000-0000-000000000401',
    'greenhouse', '00000000-0000-0000-0000-000000000301', 1,
    now() - interval '20 minutes', now() - interval '19 minutes', 200,
    14, 2, 5, 7, 'completed', '{"completeSnapshot":true}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000412',
    '00000000-0000-0000-0000-000000000401',
    'adzuna', NULL, 1,
    now() - interval '19 minutes', now() - interval '18 minutes', 200,
    50, 8, 12, 30, 'completed', '{}'::jsonb
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO job_scores (
  job_id, search_profile_id, scoring_config_id, scoring_version,
  overall_score, title_score, responsibility_score, experience_score,
  industry_score, seniority_score, location_score, compensation_score,
  freshness_score, company_priority_score, source_quality_score,
  application_effort_score, hard_disqualified, disqualifiers, reasons, scored_at
)
SELECT
  '00000000-0000-0000-0000-000000000101',
  profile.id,
  config.id,
  config.version,
  91.5, 100, 96, 88, 92, 90, 100, 86, 98, 100, 100, 75,
  false,
  ARRAY[]::text[],
  '["Title aligns with Strategic Partnerships Manager.","Direct employer source.","Remote-friendly.","Published compensation was evaluated."]'::jsonb,
  now() - interval '17 minutes'
FROM search_profiles profile
JOIN scoring_configs config
  ON config.search_profile_id = profile.id
 AND config.enabled
WHERE profile.slug = 'partnerships-and-alliances'
ON CONFLICT (job_id, search_profile_id, scoring_version) DO UPDATE SET
  overall_score = EXCLUDED.overall_score,
  title_score = EXCLUDED.title_score,
  responsibility_score = EXCLUDED.responsibility_score,
  experience_score = EXCLUDED.experience_score,
  industry_score = EXCLUDED.industry_score,
  seniority_score = EXCLUDED.seniority_score,
  location_score = EXCLUDED.location_score,
  compensation_score = EXCLUDED.compensation_score,
  freshness_score = EXCLUDED.freshness_score,
  company_priority_score = EXCLUDED.company_priority_score,
  source_quality_score = EXCLUDED.source_quality_score,
  application_effort_score = EXCLUDED.application_effort_score,
  hard_disqualified = false,
  disqualifiers = ARRAY[]::text[],
  reasons = EXCLUDED.reasons,
  scored_at = EXCLUDED.scored_at;

UPDATE jobs
SET fit_score = 92,
    fit_reasons = ARRAY[
      'Title aligns with Strategic Partnerships Manager.',
      'Direct employer source.',
      'Remote-friendly.'
    ],
    salary_min = 110000,
    salary_max = 135000,
    salary_currency = 'CAD',
    employment_type = 'full_time',
    seniority = 'manager',
    remote_type = 'remote',
    last_verified_at = now() - interval '5 minutes',
    last_seen_at = now() - interval '5 minutes',
    lifecycle_status = 'open'
WHERE id = '00000000-0000-0000-0000-000000000101';

SELECT json_build_object(
  'profiles', (SELECT count(*) FROM search_profiles),
  'company_sources', (SELECT count(*) FROM company_job_sources),
  'runs', (SELECT count(*) FROM discovery_runs),
  'scores', (SELECT count(*) FROM job_scores),
  'jobs', (SELECT count(*) FROM jobs)
) AS connected_browser_seed;
