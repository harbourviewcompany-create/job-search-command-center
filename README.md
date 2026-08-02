# Job Search Command Center

Personal decision-support tool that turns job hunting into a tracked pipeline: find roles, triage fast, track applications, and never drop a follow-up.

**Stack:** Next.js 15 (App Router) · Supabase · Vercel  
**Owner:** Tyler Campbell  
**Status:** Phase 1 MVP implemented — ready for local + Vercel deploy

---

## What is built (Phase 1)

| Area | Status |
|------|--------|
| Supabase schema (companies, jobs, applications, contacts, outreach, settings) | ✅ |
| Dashboard — pipeline counts, new postings, due follow-ups | ✅ |
| Jobs triage — list + Interested / Pass / Undo | ✅ |
| Manual job entry | ✅ |
| Applications kanban (Interested → Closed) | ✅ |
| Application detail + notes + status controls | ✅ |
| Contacts directory (read-only shell) | ✅ |
| Settings — search terms, follow-up cadence, base resume | ✅ |
| AI resume tailoring / cover notes | Phase 2 |
| Contact research (Apollo) + outreach drafts | Phase 3 |
| Gmail draft integration | Phase 3 |
| Daily job pull (Indeed / ZipRecruiter + cron) | Phase 4 |
| Follow-up scheduler | Phase 4 |

Explicit non-goals (unchanged from product spec):

- No auto-submission to ATS portals  
- No auto-sending email  
- No background scraping outside official APIs  
- No unattended scheduling beyond the future daily job pull  

---

## Quick start

### 1. Clone & install

```bash
git clone https://github.com/harbourviewcompany-create/job-search-command-center.git
cd job-search-command-center
npm install
```

### 2. Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. Apply all SQL files in `supabase/migrations` in numeric order: `001_initial_schema.sql`, `002_opportunity_centre.sql`, `003_operator_boundary_rls.sql`, and `004_jobs_effective_timestamp.sql`.
3. Copy the **Project URL**, **anon key**, and **service_role key** from Supabase project settings.
4. Keep the service-role key server-only. Migration 003 makes browser database roles read-only and requires authorized server mutations to use the service role. Migration 004 adds the indexed effective timestamp used for database-side newest and oldest pagination.

### 3. Environment

```bash
cp .env.example .env.local
```

Fill in:

```text
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # required, server-only
JOB_PULL_API_KEY=<long-random-secret>
JOB_PULL_SESSION_SECRET=<optional-independent-cookie-signing-secret>
```

`SUPABASE_SERVICE_ROLE_KEY` is required for protected mutations and must never appear in client code or a `NEXT_PUBLIC_*` variable. The anon key can read the tables needed by the current UI, but migration 003 revokes its insert, update, delete, truncate, reference, trigger, and sequence privileges. Direct browser REST writes are denied by Postgres even when an application route is bypassed.

`JOB_PULL_API_KEY` is required for the current single-user deployment unless Supabase Auth has been wired. It protects browser-triggered job creation, LinkedIn imports, job and application status changes, settings, contacts, packages, outreach, rescoring, and manual provider pulls. Open `/jobs`, enter this value in the **Operator access key** field, and select **Unlock operator**. The server validates the key and issues a signed, HttpOnly, SameSite=Strict browser cookie for 12 hours; the key is not stored in browser-readable state. Select **Lock** to remove cookie-based access. A Supabase-authenticated session is also accepted automatically. `JOB_PULL_SESSION_SECRET` is optional; when omitted, `JOB_PULL_API_KEY` signs the access cookie.

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) → redirects to `/dashboard`.

Unlock operator access on `/jobs`, add a few jobs via **Add job manually**, mark Interested, then advance them on the **Pipeline** kanban.

---

## Deploy to Vercel

1. Push this repo (already on GitHub).
2. In [vercel.com](https://vercel.com) → **Add New Project** → import `harbourviewcompany-create/job-search-command-center`.
3. Framework preset: **Next.js** (auto-detected).
4. Add the same env vars as `.env.local`. `JOB_PULL_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are required for the single-user configuration. Keep `JOB_PULL_API_KEY`, `JOB_PULL_SESSION_SECRET`, and `SUPABASE_SERVICE_ROLE_KEY` server-only; never prefix them with `NEXT_PUBLIC_`.
5. Deploy. Production URL will be something like `https://job-search-command-center.vercel.app`.

Vercel auto-deploys on every push to `main`.

---

## App routes

| Path | Purpose |
|------|---------|
| `/dashboard` | Today’s triage queue, pipeline summary, due follow-ups |
| `/jobs` | Found / Interested lists + manual add |
| `/applications` | Full pipeline kanban |
| `/applications/[id]` | Job detail, status, notes |
| `/contacts` | Contact directory |
| `/settings` | Search terms, cadence, base resume |

---

## Data model (summary)

See `supabase/migrations/001_initial_schema.sql` for the base DDL, `003_operator_boundary_rls.sql` for database authorization, and `004_jobs_effective_timestamp.sql` for database-side date ordering. High-level:

- **companies** — name, domain, notes  
- **jobs** — source, title, description, url, status (`found` / `interested` / `dismissed`)  
- **applications** — one per pursued job; status pipeline  
- **resume_versions** — tailored markdown + Storage URL (Phase 2)  
- **contacts** — people at target companies (Phase 3)  
- **outreach_messages** — drafts + sent log with cadence (Phase 3–4)  
- **settings** — JSON blobs for search terms, offsets, base resume  

Single-user for v1. RLS is enabled. The anon and authenticated database roles have explicit read-only access to UI tables and no direct mutation privileges. Server Actions first require a Supabase-authenticated session or signed operator-access cookie, then perform writes through the server-only service-role client. New tables in the `job_search` schema are private by default until a migration explicitly grants access.

---

## Phase roadmap

**Phase 2 — Resume package**  
API route: base resume + job description → Anthropic → tailored markdown → `.docx` via a server-side renderer → Supabase Storage → `resume_versions` row. Cover-note generation in the same flow.

**Phase 3 — Outreach**  
Apollo (or similar) people search by company + title. Anthropic draft email. Gmail API creates a **draft** only (never sends server-side). Contacts + outreach tables already exist.

**Phase 4 — Automation**  
Supabase Edge Function on `pg_cron` (daily) calling Indeed + ZipRecruiter APIs with saved search terms; upsert into `jobs` with dedupe on `(source, external_id)`. Follow-up cron flags `outreach_messages` due based on `applied_at` + settings offsets; surfaces on dashboard.

---

## Open questions (from product spec)

- Single-user only for v1 — the operator key can later be replaced by full Supabase Auth and user-scoped RLS.  
- Base resume stored as a markdown blob in `settings` for now; structured sections can be added when Phase 2 needs cleaner prompt construction.  
- Apollo cost: confirm budget before wiring contact lookup in Phase 3.  

---

## Development notes

- Server Actions require operator authorization before writes and use `createServiceClient()` only after that check.  
- Browser-facing Supabase clients are read-only at both grants and RLS policy layers.  
- Types in `src/types/database.ts` mirror the SQL schema.  
- Tailwind + small set of utility classes (`btn-primary`, `card`, `input`, `badge`).  
- No auto-apply / auto-send paths exist and should not be introduced without revisiting the non-goals.

---

## License

Private — Harbourview / Tyler Campbell.
