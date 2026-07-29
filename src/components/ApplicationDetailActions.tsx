'use client'

import { useTransition } from 'react'
import { updateApplicationStatus } from '@/app/applications/actions'
import type { ApplicationStatus } from '@/types/database'

const STATUSES: ApplicationStatus[] = [
  'interested',
  'applied',
  'interview',
  'offer',
  'rejected',
  'closed',
]

interface Props {
  applicationId: string
  currentStatus: ApplicationStatus
}

export function ApplicationDetailActions({
  applicationId,
  currentStatus,
}: Props) {
  const [pending, startTransition] = useTransition()

  return (
    <div className="flex flex-wrap gap-2">
      {STATUSES.map((status) => (
        <button
          key={status}
          type="button"
          disabled={pending || status === currentStatus}
          onClick={() =>
            startTransition(() =>
              updateApplicationStatus(applicationId, status)
            )
          }
          className={
            status === currentStatus
              ? 'btn-primary capitalize'
              : 'btn-secondary capitalize'
          }
        >
          {status}
        </button>
      ))}
    </div>
  )
}
