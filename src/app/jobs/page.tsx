import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { JobsCommandCenter } from '@/components/JobsCommandCenter'
import {
  JOB_PULL_ACCESS_COOKIE,
  isJobPullAccessConfigured,
  verifyJobPullAccessToken,
} from '@/lib/job-pull-auth'
import { filterAndSortJobs, type JobFilterState } from '@/lib/jobs'
import { createClient } from '@/lib/supabase/server'
import type { JobArrangementFilter, JobSort, JobStatusFilter } from '@/lib/jobs'
import type { JobSource, JobWithCompany } from '@/types/database'

export const dynamic = 'force-dynamic'

const DEFAULT_PAGE_SIZE = 100
const DATABASE_BATCH_SIZE = 1000
const JOB_SOURCES: JobSource[] = ['indeed', 'ziprecruiter', 'manual', 'adzuna', 'linkedin', 'remoteok']
const STATUS_FILTERS: JobStatusFilter[] = ['active', 'all', 'found', 'interested', 'dismissed']
const ARRANGEMENT_FILTERS: JobArrangementFilter[] = ['all', 'remote', 'hybrid', 'location']
const SORT_OPTIONS: JobSort[] = ['fit', 'newest', 'oldest', 'company']

type SearchValue = string | string[] | undefined

interface JobsPageProps {
  searchParams: Promise<{
    page?: SearchValue
    q?: SearchValue
    status?: SearchValue
    source?: SearchValue
    arrangement?: SearchValue
    sort?: SearchValue
  }>
}

function firstValue(value: SearchValue) {
  return Array.isArray(value) ? value[0] : value
}

