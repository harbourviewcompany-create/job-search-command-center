'use client'

import { useTransition } from 'react'
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

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(() => saveSettings(formData))
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
          Days after applied_at to surface follow-up tasks (Phase 4).
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

      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? 'Saving…' : 'Save settings'}
      </button>
    </form>
  )
}
