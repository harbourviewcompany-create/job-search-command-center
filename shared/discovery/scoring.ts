import { SOURCE_QUALITY } from './canonicalize'
import { normalizeEmploymentType, normalizeSeniority, normalizeText } from './normalize'
import type {
  JobProvider,
  ScoreDimensions,
  ScoreResult,
  ScoreThresholds,
  ScoreWeights,
  ScoringJob,
  SearchProfile,
} from './types'

export const DEFAULT_SCORE_WEIGHTS: ScoreWeights = {
  title: 0.22,
  responsibility: 0.16,
  experience: 0.14,
  industry: 0.1,
  seniority: 0.08,
  location: 0.1,
  compensation: 0.05,
  freshness: 0.06,
  companyPriority: 0.05,
  sourceQuality: 0.03,
  applicationEffort: 0.01,
}

export const DEFAULT_SCORE_THRESHOLDS: ScoreThresholds = {
  strong: 75,
  good: 55,
  review: 40,
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value))
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}

function phraseMatches(blob: string, phrase: string): boolean {
  const normalized = normalizeText(phrase)
  if (!normalized) return false
  if (blob.includes(normalized)) return true
  const words = normalized.split(' ').filter((word) => word.length > 2)
  return words.length > 0 && words.every((word) => blob.includes(word))
}

function matchingPhrases(blob: string, phrases: string[]): string[] {
  return phrases.filter((phrase) => phraseMatches(blob, phrase))
}

function tokenOverlap(left: string, right: string): number {
  const leftTokens = new Set(normalizeText(left).split(' ').filter(Boolean))
  const rightTokens = new Set(normalizeText(right).split(' ').filter(Boolean))
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0
  const overlap = [...leftTokens].filter((token) => rightTokens.has(token)).length
  return overlap / Math.max(leftTokens.size, rightTokens.size)
}

function titleDimension(title: string, profile: SearchProfile): { score: number; matches: string[] } {
  const normalizedTitle = normalizeText(title)
  const primary = profile.primaryTitles.filter((candidate) => phraseMatches(normalizedTitle, candidate))
  if (primary.length > 0) return { score: 100, matches: primary }

  const aliases = profile.titleAliases.filter((candidate) => phraseMatches(normalizedTitle, candidate))
  if (aliases.length > 0) return { score: 90, matches: aliases }

  const candidates = [...profile.primaryTitles, ...profile.titleAliases]
  const best = candidates.reduce(
    (current, candidate) => Math.max(current, tokenOverlap(normalizedTitle, candidate)),
    0
  )
  return { score: clamp(best * 85), matches: [] }
}

function locationDimension(job: ScoringJob, profile: SearchProfile): { score: number; disqualifier?: string } {
  const location = normalizeText(job.location)
  const remoteType = job.remoteType ?? (job.remote ? 'remote' : 'unknown')
  const isRemote = remoteType === 'remote'
  const isHybrid = remoteType === 'hybrid'
  const localMatch = profile.locations.some((candidate) => phraseMatches(location, candidate))

  if (profile.remotePolicy === 'remote_only' && !isRemote) {
    return { score: 0, disqualifier: 'Role is not fully remote.' }
  }
  if (profile.remotePolicy === 'local_only' && (isRemote || (!localMatch && !isHybrid))) {
    return { score: 0, disqualifier: 'Role is outside the accepted local geography.' }
  }
  if (profile.remotePolicy === 'remote_or_local' && !isRemote && !isHybrid && !localMatch) {
    return { score: 0, disqualifier: 'Role is neither remote nor in an accepted location.' }
  }

  if (isRemote && localMatch) return { score: 100 }
  if (isRemote) return { score: 95 }
  if (localMatch) return { score: 90 }
  if (isHybrid) return { score: 75 }
  return { score: profile.remotePolicy === 'any' ? 60 : 25 }
}

function freshnessDimension(
  job: ScoringJob,
  maximumAgeDays: number,
  now: Date
): { score: number; ageDays: number | null } {
  const timestamp = job.postedAt ?? job.firstSeenAt
  if (!timestamp) return { score: 50, ageDays: null }
  const time = new Date(timestamp).getTime()
  if (Number.isNaN(time)) return { score: 50, ageDays: null }
  const ageDays = Math.max(0, (now.getTime() - time) / 86_400_000)
  return {
    score: clamp(100 - (ageDays / Math.max(maximumAgeDays, 1)) * 80),
    ageDays,
  }
}

