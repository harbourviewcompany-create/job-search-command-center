import type { JobWithCompany } from './database'

export type DiscoveryLifecycleStatus = 'open' | 'unverified' | 'closed' | 'expired'

export interface JobSourceSummary {
  id: string
  source: string
  external_id: string
  source_url: string | null
  apply_url: string | null
  lifecycle_status: DiscoveryLifecycleStatus
  first_seen_at: string
  last_seen_at: string
  last_verified_at: string
  is_primary: boolean
}

export interface JobScoreSummary {
  search_profile_id: string
  profile_name: string
  overall_score: number
  hard_disqualified: boolean
  disqualifiers: string[]
  title_score: number
  responsibility_score: number
  experience_score: number
  industry_score: number
  seniority_score: number
  location_score: number
  compensation_score: number
  freshness_score: number
  company_priority_score: number
  source_quality_score: number
  application_effort_score: number
  reasons: string[]
}

export type DiscoveryJobWithCompany = JobWithCompany & {
  canonical_key?: string | null
  employment_type?: string | null
  seniority?: string | null
  remote_type?: 'remote' | 'hybrid' | 'onsite' | 'unknown' | null
  salary_min?: number | null
  salary_max?: number | null
  salary_currency?: string | null
  first_seen_at?: string | null
  last_seen_at?: string | null
  last_verified_at?: string | null
  closed_at?: string | null
  lifecycle_status?: DiscoveryLifecycleStatus | null
  preferred_source?: string | null
  source_count?: number | null
  description_changed_at?: string | null
  discovery_sources?: JobSourceSummary[]
  discovery_scores?: JobScoreSummary[]
}
