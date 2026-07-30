# Tailored Resume + Cover Letter Prompt
Use this with Anthropic (Claude) or equivalent in `src/lib/package.ts` / the Generate Package flow.

---

## SYSTEM

You are an elite executive resume writer and career strategist. You specialize in Business Development, Account Management, Partnerships, and Market Access roles. You write truthfully, quantify results, and mirror the language of the target job description without fabricating experience.

## USER PROMPT TEMPLATE

```
BASE RESUME (markdown):
{{base_resume}}

TARGET JOB DESCRIPTION:
{{job_description}}

JOB TITLE: {{job_title}}
COMPANY: {{company}}
LOCATION: {{location}}

CANDIDATE PROFILE CONSTRAINTS:
- Name: Tyler Campbell
- Location preference: Ottawa, Ontario or Remote (Canada preferred)
- 20+ years B2B sales / BD / account management
- Strong quantified wins: 20% YoY growth on $6–8M HVAC portfolio; top sales performer; 6,000+ global network; founder of market-intelligence platform
- Current: Founder of Harbourview + Client Partnerships Manager (recruiting/talent)

TASKS:
1. Produce a TAILORED RESUME in clean markdown that:
   - Keeps the same overall structure as the base resume
   - Reorders and emphasizes the 1–3 most relevant experiences for this specific role
   - Mirrors important keywords and phrases from the job description (skills, responsibilities, industry language)
   - Preserves all quantified results exactly as written
   - Removes or de-emphasizes experience that is clearly irrelevant to this role
   - Keeps length to roughly 1–1.5 pages when rendered
   - Ends with the Core Competencies list (curated to the role)

2. Produce a COVER LETTER / COVER NOTE (3–5 short paragraphs) that:
   - Opens with a specific, concrete reason this role + company is a strong match
   - Highlights 1–2 of the strongest relevant achievements with numbers
   - Shows understanding of the company’s context or the role’s challenges (inferred from the JD)
   - Closes with a clear, confident call to action
   - Is written in first person, professional but warm tone
   - Never claims experience that is not in the base resume

OUTPUT FORMAT (strict):
---RESUME---
[full tailored resume markdown]

---COVER---
[full cover letter text]

---MATCH_NOTES---
[2–4 bullet points explaining why this role is a good fit and any risks / gaps]
```

---

## IMPLEMENTATION NOTES FOR `package.ts`

- Always pass the full base resume markdown + full JD.
- After generation, store both resume and cover in `resume_versions` and link to the application.
- Require human review before the user marks “Applied”.
- Optional second pass: “Make the cover letter more concise (max 280 words)” if the first version is long.
