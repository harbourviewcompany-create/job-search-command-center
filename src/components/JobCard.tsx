'use client'

import { useTransition } from 'react'
import { updateJobStatus } from '@/app/jobs/actions'
import { formatDate } from '@/lib/utils'
import { ExternalLink, ThumbsUp, ThumbsDown, HelpCircle } from 'lucide-react'
import type { JobWithCompany } from '@/types/database'

interface Props {
  job: JobWithCompany & { fit_score?: number | null; fit_reasons?: string[] | null }
}

export function JobCard({ job }: Props) {
  const [pending, startTransition] = useTransition()

  function setStatus(status: 'interested' | 'dismissed' | 'found') {
    startTransition(() => {
      updateJobStatus(job.id, status)
    })
  }

  return (
    <article className="card p-5 transition-opacity" style={{ opacity: pending ? 0.6 : 1 }}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium leading-snug">{job.title}</h3>
            {job.fit_score != null && (
              <span className="badge bg-brand-50 text-brand-700">{job.fit_score}</span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-slate-500">
            {job.companies?.name ?? 'Unknown company'}
            {job.location ? ` · ${job.location}` : ''}
            {job.remote ? ' · Remote' : ''}
          </p>
          {Array.isArray(job.fit_reasons) && job.fit_reasons.length > 0 && (
            <p className="mt-1 text-xs text-slate-400">
              {job.fit_reasons.slice(0, 2).join(' · ')}
            </p>
          )}
          {job.description && (
            <p className="mt-2 line-clamp-3 text-sm text-slate-600">{job.description}</p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-400">
            <span className="badge bg-slate-100 text-slate-600">{job.source}</span>
            <span>Fetched {formatDate(job.fetched_at)}</span>
            {job.posted_at && <span>Posted {formatDate(job.posted_at)}</span>}
            {job.url && (
              <a
                href={job.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-brand-600 hover:underline"
              >
                Open listing <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>

        {job.status === 'found' && (
          <div className="flex shrink-0 flex-col gap-1.5">
            <button
              type="button"
              onClick={() => setStatus('interested')}
              disabled={pending}
              className="btn-primary text-xs"
              title="Interested"
            >
              <ThumbsUp className="h-3.5 w-3.5" /> Interested
            </button>
            <button
              type="button"
              onClick={() => setStatus('dismissed')}
              disabled={pending}
              className="btn-ghost text-xs"
              title="Not a fit"
            >
              <ThumbsDown className="h-3.5 w-3.5" /> Pass
            </button>
          </div>
        )}

        {job.status === 'interested' && (
          <button
            type="button"
            onClick={() => setStatus('found')}
            disabled={pending}
            className="btn-secondary shrink-0 text-xs"
          >
            <HelpCircle className="h-3.5 w-3.5" /> Undo
          </button>
        )}
      </div>
    </article>
  )
}
