'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'

interface Props {
  authorized: boolean
}

export function PullJobsButton({ authorized }: Props) {
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null)
  const router = useRouter()

  function handlePull() {
    if (!authorized) {
      setMessage({ tone: 'error', text: 'Sign in to run a manual job pull.' })
      return
    }

    setMessage(null)
    startTransition(async () => {
      try {
        const response = await fetch('/api/jobs/pull', { method: 'POST' })
        const data = await response.json()

        if (!response.ok || data.ok === false) {
          setMessage({ tone: 'error', text: data.error ?? 'The job pull failed. Verify provider configuration.' })
          return
        }

        setMessage({
          tone: 'success',
          text: `${data.inserted ?? 0} new · ${data.updated ?? 0} refreshed`,
        })
        router.refresh()
      } catch (caughtError) {
        setMessage({
          tone: 'error',
          text: caughtError instanceof Error ? caughtError.message : 'The job pull failed.',
        })
      }
    })
  }

  return (
    <div className="flex max-w-full flex-col items-stretch gap-2 sm:items-end">
      <button
        type="button"
        onClick={handlePull}
        disabled={pending || !authorized}
        aria-describedby={!authorized ? 'job-pull-authorization-message' : undefined}
        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-black/20 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <RefreshCw className={`h-4 w-4 ${pending ? 'animate-spin' : ''}`} aria-hidden="true" />
        {pending ? 'Pulling jobs…' : 'Pull latest jobs'}
      </button>
      <div aria-live="polite" className="min-h-4 max-w-xs text-right">
        {!authorized && !message && (
          <p id="job-pull-authorization-message" className="text-xs font-medium text-amber-200">
            An authenticated Supabase session is required for manual pulls.
          </p>
        )}
        {message && (
          <p className={message.tone === 'error' ? 'break-words text-xs font-medium text-rose-300' : 'text-xs font-medium text-emerald-300'}>
            {message.text}
          </p>
        )}
      </div>
    </div>
  )
}