function parsePage(value: SearchValue) {
  const parsed = Number.parseInt(firstValue(value) ?? '1', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
}

function parseChoice<T extends string>(value: SearchValue, choices: readonly T[], fallback: T) {
  const candidate = firstValue(value)
  return candidate && choices.includes(candidate as T) ? (candidate as T) : fallback
}

function configuredPageSize() {
  const parsed = Number.parseInt(process.env.JOBS_PAGE_SIZE ?? '', 10)
  return Number.isFinite(parsed) && parsed >= 10 && parsed <= 250
    ? parsed
    : DEFAULT_PAGE_SIZE
}

function parseFilters(params: Awaited<JobsPageProps['searchParams']>): JobFilterState {
  return {
    query: (firstValue(params.q) ?? '').trim(),
    status: parseChoice(params.status, STATUS_FILTERS, 'active'),
    source: parseChoice(params.source, ['all', ...JOB_SOURCES] as const, 'all'),
    arrangement: parseChoice(params.arrangement, ARRANGEMENT_FILTERS, 'all'),
    sort: parseChoice(params.sort, SORT_OPTIONS, 'fit'),
  }
}

function jobsHref(filters: JobFilterState, page: number) {
  const params = new URLSearchParams()
  if (filters.query) params.set('q', filters.query)
  if (filters.status !== 'active') params.set('status', filters.status)
  if (filters.source !== 'all') params.set('source', filters.source)
  if (filters.arrangement !== 'all') params.set('arrangement', filters.arrangement)
  if (filters.sort !== 'fit') params.set('sort', filters.sort)
  if (page > 1) params.set('page', String(page))
  const query = params.toString()
  return query ? `/jobs?${query}` : '/jobs'
}

function searchPatterns(value: string) {
  const normalized = value.replace(/[,*()]/g, ' ').replace(/\s+/g, ' ').trim()
  if (!normalized) return []

  const variants = new Set([normalized])
  const mojibakeVariant = Buffer.from(normalized, 'utf8').toString('latin1')
  if (mojibakeVariant !== normalized) variants.add(mojibakeVariant)
  return Array.from(variants, (variant) => `*${variant}*`)
}

function jobSearchClauses(patterns: string[], companyIds: string[]) {
  const clauses = patterns.flatMap((pattern) => [
    `title.ilike.${pattern}`,
    `location.ilike.${pattern}`,
    `description.ilike.${pattern}`,
    `job_type.ilike.${pattern}`,
    `source.ilike.${pattern}`,
  ])
  if (companyIds.length > 0) clauses.push(`company_id.in.(${companyIds.join(',')})`)
  return clauses
}

function statusValues(filters: JobFilterState) {
  if (filters.status === 'active') return ['found', 'interested'] as const
  if (filters.status === 'all') return ['found', 'interested', 'dismissed'] as const
  return [filters.status] as const
}

async function matchingCompanyIds(query: string) {
  const patterns = searchPatterns(query)
  if (patterns.length === 0) return { ids: [] as string[], error: null as string | null }

  const supabase = await createClient()
  let companyQuery = supabase.from('companies').select('id').limit(5000)
  companyQuery = patterns.length === 1
    ? companyQuery.ilike('name', patterns[0].replaceAll('*', '%'))
    : companyQuery.or(patterns.map((pattern) => `name.ilike.${pattern}`).join(','))

  const { data, error } = await companyQuery
  return {
    ids: (data ?? []).map((company) => company.id),
    error: error?.message ?? null,
  }
}

function applyDatabaseOrder<T extends {
  order: (column: string, options?: { ascending?: boolean; nullsFirst?: boolean }) => T
}>(query: T, sort: JobSort) {
  if (sort === 'newest') {
    return query
      .order('posted_at', { ascending: false, nullsFirst: false })
      .order('fetched_at', { ascending: false })
      .order('id', { ascending: true })
  }
  if (sort === 'oldest') {
    return query
      .order('posted_at', { ascending: true, nullsFirst: false })
      .order('fetched_at', { ascending: true })
      .order('id', { ascending: true })
  }
  return query
    .order('fit_score', { ascending: false, nullsFirst: false })
    .order('posted_at', { ascending: false, nullsFirst: false })
    .order('fetched_at', { ascending: false })
    .order('id', { ascending: true })
}

async function loadDatabasePage(
  filters: JobFilterState,
  requestedPage: number,
  pageSize: number,
  companyIds: string[]
) {
  const supabase = await createClient()
  const clauses = jobSearchClauses(searchPatterns(filters.query), companyIds)

  let countQuery = supabase
    .from('jobs')
    .select('id', { count: 'exact', head: true })
    .in('status', statusValues(filters))
  if (filters.source !== 'all') countQuery = countQuery.eq('source', filters.source)
  if (clauses.length > 0) countQuery = countQuery.or(clauses.join(','))

  const { count, error: countError } = await countQuery
  if (countError) {
    return {
      rows: [] as JobWithCompany[],
      total: 0,
      page: 1,
      totalPages: 1,
      error: countError.message,
    }
  }

  const total = count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const page = Math.min(requestedPage, totalPages)

  let dataQuery = supabase
    .from('jobs')
    .select('*, companies(*)')
    .in('status', statusValues(filters))
  if (filters.source !== 'all') dataQuery = dataQuery.eq('source', filters.source)
  if (clauses.length > 0) dataQuery = dataQuery.or(clauses.join(','))

  const from = (page - 1) * pageSize
  const { data, error } = await applyDatabaseOrder(dataQuery, filters.sort)
    .range(from, from + pageSize - 1)

  return {
    rows: error ? [] : ((data ?? []) as JobWithCompany[]),
    total,
    page,
    totalPages,
    error: error?.message ?? null,
  }
}

async function loadDerivedPage(
  filters: JobFilterState,
  requestedPage: number,
  pageSize: number,
  companyIds: string[]
) {
  const supabase = await createClient()
  const rows: JobWithCompany[] = []
  const clauses = jobSearchClauses(searchPatterns(filters.query), companyIds)

  for (let from = 0; ; from += DATABASE_BATCH_SIZE) {
    let query = supabase
      .from('jobs')
      .select('*, companies(*)')
      .in('status', statusValues(filters))
      .order('id', { ascending: true })

    if (filters.source !== 'all') query = query.eq('source', filters.source)
    if (clauses.length > 0) query = query.or(clauses.join(','))

    const { data, error } = await query.range(from, from + DATABASE_BATCH_SIZE - 1)
    if (error) {
      return {
        rows: [] as JobWithCompany[],
        total: 0,
        page: 1,
        totalPages: 1,
        error: error.message,
      }
    }

    const batch = (data ?? []) as JobWithCompany[]
    rows.push(...batch)
    if (batch.length < DATABASE_BATCH_SIZE) break
  }

  const filtered = filterAndSortJobs(rows, filters)
  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const page = Math.min(requestedPage, totalPages)
  const from = (page - 1) * pageSize

  return {
    rows: filtered.slice(from, from + pageSize),
    total,
    page,
    totalPages,
    error: null as string | null,
  }
}

export default async function JobsPage({ searchParams }: JobsPageProps) {
  const supabase = await createClient()
  const cookieStore = await cookies()
  const params = await searchParams
  const requestedPage = parsePage(params.page)
  const pageSize = configuredPageSize()
  const filters = parseFilters(params)

  const companyMatchResult = await matchingCompanyIds(filters.query)
  const usesDerivedDatabaseFields = filters.arrangement !== 'all' || filters.sort === 'company'
  const jobsResult = usesDerivedDatabaseFields
    ? await loadDerivedPage(filters, requestedPage, pageSize, companyMatchResult.ids)
    : await loadDatabasePage(filters, requestedPage, pageSize, companyMatchResult.ids)

  if (requestedPage !== jobsResult.page) {
    redirect(jobsHref(filters, jobsResult.page))
  }

  const [
    authResult,
    searchSettingResult,
    appliedResult,
    interviewResult,
    offerResult,
    triageCountResult,
    interestedCountResult,
    dismissedCountResult,
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('settings').select('value').eq('key', 'search_terms').maybeSingle(),
    supabase.from('applications').select('*', { count: 'exact', head: true }).eq('status', 'applied'),
    supabase.from('applications').select('*', { count: 'exact', head: true }).eq('status', 'interview'),
    supabase.from('applications').select('*', { count: 'exact', head: true }).eq('status', 'offer'),
    supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('status', 'found'),
    supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('status', 'interested'),
    supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('status', 'dismissed'),
  ])

  const search =
    (searchSettingResult.data?.value as {
      terms?: string[]
      locations?: string[]
    } | null) ?? {}

  const terms = search.terms ?? ['business development manager', 'account executive']
  const locations = search.locations ?? ['Ottawa', 'Ontario', 'Remote']
  const pullAccessToken = cookieStore.get(JOB_PULL_ACCESS_COOKIE)?.value ?? null
  const pullAuthorized = Boolean(authResult.data.user) || verifyJobPullAccessToken(pullAccessToken)

  const errors = [
    companyMatchResult.error,
    jobsResult.error,
    searchSettingResult.error?.message,
    appliedResult.error?.message,
    interviewResult.error?.message,
    offerResult.error?.message,
    triageCountResult.error?.message,
    interestedCountResult.error?.message,
    dismissedCountResult.error?.message,
  ].filter(Boolean)

  return (
    <JobsCommandCenter
      initialJobs={jobsResult.rows}
      metrics={{
        triage: triageCountResult.count ?? 0,
        interested: interestedCountResult.count ?? 0,
        dismissed: dismissedCountResult.count ?? 0,
        applied: appliedResult.count ?? 0,
        interviews: interviewResult.count ?? 0,
        offers: offerResult.count ?? 0,
      }}
      filters={filters}
      sources={JOB_SOURCES}
      pagination={{
        page: jobsResult.page,
        pageSize,
        total: jobsResult.total,
        totalPages: jobsResult.totalPages,
      }}
      pullAuthorized={pullAuthorized}
      pullAccessConfigured={isJobPullAccessConfigured()}
      terms={terms}
      locations={locations}
      loadError={errors.length > 0 ? Array.from(new Set(errors)).join(' ') : null}
    />
  )
}
