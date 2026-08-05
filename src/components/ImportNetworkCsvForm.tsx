'use client'

import { useRef, useState, useTransition } from 'react'
import { importNetworkCsv } from '@/app/network/actions'

export function ImportNetworkCsvForm() {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFile(file: File) {
    setError(null)
    setResult(null)
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result ?? '')
      startTransition(async () => {
        const outcome = await importNetworkCsv(text)
        if (outcome.error) setError(outcome.error)
        setResult(outcome.imported)
      })
    }
    reader.onerror = () => setError('Could not read that file.')
    reader.readAsText(file)
  }

  return (
    <div className="card space-y-3 p-5">
      <h2 className="font-medium">Import your network</h2>
      <p className="text-sm text-slate-500">
        LinkedIn → Settings → Data privacy → Get a copy of your data → &quot;Connections&quot;
        only. You&apos;ll get an email with a Connections.csv download link. Import it here —
        every company the discovery engine finds gets checked against it automatically.
      </p>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        className="input"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
        }}
      />
      {pending && <p className="text-xs text-slate-500">Importing…</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
      {result !== null && !error && (
        <p className="text-xs text-emerald-600">Imported {result} connections.</p>
      )}
    </div>
  )
}
