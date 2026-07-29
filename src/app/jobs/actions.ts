'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { JobStatus } from '@/types/database'

export async function updateJobStatus(jobId: string, status: JobStatus) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('jobs')
    .update({ status })
    .eq('id', jobId)

  if (error) throw new Error(error.message)

  // When marked interested, create an application row if none exists
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

  // Upsert company by name
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

  const { error } = await supabase.from('jobs').insert({
    source: 'manual',
    title,
    company_id: companyId,
    location,
    url,
    description,
    remote,
    status: 'found',
  })

  if (error) throw new Error(error.message)

  revalidatePath('/jobs')
  revalidatePath('/dashboard')
}
