'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { tailorPackageWithAI } from '@/lib/package'
import { getProfile, profileToResumeMarkdown } from '@/lib/profile'
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

  // Prefer settings.base_resume markdown when present
  const { data: baseSetting } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'base_resume')
    .maybeSingle()

  const storedBase =
    typeof baseSetting?.value === 'string'
      ? baseSetting.value
      : typeof (baseSetting?.value as { markdown?: string } | null)?.markdown ===
          'string'
        ? (baseSetting?.value as { markdown: string }).markdown
        : undefined

  const baseResume = storedBase?.trim() || profileToResumeMarkdown(profile)

  const pkg = await tailorPackageWithAI(
    {
      title: job.title,
      description: job.description,
      location: job.location,
      companies: job.companies,
    },
    profile,
    baseResume
  )

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
    matchNotes: pkg.matchNotes ?? [],
    source: pkg.source,
  }
}
