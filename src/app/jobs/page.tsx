import { JobsCommandCenter } from '@/components/JobsCommandCenter'
import { createClient } from '@/lib/supabase/server'
import type { JobWithCompany } from '@/types/database'

export const dynamic = 'force-dynamic'

export default async function JobsPage() {
  const supabase = await createClient()

  const [
    jobsResult,
    searchSettingResult,
    appliedResult,
    interviewResult,
    offerResult,
  ] = await Promise.all([
    supabase
      .from('jobs')
      .select('*, companies(*)')
      .in('status', ['found', 'interested', 'dismissed'])
      .order('fit_score', { ascending: false, nullsFirst: false })
      .limit(500),
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
  ])

  const jobs = (jobsResult.data ?? []) as JobWithCompany[]
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
  ].filter(Boolean)

  return (
    <JobsCommandCenter
      initialJobs={jobs}
      metrics={{
        triage: jobs.filter((job) => job.status === 'found').length,
        interested: jobs.filter((job) => job.status === 'interested').length,
        dismissed: jobs.filter((job) => job.status === 'dismissed').length,
        applied: appliedResult.count ?? 0,
        interviews: interviewResult.count ?? 0,
        offers: offerResult.count ?? 0,
      }}
      terms={terms}
      locations={locations}
      loadError={errors.length > 0 ? Array.from(new Set(errors)).join(' ') : null}
    />
  )
}