function compensationDimension(job: ScoringJob, profile: SearchProfile): { score: number; disqualifier?: string } {
  const floor = profile.minimumSalaryCad
  if (floor == null) return { score: job.salaryMin == null && job.salaryMax == null ? 55 : 80 }
  if (job.salaryMin == null && job.salaryMax == null) return { score: 50 }

  const currency = normalizeText(job.salaryCurrency ?? 'cad')
  if (currency && currency !== 'cad' && currency !== 'canadian dollar') return { score: 50 }
  const upper = job.salaryMax ?? job.salaryMin ?? 0
  if (upper < floor) {
    return { score: 0, disqualifier: `Published compensation is below the configured CAD ${floor.toLocaleString()} floor.` }
  }
  const lower = job.salaryMin ?? upper
  return { score: clamp(70 + ((lower - floor) / Math.max(floor, 1)) * 30) }
}

function seniorityDimension(job: ScoringJob, profile: SearchProfile): number {
  const seniority = normalizeSeniority(job.seniority ?? job.title)
  const titles = normalizeText([...profile.primaryTitles, ...profile.titleAliases].join(' '))
  const expectsLeadership = /director|head|chief|vice president|manager|lead/.test(titles)
  if (!seniority) return 55
  if (seniority === 'junior') return expectsLeadership ? 10 : 55
  if (seniority === 'executive' || seniority === 'director') return expectsLeadership ? 95 : 70
  if (seniority === 'manager' || seniority === 'senior') return 90
  return expectsLeadership ? 55 : 75
}

function sourceQualityDimension(source: string | null | undefined, profile: SearchProfile): number {
  if (!source) return 40
  const configured = profile.sourcePriority?.[source as JobProvider]
  if (typeof configured === 'number') return clamp(configured)
  return SOURCE_QUALITY[source] ?? 40
}

function employmentDisqualifier(job: ScoringJob, profile: SearchProfile): string | null {
  if (profile.employmentTypes.length === 0 || !job.employmentType) return null
  const normalized = normalizeEmploymentType(job.employmentType)
  const accepted = profile.employmentTypes
    .map((value) => normalizeEmploymentType(value))
    .filter((value): value is string => Boolean(value))
  return normalized && accepted.includes(normalized)
    ? null
    : 'Employment type is outside this search lane.'
}

function tierFor(score: number, thresholds: ScoreThresholds): ScoreResult['tier'] {
  if (score >= thresholds.strong) return 'strong'
  if (score >= thresholds.good) return 'good'
  if (score >= thresholds.review) return 'review'
  return 'weak'
}

