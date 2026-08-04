'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Linkedin } from 'lucide-react'
import { importLinkedInJob } from '@/app/jobs/linkedin-actions'

export function LinkedInImportForm() {
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
        await importLinkedInJob(formData)
        formRef.current?.reset()
        setMessage({ tone: 'success', text: 'LinkedIn job imported and scored.' })
        router.refresh()
      } catch (error) {
        setMessage({
          tone: 'error',
          text: error instanceof Error ? error.message : 'Import failed',
        })
      }
    })
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="card space-y-4 border-[#0A66C2]/20 p-5"
      aria-busy={pending}
    >
      <h2 className="flex items-center gap-2 font-medium">
        <Linkedin className="h-4 w-4 text-[#0A66C2]" aria-hidden="true" />
        Import from LinkedIn
      </h2>
      <p className="text-xs text-slate-500">
        LinkedIn has no public job-search API. Open a listing on LinkedIn, paste
        the URL and details here — we score it and add it to your triage queue.
      </p>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">
          LinkedIn job URL *
        </label>
        <input
          name="url"
          type="url"
          required
          className="input"
          placeholder="https://www.linkedin.com/jobs/view/1234567890/"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            Title *
          </label>
          <input
            name="title"
            required
            className="input"
            placeholder="Business Development Manager"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            Company *
          </label>
          <input name="company" required className="input" placeholder="Acme Corp" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            Location
          </label>
          <input name="location" className="input" placeholder="Ottawa, ON" />
        </div>
        <div className="flex items-end pb-2">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" name="remote" className="rounded border-slate-300" />
            Remote
          </label>
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">
          Description / requirements (paste for better fit score)
        </label>
        <textarea
          name="description"
          rows={3}
          className="input"
          placeholder="Paste key bullets from the LinkedIn posting…"
        />
      </div>
      <div aria-live="polite" className="min-h-5">
        {message && (
          <p className={message.tone === 'error' ? 'text-xs text-red-600' : 'text-xs text-emerald-700'}>
            {message.text}
          </p>
        )}
      </div>
      <div className="flex justify-end">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? 'Importing…' : 'Import & score'}
        </button>
      </div>
    </form>
  )
}
