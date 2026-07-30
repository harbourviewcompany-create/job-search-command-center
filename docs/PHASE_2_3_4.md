# Phase 2 / 3 / 4 — what shipped on `phase-2-3-4`

## Phase 2 — Resume package

- `src/lib/package.ts`
  - Deterministic keyword tailoring (always available)
  - `tailorPackageWithAI()` when `ANTHROPIC_API_KEY` is set (Claude Messages API)
  - Falls back to deterministic on any API failure
- `src/app/applications/package-actions.ts` loads `settings.base_resume` when present
- Application detail shows **saved** cover + resume after generation
- **Applied is blocked** until a package exists (`resume_version_id` or `cover_note`)

### Env

```
ANTHROPIC_API_KEY=sk-ant-...
```

Optional: paste full markdown from `docs/optimization/BASE_RESUME.md` into Settings → base_resume for better LLM input.

### Not yet

- `.docx` render + Supabase Storage upload (`docx_url` column is ready)
- Gmail draft API

---

## Phase 3 — Outreach

- `src/lib/outreach.ts` — templates (warm, semi-warm, cold, after-apply, recruiter, follow-up) + optional AI polish
- `src/lib/apollo.ts` — people search when `APOLLO_API_KEY` is set
- `src/app/contacts/actions.ts` — add contact, Apollo lookup, create outreach draft, mark sent
- Contacts page: **Add contact** form
- Application detail: **Outreach** panel (draft → copy → mark sent)

### Env

```
APOLLO_API_KEY=...
ANTHROPIC_API_KEY=...   # optional polish for drafts
```

### Non-goals preserved

- No auto-send of email or LinkedIn messages
- Gmail OAuth draft creation still future work (`GOOGLE_*` env placeholders remain)

---

## Phase 4 — Automation

Already on main:

- `supabase/functions/daily-job-pull` (Adzuna + optional Indeed)
- Manual trigger `POST /api/jobs/pull`
- Dashboard follow-up due list from `applied_at` + `follow_up_offsets`

New on this branch:

- `supabase/functions/follow-up-scheduler` — creates **drafted** `outreach_messages` for aging applications
- `supabase/migrations/008_schedule_follow_ups.sql` — pg_cron at 13:00 UTC
- `supabase/migrations/007_remoteok_source.sql` — allow `source = remoteok`
- `src/lib/remoteok.ts` already existed; wire into Edge Function when ready

### Deploy follow-up function

```bash
npx supabase functions deploy follow-up-scheduler
# then run 008_schedule_follow_ups.sql in SQL editor
```

---

## Suggested next steps

1. Set `ANTHROPIC_API_KEY` on Vercel + local
2. Paste BASE_RESUME into settings
3. Merge this branch → deploy
4. Run migrations 007 + 008
5. Deploy `follow-up-scheduler`
6. (Optional) Apollo key + RemoteOK in daily-job-pull
