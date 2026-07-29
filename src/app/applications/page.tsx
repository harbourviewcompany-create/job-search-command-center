import { createClient } from '@/lib/supabase/server'
import { ApplicationCard } from '@/components/ApplicationCard'
import type { ApplicationStatus, ApplicationWithJob } from '@/types/database'

export const dynamic = 'force-dynamic'

const COLUMNS: { status: ApplicationStatus; label: string }[] = [
  { status: 'interested', label: 'Interested' },
  { status: 'applied', label: 'Applied' },
  { status: 'interview', label: 'Interview' },
  { status: 'offer', label: 'Offer' },
  { status: 'rejected', label: 'Rejected' },
  { status: 'closed', label: 'Closed' },
]

export default async function ApplicationsPage() {
  const supabase = await createClient()

  const { data } = await supabase
    .from('applications')
    .select('*, jobs(*, companies(*))')
    .order('updated_at', { ascending: false })

  const apps = (data ?? []) as ApplicationWithJob[]

  const byStatus = COLUMNS.reduce(
    (acc, col) => {
      acc[col.status] = apps.filter((a) => a.status === col.status)
      return acc
    },
    {} as Record<ApplicationStatus, ApplicationWithJob[]>
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pipeline</h1>
        <p className="mt-1 text-sm text-slate-500">
          Kanban across Interested → Closed. Advance stages as you progress.
        </p>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map(({ status, label }) => (
          <div
            key={status}
            className="flex w-64 shrink-0 flex-col rounded-xl border border-slate-200 bg-slate-50/80"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2.5">
              <h2 className="text-sm font-medium">{label}</h2>
              <span className="badge bg-white text-slate-600">
                {byStatus[status].length}
              </span>
            </div>
            <div className="flex flex-1 flex-col gap-2 p-2">
              {byStatus[status].length === 0 && (
                <p className="px-2 py-6 text-center text-xs text-slate-400">
                  Empty
                </p>
              )}
              {byStatus[status].map((app) => (
                <ApplicationCard key={app.id} app={app} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
