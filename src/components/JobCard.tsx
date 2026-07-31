'use client'

import { useState, useTransition } from 'react'
import {
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Check,
  ExternalLink,
  Globe2,
  Laptop,
  MapPin,
  RotateCcw,
  X,
} from 'lucide-react'
import { updateJobStatus } from '@/app/jobs/actions'
import { cn, formatDate } from '@/lib/utils'
import { normalizeDisplayText } from '@/lib/text.mjs'
import type { JobStatus, JobWithCompany } from '@/types/database'

interface Props {
  job: JobWithCompany
  onStatusChange?: (jobId: string, status: JobStatus) => void
}

const statusOptions: Array<{
  value: JobStatus
  label: string
  icon: typeof RotateCcw
}> = [
  { value: 'found', label: 'Triage', icon: RotateCcw },
  { value: 'interested', label: 'Interested', icon: Check },
  { value: 'dismissed', label: 'Dismiss', icon: X },
]

function formatSource(source: string) {
  if (source.toLowerCase() === 'remoteok') return 'Remote OK'
  if (source.toLowerCase() === 'linkedin') return 'LinkedIn'
  return source.charAt(0).toUpperCase() + source.slice(1)
}

function getWorkArrangement(job: JobWithCompany) {
  const descriptor = `${job.location ?? ''} ${job.job_type ?? ''}`.toLowerCase()
  if (descriptor.includes('hybrid')) return 'Hybrid'
  if (job.remote || descriptor.includes('remote')) return 'Remote'
  return 'Location-based'
}

function statusLabel(status: JobStatus) {
  if (status === 'interested') return 'Interested'
  if (status === 'dismissed') return 'Dismissed'
  return 'To triage'
}

export function JobCard({ job, onStatusChange }: Props) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const title = normalizeDisplayText(job.title, 'Untitled role')
  const company = normalizeDisplayText(job.companies?.name, 'Unknown company')
  const location = normalizeDisplayText(job.location, 'Location not listed')
  const description = normalizeDisplayText(job.description)
  const arrangement = getWorkArrangement(job)

  function setStatus(status: JobStatus) {
    if (status === job.status || pending) return

    setError(null)
    startTransition(async () => {
      try {
        await updateJobStatus(job.id, status)
        onStatusChange?.(job.id, status)
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : 'Status update failed. Try again.')
      }
    })
  }

  return (
    <article
      className={cn(
        'card group flex h-full min-w-0 flex-col overflow-hidden transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_14px_36px_rgba(15,23,42,0.08)]',
        pending && 'opacity-70'
      )}
      aria-busy={pending}
    >
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  'badge',
                  job.status === 'interested' && 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200',
                  job.status === 'dismissed' && 'bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200',
                  job.status === 'found' && 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200'
                )}
              >
                {statusLabel(job.status)}
              </span>
              {job.fit_score != null && (
                <span className="badge bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200">
                  {job.fit_score}% fit
                </span>
              )}
            </div>
            <h2 className="break-words text-lg font-semibold leading-6 tracking-tight text-slate-950 [overflow-wrap:anywhere] sm:text-xl">
              {title}
            </h2>
            <p className="mt-1 flex min-w-0 items-center gap-1.5 text-sm font-medium text-slate-600">
              <Building2 className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              <span className="break-words [overflow-wrap:anywhere]">{company}</span>
            </p>
          </div>

          {job.url && (
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              aria-label={`Open ${title} listing in a new tab`}
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </a>
          )}
        </div>

        <dl className="mt-4 grid gap-2.5 text-sm text-slate-600 sm:grid-cols-2">
          <div className="flex min-w-0 items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
            <div className="min-w-0">
              <dt className="sr-only">Location</dt>
              <dd className="break-words [overflow-wrap:anywhere]">{location}</dd>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Laptop className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
            <div>
              <dt className="sr-only">Work arrangement</dt>
              <dd>{arrangement}</dd>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Globe2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
            <div>
              <dt className="sr-only">Source</dt>
              <dd>{formatSource(job.source)}</dd>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
            <div>
              <dt className="sr-only">Posting date</dt>
              <dd>{job.posted_at ? `Posted ${formatDate(job.posted_at)}` : `Added ${formatDate(job.fetched_at)}`}</dd>
            </div>
          </div>
          {job.job_type && (
            <div className="flex items-start gap-2 sm:col-span-2">
              <BriefcaseBusiness className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              <div>
                <dt className="sr-only">Job type</dt>
                <dd>{normalizeDisplayText(job.job_type)}</dd>
              </div>
            </div>
          )}
        </dl>

        {Array.isArray(job.fit_reasons) && job.fit_reasons.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2" aria-label="Fit reasons">
            {job.fit_reasons.slice(0, 3).map((reason) => (
              <span key={reason} className="badge max-w-full bg-slate-100 text-slate-600">
                <span className="truncate">{normalizeDisplayText(reason)}</span>
              </span>
            ))}
          </div>
        )}

        {description && (
          <p className="mt-4 line-clamp-3 break-words text-sm leading-6 text-slate-600 [overflow-wrap:anywhere]">
            {description}
          </p>
        )}
      </div>

      <div className="border-t border-slate-200 bg-slate-50/80 p-3 sm:p-4">
        <p className="mb-2 text-xs font-medium text-slate-500">Move job to</p>
        <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-slate-200/70 p-1" role="group" aria-label={`Change status for ${title}`}>
          {statusOptions.map(({ value, label, icon: Icon }) => {
            const active = job.status === value
            return (
              <button
                key={value}
                type="button"
                disabled={pending || active}
                aria-pressed={active}
                onClick={() => setStatus(value)}
                className={cn(
                  'inline-flex min-h-10 min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1',
                  active
                    ? 'bg-white text-slate-950 shadow-sm'
                    : 'text-slate-600 hover:bg-white/70 hover:text-slate-950 disabled:opacity-100'
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{label}</span>
              </button>
            )
          })}
        </div>
        <div aria-live="polite" className="min-h-5">
          {pending && <p className="mt-2 text-xs text-slate-500">Updating status…</p>}
          {error && <p className="mt-2 text-xs font-medium text-red-700">{error}</p>}
        </div>
      </div>
    </article>
  )
}
