# Job Search Command Center — Full Optimization Checklist
**Owner:** Tyler Campbell  
**Goal:** Maximize relevant Ottawa + remote BD / Account / Partnerships opportunities with tailored materials and network leverage.

---

## A. Profile & Data (do first — 30–45 min)

- [x] Enhanced `src/lib/profile.ts` pushed to main
- [x] Enhanced `src/lib/scoring.ts` with tiers + Ottawa/remote emphasis
- [x] `src/lib/remoteok.ts` adapter added
- [ ] Copy `docs/optimization/BASE_RESUME.md` into Settings → base_resume
- [ ] Load `docs/optimization/search_terms.json` into Settings
- [ ] Run a manual job pull and verify scoring produces sensible tiers

## B. Scoring & Sources

- [x] Scoring improvements live on main
- [ ] Add migration to allow `source = 'remoteok'` if CHECK constraint still restricts values
- [ ] Integrate RemoteOK into daily pull / `/api/jobs/pull`
- [ ] Optional: add Remotive or Jobicy free feeds
- [ ] Test: Pull jobs → triage → Interested → Generate package

## C. Tailored Package Generation (highest conversion lever)

- [ ] Implement Anthropic (or preferred LLM) call using `docs/optimization/tailored_package_prompt.md`
- [ ] Wire GeneratePackageButton to produce resume + cover → store in resume_versions + Storage
- [ ] Enforce human review before status can move to “Applied”
- [ ] Test on 2–3 real Interested jobs and refine the prompt if needed

## D. Target Companies & Network

- [ ] Load `docs/optimization/target_companies.md` into a watchlist
- [ ] For Tier 1 companies: find careers page + any Greenhouse/Lever/Ashby slug
- [ ] Weekly review of Tier 1 + Tier 2 open roles → import into app
- [ ] Use `docs/optimization/linkedin_outreach_templates.md` for 5–10 quality messages per week
- [ ] Log every outreach in Contacts + Outreach tables

## E. Operating Rhythm (human + AI)

| Cadence | Action |
|---------|--------|
| Daily | Review new Found jobs (score ≥ 55 first). Mark Interested / Pass. Generate package for any you will apply to same day. |
| 3× week | 5–10 LinkedIn outreach messages (warm first). |
| Weekly | Target company career-page sweep. Update pipeline statuses. Review response rates by source. |
| Weekly | Follow-up on applications that are 5–7 days old with no reply. |
| Bi-weekly | Review which sources and keywords produced interviews; adjust search_terms. |

## F. Quality Rules (non-negotiable)

1. Never apply with an un-reviewed AI package.
2. Prefer 8–12 high-quality tailored applications per week over 30+ generic ones.
3. Every application should ideally have a human touch (LinkedIn note or mutual intro).
4. Track response rate and interview conversion — double down on what works.
5. Keep Harbourview founder story as a differentiator on commercial roles.

## G. Success Metrics (track in dashboard)

- Applications submitted / week
- Response rate (any reply)
- Interview conversion rate
- Source of best leads (network vs board vs Adzuna vs RemoteOK)
- Time from “Interested” → “Applied” (aim < 48 h for strong matches)

---

## Immediate 48-hour sprint

1. Paste BASE_RESUME into Settings + load search terms.
2. Generate packages for any current strong matches.
3. Send 8–10 warm LinkedIn messages using the templates.
4. Import 5–10 open roles from Tier 1 companies.

This combination of precise targeting, tailored materials, and network activation is what converts for a profile like yours.
