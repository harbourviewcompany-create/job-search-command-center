'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { saveSettings } from '@/app/settings/actions'

interface Props {
  initialTerms: string
  initialLocations: string
  followUp1: number
  followUp2: number
  baseResume: string
}

export function SettingsForm({
  initialTerms,
  initialLocations,
  followUp1,
  followUp2,
  baseResume,
}: Props) {
  const [pending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    setError(null)
    setSaved(false)
    startTransition(async () => {
      try {
        await saveSettings(formData)
        setSaved(true)
      } catch (caughtError) {
        setError(
          caughtError instanceof Error && caughtError.message
            ? caughtError.message
            : 'Settings could not be saved.'
        )
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="card space-y-4 p-6">
        <h2 className="font-medium">Saved search</h2>
        <p className="text-sm text-slate-500">
          Comma-separated. Used by the daily job pull (Phase 4).
        </p>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            Search terms
          </label>
          <input
            name="terms"
            defaultValue={initialTerms}
            className="input"
            placeholder="software engineer, full stack developer"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            Locations
          </label>
          <input
            name="locations"
            defaultValue={initialLocations}
            className="input"
            placeholder="Remote, United States, New York"
          />
        </div>
      </section>

      <section className="card space-y-4 p-6">
        <h2 className="font-medium">Follow-up cadence</h2>
        <p className="text-sm text-slate-500">
          Days after applying before a follow-up shows as due on the dashboard.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              First follow-up (days)
            </label>
            <input
              name="follow_up_1"
              type="number"
              min={1}
              defaultValue={followUp1}
              className="input"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Second follow-up (days)
            </label>
            <input
              name="follow_up_2"
              type="number"
              min={1}
              defaultValue={followUp2}
              className="input"
            />
          </div>
        </div>
      </section>

      <section className="card space-y-4 p-6">
        <h2 className="font-medium">Base resume</h2>
        <p className="text-sm text-slate-500">
          Markdown or plain text. Phase 2 will use this as the source for
          tailored rewrites.
        </p>
        <textarea
          name="base_resume"
          rows={12}
          defaultValue={baseResume}
          className="input font-mono text-xs"
          placeholder="# Your Name\n\n## Experience\n..."
        />
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? 'Saving…' : 'Save settings'}
        </button>
        {saved && <span className="text-sm text-emerald-600">Settings saved</span>}
      </div>
      {error && (
        <p role="alert" className="text-sm leading-6 text-red-700">
          {error}{' '}
          <Link href="/jobs" className="font-semibold underline underline-offset-2">
            Open Jobs to unlock operator access.
          </Link>
        </p>
      )}
    </form>
  )
}
