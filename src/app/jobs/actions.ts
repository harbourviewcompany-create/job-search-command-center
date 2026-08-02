'use server'

import { revalidatePath } from 'next/cache'
import { requireOperatorAccess } from '@/lib/operator-auth'
import { createServiceClient } from '@/lib/supabase/server'
import { scoreJobAgainstProfile } from '@/lib/scoring'
import { getProfile } from '@/lib/profile'
import type { ApplicationStatus, JobStatus } from '@/types/database'

const progressedApplicationStatuses: ApplicationStatus[] = ['applied', 'interview', 'offer']

export async function updateJobStatus(jobId: string, status: JobStatus) {
  await requireOperatorAccess()
  const supabase = createServiceClient()

  const [{ data: currentJob, error: jobReadError }, { data: application, error: applicationReadError }] =
    await Promise.all([
      supabase.from('jobs').select('status').eq('id', jobId).single(),
      supabase.from('applications').select('id, status').eq('job_id', jobId).maybeSingle(),
    ])

  if (jobReadError) throw new Error(jobReadError.message)
  if (!currentJob) throw new Error('The selected job could not be found.')
  if (applicationReadError) throw new Error(applicationReadError.message)

  if (
    application &&
    progressedApplicationStatuses.includes(application.status) &&
    status !== 'interested'
  ) {
    throw new Error('Close or update this active application from the pipeline before moving the job.')
  }

  const { error: jobUpdateError } = await supabase
    .from('jobs')
    .update({ status })
    .eq('id', jobId)

  if (jobUpdateError) throw new Error(jobUpdateError.message)

  try {
    if (status === 'interested') {
      if (!application) {
        const { error: insertError } = await supabase.from('applications').insert({
          job_id: jobId,
          status: 'interested',
        })
        if (insertError && insertError.code !== '23505') throw insertError
      } else if (application.status === 'closed' || application.status === 'rejected') {
        const { error: reopenError } = await supabase
          .from('applications')
          .update({ status: 'interested', applied_at: null })
          .eq('id', application.id)
        if (reopenError) throw reopenError
      }
    } else if (application?.status === 'interested') {
      const { error: closeError } = await supabase
        .from('applications')
        .update({ status: 'closed' })
        .eq('id', application.id)
      if (closeError) throw closeError
    }
  } catch (applicationError) {
    const { error: rollbackError } = await supabase
      .from('jobs')
      .update({ status: currentJob.status })
      .eq('id', jobId)

    if (rollbackError) {
      console.error('updateJobStatus: rollback failed', {
        jobId,
        requestedStatus: status,
        previousStatus: currentJob.status,
        applicationError,
        rollbackError,
      })
      throw new Error(
        'The job status changed but the related application could not be synchronized. Reload the page and reconcile the pipeline.'
      )
    }

    throw new Error(
      applicationError instanceof Error
        ? applicationError.message
        : 'The related application could not be synchronized.'
    )
  }

  revalidatePath('/jobs')
  revalidatePath('/dashboard')
  revalidatePath('/applications')
}

export async function addManualJob(formData: FormData) {
  await requireOperatorAccess()
  const supabase = createServiceClient()

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

  const profile = await getProfile(supabase)
  const fit = scoreJobAgainstProfile({ title, description, location, remote }, profile)

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
  })

  if (error) throw new Error(error.message)

  revalidatePath('/jobs')
  revalidatePath('/dashboard')
}

export async function rescoreAllJobs() {
  await requireOperatorAccess()
  const supabase = createServiceClient()
  const profile = await getProfile(supabase)

  const { data: jobs } = await supabase
    .from('jobs')
    .select('id, title, description, location, remote')
    .in('status', ['found', 'interested'])

  const results = await Promise.all(
    (jobs ?? []).map((job) => {
      const fit = scoreJobAgainstProfile(job, profile)
      return supabase
        .from('jobs')
        .update({ fit_score: fit.score, fit_reasons: fit.reasons })
        .eq('id', job.id)
    })
  )

  const failures = results.filter((result) => result.error)
  if (failures.length > 0) {
    console.error(`rescoreAllJobs: ${failures.length} update(s) failed`, failures[0].error)
  }

  revalidatePath('/jobs')
  revalidatePath('/dashboard')
}