export function scoreJob(
  job: ScoringJob,
  profile: SearchProfile,
  options: {
    weights?: Partial<ScoreWeights>
    thresholds?: Partial<ScoreThresholds>
    experienceTerms?: string[]
    industryTerms?: string[]
    now?: Date
  } = {}
): ScoreResult {
  const weights = { ...DEFAULT_SCORE_WEIGHTS, ...(options.weights ?? {}) }
  const thresholds = { ...DEFAULT_SCORE_THRESHOLDS, ...(options.thresholds ?? {}) }
  const now = options.now ?? new Date()
  const blob = normalizeText([
    job.title,
    job.description,
    job.companyName,
    job.location,
    job.employmentType,
    job.seniority,
  ].filter(Boolean).join(' '))
  const title = titleDimension(job.title, profile)
  const requiredMatches = matchingPhrases(blob, profile.requiredTerms)
  const preferredMatches = matchingPhrases(blob, profile.preferredTerms)
  const experienceTerms = options.experienceTerms ?? profile.preferredTerms
  const industryTerms = options.industryTerms ?? profile.preferredTerms
  const experienceMatches = matchingPhrases(blob, experienceTerms)
  const industryMatches = matchingPhrases(blob, industryTerms)
  const location = locationDimension(job, profile)
  const compensation = compensationDimension(job, profile)
  const freshness = freshnessDimension(job, profile.maximumPostingAgeDays, now)

  const dimensions: ScoreDimensions = {
    title: title.score,
    responsibility: clamp(
      profile.requiredTerms.length === 0
        ? 50 + Math.min(50, preferredMatches.length * 12.5)
        : (requiredMatches.length / profile.requiredTerms.length) * 70 + Math.min(30, preferredMatches.length * 10)
    ),
    experience: clamp(35 + experienceMatches.length * 13),
    industry: clamp(35 + industryMatches.length * 15),
    seniority: seniorityDimension(job, profile),
    location: location.score,
    compensation: compensation.score,
    freshness: freshness.score,
    companyPriority: clamp(job.companyPriority ?? 50),
    sourceQuality: sourceQualityDimension(job.preferredSource, profile),
    applicationEffort: clamp(100 - (job.applicationEffort ?? 40)),
  }

  const disqualifiers: string[] = []
  if (job.lifecycleStatus === 'closed') disqualifiers.push('Posting is closed.')
  if (job.lifecycleStatus === 'expired') disqualifiers.push('Posting has expired.')
  if (location.disqualifier) disqualifiers.push(location.disqualifier)
  if (compensation.disqualifier) disqualifiers.push(compensation.disqualifier)
  const employmentIssue = employmentDisqualifier(job, profile)
  if (employmentIssue) disqualifiers.push(employmentIssue)

  const excludedTerm = profile.excludedTerms.find((term) => phraseMatches(blob, term))
  if (excludedTerm) disqualifiers.push(`Excluded term matched: ${excludedTerm}.`)
  const companyBlob = normalizeText(job.companyName)
  const excludedCompany = profile.excludedCompanies.find((company) => phraseMatches(companyBlob, company))
  if (excludedCompany) disqualifiers.push(`Company is excluded from this lane: ${excludedCompany}.`)
  if (profile.requiredTerms.length > 0 && requiredMatches.length === 0) {
    disqualifiers.push('None of the lane’s required concepts were found.')
  }
  if (freshness.ageDays != null && freshness.ageDays > profile.maximumPostingAgeDays) {
    disqualifiers.push(`Posting is older than ${profile.maximumPostingAgeDays} days.`)
  }

  const weighted = Object.entries(dimensions).reduce((total, [key, value]) => {
    return total + value * weights[key as keyof ScoreWeights]
  }, 0)
  const weightTotal = Object.values(weights).reduce((total, value) => total + value, 0) || 1
  const hardDisqualified = disqualifiers.length > 0
  const overallScore = round(
    hardDisqualified ? Math.min(20, weighted / weightTotal) : weighted / weightTotal
  )

  const reasons: string[] = []
  if (title.matches.length > 0) reasons.push(`Title aligns with ${title.matches[0]}.`)
  if (preferredMatches.length > 0) reasons.push(`Preferred concepts: ${preferredMatches.slice(0, 4).join(', ')}.`)
  if (requiredMatches.length > 0) reasons.push(`Required concepts: ${requiredMatches.slice(0, 4).join(', ')}.`)
  if (dimensions.location >= 90) reasons.push(job.remote ? 'Remote-friendly.' : 'Location aligns with the lane.')
  if (dimensions.freshness >= 80) reasons.push('Recently posted or first observed.')
  if (dimensions.sourceQuality >= 90) reasons.push('Direct employer source.')
  if (job.salaryMin != null || job.salaryMax != null) reasons.push('Published compensation was evaluated.')
  if (reasons.length === 0) reasons.push('Limited explicit alignment; review the responsibilities manually.')

  const roundedDimensions = Object.fromEntries(
    Object.entries(dimensions).map(([key, value]) => [key, round(value)])
  ) as unknown as ScoreDimensions

  return {
    overallScore,
    tier: tierFor(overallScore, thresholds),
    dimensions: roundedDimensions,
    hardDisqualified,
    disqualifiers,
    reasons,
    matchedTerms: [...new Set([...title.matches, ...requiredMatches, ...preferredMatches])],
    scoringVersion: 2,
  }
}

export function toLegacyFitResult(result: ScoreResult): {
  score: number
  reasons: string[]
  tier: ScoreResult['tier']
} {
  return {
    score: Math.round(result.overallScore),
    reasons: result.hardDisqualified
      ? [...result.reasons, ...result.disqualifiers]
      : result.reasons,
    tier: result.tier,
  }
}
