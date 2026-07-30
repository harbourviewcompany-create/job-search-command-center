# Daily job pull setup

## Why Adzuna (not Indeed directly)

Indeed’s public Job Search / Publisher API is **no longer available** to general developers. Official Indeed APIs are partner-only (Job Sync for ATS, Sponsored Jobs, etc.).

**Adzuna** is an official free job-search API that aggregates listings across Canada (and other countries), including many postings that also appear on Indeed and other boards. That matches the product non-goal of no unofficial scraping.

**RemoteOK** is a free public JSON API (`https://remoteok.com/api`) for remote roles. No API key. Enabled by default in `daily-job-pull`; set Edge secret `REMOTEOK_ENABLED=false` to disable.

Optional: if you still have a legacy `INDEED_PUBLISHER_ID`, the Edge Function will also call the old Indeed endpoint; expect it to fail if the key is inactive.

---

## 1. Get Adzuna credentials (5 minutes)

1. Register at [https://developer.adzuna.com/signup](https://developer.adzuna.com/signup)
2. Create an application
3. Copy **App ID** and **App Key**

---

## 2. Database migrations

In Supabase SQL Editor, run if not already applied:

- `001_initial_schema.sql`
- `002_opportunity_centre.sql`
- `004_adzuna_source.sql`  ← allows `source = 'adzuna'`
- `005_linkedin_source.sql`
- `007_remoteok_source.sql`  ← allows `source = 'remoteok'`

---

## 3. Deploy the Edge Function

```bash
# From repo root (requires Supabase CLI linked to your project)
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF

npx supabase secrets set \
  ADZUNA_APP_ID=your_app_id \
  ADZUNA_APP_KEY=your_app_key

# Optional legacy Indeed
# npx supabase secrets set INDEED_PUBLISHER_ID=your_id

# Optional: disable RemoteOK
# npx supabase secrets set REMOTEOK_ENABLED=false

npx supabase functions deploy daily-job-pull
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically in hosted functions.

---

## 4. Schedule daily (pg_cron)

1. Enable extensions: **Database → Extensions →** `pg_cron`, `pg_net`
2. Vault secrets (SQL):

```sql
select vault.create_secret('https://YOUR_PROJECT_REF.supabase.co', 'project_url');
select vault.create_secret('YOUR_SERVICE_ROLE_KEY', 'job_pull_auth_key');
```

3. Run `supabase/migrations/003_schedule_job_pull.sql`  
   Default schedule: **12:00 UTC daily** (`0 12 * * *`). Edit the cron expression if you want 8 AM Eastern, etc.

4. Verify:

```sql
SELECT * FROM cron.job WHERE jobname = 'daily-job-pull';
```

---

## 5. Manual pull (no wait for cron)

App: **Jobs → Pull jobs now**  
or:

```bash
curl -X POST http://localhost:3000/api/jobs/pull
```

Requires `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` / Vercel env so Next can invoke the function.

Also set on Vercel / local Next:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Adzuna keys only need to live as **Edge Function secrets** (not necessarily in Next env).

---

## 6. What the pull does

1. Reads `settings.search_terms` (terms + locations)
2. Queries Adzuna Canada (`/jobs/ca/search`) for up to 12 term×location combos
3. Fetches RemoteOK once per run; keeps jobs matching search terms (cap 40)
4. Upserts companies by name
5. Inserts new jobs with `source = adzuna | remoteok | indeed`, deduped on `(source, external_id)`
6. Scores each job 0–100 against Tyler’s BD/trade profile
7. Skips jobs already Interested / Dismissed / Applied pipeline status

Tune terms anytime under **Settings** in the app.

---

## Troubleshooting

| Symptom | Check |
|--------|--------|
| `providers.adzuna: false` | Function secrets not set |
| `providers.remoteok: false` | `REMOTEOK_ENABLED=false` |
| 0 inserted, no error | Terms too narrow or rate limit — widen locations in Settings |
| Constraint error on source | Run `004_adzuna_source.sql` / `007_remoteok_source.sql` |
| Cron never fires | Vault secret names, pg_net enabled, cron.job row exists |
| Manual pull 500 | `SUPABASE_SERVICE_ROLE_KEY` missing from Next env |
