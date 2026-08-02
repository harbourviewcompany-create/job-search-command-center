'use server'

import { revalidatePath } from 'next/cache'
import { requireOperatorAccess } from '@/lib/operator-auth'
import { createServiceClient } from '@/lib/supabase/server'
import { searchApolloPeople } from '@/lib/apollo'
import {
  draftOutreachWithAI,
  type OutreachTemplateKey,
} from '@/lib/outreach'
import { getProfile } from '@/lib/profile'
import type { OutreachType } from '@/types/database'

type ServiceClient = ReturnType<typeof createServiceClient>

interface ContactInput {
  companyId: string
  name: string
  title?: string
  email?: string
  linkedinUrl?: string
  source?: string
}

async function insertContact(supabase: ServiceClient, input: ContactInput) {
  const { data, error } = await supabase
    .from('contacts')
    .insert({
      company_id: input.companyId,
      name: input.name.trim(),
      title: input.title?.trim() || null,
      email: input.email?.trim() || null,
      linkedin_url: input.linkedinUrl?.trim() || null,
      source: input.source ?? 'manual',
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  revalidatePath('/contacts')
  return data
}

export async function addContact(input: ContactInput) {
  await requireOperatorAccess()
  return insertContact(createServiceClient(), input)
}

export async function addCompanyAndContact(input: {
  companyName: string
  name: string
  title?: string
  email?: string
  linkedinUrl?: string
}) {
  await requireOperatorAccess()
  const supabase = createServiceClient()
  const companyName = input.companyName.trim()

  let companyId: string
  const { data: existing } = await supabase
    .from('companies')
    .select('id')
    .ilike('name', companyName)
    .maybeSingle()

  if (existing) {
    companyId = existing.id
  } else {
    const { data: created, error } = await supabase
      .from('companies')
      .insert({ name: companyName })
      .select('id')
      .single()
    if (error || !created) throw new Error(error?.message ?? 'Company create failed')
    companyId = created.id
  }

  return insertContact(supabase, {
    companyId,
    name: input.name,
    title: input.title,
    email: input.email,
    linkedinUrl: input.linkedinUrl,
  })
}

export async function lookupApolloContacts(companyName: string, companyId?: string) {
  await requireOperatorAccess()
  const result = await searchApolloPeople({ companyName, limit: 5 })
  if (result.error) return result

  if (!companyId || result.people.length === 0) return result

  const supabase = createServiceClient()
  for (const person of result.people) {
    const { error } = await supabase.from('contacts').insert({
      company_id: companyId,
      name: person.name,
      title: person.title,
      email: person.email,
      linkedin_url: person.linkedin_url,
      source: 'apollo',
    })
    if (error) throw new Error(error.message)
  }

  revalidatePath('/contacts')
  return result
}

export async function createOutreachDraft(input: {
  applicationId: string
  contactId?: string | null
  template: OutreachTemplateKey
  type?: OutreachType
  companyName?: string | null
  jobTitle?: string | null
  contactName?: string | null
}) {
  await requireOperatorAccess()
  const supabase = createServiceClient()
  const profile = await getProfile(supabase)

  let contactName = input.contactName
  let contactTitle: string | null = null
  if (input.contactId) {
    const { data: contact } = await supabase
      .from('contacts')
      .select('name, title')
      .eq('id', input.contactId)
      .maybeSingle()
    contactName = contact?.name ?? contactName
    contactTitle = contact?.title ?? null
  }

  const { body } = await draftOutreachWithAI(
    input.template,
    {
      contactName,
      contactTitle,
      companyName: input.companyName,
      jobTitle: input.jobTitle,
    },
    profile
  )

  const type: OutreachType =
    input.type ??
    (input.template === 'follow_up_1' ? 'follow_up_1' : 'initial')

  const { data, error } = await supabase
    .from('outreach_messages')
    .insert({
      application_id: input.applicationId,
      contact_id: input.contactId ?? null,
      type,
      draft_body: body,
      status: 'drafted',
    })
    .select('id, draft_body, type, status, created_at')
    .single()

  if (error) throw new Error(error.message)

  revalidatePath(`/applications/${input.applicationId}`)
  revalidatePath('/dashboard')
  return data
}

export async function markOutreachSent(outreachId: string, applicationId: string) {
  await requireOperatorAccess()
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('outreach_messages')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
    })
    .eq('id', outreachId)

  if (error) throw new Error(error.message)

  revalidatePath(`/applications/${applicationId}`)
  revalidatePath('/dashboard')
}
