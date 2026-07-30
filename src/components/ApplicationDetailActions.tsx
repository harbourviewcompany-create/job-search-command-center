'use client'

import { useState, useTransition } from 'react'
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
  hasPackage?: boolean
}

export function ApplicationDetailActions({
  applicationId,
  currentStatus,
  hasPackage = true,
}: Props) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {STATUSES.map((status) => {
          const blocked = status === 'applied' && !hasPackage
          return (
            <button
              key={status}
              type="button"
              disabled={pending || status === currentStatus || blocked}
              title={
                blocked
                  ? 'Generate a tailored package first'
                  : undefined
              }
              onClick={() =>
                startTransition(async () => {
                  setError(null)
                  try {
                    await updateApplicationStatus(applicationId, status)
                  } catch (err) {
                    setError(
                      err instanceof Error ? err.message : 'Update failed'
                    )
                  }
                })
              }
              className={
                status === currentStatus
                  ? 'btn-primary capitalize'
                  : 'btn-secondary capitalize'
              }
            >
              {status}
            </button>
          )
        })}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {!hasPackage && currentStatus === 'interested' && (
        <p className="text-xs text-amber-700">
          Applied is locked until you generate a package.
        </p>
      )}
    </div>
  )
}
