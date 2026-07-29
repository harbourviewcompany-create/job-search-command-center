'use client'

import { useState, useTransition } from 'react'
import { updateApplicationNotes } from '@/app/applications/actions'

interface Props {
  applicationId: string
  initialNotes: string
}

export function NotesForm({ applicationId, initialNotes }: Props) {
  const [notes, setNotes] = useState(initialNotes)
  const [pending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)

  function handleSave() {
    startTransition(async () => {
      await updateApplicationNotes(applicationId, notes)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
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
    </div>
  )
}
