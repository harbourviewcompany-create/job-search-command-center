'use server'

import { revalidatePath } from 'next/cache'
import { requireOperatorAccess } from '@/lib/operator-auth'
import { createServiceClient } from '@/lib/supabase/server'
import { tailorPackageWithAI } from '@/lib/package'
import { getProfile, profileToResumeMarkdown } from '@/lib/profile'
import { resumeMarkdownToDocxBuffer, resumeFilename } from '@/lib/docx'
import type { JobWithCompany } from '@/types/database'

const RESUME_BUCKET = 'resumes'

export async function generatePackage(applicationId: string) {
  await requireOperatorAccess()
  const supabase = createServiceClient()

  const { data: app, error } = await supabase
    .from('applications')
    .select('id, jobs(*, companies(*))')
    .eq('id', applicationId)
    .single()

  if (error || !app) throw new Error(error?.message ?? 'Application not found')

  const job = app.jobs as unknown as JobWithCompany
  const profile = await getProfile(supabase)

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

  let docxUrl: string | null = null
  try {
    const buffer = await resumeMarkdownToDocxBuffer(pkg.resumeMarkdown, {
      title: `${profile.name} — ${job.title}`,
    })
    const filename = resumeFilename(job.companies?.name, job.title)
    const path = `${applicationId}/${Date.now()}-${filename}`

    const { error: upErr } = await supabase.storage
      .from(RESUME_BUCKET)
      .upload(path, buffer, {
        contentType:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        upsert: true,
      })

    if (!upErr) {
      const { data: pub } = supabase.storage
        .from(RESUME_BUCKET)
        .getPublicUrl(path)
      docxUrl = pub?.publicUrl ?? null

      if (!docxUrl || docxUrl.includes('undefined')) {
        const { data: signed } = await supabase.storage
          .from(RESUME_BUCKET)
          .createSignedUrl(path, 60 * 60 * 24 * 30)
        docxUrl = signed?.signedUrl ?? null
      }
    } else {
      console.error('docx upload failed', upErr.message)
    }
  } catch (err) {
    console.error('docx generation failed', err)
  }

  const { data: version, error: vErr } = await supabase
    .from('resume_versions')
    .insert({
      application_id: applicationId,
      content: pkg.resumeMarkdown,
      docx_url: docxUrl,
    })
    .select('id, docx_url')
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
    docxUrl: version.docx_url ?? docxUrl,
  }
}
