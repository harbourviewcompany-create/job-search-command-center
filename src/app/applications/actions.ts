'use server'

import { revalidatePath } from 'next/cache'
import { requireOperatorAccess } from '@/lib/operator-auth'
import { createServiceClient } from '@/lib/supabase/server'
import type { ApplicationStatus } from '@/types/database'

export async function updateApplicationStatus(
  applicationId: string,
  status: ApplicationStatus
) {
  await requireOperatorAccess()
  const supabase = createServiceClient()

  // Quality rule: do not mark Applied without a generated package
  if (status === 'applied') {
    const { data: app } = await supabase
      .from('applications')
      .select('resume_version_id, cover_note')
      .eq('id', applicationId)
      .single()

    if (!app?.resume_version_id && !app?.cover_note) {
      throw new Error(
        'Generate and review a tailored package before marking Applied.'
      )
    }
  }

  const updates: {
    status: ApplicationStatus
    applied_at?: string
  } = { status }

  if (status === 'applied') {
    updates.applied_at = new Date().toISOString().slice(0, 10)
  }

  const { error } = await supabase
    .from('applications')
    .update(updates)
    .eq('id', applicationId)

  if (error) throw new Error(error.message)

  revalidatePath('/applications')
  revalidatePath('/dashboard')
  revalidatePath(`/applications/${applicationId}`)
}

export async function updateApplicationNotes(
  applicationId: string,
  notes: string
) {
  await requireOperatorAccess()
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('applications')
    .update({ notes })
    .eq('id', applicationId)

  if (error) throw new Error(error.message)

  revalidatePath(`/applications/${applicationId}`)
}
