'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { ApplicationStatus } from '@/types/database'

export async function updateApplicationStatus(
  applicationId: string,
  status: ApplicationStatus
) {
  const supabase = await createClient()

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
  const supabase = await createClient()

  const { error } = await supabase
    .from('applications')
    .update({ notes })
    .eq('id', applicationId)

  if (error) throw new Error(error.message)

  revalidatePath(`/applications/${applicationId}`)
}
