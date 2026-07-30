'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { tailorPackage } from '@/lib/package'
import { getProfile } from '@/lib/profile'
import type { JobWithCompany } from '@/types/database'

export async function generatePackage(applicationId: string) {
  const supabase = await createClient()

  const { data: app, error } = await supabase
    .from('applications')
    .select('id, jobs(*, companies(*))')
    .eq('id', applicationId)
    .single()

  if (error || !app) throw new Error(error?.message ?? 'Application not found')

  const job = app.jobs as unknown as JobWithCompany
  const profile = await getProfile(supabase)
  const pkg = tailorPackage(
    {
      title: job.title,
      description: job.description,
      companies: job.companies,
    },
    profile
  )

  // Store resume version
  const { data: version, error: vErr } = await supabase
    .from('resume_versions')
    .insert({
      application_id: applicationId,
      content: pkg.resumeMarkdown,
    })
    .select('id')
    .single()

  if (vErr) throw new Error(vErr.message)

  const { error: appErr } = await supabase
    .from('applications')
    .update({
      resume_version_id: version.id,
      cover_note: pkg.coverNote,
    })
    .eq('id', applicationId)

  if (appErr) throw new Error(appErr.message)

  revalidatePath(`/applications/${applicationId}`)
  revalidatePath('/applications')
  revalidatePath('/dashboard')

  return {
    resumeMarkdown: pkg.resumeMarkdown,
    coverNote: pkg.coverNote,
    focusBullets: pkg.focusBullets,
  }
}
