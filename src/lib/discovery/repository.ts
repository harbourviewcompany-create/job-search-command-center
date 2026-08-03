import { createClient } from '@/lib/supabase/server'

export interface DiscoveryProfileRow {
  id: string
  name: string
  slug: string
  description: string | null
  enabled: boolean
  priority: number
  country_code: string
  remote_policy: 'any' | 'remote_only' | 'remote_or_local' | 'local_only'
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
  result_budget_per_run: number
}

export interface CompanyOption {
  id: string
  name: string
}

export interface CompanySourceRow {
  id: string
  company_id: string
  provider: 'greenhouse' | 'lever' | 'ashby' | 'smartrecruiters'
  board_key: string
  careers_url: string | null
  api_base_url: string | null
  enabled: boolean
  priority: number
  poll_interval_minutes: number
  last_checked_at: string | null
  last_success_at: string | null
  last_error: string | null
  consecutive_failures: number
  active_job_count: number
  companies: { name: string } | { name: string }[] | null
}

export interface SourceHealthRow {
  id: string
  provider: string
  board_key: string
  company_id: string
  company_name: string
  enabled: boolean
  priority: number
  last_checked_at: string | null
  last_success_at: string | null
  last_error_at: string | null
  last_error: string | null
  consecutive_failures: number
  active_job_count: number
  health: 'healthy' | 'stale' | 'failing' | 'never_run' | 'disabled'
}

export interface DiscoveryRunRow {
  id: string
  trigger_type: string
  status: string
  started_at: string
  finished_at: string | null
  providers_attempted: string[]
  requests_used: number
  postings_fetched: number
  canonical_jobs_created: number
  canonical_jobs_updated: number
  postings_merged: number
  jobs_closed: number
  jobs_reopened: number
  errors_count: number
  step_count: number
  failed_step_count: number
  rate_limited_step_count: number
}

export interface DiscoverySettingsData {
  profiles: DiscoveryProfileRow[]
  companies: CompanyOption[]
  sources: CompanySourceRow[]
  health: SourceHealthRow[]
  runs: DiscoveryRunRow[]
  error: string | null
}

export async function loadDiscoverySettings(): Promise<DiscoverySettingsData> {
  const supabase = (await createClient()) as any
  const [profilesResult, companiesResult, sourcesResult, healthResult, runsResult] = await Promise.all([
    supabase.from('search_profiles').select('*').order('priority').order('name'),
    supabase.from('companies').select('id,name').order('name').limit(1000),
    supabase
      .from('company_job_sources')
      .select('*, companies(name)')
      .order('priority')
      .order('created_at'),
    supabase.from('source_health').select('*').order('priority').order('company_name'),
    supabase.from('discovery_run_summary').select('*').order('started_at', { ascending: false }).limit(20),
  ])

  const errors = [profilesResult, companiesResult, sourcesResult, healthResult, runsResult]
    .map((result) => result.error?.message)
    .filter(Boolean)

  return {
    profiles: (profilesResult.data ?? []) as DiscoveryProfileRow[],
    companies: (companiesResult.data ?? []) as CompanyOption[],
    sources: (sourcesResult.data ?? []) as CompanySourceRow[],
    health: (healthResult.data ?? []) as SourceHealthRow[],
    runs: (runsResult.data ?? []) as DiscoveryRunRow[],
    error: errors.length > 0 ? errors.join(' ') : null,
  }
}

export function sourceCompanyName(source: CompanySourceRow): string {
  if (Array.isArray(source.companies)) return source.companies[0]?.name ?? 'Unknown company'
  return source.companies?.name ?? 'Unknown company'
}
