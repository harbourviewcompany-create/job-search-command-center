'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { scoreJobAgainstProfile } from '@/lib/scoring'
import { DEFAULT_PROFILE } from '@/lib/profile'
import type { JobStatus } from '@/types/database'

export async function updateJobStatus(jobId: string, status: JobStatus) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('jobs')
    .update({ status })
    .eq('id', jobId)

  if (error) throw new Error(error.message)

  if (status === 'interested') {
    const { data: existing } = await supabase
      .from('applications')
      .select('id')
      .eq('job_id', jobId)
      .maybeSingle()

    if (!existing) {
      await supabase.from('applications').insert({
        job_id: jobId,
        status: 'interested',
      })
    }
  }

  revalidatePath('/jobs')
  revalidatePath('/dashboard')
  revalidatePath('/applications')
}

export async function addManualJob(formData: FormData) {
  const supabase = await createClient()

  const title = String(formData.get('title') || '').trim()
  const companyName = String(formData.get('company') || '').trim()
  const location = String(formData.get('location') || '').trim() || null
  const url = String(formData.get('url') || '').trim() || null
  const description = String(formData.get('description') || '').trim() || null
  const remote = formData.get('remote') === 'on'

  if (!title || !companyName) {
    throw new Error('Title and company are required')
  }

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

  const { error } = await supabase.from('jobs').insert({
    source: 'manual',
    title,
    company_id: companyId,
    location,
    url,
    description,
    remote,
    status: 'found',
    fit_score: fit.score,
    fit_reasons: fit.reasons,
  } as any)

  if (error) throw new Error(error.message)

  revalidatePath('/jobs')
  revalidatePath('/dashboard')
}

export async function rescoreAllJobs() {
  const supabase = await createClient()

  const { data: jobs } = await supabase
    .from('jobs')
    .select('id, title, description, location, remote')
    .in('status', ['found', 'interested'])

  for (const job of jobs ?? []) {
    const fit = scoreJobAgainstProfile(job, DEFAULT_PROFILE)
    await supabase
      .from('jobs')
      .update({ fit_score: fit.score, fit_reasons: fit.reasons } as any)
      .eq('id', job.id)
  }

  revalidatePath('/jobs')
  revalidatePath('/dashboard')
}
