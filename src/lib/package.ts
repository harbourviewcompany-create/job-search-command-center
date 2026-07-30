import {
  DEFAULT_PROFILE,
  profileToResumeMarkdown,
  type Profile,
} from './profile'

export interface TailoredPackage {
  resumeMarkdown: string
  coverNote: string
  focusBullets: string[]
  matchNotes?: string[]
  source: 'deterministic' | 'anthropic'
}

export interface PackageJobInput {
  title: string
  description?: string | null
  location?: string | null
  companies?: { name: string } | null
}

/**
 * Fast, deterministic tailoring (no API key required).
 * Emphasizes experience lines that match JD keywords; rewrites summary slightly.
 */
export function tailorPackage(
  job: PackageJobInput,
  profile: Profile = DEFAULT_PROFILE
): TailoredPackage {
  const jd = `${job.title} ${job.description ?? ''}`.toLowerCase()
  const company = job.companies?.name ?? 'your team'

  const scored = profile.experience_highlights.map((h) => {
    const words = h.toLowerCase().split(/\W+/).filter((w) => w.length > 4)
    const hits = words.filter((w) => jd.includes(w)).length
    return { h, hits }
  })
  scored.sort((a, b) => b.hits - a.hits)
  const focusBullets = scored.slice(0, 4).map((s) => s.h)

  const matchedSkills = profile.skills.filter((s) => jd.includes(s.toLowerCase()))
  const otherSkills = profile.skills.filter((s) => !matchedSkills.includes(s))
  const orderedSkills = [...matchedSkills, ...otherSkills]

  const tailoredSummary = buildSummary(job.title, company, profile, matchedSkills)

  const resumeMarkdown = `# ${profile.name}
${profile.headline}
${profile.location} · ${profile.email} · ${profile.linkedin}

## Professional Summary
${tailoredSummary}

## Core Competencies
${orderedSkills.join(' · ')}

## Selected Experience
${focusBullets.map((b) => `• ${b}`).join('\n')}

## Additional Background
${scored
  .slice(4)
  .map((s) => `• ${s.h}`)
  .join('\n')}
`

  const coverNote = buildCoverNote(job.title, company, profile, focusBullets, matchedSkills)

  return {
    resumeMarkdown,
    coverNote,
    focusBullets,
    matchNotes: focusBullets.slice(0, 2).map((b) => `Relevant: ${b}`),
    source: 'deterministic',
  }
}

/**
 * LLM-powered package when ANTHROPIC_API_KEY is set.
 * Falls back to deterministic on any failure so the UI never hard-fails.
 */
