'use client'

import { AlertTriangle, RotateCcw } from 'lucide-react'

export default function JobsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="card mx-auto flex min-h-96 max-w-2xl flex-col items-center justify-center px-6 py-12 text-center" role="alert">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-700 ring-1 ring-inset ring-red-200">
        <AlertTriangle className="h-6 w-6" aria-hidden="true" />
      </div>
      <h1 className="mt-5 text-xl font-semibold text-slate-950">The job pipeline could not be loaded</h1>
      <p className="mt-2 max-w-lg text-sm leading-6 text-slate-600">
        The current data was left unchanged. Retry the request; if the problem continues, verify the Supabase connection and server logs.
      </p>
      {process.env.NODE_ENV === 'development' && (
        <p className="mt-3 max-w-full break-words rounded-lg bg-slate-100 px-3 py-2 text-left font-mono text-xs text-slate-600">
          {error.message}
        </p>
      )}
      <button type="button" onClick={reset} className="btn-primary mt-6">
        <RotateCcw className="h-4 w-4" aria-hidden="true" />
        Retry
      </button>
    </div>
  )
}
