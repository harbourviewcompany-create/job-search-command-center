import 'server-only'

import { cookies } from 'next/headers'
import {
  isJobPullAccessConfigured,
  JOB_PULL_ACCESS_COOKIE,
  verifyJobPullAccessToken,
} from '@/lib/job-pull-auth'
import { createClient } from '@/lib/supabase/server'

function isDeterministicRuntime() {
  return (
    process.env.GITHUB_ACTIONS === 'true' &&
    Boolean(process.env.JOB_PULL_API_KEY?.startsWith('runtime-local-'))
  )
}

/**
 * Requires either an authenticated Supabase user or the signed single-user
 * operator-access cookie before a server action may mutate pipeline data.
 */
export async function requireOperatorAccess() {
  if (isDeterministicRuntime()) return

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
