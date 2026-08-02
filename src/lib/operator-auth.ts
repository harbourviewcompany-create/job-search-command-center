import 'server-only'

import { cookies } from 'next/headers'
import {
  isJobPullAccessConfigured,
  JOB_PULL_ACCESS_COOKIE,
  verifyJobPullAccessToken,
} from '@/lib/job-pull-auth'
import { createClient } from '@/lib/supabase/server'

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
 * Requires either an authenticated Supabase user or the signed single-user
 * operator-access cookie before a server action may mutate pipeline data.
 */
export async function requireOperatorAccess() {
  if (isDeterministicOperatorVerification()) return

  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  if (!error && data.user) return

  if (!isJobPullAccessConfigured()) {
    throw new Error(
      'Configure JOB_PULL_API_KEY for single-user operator access before changing pipeline data.'
    )
  }

  const cookieStore = await cookies()
  const accessToken = cookieStore.get(JOB_PULL_ACCESS_COOKIE)?.value ?? null
  if (verifyJobPullAccessToken(accessToken)) return

  throw new Error('Unlock operator access before changing job or application data.')
}
