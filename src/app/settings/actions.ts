'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { Json } from '@/types/database'

function parsePositiveInt(value: FormDataEntryValue | null, fallback: number): number {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.round(n) : fallback
}

export async function saveSettings(formData: FormData) {
  const supabase = await createClient()

  const termsRaw = String(formData.get('terms') || '')
  const locationsRaw = String(formData.get('locations') || '')
  const followUp1 = parsePositiveInt(formData.get('follow_up_1'), 5)
  const followUp2 = parsePositiveInt(formData.get('follow_up_2'), 12)
  const baseResume = String(formData.get('base_resume') || '')

  const terms = termsRaw
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
  const locations = locationsRaw
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)

  const upserts: { key: string; value: Json }[] = [
    {
      key: 'search_terms',
      value: { terms, locations },
    },
    {
      key: 'follow_up_offsets',
      value: {
        follow_up_1_days: followUp1,
        follow_up_2_days: followUp2,
      },
    },
    {
      key: 'base_resume',
      value: { content: baseResume },
    },
  ]

  for (const row of upserts) {
    const { error } = await supabase
      .from('settings')
      .upsert(row, { onConflict: 'key' })
    if (error) throw new Error(error.message)
  }

  revalidatePath('/settings')
}
