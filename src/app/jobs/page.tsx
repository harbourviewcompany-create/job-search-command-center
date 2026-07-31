import { JobsCommandCenter } from '@/components/JobsCommandCenter'
import { createClient } from '@/lib/supabase/server'
import type { JobWithCompany } from '@/types/database'

export const dynamic = 'force-dynamic'

const DEFAULT_PAGE_SIZE = 100

interface JobsPageProps {
  searchParams: Promise<{ page?: string | string[] }>
}

function parsePage(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value
  const parsed = Number.parseInt(raw ?? '1', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
}

function configuredPageSize() {
  const parsed = Number.parseInt(process.env.JOBS_PAGE_SIZE ?? '', 10)
  return Number.isFinite(parsed) && parsed >= 10 && parsed <= 250
    ? parsed
    : DEFAULT_PAGE_SIZE
}

export default async function JobsPage({ searchParams }: JobsPageProps) {
  const supabase = await createClient()
  const params = await searchParams
  const page = parsePage(params.page)
  const pageSize = configuredPageSize()
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const [
    authResult,
    jobsResult,
    searchSettingResult,
    appliedResult,
    interviewResult,
    offerResult,
    triageCountResult,
    interestedCountResult,
    dismissedCountResult,
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from('jobs')
      .select('*, companies(*)', { count: 'exact' })
      .in('status', ['found', 'interested', 'dismissed'])
      .order('fit_score', { ascending: false, nullsFirst: false })
      .order('fetched_at', { ascending: false })
      .range(from, to),
    supabase.from('settings').select('value').eq('key', 'search_terms').maybeSingle(),
    supabase
      .from('applications')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'applied'),
    supabase
      .from('applications')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'interview'),
    supabase
      .from('applications')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'offer'),
    supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('status', 'found'),
    supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('status', 'interested'),
    supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('status', 'dismissed'),
  ])

  const jobs = (jobsResult.data ?? []) as JobWithCompany[]
  const totalJobs = jobsResult.count ?? 0
  const totalPages = Math.max(1, Math.ceil(totalJobs / pageSize))
  const search =
    (searchSettingResult.data?.value as {
      terms?: string[]
      locations?: string[]
    } | null) ?? {}

  const terms = search.terms ?? [
    'business development manager',
    'account executive',
  ]
  const locations = search.locations ?? ['Ottawa', 'Ontario', 'Remote']

  const errors = [
    jobsResult.error?.message,
    searchSettingResult.error?.message,
    appliedResult.error?.message,
    interviewResult.error?.message,
    offerResult.error?.message,
    triageCountResult.error?.message,
    interestedCountResult.error?.message,
    dismissedCountResult.error?.message,
  ].filter(Boolean)

  return (
    <JobsCommandCenter
      initialJobs={jobs}
      metrics={{
        triage: triageCountResult.count ?? 0,
        interested: interestedCountResult.count ?? 0,
        dismissed: dismissedCountResult.count ?? 0,
        applied: appliedResult.count ?? 0,
        interviews: interviewResult.count ?? 0,
        offers: offerResult.count ?? 0,
      }}
      pagination={{ page, pageSize, total: totalJobs, totalPages }}
      pullAuthorized={Boolean(authResult.data.user)}
      terms={terms}
      locations={locations}
      loadError={errors.length > 0 ? Array.from(new Set(errors)).join(' ') : null}
    />
  )
}
