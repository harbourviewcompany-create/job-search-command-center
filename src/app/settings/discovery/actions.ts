'use server'

import { revalidatePath } from 'next/cache'
import { requireOperatorAccess } from '@/lib/operator-auth'
import { createServiceClient } from '@/lib/supabase/server'

const PROVIDERS = ['greenhouse', 'lever', 'ashby', 'smartrecruiters'] as const
const REMOTE_POLICIES = ['any', 'remote_only', 'remote_or_local', 'local_only'] as const

type Provider = (typeof PROVIDERS)[number]
type RemotePolicy = (typeof REMOTE_POLICIES)[number]

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim()
}

function optionalText(formData: FormData, key: string): string | null {
  return text(formData, key) || null
}

function list(formData: FormData, key: string): string[] {
  return [...new Set(
    text(formData, key)
      .split(/[\n,]/)
      .map((value) => value.trim())
      .filter(Boolean)
  )]
}

function integer(formData: FormData, key: string, fallback: number, minimum = 0): number {
  const parsed = Number(formData.get(key))
  return Number.isFinite(parsed) ? Math.max(minimum, Math.round(parsed)) : fallback
}

function nullableInteger(formData: FormData, key: string): number | null {
  const value = text(formData, key)
  if (!value) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : null
}

function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
}

function checked(formData: FormData, key: string): boolean {
  return formData.get(key) === 'on' || formData.get(key) === 'true'
}

function providerValue(formData: FormData): Provider {
  const value = text(formData, 'provider')
  if (!PROVIDERS.includes(value as Provider)) throw new Error('Select a supported ATS provider.')
  return value as Provider
}

function remotePolicyValue(formData: FormData): RemotePolicy {
  const value = text(formData, 'remote_policy')
  return REMOTE_POLICIES.includes(value as RemotePolicy)
    ? value as RemotePolicy
    : 'remote_or_local'
}

export async function saveSearchProfile(formData: FormData) {
  await requireOperatorAccess()
  const supabase = createServiceClient() as any
  const id = optionalText(formData, 'id')
  const name = text(formData, 'name')
  if (!name) throw new Error('Search lane name is required.')

  const row = {
    name,
    slug: text(formData, 'slug') || slugify(name),
    description: optionalText(formData, 'description'),
    enabled: checked(formData, 'enabled'),
    priority: integer(formData, 'priority', 100),
    country_code: (text(formData, 'country_code') || 'CA').toUpperCase().slice(0, 2),
    remote_policy: remotePolicyValue(formData),
    locations: list(formData, 'locations'),
    employment_types: list(formData, 'employment_types'),
    primary_titles: list(formData, 'primary_titles'),
    title_aliases: list(formData, 'title_aliases'),
    required_terms: list(formData, 'required_terms'),
    preferred_terms: list(formData, 'preferred_terms'),
    excluded_terms: list(formData, 'excluded_terms'),
    excluded_companies: list(formData, 'excluded_companies'),
    maximum_posting_age_days: integer(formData, 'maximum_posting_age_days', 45, 1),
    minimum_salary_cad: nullableInteger(formData, 'minimum_salary_cad'),
    result_budget_per_run: integer(formData, 'result_budget_per_run', 100, 1),
  }

  const operation = id
    ? supabase.from('search_profiles').update(row).eq('id', id)
    : supabase.from('search_profiles').insert(row)
  const { error } = await operation
  if (error) throw new Error(error.message)

  revalidatePath('/settings/discovery')
  revalidatePath('/settings')
}

export async function toggleSearchProfile(formData: FormData) {
  await requireOperatorAccess()
  const id = text(formData, 'id')
  if (!id) throw new Error('Search lane identity is missing.')
  const supabase = createServiceClient() as any
  const { error } = await supabase
    .from('search_profiles')
    .update({ enabled: text(formData, 'enabled') === 'true' })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/settings/discovery')
}

