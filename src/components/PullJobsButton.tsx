'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'

export function PullJobsButton() {
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const router = useRouter()

  function handlePull() {
    setMessage(null)
    startTransition(async () => {
      try {
        const res = await fetch('/api/jobs/pull', { method: 'POST' })
        const data = await res.json()
        if (!res.ok || data.ok === false) {
          setMessage(data.error ?? 'Pull failed — check Adzuna keys and Edge Function')
          return
        }
        setMessage(
          `Pulled ${data.unique ?? 0} unique · ${data.inserted ?? 0} new · ${data.updated ?? 0} refreshed`
        )
        router.refresh()
      } catch (e) {
        setMessage(String(e))
      }
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={handlePull}
        disabled={pending}
        className="btn-primary"
      >
        <RefreshCw className={`h-4 w-4 ${pending ? 'animate-spin' : ''}`} />
        {pending ? 'Pulling jobs…' : 'Pull jobs now'}
      </button>
      {message && (
        <span className="text-xs text-slate-500">{message}</span>
      )}
    </div>
  )
}
