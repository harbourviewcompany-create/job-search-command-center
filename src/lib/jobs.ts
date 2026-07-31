import type { JobSource, JobWithCompany } from '@/types/database'

export type WorkArrangement = 'remote' | 'hybrid' | 'location'

type ArrangementJob = Pick<JobWithCompany, 'remote' | 'location' | 'job_type'>

/** Classifies work arrangement consistently for cards, filters, and tests. */
export function getWorkArrangement(job: ArrangementJob): WorkArrangement {
  const descriptor = `${job.location ?? ''} ${job.job_type ?? ''}`.toLowerCase()

  if (descriptor.includes('hybrid')) return 'hybrid'
  if (Boolean(job.remote) || descriptor.includes('remote')) return 'remote'
  return 'location'
}

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
