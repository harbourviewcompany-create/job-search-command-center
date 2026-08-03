import type { DiscoveryRunRow } from '@/lib/discovery/repository'

const statusTone: Record<string, string> = {
  completed: 'bg-emerald-50 text-emerald-700',
  partial: 'bg-amber-50 text-amber-700',
  failed: 'bg-rose-50 text-rose-700',
  running: 'bg-sky-50 text-sky-700',
  queued: 'bg-slate-100 text-slate-600',
}

export function DiscoveryRunPanel({ runs }: { runs: DiscoveryRunRow[] }) {
  return (
    <section className="space-y-4" aria-labelledby="run-history-heading">
      <div>
        <h2 id="run-history-heading" className="text-lg font-semibold">Discovery run history</h2>
        <p className="mt-1 text-sm text-slate-500">Provider work, canonicalization yield, lifecycle changes, and failures.</p>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {runs.map((run) => (
          <article key={run.id} className="card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold capitalize text-slate-950">{run.trigger_type} discovery</p>
                <p className="mt-1 text-xs text-slate-500">{new Date(run.started_at).toLocaleString()}</p>
              </div>
              <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusTone[run.status] ?? 'bg-slate-100 text-slate-600'}`}>
                {run.status}
              </span>
            </div>
            <dl className="mt-4 grid grid-cols-3 gap-3 text-xs sm:grid-cols-4">
              <div><dt className="text-slate-500">Fetched</dt><dd className="mt-1 text-base font-semibold text-slate-900">{run.postings_fetched}</dd></div>
              <div><dt className="text-slate-500">Created</dt><dd className="mt-1 text-base font-semibold text-slate-900">{run.canonical_jobs_created}</dd></div>
              <div><dt className="text-slate-500">Merged</dt><dd className="mt-1 text-base font-semibold text-slate-900">{run.postings_merged}</dd></div>
              <div><dt className="text-slate-500">Updated</dt><dd className="mt-1 text-base font-semibold text-slate-900">{run.canonical_jobs_updated}</dd></div>
              <div><dt className="text-slate-500">Requests</dt><dd className="mt-1 text-base font-semibold text-slate-900">{run.requests_used}</dd></div>
              <div><dt className="text-slate-500">Closed</dt><dd className="mt-1 text-base font-semibold text-slate-900">{run.jobs_closed}</dd></div>
              <div><dt className="text-slate-500">Reopened</dt><dd className="mt-1 text-base font-semibold text-slate-900">{run.jobs_reopened}</dd></div>
              <div><dt className="text-slate-500">Errors</dt><dd className="mt-1 text-base font-semibold text-slate-900">{run.errors_count}</dd></div>
            </dl>
            <p className="mt-4 text-xs text-slate-500">
              Providers: {(run.providers_attempted ?? []).join(', ') || 'None'} · Steps: {run.step_count ?? 0} · Rate-limited: {run.rate_limited_step_count ?? 0}
            </p>
          </article>
        ))}
        {runs.length === 0 ? <div className="card p-8 text-center text-sm text-slate-500">No discovery runs recorded yet.</div> : null}
      </div>
    </section>
  )
}
