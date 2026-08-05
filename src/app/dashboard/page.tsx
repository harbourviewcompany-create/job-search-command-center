import Link from 'next/link'
import {
  ArrowRight,
  Bell,
  Briefcase,
  CheckCircle2,
  Clock,
  DollarSign,
  Send,
  Users,
  Zap,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { normalizeDisplayText } from '@/lib/text.mjs'
import { daysSince } from '@/lib/utils'
import type { Opportunity } from '@/types/database'

export const dynamic = 'force-dynamic'

type DashboardCompany = { name: string } | null

type DashboardJob = {
  id: string
  title: string
  location: string | null
  remote: boolean | null
  fit_score: number | null
  fit_reasons: string[] | null
  companies: DashboardCompany
}

type QueueApplication = {
  id: string
  jobs: { title: string; companies: DashboardCompany } | null
}

type AppliedApplication = QueueApplication & {
  applied_at: string | null
}

type ReadyToApplyRow = {
  overall_score: number
  jobs: {
    id: string
    title: string
    companies: DashboardCompany
    applications: { id: string }[]
  } | null
}

type DraftedOutreach = {
  id: string
  type: string
  applications: { id: string; jobs: { title: string; companies: DashboardCompany } | null } | null
}

type NetworkMatch = { company_name: string; contact_name: string; contact_title: string | null }

/** Today's 5: a single ranked queue mixing ready-to-send applications,
 *  drafted follow-ups, and top prospect plays — with a "you know someone
 *  here" nudge wherever an imported network contact matches the company.
 *  Beats a job board because it removes the "what should I even do right
 *  now" decision, not just because it lists more jobs. */
type TodayItem = {
  key: string
  kind: 'apply' | 'follow_up' | 'prospect'
  title: string
  subtitle: string
  href: string
  cta: string
  networkNudge?: string
}

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
    { data: readyToApplyRaw },
    { data: draftedOutreachRaw },
    { data: networkMatchesRaw },
  ] = await Promise.all([
    supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('status', 'found'),
    supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('status', 'interested'),
    supabase.from('applications').select('*', { count: 'exact', head: true }).eq('status', 'applied'),
    supabase
      .from('job_scores')
      .select('overall_score, jobs!inner(id, title, location, remote, companies(name))')
      .eq('hard_disqualified', false)
      .order('overall_score', { ascending: false })
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
    supabase
      .from('job_scores')
      .select('overall_score, jobs!inner(id, title, companies(name), applications!inner(id))')
      .eq('jobs.applications.status', 'interested')
      .not('jobs.applications.resume_version_id', 'is', null)
      .order('overall_score', { ascending: false })
      .limit(3),
    supabase
      .from('outreach_messages')
      .select('id, type, applications(id, jobs(title, companies(name)))')
      .eq('status', 'drafted')
      .order('scheduled_for', { ascending: true })
      .limit(3),
    supabase.from('network_matches').select('company_name, contact_name, contact_title'),
  ])

  const typedTopJobs = (topJobs ?? []) as unknown as { overall_score: number; jobs: DashboardJob | null }[]
  const typedNeedsPackage = (needsPackage ?? []) as unknown as QueueApplication[]
  const typedAppliedApps = (appliedApps ?? []) as unknown as AppliedApplication[]
  const typedCashPlays = (cashPlays ?? []) as Opportunity[]
  const typedReadyToApply = (readyToApplyRaw ?? []) as unknown as ReadyToApplyRow[]
  const typedDraftedOutreach = (draftedOutreachRaw ?? []) as unknown as DraftedOutreach[]
  const networkMatches = (networkMatchesRaw ?? []) as NetworkMatch[]

  const networkByCompany = new Map<string, NetworkMatch>()
  for (const match of networkMatches) {
    const key = normalizeDisplayText(match.company_name).toLowerCase()
    if (key && !networkByCompany.has(key)) networkByCompany.set(key, match)
  }
  const nudgeFor = (companyName?: string | null) => {
    const key = normalizeDisplayText(companyName).toLowerCase()
    const match = key ? networkByCompany.get(key) : undefined
    if (!match) return undefined
    return `You know ${match.contact_name}${match.contact_title ? ` (${match.contact_title})` : ''} there`
  }

  const followUpTypeLabel: Record<string, string> = {
    initial: 'Send outreach',
    follow_up_1: 'Send follow-up',
    follow_up_2: 'Send second follow-up',
  }

  const todaysFive: TodayItem[] = [
    ...typedReadyToApply
      .filter((row) => row.jobs && row.jobs.applications?.[0]?.id)
      .map((row) => {
        const job = row.jobs!
        const applicationId = job.applications[0].id
        return {
          key: `apply-${applicationId}`,
          kind: 'apply' as const,
          title: normalizeDisplayText(job.title, 'Untitled role'),
          subtitle: `${normalizeDisplayText(job.companies?.name, 'Unknown company')} · Package ready · Fit ${Math.round(row.overall_score)}`,
          href: `/applications/${applicationId}`,
          cta: 'Review & apply',
          networkNudge: nudgeFor(job.companies?.name),
        }
      }),
    ...typedDraftedOutreach
      .filter((row) => row.applications)
      .map((row) => {
        const app = row.applications!
        return {
          key: `followup-${row.id}`,
          kind: 'follow_up' as const,
          title: normalizeDisplayText(app.jobs?.title, 'Application'),
          subtitle: `${normalizeDisplayText(app.jobs?.companies?.name)} · Draft ready`,
          href: `/applications/${app.id}`,
          cta: followUpTypeLabel[row.type] ?? 'Review & send',
          networkNudge: nudgeFor(app.jobs?.companies?.name),
        }
      }),
    ...typedCashPlays.slice(0, 2).map((opportunity) => ({
      key: `prospect-${opportunity.id}`,
      kind: 'prospect' as const,
      title: normalizeDisplayText(opportunity.title, 'Untitled opportunity'),
      subtitle: `${normalizeDisplayText(opportunity.company_or_channel)} · ${normalizeDisplayText(opportunity.time_to_cash, 'Timing TBD')}`,
      href: '/opportunities',
      cta: 'Reach out',
      networkNudge: nudgeFor(opportunity.company_or_channel),
    })),
  ].slice(0, 5)

  const followUp1Days =
    (followUpSetting?.value as { follow_up_1_days?: number } | null)?.follow_up_1_days ?? 5

  const dueFollowUps = typedAppliedApps.filter((app) => {
    const days = daysSince(app.applied_at)
    return days !== null && days >= followUp1Days
  })

  const stats = [
    { label: 'To triage', value: foundCount ?? 0, icon: Briefcase, color: 'text-blue-600 bg-blue-50' },
    { label: 'Interested', value: interestedCount ?? 0, icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50' },
    { label: 'Applied', value: appliedCount ?? 0, icon: Clock, color: 'text-amber-600 bg-amber-50' },
    { label: 'Follow-ups due', value: dueFollowUps.length, icon: Bell, color: 'text-rose-600 bg-rose-50' },
    { label: 'Cash plays', value: typedCashPlays.length, icon: DollarSign, color: 'text-violet-600 bg-violet-50' },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Today&apos;s 5</h1>
        <p className="mt-1 text-sm text-slate-500">
          The five highest-value moves right now — ready-to-send applications, drafted
          follow-ups, and warm prospects — not a job board to scroll.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">{label}</p>
              <div className={`rounded-lg p-2 ${color}`}>
                <Icon className="h-4 w-4" aria-hidden="true" />
              </div>
            </div>
            <p className="mt-2 text-3xl font-semibold tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      <section className="card border-brand-100 bg-gradient-to-br from-white to-brand-50/30">
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
          <Zap className="h-4 w-4 text-brand-600" aria-hidden="true" />
          <h2 className="font-medium">Today&apos;s 5</h2>
        </div>
        <ol className="divide-y divide-slate-100">
          {todaysFive.length === 0 && (
            <li className="px-5 py-8 text-center text-sm text-slate-400">
              Nothing queued yet — run &quot;Pull jobs now&quot; on the Jobs page. High-fit roles
              auto-assemble a ready-to-send package here once scored.
            </li>
          )}
          {todaysFive.map((item, index) => (
            <li key={item.key} className="flex items-center justify-between gap-3 px-5 py-3.5">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-xs font-medium text-brand-600">
                  {index + 1}.{' '}
                  {item.kind === 'apply' ? 'Ready to apply' : item.kind === 'follow_up' ? 'Follow-up ready' : 'Warm prospect'}
                </p>
                <p className="truncate text-sm font-medium">{item.title}</p>
                <p className="text-xs text-slate-500">{item.subtitle}</p>
                {item.networkNudge && (
                  <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-violet-600">
                    <Users className="h-3 w-3" aria-hidden="true" /> {item.networkNudge}
                  </p>
                )}
              </div>
              <Link href={item.href} className="btn-primary shrink-0 text-xs">
                {item.cta}
              </Link>
            </li>
          ))}
        </ol>
      </section>

      {typedNeedsPackage.length > 0 && (
        <section className="card">
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
            <Send className="h-4 w-4 text-slate-500" aria-hidden="true" />
            <h2 className="font-medium">Still assembling</h2>
          </div>
          <ol className="divide-y divide-slate-100">
            {typedNeedsPackage.map((app) => (
              <li key={app.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {normalizeDisplayText(app.jobs?.title, 'Application')}
                  </p>
                  <p className="text-xs text-slate-500">
                    {normalizeDisplayText(app.jobs?.companies?.name)}
                  </p>
                </div>
                <Link href={`/applications/${app.id}`} className="btn-secondary shrink-0 text-xs">
                  Generate package
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}

      {dueFollowUps.length > 0 && (
        <section className="card">
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
            <Bell className="h-4 w-4 text-rose-600" aria-hidden="true" />
            <h2 className="font-medium">Follow-ups due</h2>
          </div>
          <ul className="divide-y divide-slate-100">
            {dueFollowUps.map((app) => {
              const days = daysSince(app.applied_at)
              return (
                <li key={app.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {normalizeDisplayText(app.jobs?.title, 'Application')}
                    </p>
                    <p className="text-xs text-slate-500">
                      {normalizeDisplayText(app.jobs?.companies?.name)}
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
              All jobs <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
          <ul className="divide-y divide-slate-100">
            {typedTopJobs.length === 0 && (
              <li className="px-5 py-8 text-center text-sm text-slate-400">
                No scored jobs yet. Add one manually — it will auto-score against your profile.
              </li>
            )}
            {typedTopJobs.map((row) => (
              <li key={row.jobs?.id ?? row.overall_score} className="px-5 py-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {normalizeDisplayText(row.jobs?.title, 'Untitled role')}
                    </p>
                    <p className="text-xs text-slate-500">
                      {normalizeDisplayText(row.jobs?.companies?.name, 'Unknown')}
                      {row.jobs?.location ? ` · ${normalizeDisplayText(row.jobs.location)}` : ''}
                      {row.jobs?.remote ? ' · Remote' : ''}
                    </p>
                    {nudgeFor(row.jobs?.companies?.name) && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-violet-600">
                        <Users className="h-3 w-3" aria-hidden="true" /> {nudgeFor(row.jobs?.companies?.name)}
                      </p>
                    )}
                  </div>
                  <span className="badge shrink-0 bg-brand-50 text-brand-700">
                    {Math.round(row.overall_score)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="card">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="font-medium">Cash plays</h2>
            <Link href="/opportunities" className="btn-ghost text-xs">
              All plays <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
          <ul className="divide-y divide-slate-100">
            {typedCashPlays.length === 0 && (
              <li className="px-5 py-8 text-center text-sm text-slate-400">
                Run migration 002_opportunity_centre.sql to seed commercial plays.
              </li>
            )}
            {typedCashPlays.map((opportunity) => (
              <li key={opportunity.id} className="px-5 py-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {normalizeDisplayText(opportunity.title, 'Untitled opportunity')}
                    </p>
                    <p className="text-xs text-slate-500">
                      {normalizeDisplayText(opportunity.estimated_value, '—')}
                      {opportunity.time_to_cash
                        ? ` · ${normalizeDisplayText(opportunity.time_to_cash)}`
                        : ''}
                    </p>
                  </div>
                  <span className="badge shrink-0 bg-violet-50 text-violet-700 capitalize">
                    {opportunity.type.replaceAll('_', ' ')}
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
