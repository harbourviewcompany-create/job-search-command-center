# Supabase agent handoff — for Claude

**Repo:** `harbourviewcompany-create/job-search-command-center`  
**Owner:** Tyler Campbell / Harbourview  
**App stack:** Next.js 15 reads/writes via Supabase client with **`db: { schema: 'job_search' }`** (`src/lib/supabase/server.ts`).

This doc is the complete work package for a Claude agent that has Supabase access (Dashboard SQL, CLI, or MCP). Do **not** change Next.js app code unless required to fix schema mismatches discovered below.

---

## Goal

Make Supabase fully operational for Phase 2–4:

1. Schema `job_search` exists and matches what the app expects
2. All migrations applied in order
3. Edge Functions deployed + secrets set
4. pg_cron schedules job pull + follow-up drafts
5. Storage bucket `resumes` for `.docx` uploads
6. Verify with SQL and a manual function invoke

---

## Critical schema note (do this first)

The **Next.js app uses schema `job_search`**, but early migrations (`001`, `002`, `004`, `005`, `006`) create tables in **`public`** with no schema prefix. Later files (`007`) reference `job_search.jobs`.

### Agent task A — Resolve schema inconsistency

**Preferred approach (if project is empty / greenfield):**

1. Create schema:
   ```sql
   CREATE SCHEMA IF NOT EXISTS job_search;
   GRANT USAGE ON SCHEMA job_search TO anon, authenticated, service_role;
   GRANT ALL ON ALL TABLES IN SCHEMA job_search TO anon, authenticated, service_role;
   ALTER DEFAULT PRIVILEGES IN SCHEMA job_search
     GRANT ALL ON TABLES TO anon, authenticated, service_role;
   ```
2. Either:
   - **Option 1:** Re-run DDL under `job_search` (prefix all tables: `job_search.companies`, etc.), **or**
   - **Option 2:** Move existing public tables:
     ```sql
     ALTER TABLE public.companies SET SCHEMA job_search;
     -- repeat for jobs, applications, resume_versions, contacts,
     -- outreach_messages, settings, opportunities
     ```
3. Expose schema to API: Supabase Dashboard → **Settings → API → Exposed schemas** → add `job_search` (in addition to `public`).
4. Confirm PostgREST can see tables: REST or Table Editor should list `job_search.*`.

**If production already has data in `public`:** move tables to `job_search` (Option 2) and update any leftover constraints/indexes. Do not drop data.

**Also fix source CHECK** so all providers are allowed on the live table:

```sql
ALTER TABLE job_search.jobs DROP CONSTRAINT IF EXISTS jobs_source_check;
ALTER TABLE job_search.jobs ADD CONSTRAINT jobs_source_check
  CHECK (source IN (
    'indeed', 'ziprecruiter', 'manual', 'adzuna', 'linkedin', 'remoteok'
  ));
```

Add columns if missing (from 002):

```sql
ALTER TABLE job_search.jobs
  ADD COLUMN IF NOT EXISTS fit_score SMALLINT,
  ADD COLUMN IF NOT EXISTS fit_reasons TEXT[];
```

---

## Migration order (apply if not already applied)

Run in Supabase **SQL Editor** (or `supabase db push` if CLI linked), after schema fix:

| # | File | Purpose |
|---|------|---------|
| 001 | `supabase/migrations/001_initial_schema.sql` | Core tables + seed settings |
| 002 | `supabase/migrations/002_opportunity_centre.sql` | fit_score, opportunities, profile/search seeds |
| 003 | `supabase/migrations/003_schedule_job_pull.sql` | pg_cron daily-job-pull (needs vault secrets first) |
| 004 | `supabase/migrations/004_adzuna_source.sql` | source = adzuna |
| 005 | `supabase/migrations/005_linkedin_source.sql` | source = linkedin |
| 006 | `supabase/migrations/006_indexes.sql` | indexes |
| 007 | `supabase/migrations/007_remoteok_source.sql` | source = remoteok (prefer the unified CHECK above) |
| 008 | `supabase/migrations/008_schedule_follow_ups.sql` | pg_cron follow-up-scheduler |
| 009 | `supabase/migrations/009_resume_storage.sql` | Storage bucket `resumes` |

**Adapt 001–006** to `job_search.` table names if you recreate from scratch. Do not blindly run 001 on a live DB that already has tables (will fail on CREATE).

### Idempotent verification queries

```sql
-- Tables present?
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema = 'job_search'
ORDER BY table_name;

-- Source constraint allows remoteok + adzuna?
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'job_search.jobs'::regclass
  AND contype = 'c';

-- Settings keys
SELECT key, updated_at FROM job_search.settings ORDER BY key;
```

---

## Edge Functions

### Deploy

From repo root (Claude should use Supabase CLI if available):

