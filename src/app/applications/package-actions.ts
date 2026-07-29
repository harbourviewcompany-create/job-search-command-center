'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { tailorPackage } from '@/lib/package'
import { DEFAULT_PROFILE } from '@/lib/profile'

export async function generatePackage(applicationId: string) {
  const supabase = await createClient()

  const { data: app, error } = await supabase
    .from('applications')
    .select('id, jobs(*, companies(*))')
    .eq('id', applicationId)
    .single()

  if (error || !app) throw new Error(error?.message ?? 'Application not found')

  const job = app.jobs as any
  const pkg = tailorPackage(
    {
      title: job.title,
      description: job.description,
      companies: job.companies,
    },
    DEFAULT_PROFILE
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

  await supabase
    .from('applications')
    .update({
      resume_version_id: version.id,
      cover_note: pkg.coverNote,
    })
    .eq('id', applicationId)

  revalidatePath(`/applications/${applicationId}`)
  revalidatePath('/applications')
  revalidatePath('/dashboard')

  return {
    resumeMarkdown: pkg.resumeMarkdown,
    coverNote: pkg.coverNote,
    focusBullets: pkg.focusBullets,
  }
}
