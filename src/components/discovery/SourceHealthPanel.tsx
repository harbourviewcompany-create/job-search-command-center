import type { SourceHealthRow } from '@/lib/discovery/repository'

const tone: Record<SourceHealthRow['health'], string> = {
  healthy: 'bg-emerald-50 text-emerald-700',
  stale: 'bg-amber-50 text-amber-700',
  failing: 'bg-rose-50 text-rose-700',
  never_run: 'bg-sky-50 text-sky-700',
  disabled: 'bg-slate-100 text-slate-500',
}

export function SourceHealthPanel({ health }: { health: SourceHealthRow[] }) {
  return (
    <section className="space-y-4" aria-labelledby="source-health-heading">
      <div>
        <h2 id="source-health-heading" className="text-lg font-semibold">Source health</h2>
        <p className="mt-1 text-sm text-slate-500">Operational state for every registered employer feed.</p>
      </div>
      <div className="card overflow-x-auto">
        <table className="min-w-[760px] w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Company</th>
              <th className="px-4 py-3 font-medium">Provider</th>
              <th className="px-4 py-3 font-medium">Health</th>
              <th className="px-4 py-3 font-medium">Active jobs</th>
              <th className="px-4 py-3 font-medium">Last success</th>
              <th className="px-4 py-3 font-medium">Failures</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {health.map((source) => (
              <tr key={source.id}>
                <td className="px-4 py-3 font-medium text-slate-900">{source.company_name}</td>
                <td className="px-4 py-3 capitalize text-slate-600">{source.provider}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-1 text-xs font-medium ${tone[source.health]}`}>
                    {source.health.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-700">{source.active_job_count}</td>
                <td className="px-4 py-3 text-slate-600">
                  {source.last_success_at ? new Date(source.last_success_at).toLocaleString() : 'Never'}
                </td>
                <td className="px-4 py-3 text-slate-700">{source.consecutive_failures}</td>
              </tr>
            ))}
            {health.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No ATS sources registered yet.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  )
}