```bash
npx supabase login
npx supabase link --project-ref <PROJECT_REF>

npx supabase secrets set \
  ADZUNA_APP_ID=<id> \
  ADZUNA_APP_KEY=<key>

# Optional:
# npx supabase secrets set INDEED_PUBLISHER_ID=<id>
# npx supabase secrets set REMOTEOK_ENABLED=false   # only to disable RemoteOK

npx supabase functions deploy daily-job-pull
npx supabase functions deploy follow-up-scheduler
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically on hosted functions.

**Important:** Edge Functions use the **default** Supabase client (usually `public` schema). If tables live only in `job_search`, the functions must either:

- Use `.schema('job_search')` on the client, **or**
- Set search_path / use fully qualified names

### Agent task B — Align Edge Function schema

Edit both:

- `supabase/functions/daily-job-pull/index.ts`
- `supabase/functions/follow-up-scheduler/index.ts`

After `createClient(...)`, ensure queries hit `job_search`:

```ts
const supabase = createClient(supabaseUrl, serviceKey, {
  db: { schema: 'job_search' },
  auth: { persistSession: false },
})
```

Redeploy both functions after the change.

### Manual test

```bash
curl -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/daily-job-pull" \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"source":"manual"}'
```

Expect JSON like:

```json
{
  "ok": true,
  "inserted": ...,
  "providers": { "adzuna": true, "remoteok": true, "indeed": false }
}
```

```bash
curl -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/follow-up-scheduler" \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

---

## Vault + pg_cron

### Prerequisites

Dashboard → **Database → Extensions**: enable `pg_cron`, `pg_net`, and `supabase_vault` (or `vault`) if needed.

### Secrets (once)

```sql
-- Replace placeholders
SELECT vault.create_secret('https://<PROJECT_REF>.supabase.co', 'project_url');
SELECT vault.create_secret('<SERVICE_ROLE_KEY>', 'job_pull_auth_key');
```

If secrets already exist under those names, skip or update per vault docs.

### Schedules

Apply (or re-apply) after vault secrets exist:

- `003_schedule_job_pull.sql` → job name `daily-job-pull` (12:00 UTC)
- `008_schedule_follow_ups.sql` → job name `daily-follow-up-scheduler` (13:00 UTC)

Verify:

```sql
SELECT jobid, jobname, schedule, active FROM cron.job
WHERE jobname IN ('daily-job-pull', 'daily-follow-up-scheduler');
```

---

## Storage (`resumes` bucket)

Apply `009_resume_storage.sql`, or create via Dashboard:

- Bucket id/name: **`resumes`**
- **Private** (not public)
- Allowed MIME: `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- Size limit: 5 MB

Policies: service_role must be able to INSERT/SELECT objects in `resumes` (Next.js uploads with `SUPABASE_SERVICE_ROLE_KEY` when set).

Verify:

```sql
SELECT id, name, public FROM storage.buckets WHERE id = 'resumes';
```

---

## Seed / settings expected by the app

| key | Shape |
|-----|--------|
| `search_terms` | `{ "terms": string[], "locations": string[] }` |
| `follow_up_offsets` | `{ "follow_up_1_days": number, "follow_up_2_days": number }` |
| `base_resume` | string markdown **or** `{ "content": "..." }` / `{ "markdown": "..." }` |
| `profile` | JSON profile object (see 002 seed) |

Optional seed improvement (BD-focused terms already in 002):

```sql
UPDATE job_search.settings
SET value = '{
  "terms": [
    "business development manager",
    "account executive",
    "strategic account manager",
    "partnerships manager",
    "director business development",
    "sales manager",
    "client partnerships",
    "B2B sales"
  ],
  "locations": ["Ottawa", "Ontario", "Canada", "Remote"]
}'::jsonb,
updated_at = NOW()
WHERE key = 'search_terms';
```

---

## RLS (optional but recommended)

v1 is single-user with open anon access. If the Vercel URL is public, recommend:

1. Enable Supabase Auth (email magic link is enough for one user)
2. Enable RLS on all `job_search` tables
3. Policies: `auth.role() = 'authenticated'` full access for Tyler’s user only

**Do not enable RLS without Auth wired in the Next app** or the UI will break. If implementing Auth is out of scope, leave RLS off and document that Vercel deployment protection / password is required.

---

## Definition of done (checklist for Claude)

- [ ] Schema `job_search` exists and is exposed in API settings
- [ ] All core tables in `job_search` with `fit_score` / `fit_reasons` on jobs
- [ ] `jobs_source_check` allows `adzuna`, `linkedin`, `remoteok`, `manual`, `indeed`, `ziprecruiter`
- [ ] Settings rows: `search_terms`, `follow_up_offsets`, `profile` (and optionally `base_resume`)
- [ ] Edge Functions use `db: { schema: 'job_search' }` and are redeployed
- [ ] Secrets: `ADZUNA_APP_ID`, `ADZUNA_APP_KEY` set on functions
- [ ] Manual `daily-job-pull` returns `ok: true` and can insert rows
- [ ] Manual `follow-up-scheduler` returns `ok: true`
- [ ] Vault secrets `project_url` + `job_pull_auth_key` exist
- [ ] Cron jobs `daily-job-pull` and `daily-follow-up-scheduler` are active
- [ ] Storage bucket `resumes` exists (private)
- [ ] Document any deviations in a short comment on this file or a PR description

---

## Out of scope for this handoff

- Next.js UI changes (except if Edge Function schema fix needs a matching app change — it should not)
- Gmail OAuth
- Apollo billing / API key procurement (key is an env var on Vercel, not Supabase)
- Anthropic key (Vercel / Next only)

---

## Files to read

- `src/lib/supabase/server.ts` — confirms `job_search` schema
- `src/types/database.ts` — table shapes
- `supabase/functions/daily-job-pull/index.ts`
- `supabase/functions/follow-up-scheduler/index.ts`
- `supabase/migrations/*.sql`
- `docs/DAILY_JOB_PULL.md`
- `docs/PHASE_2_3_4.md`
