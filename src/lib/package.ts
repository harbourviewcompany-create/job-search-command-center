import { DEFAULT_PROFILE, profileToResumeMarkdown, type Profile } from './profile'

export interface TailoredPackage {
  resumeMarkdown: string
  coverNote: string
  focusBullets: string[]
}

/**
 * Fast, deterministic tailoring (no API key required).
 * Emphasizes experience lines that match JD keywords; rewrites summary slightly.
 * When ANTHROPIC_API_KEY is set, callers can swap in LLM polish later.
 */
export function tailorPackage(
  job: { title: string; description?: string | null; companies?: { name: string } | null },
  profile: Profile = DEFAULT_PROFILE
): TailoredPackage {
  const jd = `${job.title} ${job.description ?? ''}`.toLowerCase()
  const company = job.companies?.name ?? 'your team'

  // Pick experience highlights that overlap JD words
  const scored = profile.experience_highlights.map((h) => {
    const words = h.toLowerCase().split(/\W+/).filter((w) => w.length > 4)
    const hits = words.filter((w) => jd.includes(w)).length
    return { h, hits }
  })
  scored.sort((a, b) => b.hits - a.hits)
  const focusBullets = scored.slice(0, 4).map((s) => s.h)

  // Skills that appear in JD first
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

  return { resumeMarkdown, coverNote, focusBullets }
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

Tyler Campbell
${profile.email}
${profile.linkedin}
`
}

/** Full base resume for settings / export */
export function baseResumeMarkdown(profile: Profile = DEFAULT_PROFILE): string {
  return profileToResumeMarkdown(profile)
}
