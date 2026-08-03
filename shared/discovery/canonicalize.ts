import { normalizeText, normalizeUrl, stableHash } from './normalize'
import type { NormalizedSourcePosting } from './types'

export interface CanonicalCandidate {
  canonicalKey: string
  normalizedTitle: string
  normalizedCompany: string
  normalizedLocation: string
  method: 'apply_url' | 'company_title_location_week'
}

function weekBucket(value: string | null): string {
  if (!value) return 'unknown'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'unknown'
  const day = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() - day + 1)
  return date.toISOString().slice(0, 10)
}

export function canonicalizePosting(posting: NormalizedSourcePosting): CanonicalCandidate {
  const normalizedTitle = normalizeText(posting.title)
  const normalizedCompany = normalizeText(posting.companyName)
  const normalizedLocation = normalizeText(posting.location)
  const normalizedApplyUrl = normalizeUrl(posting.applyUrl)

  if (normalizedApplyUrl) {
    return {
      canonicalKey: stableHash(`url|${normalizedApplyUrl}`),
      normalizedTitle,
      normalizedCompany,
      normalizedLocation,
      method: 'apply_url',
    }
  }

  return {
    canonicalKey: stableHash(
      `job|${normalizedCompany}|${normalizedTitle}|${normalizedLocation}|${weekBucket(posting.postedAt)}`
    ),
    normalizedTitle,
    normalizedCompany,
    normalizedLocation,
    method: 'company_title_location_week',
  }
}

export function sourceIdentity(posting: Pick<NormalizedSourcePosting, 'provider' | 'externalId' | 'companyJobSourceId'>): string {
  return `${posting.provider}:${posting.companyJobSourceId ?? 'global'}:${posting.externalId}`
}

export function likelySameJob(
  left: NormalizedSourcePosting,
  right: NormalizedSourcePosting
): { match: boolean; confidence: number; reason: string } {
  const a = canonicalizePosting(left)
  const b = canonicalizePosting(right)
  if (a.canonicalKey === b.canonicalKey) {
    return {
      match: true,
      confidence: a.method === 'apply_url' && b.method === 'apply_url' ? 1 : 0.9,
      reason: a.method === 'apply_url' ? 'normalized apply URL' : 'company, title, location, and posting week',
    }
  }

  const companyMatch = a.normalizedCompany === b.normalizedCompany
  const titleMatch = a.normalizedTitle === b.normalizedTitle
  const locationMatch = a.normalizedLocation === b.normalizedLocation
  const confidence = Number(companyMatch) * 0.4 + Number(titleMatch) * 0.4 + Number(locationMatch) * 0.2
  return {
    match: confidence >= 0.9,
    confidence,
    reason: confidence >= 0.9 ? 'exact normalized fields' : 'insufficient canonical overlap',
  }
}

export const SOURCE_QUALITY: Record<string, number> = {
  greenhouse: 100,
  lever: 100,
  ashby: 100,
  smartrecruiters: 100,
  manual: 90,
  linkedin: 80,
  adzuna: 60,
  remoteok: 50,
  indeed: 45,
  ziprecruiter: 45,
}

export function preferredSource(sources: string[]): string | null {
  return [...sources].sort((left, right) => {
    const difference = (SOURCE_QUALITY[right] ?? 40) - (SOURCE_QUALITY[left] ?? 40)
    return difference || left.localeCompare(right)
  })[0] ?? null
}
