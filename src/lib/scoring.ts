import { DEFAULT_PROFILE, type Profile } from './profile'

export interface FitResult {
  score: number
  reasons: string[]
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9+.# ]/g, ' ')
}

/** Keyword overlap score 0–100 between job text and profile */
export function scoreJobAgainstProfile(
  job: {
    title: string
    description?: string | null
    location?: string | null
    remote?: boolean | null
  },
  profile: Profile = DEFAULT_PROFILE
): FitResult {
  const blob = normalize(
    [job.title, job.description ?? '', job.location ?? ''].join(' ')
  )
  const reasons: string[] = []
  let score = 20 // base

  // Title match against target titles
  const titleNorm = normalize(job.title)
  const titleHits = profile.target_titles.filter((t) => {
    const tn = normalize(t)
    return titleNorm.includes(tn) || tn.split(' ').every((w) => titleNorm.includes(w))
  })
  if (titleHits.length > 0) {
    score += 35
    reasons.push(`Title aligns with ${titleHits[0]}`)
  } else {
    // partial word overlap on title
    const titleWords = new Set(titleNorm.split(/\s+/).filter((w) => w.length > 3))
    const targetWords = profile.target_titles.flatMap((t) =>
      normalize(t).split(/\s+/).filter((w) => w.length > 3)
    )
    const overlap = targetWords.filter((w) => titleWords.has(w))
    if (overlap.length >= 2) {
      score += 18
      reasons.push(`Title keywords: ${[...new Set(overlap)].slice(0, 3).join(', ')}`)
    }
  }

  // Skills in description / title
  const skillHits = profile.skills.filter((s) => blob.includes(normalize(s)))
  if (skillHits.length >= 5) {
    score += 25
    reasons.push(`Strong skill match (${skillHits.length}): ${skillHits.slice(0, 4).join(', ')}`)
  } else if (skillHits.length >= 2) {
    score += 15
    reasons.push(`Skills: ${skillHits.slice(0, 4).join(', ')}`)
  } else if (skillHits.length === 1) {
    score += 8
    reasons.push(`Skill: ${skillHits[0]}`)
  }

  // Industry hints
  const industryHits = profile.industries.filter((i) => blob.includes(normalize(i)))
  if (industryHits.length > 0) {
    score += 12
    reasons.push(`Industry: ${industryHits[0]}`)
  }

  // Location / remote
  const loc = normalize(job.location ?? '')
  const locOk =
    job.remote ||
    profile.constraints.remote_ok && (loc.includes('remote') || loc.length === 0) ||
    profile.constraints.locations.some((l) => loc.includes(normalize(l)))
  if (locOk) {
    score += 10
    if (job.remote || loc.includes('remote')) reasons.push('Remote-friendly')
    else reasons.push('Location match')
  } else if (loc.length > 0) {
    score -= 15
    reasons.push('Location may not match')
  }

  // BD / sales signal boost (core strength)
  const bdSignals = ['business development', 'account manager', 'account executive', 'partnership', 'b2b', 'sales manager', 'revenue', 'client success']
  if (bdSignals.some((s) => blob.includes(s))) {
    score += 8
    if (!reasons.some((r) => r.startsWith('Title'))) reasons.push('BD/sales role signal')
  }

  score = Math.max(0, Math.min(100, score))
  if (reasons.length === 0) reasons.push('Limited keyword overlap — review manually')

  return { score, reasons }
}

/** Rank jobs in place by fit_score descending */
export function rankByFit<T extends { fit_score?: number | null }>(items: T[]): T[] {
  return [...items].sort((a, b) => (b.fit_score ?? 0) - (a.fit_score ?? 0))
}
