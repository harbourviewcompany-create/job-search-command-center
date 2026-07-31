'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  AlertTriangle,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Filter,
  Search,
  Sparkles,
  Trophy,
  UsersRound,
  X,
} from 'lucide-react'
import { AddJobForm } from '@/components/AddJobForm'
import { JobCard } from '@/components/JobCard'
import { LinkedInImportForm } from '@/components/LinkedInImportForm'
import { LinkedInSearchLinks } from '@/components/LinkedInSearchLinks'
import { PullJobsButton } from '@/components/PullJobsButton'
import {
  formatSource,
  type JobArrangementFilter,
  type JobFilterState,
  type JobSort,
  type JobStatusFilter,
} from '@/lib/jobs'
import { cn } from '@/lib/utils'
import type { JobSource, JobStatus, JobWithCompany } from '@/types/database'

interface PipelineMetrics {
  triage: number
  interested: number
  applied: number
  interviews: number
  offers: number
  dismissed: number
}

interface PaginationState {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

interface Props {
  initialJobs: JobWithCompany[]
  metrics: PipelineMetrics
  filters: JobFilterState
  sources: JobSource[]
  pagination: PaginationState
  pullAuthorized: boolean
  pullAccessConfigured: boolean
  terms: string[]
  locations: string[]
  loadError?: string | null
}

const metricCards = [
  { key: 'triage', label: 'To triage', icon: CircleDot, tone: 'text-blue-700 bg-blue-50 ring-blue-200' },
  { key: 'interested', label: 'Interested', icon: CheckCircle2, tone: 'text-emerald-700 bg-emerald-50 ring-emerald-200' },
  { key: 'applied', label: 'Applied', icon: BriefcaseBusiness, tone: 'text-violet-700 bg-violet-50 ring-violet-200' },
  { key: 'interviews', label: 'Interviews', icon: UsersRound, tone: 'text-amber-800 bg-amber-50 ring-amber-200' },
  { key: 'offers', label: 'Offers', icon: Trophy, tone: 'text-rose-700 bg-rose-50 ring-rose-200' },
  { key: 'dismissed', label: 'Dismissed', icon: X, tone: 'text-slate-600 bg-slate-100 ring-slate-200' },
] as const

export function JobsCommandCenter({
  initialJobs,
  metrics,
  filters,
  sources,
  pagination,
  pullAuthorized,
  pullAccessConfigured,
  terms,
  locations,
  loadError,
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [navigationPending, startNavigation] = useTransition()
  const [jobs, setJobs] = useState(initialJobs)
  const [query, setQuery] = useState(filters.query)
  const queryRef = useRef(filters.query)
  const searchTimerRef = useRef<number | null>(null)
  const suppressSearchSyncRef = useRef(false)

  useEffect(() => {
    setJobs(initialJobs)
  }, [initialJobs])

  useEffect(() => {
    queryRef.current = filters.query
    setQuery(filters.query)
  }, [filters.query])

  const clearPendingSearch = useCallback(() => {
    if (searchTimerRef.current !== null) {
      window.clearTimeout(searchTimerRef.current)
      searchTimerRef.current = null
    }
  }, [])

  useEffect(() => clearPendingSearch, [clearPendingSearch])

  const updateFilters = useCallback(
    (changes: Partial<JobFilterState>, options: { fromSearch?: boolean } = {}) => {
      if (!options.fromSearch) clearPendingSearch()

      const next = {
        ...filters,
        query: queryRef.current.trim(),
        ...changes,
      }
      const params = new URLSearchParams(searchParams.toString())

      if (next.query) params.set('q', next.query)
      else params.delete('q')
      if (next.status !== 'active') params.set('status', next.status)
      else params.delete('status')
      if (next.source !== 'all') params.set('source', next.source)
      else params.delete('source')
      if (next.arrangement !== 'all') params.set('arrangement', next.arrangement)
      else params.delete('arrangement')
      if (next.sort !== 'fit') params.set('sort', next.sort)
      else params.delete('sort')
      params.delete('page')

      const serialized = params.toString()
      startNavigation(() => {
        router.replace(serialized ? `/jobs?${serialized}` : '/jobs', { scroll: false })
      })
    },
    [clearPendingSearch, filters, router, searchParams]
  )

  useEffect(() => {
    if (suppressSearchSyncRef.current) {
      suppressSearchSyncRef.current = false
      return
    }

    const normalizedQuery = query.trim()
    if (normalizedQuery === filters.query) return

    clearPendingSearch()
    searchTimerRef.current = window.setTimeout(() => {
      searchTimerRef.current = null
      updateFilters({ query: normalizedQuery }, { fromSearch: true })
    }, 350)

    return clearPendingSearch
  }, [clearPendingSearch, filters.query, query, updateFilters])

  const filtersActive = Boolean(
    filters.query ||
      filters.status !== 'active' ||
      filters.source !== 'all' ||
      filters.arrangement !== 'all' ||
      filters.sort !== 'fit'
  )
  const firstRecord = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1
  const lastRecord = Math.min(pagination.page * pagination.pageSize, pagination.total)

  function pageHref(page: number) {
    const params = new URLSearchParams(searchParams.toString())
    if (page <= 1) params.delete('page')
    else params.set('page', String(page))
    const serialized = params.toString()
    return serialized ? `/jobs?${serialized}` : '/jobs'
  }

  function clearFilters() {
    clearPendingSearch()
    suppressSearchSyncRef.current = true
    queryRef.current = ''
    setQuery('')
    startNavigation(() => router.replace('/jobs', { scroll: false }))
  }

  function handleStatusChange(jobId: string, nextStatus: JobStatus) {
    setJobs((current) => current.map((job) => (job.id === jobId ? { ...job, status: nextStatus } : job)))
    router.refresh()
  }

  return (
    <div className="space-y-5 sm:space-y-7">
      <section className="overflow-hidden rounded-3xl bg-slate-950 px-5 py-6 text-white shadow-[0_20px_50px_rgba(15,23,42,0.18)] sm:px-7 sm:py-8 lg:px-9">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-slate-200">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Search pipeline
            </div>
            <h1 className="text-3xl font-semibold tracking-[-0.035em] sm:text-4xl lg:text-5xl">
              Job Search Command Center
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
              Review new roles, focus on the strongest matches, and move each opportunity through a clear application workflow.
            </p>
          </div>
          <div className="shrink-0">
            <PullJobsButton authorized={pullAuthorized} accessConfigured={pullAccessConfigured} />
          </div>
        </div>
      </section>

      {loadError && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-4 text-sm text-amber-950" role="alert">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold">Some pipeline data could not be loaded.</p>
            <p className="mt-1 break-words text-amber-800">{loadError}</p>
          </div>
        </div>
      )}

      <section aria-labelledby="pipeline-summary-heading">
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <h2 id="pipeline-summary-heading" className="text-lg font-semibold tracking-tight text-slate-950">
              Pipeline summary
            </h2>
            <p className="text-sm text-slate-500">Exact counts across the complete pipeline.</p>
          </div>
          <Link href="/applications" className="hidden text-sm font-semibold text-brand-700 hover:text-brand-900 sm:inline-flex">
            Open pipeline
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {metricCards.map(({ key, label, icon: Icon, tone }) => {
            const isJobFilter = key === 'triage' || key === 'interested' || key === 'dismissed'
            const nextStatus: JobStatusFilter = key === 'triage' ? 'found' : key === 'interested' ? 'interested' : 'dismissed'
            const content = (
              <>
                <div className={cn('inline-flex h-9 w-9 items-center justify-center rounded-xl ring-1 ring-inset', tone)}>
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </div>
                <p className="mt-3 text-2xl font-semibold tabular-nums text-slate-950">{metrics[key]}</p>
                <p className="mt-0.5 text-xs font-medium text-slate-500">{label}</p>
              </>
            )

            return isJobFilter ? (
              <button
                key={key}
                type="button"
                onClick={() => updateFilters({ status: nextStatus })}
                className="card min-h-32 p-4 text-left transition hover:-translate-y-0.5 hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                aria-label={`Filter jobs by ${label}`}
              >
                {content}
              </button>
            ) : (
              <Link
                key={key}
                href="/applications"
                className="card min-h-32 p-4 transition hover:-translate-y-0.5 hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                {content}
              </Link>
            )
          })}
        </div>
      </section>

      <details className="card group overflow-hidden">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 sm:px-5">
          <span className="flex items-center gap-2">
            <BriefcaseBusiness className="h-4 w-4 text-brand-700" aria-hidden="true" />
            Add or import jobs
          </span>
          <ChevronDown className="h-4 w-4 text-slate-400 transition group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="space-y-4 border-t border-slate-200 bg-slate-50/60 p-4 sm:p-5">
          <LinkedInSearchLinks terms={terms} locations={locations} />
          <div className="grid gap-4 xl:grid-cols-2">
            <LinkedInImportForm />
            <AddJobForm />
          </div>
        </div>
      </details>

      <section
        aria-labelledby="jobs-heading"
        aria-busy={navigationPending}
        data-filter-query={filters.query}
        data-filter-status={filters.status}
        data-filter-source={filters.source}
        data-filter-arrangement={filters.arrangement}
        data-filter-sort={filters.sort}
        className={cn('space-y-4 transition-opacity', navigationPending && 'opacity-70')}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="jobs-heading" className="text-xl font-semibold tracking-tight text-slate-950">
              Jobs
            </h2>
            <p className="mt-0.5 text-sm text-slate-500" aria-live="polite" data-pagination-total={pagination.total}>
              Showing {jobs.length} jobs · records {firstRecord}–{lastRecord} of {pagination.total} matching results
            </p>
          </div>
          {filtersActive && (
            <button type="button" onClick={clearFilters} className="btn-ghost self-start text-xs sm:self-auto">
              <X className="h-3.5 w-3.5" aria-hidden="true" /> Clear filters
            </button>
          )}
        </div>

        <div className="card p-3 sm:p-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(260px,1.5fr)_repeat(4,minmax(130px,0.65fr))]">
            <label className="relative block">
              <span className="sr-only">Search jobs</span>
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(event) => {
                  queryRef.current = event.target.value
                  setQuery(event.target.value)
                }}
                className="input pl-10"
                placeholder="Search title, company, location…"
              />
            </label>

            <label>
              <span className="sr-only">Status</span>
              <select value={filters.status} onChange={(event) => updateFilters({ status: event.target.value as JobStatusFilter })} className="select">
                <option value="active">Active jobs</option>
                <option value="all">All statuses</option>
                <option value="found">To triage</option>
                <option value="interested">Interested</option>
                <option value="dismissed">Dismissed</option>
              </select>
            </label>

            <label>
              <span className="sr-only">Source</span>
              <select value={filters.source} onChange={(event) => updateFilters({ source: event.target.value as 'all' | JobSource })} className="select">
                <option value="all">All sources</option>
                {sources.map((jobSource) => (
                  <option key={jobSource} value={jobSource}>
                    {formatSource(jobSource)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="sr-only">Work arrangement</span>
              <select value={filters.arrangement} onChange={(event) => updateFilters({ arrangement: event.target.value as JobArrangementFilter })} className="select">
                <option value="all">Any arrangement</option>
                <option value="remote">Remote</option>
                <option value="hybrid">Hybrid</option>
                <option value="location">Location-based</option>
              </select>
            </label>

            <label>
              <span className="sr-only">Sort jobs</span>
              <select value={filters.sort} onChange={(event) => updateFilters({ sort: event.target.value as JobSort })} className="select">
                <option value="fit">Best fit</option>
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="company">Company A–Z</option>
              </select>
            </label>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-slate-500 lg:hidden">
            <Filter className="h-3.5 w-3.5" aria-hidden="true" />
            Filters and sorting are applied across the complete pipeline.
          </div>
        </div>

        {jobs.length > 0 ? (
          <div className="grid items-stretch gap-4 xl:grid-cols-2">
            {jobs.map((job) => (
              <JobCard key={job.id} job={job} onStatusChange={handleStatusChange} />
            ))}
          </div>
        ) : (
          <div className="card flex min-h-72 flex-col items-center justify-center px-5 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
              <Search className="h-5 w-5" aria-hidden="true" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-slate-950">No jobs match these filters</h3>
            <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
              Clear or change the current search and filters.
            </p>
          </div>
        )}

        {pagination.totalPages > 1 && (
          <nav className="card flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4" aria-label="Jobs pagination">
            <p className="text-sm text-slate-600">
              Page <span className="font-semibold text-slate-950">{pagination.page}</span> of {pagination.totalPages}
            </p>
            <div className="flex items-center gap-2">
              {pagination.page > 1 ? (
                <Link href={pageHref(pagination.page - 1)} className="btn-secondary min-h-11 flex-1 sm:flex-none" rel="prev">
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Previous
                </Link>
              ) : (
                <span className="btn-secondary min-h-11 flex-1 cursor-not-allowed opacity-50 sm:flex-none" aria-disabled="true">
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Previous
                </span>
              )}
              {pagination.page < pagination.totalPages ? (
                <Link href={pageHref(pagination.page + 1)} className="btn-secondary min-h-11 flex-1 sm:flex-none" rel="next">
                  Next <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              ) : (
                <span className="btn-secondary min-h-11 flex-1 cursor-not-allowed opacity-50 sm:flex-none" aria-disabled="true">
                  Next <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </span>
              )}
            </div>
          </nav>
        )}
      </section>
    </div>
  )
}
