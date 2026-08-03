'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface Props {
  profileId?: string
  companySourceId?: string
  label: string
  compact?: boolean
}

export function DiscoveryRunButton({ profileId, companySourceId, label, compact = false }: Props) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function runDiscovery() {
    if (pending) return
    setPending(true)
    setMessage(null)
    try {
      const response = await fetch('/api/jobs/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile_id: profileId ?? null,
          company_source_id: companySourceId ?? null,
          max_pages: 3,
          force: Boolean(companySourceId),
        }),
      })
      const payload = await response.json().catch(() => ({})) as {
        ok?: boolean
        discovery_run_id?: string
        status?: string
        inserted?: number
        merged?: number
        updated?: number
        error?: string
      }
      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error ?? `Discovery request failed with HTTP ${response.status}.`)
      }
      const total = (payload.inserted ?? 0) + (payload.merged ?? 0) + (payload.updated ?? 0)
      setMessage(`Run ${payload.status ?? 'completed'} · ${total} posting updates`)
      router.refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Discovery run failed.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={runDiscovery}
        disabled={pending}
        className={compact ? 'btn-secondary px-3 py-2 text-xs' : 'btn-primary'}
      >
        {pending ? 'Running…' : label}
      </button>
      {message ? <p className="max-w-xs text-xs text-slate-500" role="status">{message}</p> : null}
    </div>
  )
}