function sourceValidationUrl(provider: Provider, boardKey: string, apiBaseUrl: string | null): string {
  const base = apiBaseUrl?.replace(/\/$/, '')
  switch (provider) {
    case 'greenhouse':
      return `${base ?? 'https://boards-api.greenhouse.io/v1/boards'}/${encodeURIComponent(boardKey)}/jobs`
    case 'lever':
      return `${base ?? 'https://api.lever.co/v0/postings'}/${encodeURIComponent(boardKey)}?mode=json&limit=1`
    case 'ashby':
      return `${base ?? 'https://api.ashbyhq.com/posting-api/job-board'}/${encodeURIComponent(boardKey)}`
    case 'smartrecruiters':
      return `${base ?? 'https://api.smartrecruiters.com/v1/companies'}/${encodeURIComponent(boardKey)}/postings?limit=1&offset=0&destination=PUBLIC`
  }
}

async function validateCompanySource(provider: Provider, boardKey: string, apiBaseUrl: string | null) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12_000)
  try {
    const response = await fetch(sourceValidationUrl(provider, boardKey, apiBaseUrl), {
      headers: { Accept: 'application/json', 'User-Agent': 'JobSearchCommandCenter/2.0' },
      signal: controller.signal,
      cache: 'no-store',
    })
    if (!response.ok) {
      throw new Error(`${provider} returned HTTP ${response.status} for board key “${boardKey}”.`)
    }
  } finally {
    clearTimeout(timeout)
  }
}

export async function saveCompanySource(formData: FormData) {
  await requireOperatorAccess()
  const supabase = createServiceClient() as any
  const id = optionalText(formData, 'id')
  const provider = providerValue(formData)
  const boardKey = text(formData, 'board_key')
  const apiBaseUrl = optionalText(formData, 'api_base_url')
  if (!boardKey) throw new Error('ATS board key is required.')

  let companyId = optionalText(formData, 'company_id')
  const newCompanyName = optionalText(formData, 'new_company_name')
  if (!companyId && !newCompanyName) throw new Error('Select or create a company.')

  if (!companyId && newCompanyName) {
    const { data, error } = await supabase
      .from('companies')
      .insert({ name: newCompanyName })
      .select('id')
      .single()
    if (error) throw new Error(error.message)
    companyId = String(data.id)
  }

  await validateCompanySource(provider, boardKey, apiBaseUrl)

  const row = {
    company_id: companyId,
    provider,
    board_key: boardKey,
    careers_url: optionalText(formData, 'careers_url'),
    api_base_url: apiBaseUrl,
    enabled: checked(formData, 'enabled'),
    priority: integer(formData, 'priority', 100),
    poll_interval_minutes: integer(formData, 'poll_interval_minutes', 360, 15),
    last_error: null,
    consecutive_failures: 0,
  }

  let sourceId = id
  if (id) {
    const { error } = await supabase.from('company_job_sources').update(row).eq('id', id)
    if (error) throw new Error(error.message)
  } else {
    const { data, error } = await supabase
      .from('company_job_sources')
      .insert(row)
      .select('id')
      .single()
    if (error) throw new Error(error.message)
    sourceId = String(data.id)
  }

  const profileIds = formData.getAll('profile_ids').map(String).filter(Boolean)
  if (sourceId) {
    const { error: deleteError } = await supabase
      .from('search_profile_company_sources')
      .delete()
      .eq('company_job_source_id', sourceId)
    if (deleteError) throw new Error(deleteError.message)

    if (profileIds.length > 0) {
      const { error: linkError } = await supabase
        .from('search_profile_company_sources')
        .insert(profileIds.map((profileId) => ({
          search_profile_id: profileId,
          company_job_source_id: sourceId,
          enabled: true,
          weight: 1,
        })))
      if (linkError) throw new Error(linkError.message)
    }
  }

  revalidatePath('/settings/discovery')
}

export async function toggleCompanySource(formData: FormData) {
  await requireOperatorAccess()
  const id = text(formData, 'id')
  if (!id) throw new Error('ATS source identity is missing.')
  const supabase = createServiceClient() as any
  const { error } = await supabase
    .from('company_job_sources')
    .update({ enabled: text(formData, 'enabled') === 'true' })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/settings/discovery')
}
