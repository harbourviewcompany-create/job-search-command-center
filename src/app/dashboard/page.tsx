import { createClient } from '@/lib/supabase/server'
import { formatDate, daysSince } from '@/lib/utils'
import Link from 'next/link'
import {
  Briefcase,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowRight,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()

  const [
    { count: foundCount },
    { count: interestedCount },
    { count: appliedCount },
    { count: interviewCount },
    { data: recentJobs },
    { data: dueFollowUps },
  ] = await Promise.all([
    supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('status', 'found'),
    supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('status', 'interested'),
    supabase.from('applications').select('*', { count: 'exact', head: true }).eq('status', 'applied'),
    supabase.from('applications').select('*', { count: 'exact', head: true }).eq('status', 'interview'),
    supabase
      .from('jobs')
      .select('id, title, location, remote, status, fetched_at, companies(name)')
      .eq('status', 'found')
      .order('fetched_at', { ascending: false })
      .limit(8),
    supabase
      .from('outreach_messages')
      .select('id, type, scheduled_for, applications(jobs(title, companies(name)))')
      .eq('status', 'drafted')
      .lte('scheduled_for', new Date().toISOString().slice(0, 10))
      .order('scheduled_for', { ascending: true })
      .limit(5),
  ])

  const stats = [
    { label: 'New to triage', value: foundCount ?? 0, icon: Briefcase, color: 'text-blue-600 bg-blue-50' },
    { label: 'Interested', value: interestedCount ?? 0, icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50' },
    { label: 'Applied', value: appliedCount ?? 0, icon: Clock, color: 'text-amber-600 bg-amber-50' },
    { label: 'Interview', value: interviewCount ?? 0, icon: AlertCircle, color: 'text-purple-600 bg-purple-50' },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          Pipeline snapshot and items that need your attention.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
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

      <div className="grid gap-6 lg:grid-cols-2">
        {/* New postings */}
        <section className="card">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="font-medium">New postings to triage</h2>
            <Link href="/jobs" className="btn-ghost text-xs">
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <ul className="divide-y divide-slate-100">
            {(recentJobs ?? []).length === 0 && (
              <li className="px-5 py-8 text-center text-sm text-slate-400">
                No new jobs. Add one manually or wait for the daily pull.
              </li>
            )}
            {(recentJobs ?? []).map((job: any) => (
              <li key={job.id} className="flex items-start justify-between gap-3 px-5 py-3.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{job.title}</p>
                  <p className="text-xs text-slate-500">
                    {job.companies?.name ?? 'Unknown company'}
                    {job.location ? ` · ${job.location}` : ''}
                    {job.remote ? ' · Remote' : ''}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-slate-400">
                  {formatDate(job.fetched_at)}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Due follow-ups */}
        <section className="card">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="font-medium">Due follow-ups</h2>
            <Link href="/applications" className="btn-ghost text-xs">
              Pipeline <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <ul className="divide-y divide-slate-100">
            {(dueFollowUps ?? []).length === 0 && (
              <li className="px-5 py-8 text-center text-sm text-slate-400">
                No follow-ups due. (Phase 3/4 will populate these.)
              </li>
            )}
            {(dueFollowUps ?? []).map((msg: any) => (
              <li key={msg.id} className="px-5 py-3.5">
                <p className="text-sm font-medium">
                  {msg.applications?.jobs?.title ?? 'Application'}
                </p>
                <p className="text-xs text-slate-500">
                  {msg.type.replace('_', ' ')} · due {formatDate(msg.scheduled_for)}
                  {daysSince(msg.scheduled_for) !== null &&
                    daysSince(msg.scheduled_for)! > 0 &&
                    ` (${daysSince(msg.scheduled_for)}d overdue)`}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
