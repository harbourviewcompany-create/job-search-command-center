import Link from 'next/link'
import { CompanySourceRegistry } from '@/components/discovery/CompanySourceRegistry'
import { DiscoveryRunPanel } from '@/components/discovery/DiscoveryRunPanel'
import { SearchProfileEditor } from '@/components/discovery/SearchProfileEditor'
import { SourceHealthPanel } from '@/components/discovery/SourceHealthPanel'
import { loadDiscoverySettings } from '@/lib/discovery/repository'

export const dynamic = 'force-dynamic'

export default async function DiscoverySettingsPage() {
  const data = await loadDiscoverySettings()

  return (
    <div className="mx-auto max-w-7xl space-y-10 pb-12">
      <header className="space-y-4">
        <Link href="/settings" className="text-sm font-medium text-slate-600 hover:text-slate-950">
          ← General settings
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Job Discovery V2</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Discovery control center</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Configure independent search lanes, direct employer ATS feeds, provider budgets, lifecycle verification, and explainable ranking without changing the application pipeline.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <div className="text-xl font-semibold text-slate-950">{data.profiles.filter((profile) => profile.enabled).length}</div>
              <div className="mt-1 text-slate-500">Active lanes</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <div className="text-xl font-semibold text-slate-950">{data.sources.filter((source) => source.enabled).length}</div>
              <div className="mt-1 text-slate-500">ATS feeds</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <div className="text-xl font-semibold text-slate-950">{data.runs.length}</div>
              <div className="mt-1 text-slate-500">Recent runs</div>
            </div>
          </div>
        </div>
      </header>

      {data.error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800" role="alert">
          Discovery data is not fully available. Apply migrations 012–017, then reload. {data.error}
        </div>
      ) : null}

      <SearchProfileEditor profiles={data.profiles} />
      <CompanySourceRegistry profiles={data.profiles} companies={data.companies} sources={data.sources} />
      <SourceHealthPanel health={data.health} />
      <DiscoveryRunPanel runs={data.runs} />
    </div>
  )
}
