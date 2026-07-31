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
2. Open **SQL Editor** → paste and run `supabase/migrations/001_initial_schema.sql`.
3. Copy **Project URL** and **anon key** (Settings → API).
4. Optionally copy the **service_role** key for future Edge Functions / cron.

### 3. Environment

```bash
cp .env.example .env.local
```

Fill in:

```text
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # optional for Phase 1 UI
JOB_PULL_API_KEY=<long-random-secret>
JOB_PULL_SESSION_SECRET=<optional-independent-cookie-signing-secret>
```

`JOB_PULL_API_KEY` protects manual provider pulls. In the current single-user configuration, open `/jobs`, enter this value in the **Manual job-pull access key** field, and select **Unlock pulls**. The server validates the key and issues a signed, HttpOnly, SameSite=Strict browser cookie for 12 hours; the key is not stored in browser-readable state. Select **Lock** to remove browser access. A future Supabase-authenticated session is also accepted automatically. `JOB_PULL_SESSION_SECRET` is optional; when omitted, `JOB_PULL_API_KEY` signs the access cookie.

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) → redirects to `/dashboard`.

Add a few jobs via **Jobs → Add job manually**, mark Interested, then advance them on the **Pipeline** kanban.

---

## Deploy to Vercel

1. Push this repo (already on GitHub).
2. In [vercel.com](https://vercel.com) → **Add New Project** → import `harbourviewcompany-create/job-search-command-center`.
3. Framework preset: **Next.js** (auto-detected).
4. Add the same env vars as `.env.local`, including `JOB_PULL_API_KEY` when manual pulls are enabled. Keep `JOB_PULL_API_KEY`, `JOB_PULL_SESSION_SECRET`, and `SUPABASE_SERVICE_ROLE_KEY` server-only; never prefix them with `NEXT_PUBLIC_`.
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

See `supabase/migrations/001_initial_schema.sql` for the full DDL. High-level:

- **companies** — name, domain, notes  
- **jobs** — source, title, description, url, status (`found` / `interested` / `dismissed`)  
- **applications** — one per pursued job; status pipeline  
- **resume_versions** — tailored markdown + Storage URL (Phase 2)  
- **contacts** — people at target companies (Phase 3)  
- **outreach_messages** — drafts + sent log with cadence (Phase 3–4)  
- **settings** — JSON blobs for search terms, offsets, base resume  

Single-user for v1 (no RLS enforced yet; use the anon key in the browser). Manual provider pulls are separately protected by the server-side access-key/cookie mechanism described above.

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

- Single-user only for v1 — auth can stay minimal (or add Supabase Auth later).  
- Base resume stored as a markdown blob in `settings` for now; structured sections can be added when Phase 2 needs cleaner prompt construction.  
- Apollo cost: confirm budget before wiring contact lookup in Phase 3.  

---

## Development notes

- Server Actions for all mutations (`src/app/*/actions.ts`).  
- Types in `src/types/database.ts` mirror the SQL schema.  
- Tailwind + small set of utility classes (`btn-primary`, `card`, `input`, `badge`).  
- No auto-apply / auto-send paths exist and should not be introduced without revisiting the non-goals.

---

## License

Private — Harbourview / Tyler Campbell.
