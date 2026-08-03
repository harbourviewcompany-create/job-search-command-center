import { saveSearchProfile, toggleSearchProfile } from '@/app/settings/discovery/actions'
import type { DiscoveryProfileRow } from '@/lib/discovery/repository'
import { DiscoveryRunButton } from './DiscoveryRunButton'

function joined(values: string[] | null | undefined) {
  return (values ?? []).join(', ')
}

function ListField({ name, label, value, hint }: {
  name: string
  label: string
  value?: string[]
  hint?: string
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-slate-700">{label}</span>
      <textarea
        name={name}
        rows={2}
        defaultValue={joined(value)}
        className="input min-h-20 text-sm"
        placeholder={hint}
      />
    </label>
  )
}

function ProfileForm({ profile }: { profile?: DiscoveryProfileRow }) {
  const editing = Boolean(profile)
  return (
    <form action={saveSearchProfile} className="space-y-5">
      {profile ? <input type="hidden" name="id" value={profile.id} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1 sm:col-span-2">
          <span className="text-xs font-medium text-slate-700">Lane name</span>
          <input name="name" required defaultValue={profile?.name} className="input" placeholder="Strategic partnerships" />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-slate-700">Slug</span>
          <input name="slug" defaultValue={profile?.slug} className="input" placeholder="generated-from-name" />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-slate-700">Priority</span>
          <input name="priority" type="number" min={0} defaultValue={profile?.priority ?? 100} className="input" />
        </label>
        <label className="block space-y-1 sm:col-span-2">
          <span className="text-xs font-medium text-slate-700">Description</span>
          <textarea name="description" rows={2} defaultValue={profile?.description ?? ''} className="input" />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-slate-700">Remote policy</span>
          <select name="remote_policy" defaultValue={profile?.remote_policy ?? 'remote_or_local'} className="input">
            <option value="any">Any arrangement</option>
            <option value="remote_only">Fully remote only</option>
            <option value="remote_or_local">Remote, hybrid, or accepted location</option>
            <option value="local_only">Accepted locations only</option>
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-slate-700">Country</span>
          <input name="country_code" maxLength={2} defaultValue={profile?.country_code ?? 'CA'} className="input uppercase" />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-slate-700">Maximum posting age</span>
          <input name="maximum_posting_age_days" type="number" min={1} defaultValue={profile?.maximum_posting_age_days ?? 45} className="input" />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-slate-700">Minimum salary (CAD)</span>
          <input name="minimum_salary_cad" type="number" min={0} defaultValue={profile?.minimum_salary_cad ?? ''} className="input" placeholder="Optional" />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-slate-700">Result budget per run</span>
          <input name="result_budget_per_run" type="number" min={1} defaultValue={profile?.result_budget_per_run ?? 100} className="input" />
        </label>
        <label className="flex min-h-12 items-center gap-3 self-end rounded-lg border border-slate-200 px-3">
          <input name="enabled" type="checkbox" defaultChecked={profile?.enabled ?? true} />
          <span className="text-sm font-medium text-slate-700">Lane enabled</span>
        </label>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ListField name="locations" label="Accepted locations" value={profile?.locations} hint="Ottawa, Ontario, Canada, Remote" />
        <ListField name="employment_types" label="Employment types" value={profile?.employment_types} hint="full time, contract" />
        <ListField name="primary_titles" label="Primary titles" value={profile?.primary_titles} hint="Business Development Manager" />
        <ListField name="title_aliases" label="Title aliases" value={profile?.title_aliases} hint="Commercial Manager, Growth Partnerships" />
        <ListField name="required_terms" label="Required concepts" value={profile?.required_terms} hint="partnerships, channel" />
        <ListField name="preferred_terms" label="Preferred concepts" value={profile?.preferred_terms} hint="revenue growth, enterprise" />
        <ListField name="excluded_terms" label="Excluded terms" value={profile?.excluded_terms} hint="entry level, commission only" />
        <ListField name="excluded_companies" label="Excluded companies" value={profile?.excluded_companies} hint="Optional company exclusions" />
      </div>

      <button type="submit" className="btn-primary">
        {editing ? 'Save lane' : 'Create search lane'}
      </button>
    </form>
  )
}

export function SearchProfileEditor({ profiles }: { profiles: DiscoveryProfileRow[] }) {
  return (
    <section className="space-y-4" aria-labelledby="search-lanes-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="search-lanes-heading" className="text-lg font-semibold">Search lanes</h2>
          <p className="mt-1 text-sm text-slate-500">Independent title universes, constraints, ranking signals, and query budgets.</p>
        </div>
        <DiscoveryRunButton label="Run all due searches" />
      </div>

      <div className="space-y-3">
        {profiles.map((profile) => (
          <article key={profile.id} className="card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-medium text-slate-950">{profile.name}</h3>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${profile.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    {profile.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Priority {profile.priority} · {profile.primary_titles.length} primary titles · {profile.locations.length} locations
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <DiscoveryRunButton profileId={profile.id} label="Run lane" compact />
                <form action={toggleSearchProfile}>
                  <input type="hidden" name="id" value={profile.id} />
                  <input type="hidden" name="enabled" value={String(!profile.enabled)} />
                  <button type="submit" className="btn-secondary px-3 py-2 text-xs">
                    {profile.enabled ? 'Disable' : 'Enable'}
                  </button>
                </form>
              </div>
            </div>
            <details>
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50">Edit lane configuration</summary>
              <div className="border-t border-slate-100 p-4">
                <ProfileForm profile={profile} />
              </div>
            </details>
          </article>
        ))}
      </div>

      <details className="card">
        <summary className="cursor-pointer p-4 text-sm font-semibold">Create another search lane</summary>
        <div className="border-t border-slate-100 p-4">
          <ProfileForm />
        </div>
      </details>
    </section>
  )
}
