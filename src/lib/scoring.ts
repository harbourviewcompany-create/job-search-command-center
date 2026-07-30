import { DEFAULT_PROFILE, type Profile } from './profile'

export interface FitResult {
  score: number
  reasons: string[]
  tier?: 'strong' | 'good' | 'review' | 'weak'
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9+.# ]/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Keyword overlap score 0–100 between job text and profile — tuned for Tyler Campbell BD/Account profile */
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
  const titleNorm = normalize(job.title)
  const reasons: string[] = []
  let score = 15 // base

  // Title match against target titles (highest weight)
  const titleHits = profile.target_titles.filter((t) => {
    const tn = normalize(t)
    const words = tn.split(' ').filter((w) => w.length > 2)
    return titleNorm.includes(tn) || (words.length > 0 && words.every((w) => titleNorm.includes(w)))
  })
  if (titleHits.length > 0) {
    score += 38
    reasons.push(`Title aligns with ${titleHits[0]}`)
  } else {
    const titleWords = new Set(titleNorm.split(/\s+/).filter((w) => w.length > 3))
    const targetWords = profile.target_titles.flatMap((t) =>
      normalize(t).split(/\s+/).filter((w) => w.length > 3)
    )
    const overlap = [...new Set(targetWords.filter((w) => titleWords.has(w)))]
    if (overlap.length >= 2) {
      score += 20
      reasons.push(`Title keywords: ${overlap.slice(0, 3).join(', ')}`)
    }
  }

  // Skills in description / title
  const skillHits = profile.skills.filter((s) => blob.includes(normalize(s)))
  if (skillHits.length >= 6) {
    score += 22
    reasons.push(`Strong skill match (${skillHits.length}): ${skillHits.slice(0, 4).join(', ')}`)
  } else if (skillHits.length >= 3) {
    score += 14
    reasons.push(`Skills: ${skillHits.slice(0, 4).join(', ')}`)
  } else if (skillHits.length >= 1) {
    score += 7
    reasons.push(`Skill: ${skillHits[0]}`)
  }

  // Industry hints
  const industryHits = profile.industries.filter((i) => blob.includes(normalize(i)))
  if (industryHits.length > 0) {
    score += 12
    reasons.push(`Industry: ${industryHits[0]}`)
  }

  // Location / remote — critical for Ottawa + remote preference
  const loc = normalize(job.location ?? '')
  const remoteMatch =
    job.remote === true ||
    (profile.constraints.remote_ok &&
      (loc.includes('remote') || loc.includes('work from home') || loc.includes('anywhere')))
  const locationMatch = profile.constraints.locations.some((l) => loc.includes(normalize(l)))

  if (remoteMatch && locationMatch) {
    score += 14
    reasons.push('Ottawa/remote match')
  } else if (remoteMatch) {
    score += 12
    reasons.push('Remote-friendly')
  } else if (locationMatch) {
    score += 12
    reasons.push('Location match (Ottawa/ON)')
  } else if (loc.length > 0) {
    score -= 18
    reasons.push('Location may not match (prefer Ottawa or remote)')
  }

  // Boost keywords
  const boostHits = (profile.keywords_boost || []).filter((k) => blob.includes(normalize(k)))
  if (boostHits.length >= 3) {
    score += 8
    reasons.push(`Strong BD signal: ${boostHits.slice(0, 3).join(', ')}`)
  }

  // Penalty keywords (junior / low-fit)
  const penaltyHits = (profile.keywords_penalty || []).filter((k) => blob.includes(normalize(k)))
  if (penaltyHits.length > 0) {
    score -= 20
    reasons.push(`Possible junior/low-fit signal: ${penaltyHits[0]}`)
  }

  // BD / sales specific signal
  const bdPhraseSignals = [
    'business development',
    'account manager',
    'account executive',
    'key account',
    'partnership',
    'client success',
    'client partnerships',
    'market access',
    'commercial development',
  ]
  const bdTitleSignals = ['b2b', 'revenue', 'sales manager', 'bd manager']
  const bdSignalHit =
    bdPhraseSignals.some((s) => blob.includes(s)) ||
    bdTitleSignals.some((s) => titleNorm.includes(s))
  if (bdSignalHit) {
    score += 8
    if (!reasons.some((r) => r.toLowerCase().includes('title') || r.toLowerCase().includes('bd'))) {
      reasons.push('BD/sales role signal')
    }
  }

  score = Math.max(0, Math.min(100, score))

  let tier: FitResult['tier'] = 'weak'
  if (score >= 75) tier = 'strong'
  else if (score >= 55) tier = 'good'
  else if (score >= 40) tier = 'review'

  if (reasons.length === 0) reasons.push('Limited keyword overlap — review manually')

  return { score, reasons, tier }
}