export async function tailorPackageWithAI(
  job: PackageJobInput,
  profile: Profile = DEFAULT_PROFILE,
  baseResumeMarkdown?: string
): Promise<TailoredPackage> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return tailorPackage(job, profile)
  }

  const base =
    baseResumeMarkdown?.trim() ||
    profileToResumeMarkdown(profile)

  const company = job.companies?.name ?? 'Unknown company'
  const userPrompt = `BASE RESUME (markdown):
${base}

TARGET JOB DESCRIPTION:
${job.description ?? '(no description provided — tailor from title only)'}

JOB TITLE: ${job.title}
COMPANY: ${company}
LOCATION: ${job.location ?? 'Not specified'}

CANDIDATE PROFILE CONSTRAINTS:
- Name: ${profile.name}
- Location preference: ${profile.constraints.locations.join(', ')}
- Remote OK: ${profile.constraints.remote_ok}
- Notes: ${profile.constraints.notes}

TASKS:
1. Produce a TAILORED RESUME in clean markdown that:
   - Keeps the same overall structure as the base resume
   - Reorders and emphasizes the 1–3 most relevant experiences for this specific role
   - Mirrors important keywords and phrases from the job description
   - Preserves all quantified results exactly as written
   - Removes or de-emphasizes experience that is clearly irrelevant
   - Keeps length to roughly 1–1.5 pages when rendered
   - Ends with the Core Competencies list (curated to the role)

2. Produce a COVER LETTER / COVER NOTE (3–5 short paragraphs) that:
   - Opens with a specific, concrete reason this role + company is a strong match
   - Highlights 1–2 of the strongest relevant achievements with numbers
   - Shows understanding of the company's context or the role's challenges
   - Closes with a clear, confident call to action
   - Is written in first person, professional but warm tone
   - Never claims experience that is not in the base resume

OUTPUT FORMAT (strict):
---RESUME---
[full tailored resume markdown]

---COVER---
[full cover letter text]

---MATCH_NOTES---
[2–4 bullet points explaining why this role is a good fit and any risks / gaps]`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system:
          'You are an elite executive resume writer and career strategist. You specialize in Business Development, Account Management, Partnerships, and Market Access roles. You write truthfully, quantify results, and mirror the language of the target job description without fabricating experience.',
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    if (!res.ok) {
      console.error('Anthropic error', res.status, await res.text())
      return tailorPackage(job, profile)
    }

    const data = await res.json()
    const text: string =
      data?.content?.map((b: { text?: string }) => b.text ?? '').join('') ?? ''

    const resumeMarkdown =
      extractSection(text, 'RESUME') ?? extractSection(text, 'resume') ?? ''
    const coverNote =
      extractSection(text, 'COVER') ?? extractSection(text, 'cover') ?? ''
    const matchBlock =
      extractSection(text, 'MATCH_NOTES') ??
      extractSection(text, 'match_notes') ??
      ''

    if (!resumeMarkdown.trim() || !coverNote.trim()) {
      return tailorPackage(job, profile)
    }

    const matchNotes = matchBlock
      .split('\n')
      .map((l) => l.replace(/^[-*•]\s*/, '').trim())
      .filter(Boolean)
      .slice(0, 6)

    const focusBullets = matchNotes.length
      ? matchNotes
      : tailorPackage(job, profile).focusBullets

    return {
      resumeMarkdown: resumeMarkdown.trim(),
      coverNote: coverNote.trim(),
      focusBullets,
      matchNotes,
      source: 'anthropic',
    }
  } catch (err) {
    console.error('tailorPackageWithAI failed', err)
    return tailorPackage(job, profile)
  }
}

function extractSection(text: string, name: string): string | null {
  const re = new RegExp(
    `---${name}---\\s*([\\s\\S]*?)(?=---[A-Z_]+---|$)`,
    'i'
  )
  // Fix: use real regex without over-escaping
  const re2 = new RegExp('---' + name + '---\\s*([\\s\\S]*?)(?=---[A-Z_]+---|$)', 'i')
  const m = text.match(re2)
  return m ? m[1].trim() : null
}

function buildSummary(
  title: string,
  company: string,
  profile: Profile,
  matchedSkills: string[]
): string {
  const skillBit =
    matchedSkills.length > 0
      ? ` with particular strength in ${matchedSkills.slice(0, 3).join(', ')}`
      : ''
  return `${profile.summary} Currently focused on ${title} opportunities${skillBit}. Interested in contributing to ${company}'s growth through disciplined business development, account leadership, and relationship-driven revenue.`
}

function buildCoverNote(
  title: string,
  company: string,
  profile: Profile,
  bullets: string[],
  matchedSkills: string[]
): string {
  const skillLine =
    matchedSkills.length > 0
      ? `My background in ${matchedSkills.slice(0, 3).join(', ')} maps directly to what this role requires.`
      : `My background in business development and account management maps closely to this role.`

  return `Hi —

I'm applying for the ${title} role at ${company}. ${skillLine}

Highlights:
${bullets
  .slice(0, 3)
  .map((b) => `• ${b}`)
  .join('\n')}

I would welcome a short conversation about how I can help open markets and deepen client relationships for your team.

${profile.name}
${profile.email}
${profile.linkedin}
`
}

/** Full base resume for settings / export */
export function baseResumeMarkdown(profile: Profile = DEFAULT_PROFILE): string {
  return profileToResumeMarkdown(profile)
}
