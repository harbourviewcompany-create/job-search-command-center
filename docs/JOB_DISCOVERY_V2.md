# Job Discovery V2

Job Discovery V2 expands the existing Job Search Command Center without replacing its application, resume, contact, outreach, or follow-up workflows.

## Runtime model

1. Enabled search profiles define independent title universes, aliases, terms, exclusions, locations, remote policy, compensation floor, posting age, and result budgets.
2. Registered employer sources poll public Greenhouse, Lever, Ashby, and SmartRecruiters job boards.
3. Adzuna and RemoteOK queries run through the same provider contract.
4. Every provider representation is stored in `job_source_postings`.
5. `jobs` remains the canonical vacancy record referenced by existing applications.
6. Direct employer sources become preferred over aggregator copies.
7. Each job receives profile-specific dimension scores in `job_scores`; the best eligible score is copied to legacy `jobs.fit_score` and `jobs.fit_reasons` fields for compatibility.
8. Every request and result is attributable to a `discovery_run` and `discovery_run_step`.

## Migration order

Apply all tracked migrations in filename order. The Job Discovery V2 chain is:

- `010_operator_boundary_rls.sql`
- `011_jobs_effective_timestamp.sql`
- `012_discovery_profiles_and_sources.sql`
- `013_job_canonicalization.sql`
- `014_discovery_runs_and_budgets.sql`
- `015_multidimensional_job_scoring.sql`
- `016_discovery_ingestion_functions.sql`
- `017_discovery_backfill_and_views.sql`

Migration 017 backfills each existing job into one source-posting record while preserving its existing `jobs.id`. Existing `applications.job_id`, resume, outreach, and follow-up relationships remain unchanged.

## Search profiles

The migration seeds eight editable lanes:

- Strategic Business Development
- Enterprise Account Management
- Partnerships and Alliances
- Commercial Leadership
- Market Access and International Trade
- Recruiting and Client Partnerships
- Industry-Adjacent Opportunities
- Stretch Opportunities

Manage them at `/settings/discovery`.

## Target-company ATS registry

`company_job_sources` accepts:

- Greenhouse board token
- Lever site slug, including an optional EU API base
- Ashby public job-board name
- SmartRecruiters company identifier

The settings action validates the public endpoint before saving. Sources may be linked to selected search profiles or left unassigned for use by every enabled profile.

## Lifecycle semantics

Direct ATS sources provide complete employer snapshots:

- Seen: `open`, missed count reset to zero.
- Missed once after a successful complete snapshot: `unverified`.
- Missed twice: `closed`.
- Reappears: reopened on the same source and canonical job.

Provider failures and incomplete snapshots never close jobs.

Aggregator absence is not treated as proof of closure. Stale Adzuna, RemoteOK, Indeed, and ZipRecruiter observations expire only after their configured age window.

A canonical job stays open while at least one source remains open.

## Adzuna budgets

Default policy:

- 25 requests per minute.
- 250 requests per day.
- Two minute requests and 20 daily requests reserved for manual runs.
- Three pages per query until yield data supports deeper pagination.

The `reserve_provider_request` RPC updates budget buckets atomically. Automated requests cannot consume manual reserve capacity.

## Verification

`.github/workflows/job-discovery-v2-verify.yml` runs:

- `npm ci`
- TypeScript typecheck
- ESLint
- Node unit and provider adapter tests
- Next.js production build
- PostgreSQL 16 migration chain 010–017
- Upgrade/backfill relationship assertions
- Direct ATS plus aggregator canonical merge assertion
- ATS two-snapshot lifecycle assertion
- Provider budget reserve assertion
- Desktop and mobile control-center screenshots

The workflow is read-only and uploads evidence as an artifact. The feature branch is deployment-disabled in `vercel.json`.
