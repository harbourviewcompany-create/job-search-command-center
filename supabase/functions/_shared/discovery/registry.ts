import type { CompanyJobSource, DiscoveryQuery, SearchProfile } from '../../../../shared/discovery/types.ts'

export interface SearchProfileRow {
  id: string
  name: string
  slug: string
  enabled: boolean
  priority: number
  country_code: string
  remote_policy: SearchProfile['remotePolicy']
  locations: string[]
  employment_types: string[]
  primary_titles: string[]
  title_aliases: string[]
  required_terms: string[]
  preferred_terms: string[]
  excluded_terms: string[]
  excluded_companies: string[]
  maximum_posting_age_days: number
  minimum_salary_cad: number | null
  source_priority: SearchProfile['sourcePriority']
  scoring_configs?: Array<{
    id: string
    version: number
    enabled: boolean
    weights: Record<string, number>
    thresholds: Record<string, number>
  }>
}

export function toSearchProfile(row: SearchProfileRow): SearchProfile {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    enabled: row.enabled,
    priority: row.priority,
    countryCode: row.country_code,
    remotePolicy: row.remote_policy,
    locations: row.locations ?? [],
    employmentTypes: row.employment_types ?? [],
    primaryTitles: row.primary_titles ?? [],
    titleAliases: row.title_aliases ?? [],
    requiredTerms: row.required_terms ?? [],
    preferredTerms: row.preferred_terms ?? [],
    excludedTerms: row.excluded_terms ?? [],
    excludedCompanies: row.excluded_companies ?? [],
    maximumPostingAgeDays: row.maximum_posting_age_days ?? 45,
    minimumSalaryCad: row.minimum_salary_cad,
    sourcePriority: row.source_priority ?? {},
  }
}

export function toDiscoveryQuery(row: Record<string, unknown>): DiscoveryQuery {
  return {
    id: String(row.id),
    searchProfileId: String(row.search_profile_id),
    provider: row.provider as DiscoveryQuery['provider'],
    queryType: row.query_type as DiscoveryQuery['queryType'],
    queryText: String(row.query_text),
    location: row.location == null ? null : String(row.location),
    priority: Number(row.priority ?? 100),
    lastRunAt: row.last_run_at == null ? null : String(row.last_run_at),
    lastResultCount: Number(row.last_result_count ?? 0),
    lastNewJobCount: Number(row.last_new_job_count ?? 0),
  }
}

export function toCompanySource(row: Record<string, any>): CompanyJobSource {
  const company = Array.isArray(row.companies) ? row.companies[0] : row.companies
  return {
    id: String(row.id),
    companyId: String(row.company_id),
    companyName: String(company?.name ?? row.company_name ?? 'Unknown'),
    provider: row.provider,
    boardKey: String(row.board_key),
    careersUrl: row.careers_url ?? null,
    apiBaseUrl: row.api_base_url ?? null,
    priority: Number(row.priority ?? 100),
    etag: row.etag ?? null,
    lastModified: row.last_modified ?? null,
  }
}
