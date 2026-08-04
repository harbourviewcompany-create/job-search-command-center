import { normalizeDisplayText } from '@/lib/text.mjs'
import type { JobSource, JobStatus, JobWithCompany } from '@/types/database'

export type WorkArrangement = 'remote' | 'hybrid' | 'location'
export type JobStatusFilter = 'active' | 'all' | JobStatus
export type JobArrangementFilter = 'all' | WorkArrangement
export type JobSort = 'fit' | 'newest' | 'oldest' | 'company'

export interface JobFilterState {
  query: string
  status: JobStatusFilter
  source: 'all' | JobSource
  arrangement: JobArrangementFilter
  sort: JobSort
}

type ArrangementJob = Pick<JobWithCompany, 'remote' | 'location' | 'job_type'>

/** Classifies work arrangement consistently for cards, filters, and tests. */
export function getWorkArrangement(job: ArrangementJob): WorkArrangement {
  const descriptor = `${job.location ?? ''} ${job.job_type ?? ''}`.toLowerCase()

  if (descriptor.includes('hybrid')) return 'hybrid'
  if (Boolean(job.remote) || descriptor.includes('remote')) return 'remote'
  return 'location'
}

/** Returns the stable user-facing work-arrangement label. */
export function getWorkArrangementLabel(job: ArrangementJob) {
  const arrangement = getWorkArrangement(job)
  if (arrangement === 'remote') return 'Remote'
  if (arrangement === 'hybrid') return 'Hybrid'
  return 'Location-based'
}

/** Formats provider identifiers for stable user-facing labels. */
export function formatSource(source: JobSource | string) {
  const normalized = source.toLowerCase()
  if (normalized === 'remoteok') return 'Remote OK'
  if (normalized === 'linkedin') return 'LinkedIn'
  if (normalized === 'ziprecruiter') return 'ZipRecruiter'
  return source.charAt(0).toUpperCase() + source.slice(1)
}

/** Returns a safe timestamp used by server-side job sorting. */
export function jobTimestamp(job: JobWithCompany) {
  const timestamp = new Date(job.posted_at ?? job.fetched_at).getTime()
  return Number.isFinite(timestamp) ? timestamp : 0
}

/** Compares company names while keeping unknown companies last. */
export function compareJobCompanies(left: JobWithCompany, right: JobWithCompany) {
  const leftCompany = normalizeDisplayText(left.companies?.name)
  const rightCompany = normalizeDisplayText(right.companies?.name)

  if (!leftCompany && !rightCompany) return 0
  if (!leftCompany) return 1
  if (!rightCompany) return -1

  return leftCompany.localeCompare(rightCompany, undefined, {
    sensitivity: 'base',
    numeric: true,
  })
}

/** Applies the complete filter and sort state before pagination. */
export function filterAndSortJobs(jobs: JobWithCompany[], filters: JobFilterState) {
  const normalizedQuery = normalizeDisplayText(filters.query).toLowerCase()

  return jobs
    .filter((job) => {
      if (filters.status === 'active' && job.status === 'dismissed') return false
      if (filters.status !== 'active' && filters.status !== 'all' && job.status !== filters.status) {
        return false
      }
      if (filters.source !== 'all' && job.source !== filters.source) return false
      if (filters.arrangement !== 'all' && getWorkArrangement(job) !== filters.arrangement) {
        return false
      }

      if (!normalizedQuery) return true
      const searchable = [
        job.title,
        job.companies?.name,
        job.location,
        job.source,
        job.job_type,
        job.description,
      ]
        .map((value) => normalizeDisplayText(value))
        .join(' ')
        .toLowerCase()

      return searchable.includes(normalizedQuery)
    })
    .sort((left, right) => {
      if (filters.sort === 'newest') return jobTimestamp(right) - jobTimestamp(left)
      if (filters.sort === 'oldest') return jobTimestamp(left) - jobTimestamp(right)
      if (filters.sort === 'company') return compareJobCompanies(left, right)
      return (right.fit_score ?? -1) - (left.fit_score ?? -1) || jobTimestamp(right) - jobTimestamp(left)
    })
}
