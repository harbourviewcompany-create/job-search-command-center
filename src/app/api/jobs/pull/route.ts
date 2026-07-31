import { createClient as createFunctionClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { verifyJobPullServiceKey } from '@/lib/job-pull-auth'
import { createClient as createServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

function bearerToken(request: Request) {
  const authorization = request.headers.get('authorization')
  if (!authorization?.startsWith('Bearer ')) return null
  return authorization.slice('Bearer '.length).trim() || null
}

function functionErrorStatus(error: { name?: string }) {
  return error.name === 'FunctionsFetchError' ? 504 : 502
}

async function isAuthorized(request: Request) {
  if (verifyJobPullServiceKey(bearerToken(request))) return true

  const sessionClient = await createServerClient()
  const { data, error } = await sessionClient.auth.getUser()
  return !error && Boolean(data.user)
}

/**
 * Authenticated or service-authorized manual trigger for the scheduled job pull.
 * Browser callers must have a valid Supabase user session. CI and trusted
 * operators may use JOB_PULL_API_KEY as a server-side bearer credential.
 */
export async function POST(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json(
      { ok: false, error: 'Unauthorized job-pull request' },
      { status: 401 }
    )
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const invocationKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !invocationKey) {
    return NextResponse.json(
      { ok: false, error: 'Missing Supabase URL or function invocation key' },
      { status: 500 }
    )
  }

  const functionClient = createFunctionClient(supabaseUrl, invocationKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data, error } = await functionClient.functions.invoke('daily-job-pull', {
    body: { source: 'manual', triggered_at: new Date().toISOString() },
    timeout: 20_000,
  })

  if (error) {
    const status = functionErrorStatus(error)
    const message =
      error.name === 'FunctionsFetchError'
        ? `Job provider request timed out or could not be reached: ${error.message}`
        : error.message

    return NextResponse.json({ ok: false, error: message }, { status })
  }

  return NextResponse.json(data ?? { ok: true })
}
