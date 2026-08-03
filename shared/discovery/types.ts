export type JobProvider =
  | 'greenhouse'
  | 'lever'
  | 'ashby'
  | 'smartrecruiters'
  | 'adzuna'
  | 'remoteok'
  | 'indeed'
  | 'ziprecruiter'
  | 'linkedin'
  | 'manual'

export type RemotePolicy = 'any' | 'remote_only' | 'remote_or_local' | 'local_only'
export type RemoteType = 'remote' | 'hybrid' | 'onsite' | 'unknown'
export type ScoreTier = 'strong' | 'good' | 'review' | 'weak'

export interface SearchProfile {
  id?: string
  name: string
  slug: string
  enabled?: boolean
  priority?: number
  countryCode?: string
  remotePolicy: RemotePolicy
  locations: string[]
  employmentTypes: string[]
  primaryTitles: string[]
  titleAliases: string[]
  requiredTerms: string[]
  preferredTerms: string[]
  excludedTerms: string[]
  excludedCompanies: string[]
  maximumPostingAgeDays: number
  minimumSalaryCad: number | null
  sourcePriority?: Partial<Record<JobProvider, number>>
}

export interface NormalizedSourcePosting {
  provider: JobProvider
  externalId: string
  companyName: string
  title: string
  location: string | null
  remote: boolean
  remoteType: RemoteType
  description: string | null
  sourceUrl: string | null
  applyUrl: string | null
  postedAt: string | null
  employmentType: string | null
  seniority: string | null
  salaryMin: number | null
  salaryMax: number | null
  salaryCurrency: string | null
  contentHash: string
  rawPayload: Record<string, unknown>
  companyJobSourceId?: string | null
  searchProfileId?: string | null
}

export interface DiscoveryQuery {
  id?: string
  searchProfileId: string
  provider: 'adzuna' | 'remoteok'
  queryType: 'keyword' | 'exact_title' | 'broad'
  queryText: string
  location: string | null
  priority: number
  lastRunAt?: string | null
  lastResultCount?: number
  lastNewJobCount?: number
}

export interface CompanyJobSource {
  id: string
  companyId: string
  companyName: string
  provider: 'greenhouse' | 'lever' | 'ashby' | 'smartrecruiters'
  boardKey: string
  careersUrl: string | null
  apiBaseUrl: string | null
  priority: number
  etag?: string | null
  lastModified?: string | null
}

export interface ProviderPage {
  postings: NormalizedSourcePosting[]
  nextCursor: string | null
  completeSnapshot: boolean
  requestsUsed: number
  httpStatus?: number
  rateLimitRemaining?: number | null
  retryAfterSeconds?: number | null
}

export interface ProviderDiscoveryContext {
  signal?: AbortSignal
  pageSize?: number
  maxPages?: number
  countryCode?: string
  query?: DiscoveryQuery
  companySource?: CompanyJobSource
  credentials?: Record<string, string | undefined>
  fetchImpl?: typeof fetch
}

export interface JobProviderAdapter {
  provider: JobProvider
  discover(context: ProviderDiscoveryContext): AsyncGenerator<ProviderPage>
}

export interface ScoringJob {
  title: string
  description?: string | null
  companyName?: string | null
  location?: string | null
  remote?: boolean | null
  remoteType?: RemoteType | null
  employmentType?: string | null
  seniority?: string | null
  salaryMin?: number | null
  salaryMax?: number | null
  salaryCurrency?: string | null
  postedAt?: string | null
  firstSeenAt?: string | null
  preferredSource?: JobProvider | string | null
  companyPriority?: number | null
  applicationEffort?: number | null
  lifecycleStatus?: 'open' | 'unverified' | 'closed' | 'expired' | null
}

export interface ScoreWeights {
  title: number
  responsibility: number
  experience: number
  industry: number
  seniority: number
  location: number
  compensation: number
  freshness: number
  companyPriority: number
  sourceQuality: number
  applicationEffort: number
}

export interface ScoreThresholds {
  strong: number
  good: number
  review: number
}

export interface ScoreDimensions {
  title: number
  responsibility: number
  experience: number
  industry: number
  seniority: number
  location: number
  compensation: number
  freshness: number
  companyPriority: number
  sourceQuality: number
  applicationEffort: number
}

export interface ScoreResult {
  overallScore: number
  tier: ScoreTier
  dimensions: ScoreDimensions
  hardDisqualified: boolean
  disqualifiers: string[]
  reasons: string[]
  matchedTerms: string[]
  scoringVersion: number
}
