'use client'

import { useRef, useTransition } from 'react'
import { addManualJob } from '@/app/jobs/actions'
import { Plus } from 'lucide-react'

export function AddJobForm() {
  const formRef = useRef<HTMLFormElement>(null)
  const [pending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      await addManualJob(formData)
      formRef.current?.reset()
    })
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="card space-y-4 p-5"
    >
      <h2 className="flex items-center gap-2 font-medium">
        <Plus className="h-4 w-4" /> Add job manually
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Title *</label>
          <input name="title" required className="input" placeholder="Senior Full Stack Engineer" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Company *</label>
          <input name="company" required className="input" placeholder="Acme Corp" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Location</label>
          <input name="location" className="input" placeholder="San Francisco, CA" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Listing URL</label>
          <input name="url" type="url" className="input" placeholder="https://..." />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Description</label>
        <textarea name="description" rows={3} className="input" placeholder="Paste key requirements or notes..." />
      </div>
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" name="remote" className="rounded border-slate-300" />
          Remote
        </label>
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? 'Saving…' : 'Add job'}
        </button>
      </div>
    </form>
  )
}
