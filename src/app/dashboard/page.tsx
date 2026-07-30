import { createClient } from '@/lib/supabase/server'
import { daysSince } from '@/lib/utils'
import type { Opportunity } from '@/types/database'
import Link from 'next/link'
import {
  Briefcase,
  CheckCircle2,
  Clock,
  Zap,
  ArrowRight,
  DollarSign,
  Bell,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()

  const [
    { count: foundCount },
    { count: interestedCount },
    { count: appliedCount },
    { data: topJobs },
    { data: cashPlays },
    { data: needsPackage },
    { data: appliedApps },
    { data: followUpSetting },
  ] = await Promise.all([
    supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('status', 'found'),
    supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('status', 'interested'),
    supabase.from('applications').select('*', { count: 'exact', head: true }).eq('status', 'applied'),
    supabase
      .from('jobs')
      .select('id, title, location, remote, fit_score, fit_reasons, companies(name)')
      .eq('status', 'found')
      .order('fit_score', { ascending: false, nullsFirst: false })
      .limit(5),
    supabase
      .from('opportunities')
      .select('*')
      .eq('status', 'active')
      .order('fit_score', { ascending: false, nullsFirst: false })
      .limit(5),
    supabase
      .from('applications')
      .select('id, jobs(title, companies(name))')
      .eq('status', 'interested')
      .is('resume_version_id', null)
      .limit(5),
    supabase
      .from('applications')
      .select('id, applied_at, jobs(title, companies(name))')
      .eq('status', 'applied')
      .not('applied_at', 'is', null)
      .order('applied_at', { ascending: true })
      .limit(50),
    supabase.from('settings').select('value').eq('key', 'follow_up_offsets').maybeSingle(),
  ])

  const followUp1Days =
    (followUpSetting?.value as { follow_up_1_days?: number } | null)?.follow_up_1_days ?? 5

  const dueFollowUps = (appliedApps ?? []).filter((app: any) => {
    const days = daysSince(app.applied_at)
    return days !== null && days >= followUp1Days
  })

  const stats = [
    { label: 'To triage', value: foundCount ?? 0, icon: Briefcase, color: 'text-blue-600 bg-blue-50' },
    { label: 'Interested', value: interestedCount ?? 0, icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50' },
    { label: 'Applied', value: appliedCount ?? 0, icon: Clock, color: 'text-amber-600 bg-amber-50' },
    { label: 'Follow-ups due', value: dueFollowUps.length, icon: Bell, color: 'text-rose-600 bg-rose-50' },
    { label: 'Cash plays', value: cashPlays?.length ?? 0, icon: DollarSign, color: 'text-violet-600 bg-violet-50' },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Today's actions</h1>
        <p className="mt-1 text-sm text-slate-500">
          Highest-fit jobs and commercial plays. Generate a package, apply, or run a cash play.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">{label}</p>
              <div className={`rounded-lg p-2 ${color}`}>
                <Icon className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-3xl font-semibold tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      {/* Action queue */}
      <section className="card border-brand-100 bg-gradient-to-br from-white to-brand-50/30">
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
          <Zap className="h-4 w-4 text-brand-600" />
          <h2 className="font-medium">Do these next</h2>
        </div>
        <ol className="divide-y divide-slate-100">
          {(needsPackage ?? []).length === 0 && (topJobs ?? []).length === 0 && (
            <li className="px-5 py-8 text-center text-sm text-slate-400">
              Add jobs on the Jobs page (or run migration 002 for cash plays). Top fits will show here.
            </li>
          )}
          {(needsPackage ?? []).map((app: any, i: number) => (
            <li key={app.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
              <div className="min-w-0">
                <p className="text-xs font-medium text-brand-600">
                  {i + 1}. Generate package
                </p>
                <p className="truncate text-sm font-medium">
                  {app.jobs?.title ?? 'Application'}
                </p>
                <p className="text-xs text-slate-500">
                  {app.jobs?.companies?.name ?? ''}
                </p>
              </div>
              <Link href={`/applications/${app.id}`} className="btn-primary shrink-0 text-xs">
                Open
              </Link>
            </li>
          ))}
          {(topJobs ?? []).slice(0, 3).map((job: any, i: number) => (
            <li key={job.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-500">
                  {(needsPackage?.length ?? 0) + i + 1}. Triage high-fit job
                  {job.fit_score != null && (
                    <span className="ml-2 badge bg-brand-50 text-brand-700">
                      {job.fit_score}
                    </span>
                  )}
                </p>
                <p className="truncate text-sm font-medium">{job.title}</p>
                <p className="text-xs text-slate-500">
                  {job.companies?.name ?? 'Unknown'}
                  {job.location ? ` · ${job.location}` : ''}
                </p>
              </div>
              <Link href="/jobs" className="btn-secondary shrink-0 text-xs">
                Triage
              </Link>
            </li>
          ))}
        </ol>
      </section>

      {dueFollowUps.length > 0 && (
        <section className="card">
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
            <Bell className="h-4 w-4 text-rose-600" />
            <h2 className="font-medium">Follow-ups due</h2>
          </div>
          <ul className="divide-y divide-slate-100">
            {dueFollowUps.map((app: any) => {
              const days = daysSince(app.applied_at)
              return (
                <li key={app.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {app.jobs?.title ?? 'Application'}
                    </p>
                    <p className="text-xs text-slate-500">
                      {app.jobs?.companies?.name ?? ''}
                      {days !== null ? ` · Applied ${days}d ago` : ''}
                    </p>
                  </div>
                  <Link href={`/applications/${app.id}`} className="btn-secondary shrink-0 text-xs">
                    Follow up
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="font-medium">Best job matches</h2>
            <Link href="/jobs" className="btn-ghost text-xs">
              All jobs <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <ul className="divide-y divide-slate-100">
            {(topJobs ?? []).length === 0 && (
              <li className="px-5 py-8 text-center text-sm text-slate-400">
                No scored jobs yet. Add one manually — it will auto-score against your profile.
              </li>
            )}
            {(topJobs ?? []).map((job: any) => (
              <li key={job.id} className="px-5 py-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{job.title}</p>
                    <p className="text-xs text-slate-500">
                      {job.companies?.name ?? 'Unknown'}
                      {job.location ? ` · ${job.location}` : ''}
                      {job.remote ? ' · Remote' : ''}
                    </p>
                    {Array.isArray(job.fit_reasons) && job.fit_reasons[0] && (
                      <p className="mt-0.5 text-xs text-slate-400">{job.fit_reasons[0]}</p>
                    )}
                  </div>
                  {job.fit_score != null && (
                    <span className="badge shrink-0 bg-brand-50 text-brand-700">
                      {job.fit_score}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="card">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="font-medium">Cash plays</h2>
            <Link href="/opportunities" className="btn-ghost text-xs">
              All plays <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <ul className="divide-y divide-slate-100">
            {(cashPlays ?? []).length === 0 && (
              <li className="px-5 py-8 text-center text-sm text-slate-400">
                Run migration 002_opportunity_centre.sql to seed commercial plays.
              </li>
            )}
            {((cashPlays ?? []) as Opportunity[]).map((op) => (
              <li key={op.id} className="px-5 py-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{op.title}</p>
                    <p className="text-xs text-slate-500">
                      {op.estimated_value ?? '—'}
                      {op.time_to_cash ? ` · ${op.time_to_cash}` : ''}
                    </p>
                  </div>
                  <span className="badge shrink-0 bg-violet-50 text-violet-700 capitalize">
                    {op.type.replace('_', ' ')}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
