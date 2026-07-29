'use client'

import { useTransition } from 'react'
import Link from 'next/link'
import { updateApplicationStatus } from '@/app/applications/actions'
import { formatDate } from '@/lib/utils'
import type { ApplicationStatus, ApplicationWithJob } from '@/types/database'
import { ExternalLink } from 'lucide-react'

const NEXT_STATUS: Partial<Record<ApplicationStatus, ApplicationStatus>> = {
  interested: 'applied',
  applied: 'interview',
  interview: 'offer',
}

interface Props {
  app: ApplicationWithJob
}

export function ApplicationCard({ app }: Props) {
  const [pending, startTransition] = useTransition()
  const next = NEXT_STATUS[app.status]

  return (
    <div
      className="card p-4"
      style={{ opacity: pending ? 0.6 : 1 }}
    >
      <Link
        href={`/applications/${app.id}`}
        className="block font-medium leading-snug hover:text-brand-700"
      >
        {app.jobs.title}
      </Link>
      <p className="mt-0.5 text-xs text-slate-500">
        {app.jobs.companies?.name ?? 'Unknown'}
        {app.jobs.location ? ` · ${app.jobs.location}` : ''}
      </p>
      {app.applied_at && (
        <p className="mt-1 text-xs text-slate-400">
          Applied {formatDate(app.applied_at)}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {next && (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(() => updateApplicationStatus(app.id, next))
            }
            className="btn-primary text-xs"
          >
            → {next}
          </button>
        )}
        {app.status !== 'rejected' && app.status !== 'closed' && (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(() => updateApplicationStatus(app.id, 'rejected'))
            }
            className="btn-ghost text-xs text-red-600"
          >
            Rejected
          </button>
        )}
        {app.jobs.url && (
          <a
            href={app.jobs.url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost text-xs"
          >
            <ExternalLink className="h-3 w-3" /> Listing
          </a>
        )}
      </div>
    </div>
  )
}
