import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { SettingsForm } from '@/components/SettingsForm'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const supabase = await createClient()

  const { data: settings } = await supabase.from('settings').select('*')

  const map = Object.fromEntries(
    (settings ?? []).map((s) => [s.key, s.value])
  )

  const searchTerms = (map.search_terms as {
    terms?: string[]
    locations?: string[]
  }) ?? { terms: [], locations: [] }

  const followUp = (map.follow_up_offsets as {
    follow_up_1_days?: number
    follow_up_2_days?: number
  }) ?? { follow_up_1_days: 5, follow_up_2_days: 12 }

  const baseResume = (map.base_resume as { content?: string }) ?? {
    content: '',
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">
          Base resume, follow-up cadence, and compatibility search settings.
        </p>
      </div>

      <Link
        href="/settings/discovery"
        className="card block p-5 transition hover:border-slate-300 hover:shadow-sm"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Job Discovery V2</p>
        <h2 className="mt-2 text-lg font-semibold text-slate-950">Open discovery control center</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          Manage multi-lane searches, direct employer ATS feeds, provider health, rate budgets, lifecycle verification, and run history.
        </p>
      </Link>

      <SettingsForm
        initialTerms={(searchTerms.terms ?? []).join(', ')}
        initialLocations={(searchTerms.locations ?? []).join(', ')}
        followUp1={followUp.follow_up_1_days ?? 5}
        followUp2={followUp.follow_up_2_days ?? 12}
        baseResume={baseResume.content ?? ''}
      />
    </div>
  )
}
