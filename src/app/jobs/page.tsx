import { redirect } from 'next/navigation'
import { JobsCommandCenter } from '@/components/JobsCommandCenter'
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

async function loadAllJobs() {
  const supabase = await createClient()
  const rows: JobWithCompany[] = []

  for (let from = 0; ; from += DATABASE_BATCH_SIZE) {
    const { data, error } = await supabase
      .from('jobs')
      .select('*, companies(*)')
      .in('status', ['found', 'interested', 'dismissed'])
      .order('id', { ascending: true })
      .range(from, from + DATABASE_BATCH_SIZE - 1)

    if (error) return { rows, error: error.message }

    const batch = (data ?? []) as JobWithCompany[]
    rows.push(...batch)
    if (batch.length < DATABASE_BATCH_SIZE) return { rows, error: null }
  }
}

export default async function JobsPage({ searchParams }: JobsPageProps) {
  const supabase = await createClient()
  const params = await searchParams
  const requestedPage = parsePage(params.page)
  const pageSize = configuredPageSize()
  const filters = parseFilters(params)

  const [
    allJobsResult,
    authResult,
    searchSettingResult,
    appliedResult,
    interviewResult,
    offerResult,
    triageCountResult,
    interestedCountResult,
    dismissedCountResult,
  ] = await Promise.all([
    loadAllJobs(),
    supabase.auth.getUser(),
    supabase.from('settings').select('value').eq('key', 'search_terms').maybeSingle(),
    supabase.from('applications').select('*', { count: 'exact', head: true }).eq('status', 'applied'),
    supabase.from('applications').select('*', { count: 'exact', head: true }).eq('status', 'interview'),
    supabase.from('applications').select('*', { count: 'exact', head: true }).eq('status', 'offer'),
    supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('status', 'found'),
    supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('status', 'interested'),
    supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('status', 'dismissed'),
  ])

  const availableSources = Array.from(new Set(allJobsResult.rows.map((job) => job.source))).sort()
  const filteredJobs = filterAndSortJobs(allJobsResult.rows, filters)
  const totalJobs = filteredJobs.length
  const totalPages = Math.max(1, Math.ceil(totalJobs / pageSize))
  const page = Math.min(requestedPage, totalPages)

  if (requestedPage !== page) {
    redirect(jobsHref(filters, page))
  }

  const from = (page - 1) * pageSize
  const jobs = filteredJobs.slice(from, from + pageSize)
  const search =
    (searchSettingResult.data?.value as {
      terms?: string[]
      locations?: string[]
    } | null) ?? {}

  const terms = search.terms ?? ['business development manager', 'account executive']
  const locations = search.locations ?? ['Ottawa', 'Ontario', 'Remote']

  const errors = [
    allJobsResult.error,
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
      initialJobs={jobs}
      metrics={{
        triage: triageCountResult.count ?? 0,
        interested: interestedCountResult.count ?? 0,
        dismissed: dismissedCountResult.count ?? 0,
        applied: appliedResult.count ?? 0,
        interviews: interviewResult.count ?? 0,
        offers: offerResult.count ?? 0,
      }}
      filters={filters}
      sources={availableSources}
      pagination={{ page, pageSize, total: totalJobs, totalPages }}
      pullAuthorizationToken={authResult.data.user ? 'session' : null}
      terms={terms}
      locations={locations}
      loadError={errors.length > 0 ? Array.from(new Set(errors)).join(' ') : null}
    />
  )
}
