import { createClient } from '@/lib/supabase/server'
import { JobCard } from '@/components/JobCard'
import { AddJobForm } from '@/components/AddJobForm'
import { PullJobsButton } from '@/components/PullJobsButton'
import { LinkedInImportForm } from '@/components/LinkedInImportForm'
import { LinkedInSearchLinks } from '@/components/LinkedInSearchLinks'
import type { JobWithCompany } from '@/types/database'

export const dynamic = 'force-dynamic'

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab = 'found' } = await searchParams
  const supabase = await createClient()

  const statusFilter = tab === 'interested' ? 'interested' : 'found'

  const [{ data: jobs }, { data: searchSetting }] = await Promise.all([
    supabase
      .from('jobs')
      .select('*, companies(*)')
      .eq('status', statusFilter)
      .order('fit_score', { ascending: false, nullsFirst: false }),
    supabase.from('settings').select('value').eq('key', 'search_terms').maybeSingle(),
  ])

  const search = (searchSetting?.value as { terms?: string[]; locations?: string[] }) ?? {}
  const terms = search.terms ?? [
    'business development manager',
    'account executive',
  ]
  const locations = search.locations ?? ['Ottawa', 'Ontario', 'Remote']

  const typedJobs = (jobs ?? []) as JobWithCompany[]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Jobs</h1>
          <p className="mt-1 text-sm text-slate-500">
            Ranked by fit. Pull from Adzuna, open LinkedIn searches, or import a
            LinkedIn listing. Mark Interested to stage a tailored package.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <PullJobsButton />
          <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1">
            <TabLink href="/jobs?tab=found" active={tab !== 'interested'}>
              To triage
            </TabLink>
            <TabLink href="/jobs?tab=interested" active={tab === 'interested'}>
              Interested
            </TabLink>
          </div>
        </div>
      </div>

      <LinkedInSearchLinks terms={terms} locations={locations} />

      <div className="grid gap-4 lg:grid-cols-2">
        <LinkedInImportForm />
        <AddJobForm />
      </div>

      <div className="space-y-3">
        {typedJobs.length === 0 && (
          <div className="card px-5 py-12 text-center text-sm text-slate-400">
            {tab === 'interested'
              ? 'No interested jobs yet. Mark some from the triage list.'
              : 'No jobs yet. Pull from Adzuna, open LinkedIn, or import a listing.'}
          </div>
        )}
        {typedJobs.map((job) => (
          <JobCard key={job.id} job={job} />
        ))}
      </div>
    </div>
  )
}

function TabLink({
  href,
  active,
  children,
}: {
  href: string
  active: boolean
  children: React.ReactNode
}) {
  return (
    <a
      href={href}
      className={
        active
          ? 'rounded-md bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-700'
          : 'rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50'
      }
    >
      {children}
    </a>
  )
}
