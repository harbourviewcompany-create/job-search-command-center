import { saveCompanySource, toggleCompanySource } from '@/app/settings/discovery/actions'
import type {
  CompanyOption,
  CompanySourceRow,
  DiscoveryProfileRow,
} from '@/lib/discovery/repository'
import { sourceCompanyName } from '@/lib/discovery/repository'
import { DiscoveryRunButton } from './DiscoveryRunButton'

const providerLabels = {
  greenhouse: 'Greenhouse',
  lever: 'Lever',
  ashby: 'Ashby',
  smartrecruiters: 'SmartRecruiters',
}

function SourceForm({
  profiles,
  companies,
  source,
}: {
  profiles: DiscoveryProfileRow[]
  companies: CompanyOption[]
  source?: CompanySourceRow
}) {
  const selectedProfiles = new Set(
    (source?.search_profile_company_sources ?? []).map((link) => link.search_profile_id)
  )

  return (
    <form action={saveCompanySource} className="space-y-5">
      {source ? <input type="hidden" name="id" value={source.id} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-xs font-medium text-slate-700">Existing company</span>
          <select name="company_id" defaultValue={source?.company_id ?? ''} className="input">
            <option value="">Select a company</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>{company.name}</option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-slate-700">Or create company</span>
          <input name="new_company_name" className="input" placeholder="Company name" disabled={Boolean(source)} />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-slate-700">ATS provider</span>
          <select name="provider" defaultValue={source?.provider ?? 'greenhouse'} className="input">
            {Object.entries(providerLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-slate-700">Board key / site slug</span>
          <input name="board_key" required defaultValue={source?.board_key ?? ''} className="input" placeholder="company-board-key" />
        </label>
        <label className="block space-y-1 sm:col-span-2">
          <span className="text-xs font-medium text-slate-700">Careers URL</span>
          <input name="careers_url" type="url" defaultValue={source?.careers_url ?? ''} className="input" placeholder="https://company.example/careers" />
        </label>
        <label className="block space-y-1 sm:col-span-2">
          <span className="text-xs font-medium text-slate-700">Custom API base</span>
          <input name="api_base_url" type="url" defaultValue={source?.api_base_url ?? ''} className="input" placeholder="Optional; useful for Lever EU" />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-slate-700">Priority</span>
          <input name="priority" type="number" min={0} defaultValue={source?.priority ?? 100} className="input" />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-slate-700">Poll interval (minutes)</span>
          <input name="poll_interval_minutes" type="number" min={15} defaultValue={source?.poll_interval_minutes ?? 360} className="input" />
        </label>
        <label className="flex min-h-12 items-center gap-3 rounded-lg border border-slate-200 px-3 sm:col-span-2">
          <input name="enabled" type="checkbox" defaultChecked={source?.enabled ?? true} />
          <span className="text-sm font-medium text-slate-700">Source enabled</span>
        </label>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-xs font-medium text-slate-700">Search lanes using this source</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {profiles.map((profile) => (
            <label key={profile.id} className="flex min-h-11 items-center gap-3 rounded-lg border border-slate-200 px-3 text-sm">
              <input
                type="checkbox"
                name="profile_ids"
                value={profile.id}
                defaultChecked={selectedProfiles.has(profile.id)}
              />
              <span>{profile.name}</span>
            </label>
          ))}
        </div>
        <p className="text-xs text-slate-500">No selections means the source is available to every enabled lane.</p>
      </fieldset>

      <button type="submit" className="btn-primary">
        {source ? 'Save ATS source' : 'Validate and add ATS source'}
      </button>
    </form>
  )
}

export function CompanySourceRegistry({
  profiles,
  companies,
  sources,
}: {
  profiles: DiscoveryProfileRow[]
  companies: CompanyOption[]
  sources: CompanySourceRow[]
}) {
  return (
    <section className="space-y-4" aria-labelledby="ats-registry-heading">
      <div>
        <h2 id="ats-registry-heading" className="text-lg font-semibold">Target-company ATS registry</h2>
        <p className="mt-1 text-sm text-slate-500">Direct employer feeds are validated before saving and treated as authoritative vacancy snapshots.</p>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        {sources.map((source) => (
          <article key={source.id} className="card overflow-hidden">
            <div className="space-y-3 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium text-slate-950">{sourceCompanyName(source)}</h3>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                      {providerLabels[source.provider]}
                    </span>
                  </div>
                  <p className="mt-1 break-all text-xs text-slate-500">{source.board_key}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${source.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                  {source.enabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <dl className="grid grid-cols-2 gap-3 text-xs">
                <div><dt className="text-slate-500">Active jobs</dt><dd className="mt-0.5 font-semibold text-slate-900">{source.active_job_count}</dd></div>
                <div><dt className="text-slate-500">Failures</dt><dd className="mt-0.5 font-semibold text-slate-900">{source.consecutive_failures}</dd></div>
                <div><dt className="text-slate-500">Last success</dt><dd className="mt-0.5 text-slate-700">{source.last_success_at ? new Date(source.last_success_at).toLocaleString() : 'Never'}</dd></div>
                <div><dt className="text-slate-500">Poll cadence</dt><dd className="mt-0.5 text-slate-700">{source.poll_interval_minutes} min</dd></div>
              </dl>
              {source.last_error ? <p className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700">{source.last_error}</p> : null}
              <div className="flex flex-wrap gap-2">
                <DiscoveryRunButton companySourceId={source.id} label="Poll source" compact />
                <form action={toggleCompanySource}>
                  <input type="hidden" name="id" value={source.id} />
                  <input type="hidden" name="enabled" value={String(!source.enabled)} />
                  <button type="submit" className="btn-secondary px-3 py-2 text-xs">
                    {source.enabled ? 'Disable' : 'Enable'}
                  </button>
                </form>
              </div>
            </div>
            <details className="border-t border-slate-100">
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50">Edit source</summary>
              <div className="border-t border-slate-100 p-4">
                <SourceForm profiles={profiles} companies={companies} source={source} />
              </div>
            </details>
          </article>
        ))}
      </div>

      <details className="card">
        <summary className="cursor-pointer p-4 text-sm font-semibold">Add target-company ATS source</summary>
        <div className="border-t border-slate-100 p-4">
          <SourceForm profiles={profiles} companies={companies} />
        </div>
      </details>
    </section>
  )
}
