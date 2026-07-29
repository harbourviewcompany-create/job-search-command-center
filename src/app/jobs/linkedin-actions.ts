'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { scoreJobAgainstProfile } from '@/lib/scoring'
import { DEFAULT_PROFILE } from '@/lib/profile'
import { parseLinkedInJobId } from '@/lib/linkedin'

export async function importLinkedInJob(formData: FormData) {
  const supabase = await createClient()

  const url = String(formData.get('url') || '').trim()
  const title = String(formData.get('title') || '').trim()
  const companyName = String(formData.get('company') || '').trim()
  const location = String(formData.get('location') || '').trim() || null
  const description = String(formData.get('description') || '').trim() || null
  const remote = formData.get('remote') === 'on'

  if (!url || !title || !companyName) {
    throw new Error('LinkedIn URL, title, and company are required')
  }

  const jobId = parseLinkedInJobId(url)
  const externalId = jobId ?? url

  // Company upsert
  let companyId: string | null = null
  const { data: existingCompany } = await supabase
    .from('companies')
    .select('id')
    .ilike('name', companyName)
    .maybeSingle()

  if (existingCompany) {
    companyId = existingCompany.id
  } else {
    const { data: created, error: companyError } = await supabase
      .from('companies')
      .insert({ name: companyName })
      .select('id')
      .single()
    if (companyError) throw new Error(companyError.message)
    companyId = created.id
  }

  const fit = scoreJobAgainstProfile(
    { title, description, location, remote },
    DEFAULT_PROFILE
  )

  // Dedupe on linkedin + external_id
  const { data: existing } = await supabase
    .from('jobs')
    .select('id')
    .eq('source', 'linkedin')
    .eq('external_id', externalId)
    .maybeSingle()

  if (existing) {
    await supabase
      .from('jobs')
      .update({
        title,
        company_id: companyId,
        location,
        description,
        remote,
        url,
        fit_score: fit.score,
        fit_reasons: fit.reasons,
        fetched_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
  } else {
    const { error } = await supabase.from('jobs').insert({
      source: 'linkedin',
      external_id: externalId,
      title,
      company_id: companyId,
      location,
      url,
      description,
      remote,
      status: 'found',
      fit_score: fit.score,
      fit_reasons: fit.reasons,
    })
    if (error) throw new Error(error.message)
  }

  revalidatePath('/jobs')
  revalidatePath('/dashboard')
}
