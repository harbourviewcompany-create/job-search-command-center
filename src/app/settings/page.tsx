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
          Saved search terms, follow-up cadence, and base resume. Used by daily
          ingestion (Phase 4) and AI tailoring (Phase 2).
        </p>
      </div>

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
