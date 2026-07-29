# LinkedIn integration

## Reality check (2026)

LinkedIn **does not offer a public Job Search API** for individuals or most apps.

| Product | What it does | Access |
|---------|--------------|--------|
| **Job Posting API** | Post jobs *to* LinkedIn | Partner-only; not accepting many new partners |
| **Apply Connect / Apply with LinkedIn** | Employer apply flows | Enterprise / ATS partners |
| **Recruiter System Connect** | ATS ↔ Recruiter | Enterprise, long sales cycle |
| **Consumer / Sign In** | Login + limited profile | Available; **no job search** |

Third-party “LinkedIn Jobs APIs” on marketplaces are almost always **scrapers**. They violate LinkedIn’s ToS, are brittle, and conflict with this product’s non-goal of no unofficial scraping.

---

## What this app implements (legitimate)

### 1. Deep-link job search
On **Jobs**, one-click links open LinkedIn Jobs search with your saved terms and locations (past 24 hours, newest first). You review on LinkedIn; nothing is scraped.

### 2. Import by URL
Paste a `linkedin.com/jobs/view/...` URL + title, company, and optional description. We:

- Parse the job id when possible
- Store `source = linkedin`
- Score against your profile
- Add to the triage queue

### 3. Future partner hook
If you ever obtain official Talent/partner credentials, extend `daily-job-pull` with a LinkedIn provider behind env flags. Do **not** wire unofficial scrapers into production.

---

## Setup

1. Run migration `005_linkedin_source.sql` in Supabase SQL Editor.
2. No LinkedIn API keys required for deep links or import.
3. Optional: create a LinkedIn Developer app only if you later pursue partner products (Sign In, etc.) — not needed for job search as built today.

---

## Workflow that works

1. Click a **Open on LinkedIn** chip for your BD search terms  
2. Open strong listings → copy URL + paste description bullets  
3. **Import & score** → Interested → **Generate package** → Apply on LinkedIn  
4. Mark **Applied** in the pipeline  

That is the lowest-friction path that stays on the right side of LinkedIn’s rules.
