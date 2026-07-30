import { createClient } from '@/lib/supabase/server'
import type { Opportunity } from '@/types/database'

export const dynamic = 'force-dynamic'

export default async function OpportunitiesPage() {
  const supabase = await createClient()

  const { data: ops } = await supabase
    .from('opportunities')
    .select('*')
    .neq('status', 'dismissed')
    .order('fit_score', { ascending: false, nullsFirst: false })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Cash plays</h1>
        <p className="mt-1 text-sm text-slate-500">
          Commercial ways to get paid from your skills and network — not only job
          applications. Copy the pitch and act.
        </p>
      </div>

      <div className="space-y-4">
        {(ops ?? []).length === 0 && (
          <div className="card px-5 py-12 text-center text-sm text-slate-400">
            No opportunities yet. Run{' '}
            <code className="text-xs">supabase/migrations/002_opportunity_centre.sql</code>{' '}
            in the Supabase SQL editor to seed plays built from your profile.
          </div>
        )}
        {((ops ?? []) as Opportunity[]).map((op) => (
          <article key={op.id} className="card p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="badge bg-violet-50 text-violet-700 capitalize">
                    {String(op.type).replace(/_/g, ' ')}
                  </span>
                  {op.fit_score != null && (
                    <span className="badge bg-brand-50 text-brand-700">
                      Fit {op.fit_score}
                    </span>
                  )}
                  <span className="badge bg-slate-100 text-slate-600 capitalize">
                    {op.status}
                  </span>
                </div>
                <h2 className="mt-2 text-lg font-medium">{op.title}</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {op.company_or_channel}
                  {op.estimated_value ? ` · ${op.estimated_value}` : ''}
                  {op.time_to_cash ? ` · ${op.time_to_cash}` : ''}
                  {op.effort ? ` · ${op.effort} effort` : ''}
                </p>
              </div>
            </div>

            {op.description && (
              <p className="mt-3 text-sm text-slate-600">{op.description}</p>
            )}

            {Array.isArray(op.fit_reasons) && op.fit_reasons.length > 0 && (
              <p className="mt-2 text-xs text-slate-400">
                {op.fit_reasons.join(' · ')}
              </p>
            )}

            {op.draft_pitch && (
              <div className="mt-4">
                <p className="mb-1 text-xs font-medium text-slate-500">
                  Ready-to-use pitch
                </p>
                <pre className="whitespace-pre-wrap rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs text-slate-700">
                  {op.draft_pitch}
                </pre>
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  )
}
