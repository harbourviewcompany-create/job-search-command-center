import 'server-only'

import type { User } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import {
  isJobPullAccessConfigured,
  JOB_PULL_ACCESS_COOKIE,
  verifyJobPullAccessToken,
} from '@/lib/job-pull-auth'
import { createClient } from '@/lib/supabase/server'

function normalized(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? ''
}

/** A Supabase session is privileged only when it matches the configured operator. */
export function isConfiguredOperatorUser(user: User | null | undefined) {
  if (!user) return false
  const configuredId = process.env.OPERATOR_USER_ID?.trim() ?? ''
  const configuredEmail = normalized(process.env.OPERATOR_EMAIL)
  if (!configuredId && !configuredEmail) return false
  return (
    (Boolean(configuredId) && user.id === configuredId) ||
    (Boolean(configuredEmail) && normalized(user.email) === configuredEmail)
  )
}

export async function isAuthorizedOperatorSession() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  return !error && isConfiguredOperatorUser(data.user)
}

/**
 * Allows deterministic CI to exercise server actions without a real user.
 * The bypass is disabled on Vercel and requires an explicit loopback runtime,
 * GitHub Actions, CI mode, and an ephemeral runtime-local key.
 */
export function isDeterministicOperatorVerification() {
  const runtimeBaseUrl = process.env.RUNTIME_BASE_URL ?? ''
  const isLoopback =
    runtimeBaseUrl.startsWith('http://127.0.0.1:') ||
    runtimeBaseUrl.startsWith('http://localhost:')

  return (
    process.env.GITHUB_ACTIONS === 'true' &&
    process.env.CI === 'true' &&
    process.env.VERCEL !== '1' &&
    !process.env.VERCEL_ENV &&
    isLoopback &&
    Boolean(process.env.JOB_PULL_API_KEY?.startsWith('runtime-local-'))
  )
}

/**
 * Requires either the explicitly configured Supabase operator or the signed
 * single-user operator-access cookie before a server action may mutate data.
 */
export async function requireOperatorAccess() {
  if (isDeterministicOperatorVerification()) return
  if (await isAuthorizedOperatorSession()) return

  if (!isJobPullAccessConfigured()) {
    throw new Error(
      'Configure OPERATOR_USER_ID or OPERATOR_EMAIL, or configure JOB_PULL_API_KEY for single-user operator access before changing pipeline data.'
    )
  }

  const cookieStore = await cookies()
  const accessToken = cookieStore.get(JOB_PULL_ACCESS_COOKIE)?.value ?? null
  if (verifyJobPullAccessToken(accessToken)) return

  throw new Error('Unlock operator access before changing job or application data.')
}
