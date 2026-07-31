'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { addManualJob } from '@/app/jobs/actions'

export function AddJobForm() {
  const formRef = useRef<HTMLFormElement>(null)
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null)
  const router = useRouter()

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    setMessage(null)

    startTransition(async () => {
      try {
        await addManualJob(formData)
        formRef.current?.reset()
        setMessage({ tone: 'success', text: 'Job added to the triage queue.' })
        router.refresh()
      } catch (caughtError) {
        setMessage({
          tone: 'error',
          text: caughtError instanceof Error ? caughtError.message : 'The job could not be added.',
        })
      }
    })
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="card space-y-4 p-4 sm:p-5" aria-busy={pending}>
      <div>
        <h2 className="flex items-center gap-2 font-semibold text-slate-950">
          <Plus className="h-4 w-4 text-brand-700" aria-hidden="true" /> Add job manually
        </h2>
        <p className="mt-1 text-xs leading-5 text-slate-500">Create a record when no supported import is available.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-semibold text-slate-700">
          Job title <span aria-hidden="true">*</span>
          <input name="title" required className="input mt-1" placeholder="Senior account executive" autoComplete="off" />
        </label>
        <label className="block text-xs font-semibold text-slate-700">
          Company <span aria-hidden="true">*</span>
          <input name="company" required className="input mt-1" placeholder="Company name" autoComplete="organization" />
        </label>
        <label className="block text-xs font-semibold text-slate-700">
          Location
          <input name="location" className="input mt-1" placeholder="Ottawa, ON" autoComplete="address-level2" />
        </label>
        <label className="block text-xs font-semibold text-slate-700">
          Listing URL
          <input name="url" type="url" inputMode="url" className="input mt-1" placeholder="https://…" autoComplete="url" />
        </label>
      </div>
      <label className="block text-xs font-semibold text-slate-700">
        Description or notes
        <textarea name="description" rows={4} className="input mt-1 resize-y" placeholder="Paste requirements or notes for scoring…" />
      </label>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-slate-700">
          <input type="checkbox" name="remote" className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
          Remote role
        </label>
        <button type="submit" disabled={pending} className="btn-primary w-full sm:w-auto">
          {pending ? 'Saving…' : 'Add job'}
        </button>
      </div>
      <div aria-live="polite" className="min-h-5">
        {message && (
          <p className={message.tone === 'error' ? 'text-xs font-medium text-red-700' : 'text-xs font-medium text-emerald-700'}>
            {message.text}
          </p>
        )}
      </div>
    </form>
  )
}
