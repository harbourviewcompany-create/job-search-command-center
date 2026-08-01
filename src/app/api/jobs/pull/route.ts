import { createClient as createFunctionClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import {
  JOB_PULL_ACCESS_COOKIE,
  verifyJobPullAccessToken,
  verifyJobPullServiceKey,
} from '@/lib/job-pull-auth'
import { createClient as createServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 180

const FUNCTION_TIMEOUT_MS = 165_000

function bearerToken(request: Request) {
  const authorization = request.headers.get('authorization')
  if (!authorization?.startsWith('Bearer ')) return null
  return authorization.slice('Bearer '.length).trim() || null
}

function functionErrorStatus(error: { name?: string }) {
  return error.name === 'FunctionsFetchError' ? 504 : 502
}

async function isAuthorized(request: NextRequest) {
  if (verifyJobPullServiceKey(bearerToken(request))) return true

  const accessToken = request.cookies.get(JOB_PULL_ACCESS_COOKIE)?.value ?? null
  if (verifyJobPullAccessToken(accessToken)) return true

  const sessionClient = await createServerClient()
  const { data, error } = await sessionClient.auth.getUser()
  return !error && Boolean(data.user)
}

function isConnectedRuntimeVerification(request: NextRequest) {
  const serviceToken = bearerToken(request)
  return (
    process.env.GITHUB_ACTIONS === 'true' &&
    Boolean(serviceToken?.startsWith('runtime-local-')) &&
    verifyJobPullServiceKey(serviceToken)
  )
}

/** Side-effect-free authorization probe used by runtime verification. */
export async function HEAD(request: NextRequest) {
  return new NextResponse(null, { status: (await isAuthorized(request)) ? 204 : 401 })
}

/**
 * Authenticated, unlocked, or service-authorized manual trigger for the
 * scheduled job pull. Browser unlocks use a signed HttpOnly cookie; CI and
 * trusted operators may use JOB_PULL_API_KEY as a server-side bearer.
 */
export async function POST(request: NextRequest) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json(
      { ok: false, error: 'Unauthorized job-pull request' },
      { status: 401 }
    )
  }

  // The connected browser suite verifies the authenticated POST contract with
  // an ephemeral runtime-local service key. Keep that CI-only probe isolated
  // from provider quotas and live, unmarked job writes.
  if (isConnectedRuntimeVerification(request)) {
    return NextResponse.json({
      ok: true,
      verification: 'connected-runtime-service-key',
      inserted: 0,
      updated: 0,
      skipped: 0,
    })
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
    timeout: FUNCTION_TIMEOUT_MS,
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
