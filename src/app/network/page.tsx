import { AddNetworkContactForm } from '@/components/AddNetworkContactForm'
import { ImportNetworkCsvForm } from '@/components/ImportNetworkCsvForm'
import { createClient } from '@/lib/supabase/server'
import { normalizeDisplayText } from '@/lib/text.mjs'

export const dynamic = 'force-dynamic'

type NetworkMatchRow = {
  network_contact_id: string
  contact_name: string
  contact_title: string | null
  contact_linkedin_url: string | null
  company_name: string
}

export default async function NetworkPage() {
  const supabase = await createClient()

  const [{ count: contactCount }, { data: matches }] = await Promise.all([
    supabase.from('network_contacts').select('*', { count: 'exact', head: true }),
    supabase
      .from('network_matches')
      .select('network_contact_id, contact_name, contact_title, contact_linkedin_url, company_name'),
  ])

  const typedMatches = (matches ?? []) as NetworkMatchRow[]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Network</h1>
        <p className="mt-1 text-sm text-slate-500">
          The single biggest edge a job board can&apos;t give you: someone you already know.
          Import your connections once — every company the discovery engine and Cash
          Plays surface gets checked against it automatically.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ImportNetworkCsvForm />
        <AddNetworkContactForm />
      </div>

      <div className="card">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="font-medium">Warm-intro matches</h2>
          <span className="badge bg-violet-50 text-violet-700">
            {typedMatches.length} match{typedMatches.length === 1 ? '' : 'es'} · {contactCount ?? 0} contacts imported
          </span>
        </div>
        <ul className="divide-y divide-slate-100">
          {typedMatches.length === 0 && (
            <li className="px-5 py-8 text-center text-sm text-slate-400">
              No matches yet — import your connections above. Matches appear the moment a
              company you&apos;re tracking overlaps with someone in your network.
            </li>
          )}
          {typedMatches.map((match) => (
            <li key={`${match.network_contact_id}-${match.company_name}`} className="px-5 py-3.5">
              <p className="text-sm font-medium">
                {normalizeDisplayText(match.contact_name)}
                {match.contact_title ? ` — ${normalizeDisplayText(match.contact_title)}` : ''}
              </p>
              <p className="text-xs text-slate-500">
                at {normalizeDisplayText(match.company_name)}
                {match.contact_linkedin_url && (
                  <>
                    {' · '}
                    <a
                      href={match.contact_linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-600 hover:underline"
                    >
                      LinkedIn
                    </a>
                  </>
                )}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
