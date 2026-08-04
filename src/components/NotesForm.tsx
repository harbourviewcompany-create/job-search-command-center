'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { updateApplicationNotes } from '@/app/applications/actions'

interface Props {
  applicationId: string
  initialNotes: string
}

export function NotesForm({ applicationId, initialNotes }: Props) {
  const [notes, setNotes] = useState(initialNotes)
  const [pending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleSave() {
    setError(null)
    setSaved(false)
    startTransition(async () => {
      try {
        await updateApplicationNotes(applicationId, notes)
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      } catch (caughtError) {
        setError(
          caughtError instanceof Error && caughtError.message
            ? caughtError.message
            : 'The notes could not be saved.'
        )
      }
    })
  }

  return (
    <div className="mt-3 space-y-3">
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={5}
        className="input"
        placeholder="Interview notes, recruiter names, salary band, red flags…"
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={pending}
          className="btn-primary"
        >
          {pending ? 'Saving…' : 'Save notes'}
        </button>
        {saved && <span className="text-sm text-emerald-600">Saved</span>}
      </div>
      {error && (
        <p role="alert" className="text-sm leading-6 text-red-700">
          {error}{' '}
          <Link href="/jobs" className="font-semibold underline underline-offset-2">
            Open Jobs to unlock operator access.
          </Link>
        </p>
      )}
    </div>
  )
}
