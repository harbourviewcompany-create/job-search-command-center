-- Fast-Track: staffing/temp agencies for immediate income
-- These are the fastest realistic path to a paycheck (days, not weeks) and
-- were missing from the Opportunity Centre, which previously only modeled
-- Harbourview-monetization plays. Seeded as 'job_lead' opportunities with
-- short time_to_cash so they surface at the top of Cash Plays.

INSERT INTO job_search.opportunities (
  type, title, description, company_or_channel, estimated_value,
  effort, time_to_cash, fit_score, fit_reasons, draft_pitch, status
)
VALUES
(
  'job_lead',
  'LRO Staffing — call today',
  'Full-service Ottawa staffing agency covering tech, marketing, law, industrial, and BD/sales roles. Broad industry coverage, strong local reputation, tracks candidates long-term.',
  'LRO Staffing',
  'Temp/temp-to-perm hourly or salaried, role-dependent',
  'low',
  'Days',
  90,
  ARRAY['Same-week intake calls are normal', 'Matches BD/sales/account management background', 'No application black hole — direct human contact'],
  'Hi, I''m an Ottawa-based BD/account management professional (20+ years, most recently HVAC and recruiting) looking for immediate placement — temp, temp-to-perm, or contract all open. Can I set up an intake call this week?',
  'active'
),
(
  'job_lead',
  'Local Staffing — call today',
  'Ottawa-focused agency known for fast temp placements and understanding the local market. Closed weekends, so call/email on a weekday.',
  'Local Staffing',
  'Temp/temp-to-perm hourly or salaried, role-dependent',
  'low',
  'Days',
  88,
  ARRAY['Ottawa-only focus means faster local matching', 'Known for genuinely fast temp placements', 'Good fit for immediate-income bridge roles'],
  'Hi, I''m local to Ottawa and available immediately for temp or temp-to-perm work — sales, account management, or general BD. Happy to come in this week.',
  'active'
),
(
  'job_lead',
  'Stevenson & White Recruitment — call today',
  'Ottawa recruiter placing permanent, contract, and temp roles since 2000. Good general-purpose option alongside LRO and Local.',
  'Stevenson & White Recruitment',
  'Contract or permanent, role-dependent',
  'low',
  'Days to 1-2 weeks',
  80,
  ARRAY['20 years placing Ottawa candidates', 'Handles both contract and permanent', 'Backup channel if LRO/Local are slower'],
  'Hi, I''m actively looking for my next role in Ottawa — open to contract or permanent, BD/account management/sales background. Could we set up a call this week?',
  'active'
),
(
  'job_lead',
  'Aplin — call today',
  'National, family-owned staffing firm with wide sector reach; good third option to run in parallel for volume.',
  'Aplin',
  'Contract or permanent, role-dependent',
  'low',
  'Days to 1-2 weeks',
  78,
  ARRAY['National reach beyond Ottawa-only openings', 'Runs in parallel with local agencies for more volume', 'Wide sector coverage increases odds of a fast match'],
  'Hi, I''m based in Ottawa and open to contract or permanent roles — 20+ years in BD, account management, and sales. Looking to move quickly, available for a call this week.',
  'active'
)
ON CONFLICT DO NOTHING;
