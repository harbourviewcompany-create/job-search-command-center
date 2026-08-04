'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { KeyRound, LockKeyhole, RefreshCw } from 'lucide-react'

interface Props {
  authorized: boolean
  accessConfigured: boolean
}

export function PullJobsButton({ authorized, accessConfigured }: Props) {
  const [pending, startTransition] = useTransition()
  const [accessKey, setAccessKey] = useState('')
  const [unlocking, setUnlocking] = useState(false)
  const [locking, setLocking] = useState(false)
  const [canLock, setCanLock] = useState(false)
  const [browserAuthorized, setBrowserAuthorized] = useState(false)
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null)
  const router = useRouter()
  const effectiveAuthorized = authorized || browserAuthorized

  const refreshAccessState = useCallback(async () => {
    if (!effectiveAuthorized && !accessConfigured) {
      setCanLock(false)
      return
    }

    try {
      const response = await fetch('/api/jobs/pull/access', { method: 'GET', cache: 'no-store' })
      const data = await response.json()
      setCanLock(response.ok && data.canLock === true)
    } catch {
      setCanLock(false)
    }
  }, [accessConfigured, effectiveAuthorized])

  useEffect(() => {
    void refreshAccessState()
  }, [refreshAccessState])

  function handlePull() {
    if (!effectiveAuthorized) {
      setMessage({ tone: 'error', text: 'Unlock operator access before running this action.' })
      return
    }

    setMessage(null)
    startTransition(async () => {
      try {
        const response = await fetch('/api/jobs/pull', { method: 'POST' })
        const data = await response.json()

        if (!response.ok || data.ok === false) {
          if (response.status === 401) {
            setBrowserAuthorized(false)
            setCanLock(false)
            router.refresh()
          }
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

  async function handleUnlock(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!accessKey.trim() || unlocking) return

    setUnlocking(true)
    setMessage(null)
    try {
      const response = await fetch('/api/jobs/pull/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: accessKey }),
      })
      const data = await response.json()

      if (!response.ok || data.ok === false) {
        setMessage({ tone: 'error', text: data.error ?? 'Operator access could not be unlocked.' })
        return
      }

      setAccessKey('')
      setBrowserAuthorized(true)
      setMessage({ tone: 'success', text: 'Operator access unlocked for this browser.' })
      await refreshAccessState()
      router.refresh()
    } catch (caughtError) {
      setMessage({
        tone: 'error',
        text: caughtError instanceof Error ? caughtError.message : 'Operator access could not be unlocked.',
      })
    } finally {
      setUnlocking(false)
    }
  }

  async function handleLock() {
    if (locking) return

    setLocking(true)
    setMessage(null)
    try {
      const response = await fetch('/api/jobs/pull/access', { method: 'DELETE' })
      if (!response.ok) throw new Error('Operator access could not be locked.')
      setCanLock(false)
      setBrowserAuthorized(false)
      setMessage({ tone: 'success', text: 'Operator access locked.' })
      router.refresh()
    } catch (caughtError) {
      setMessage({
        tone: 'error',
        text: caughtError instanceof Error ? caughtError.message : 'Operator access could not be locked.',
      })
    } finally {
      setLocking(false)
    }
  }

  return (
    <div className="flex max-w-sm flex-col items-stretch gap-2 sm:items-end">
      {effectiveAuthorized ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={handlePull}
            disabled={pending || locking}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-black/20 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${pending ? 'animate-spin' : ''}`} aria-hidden="true" />
            {pending ? 'Pulling jobs…' : 'Pull latest jobs'}
          </button>
          {accessConfigured && canLock && (
            <button
              type="button"
              onClick={handleLock}
              disabled={pending || locking}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-3 text-sm font-semibold text-white transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:opacity-60"
            >
              <LockKeyhole className="h-4 w-4" aria-hidden="true" />
              {locking ? 'Locking…' : 'Lock'}
            </button>
          )}
        </div>
      ) : accessConfigured ? (
        <div className="flex w-full flex-col gap-2">
          <button
            type="button"
            disabled
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 opacity-60 shadow-lg shadow-black/20"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Pull latest jobs
          </button>
          <form onSubmit={handleUnlock} className="flex w-full flex-col gap-2 sm:flex-row" aria-busy={unlocking}>
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">Operator access key</span>
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                type="password"
                value={accessKey}
                onChange={(event) => setAccessKey(event.target.value)}
                className="min-h-12 w-full rounded-xl border border-white/20 bg-white px-10 py-3 text-sm text-slate-950 shadow-lg shadow-black/20 outline-none placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-brand-400"
                placeholder="Access key"
                autoComplete="current-password"
              />
            </label>
            <button
              type="submit"
              disabled={unlocking || !accessKey.trim()}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-black/20 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <KeyRound className="h-4 w-4" aria-hidden="true" />
              {unlocking ? 'Unlocking…' : 'Unlock operator'}
            </button>
          </form>
          <div className="space-y-1 text-xs font-medium text-amber-100">
            <p>An authenticated Supabase session is required for manual pulls.</p>
            <p>For the single-user setup, unlock this browser with the configured operator key; the same access protects job mutations.</p>
          </div>
        </div>
      ) : (
        <p className="rounded-xl border border-amber-300/30 bg-amber-100/10 px-3 py-2 text-xs font-medium text-amber-100">
          Configure JOB_PULL_API_KEY to enable protected operator actions.
        </p>
      )}

      <div aria-live="polite" className="min-h-4 max-w-sm text-right">
        {message && (
          <p className={message.tone === 'error' ? 'break-words text-xs font-medium text-rose-300' : 'text-xs font-medium text-emerald-300'}>
            {message.text}
          </p>
        )}
      </div>
    </div>
  )
}
