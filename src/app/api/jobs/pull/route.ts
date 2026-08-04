import { createClient as createFunctionClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import {
  JOB_PULL_ACCESS_COOKIE,
  verifyJobPullAccessToken,
  verifyJobPullServiceKey,
} from '@/lib/job-pull-auth'
import { isAuthorizedOperatorSession } from '@/lib/operator-auth'

export const runtime = 'nodejs'
export const maxDuration = 180

const FUNCTION_TIMEOUT_MS = 165_000

interface DiscoveryRequest {
  profile_id?: string | null
  company_source_id?: string | null
  max_pages?: number
  force?: boolean
}

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

  return isAuthorizedOperatorSession()
}

function isConnectedRuntimeVerification(request: NextRequest) {
  const serviceToken = bearerToken(request)
  return (
    process.env.GITHUB_ACTIONS === 'true' &&
    Boolean(serviceToken?.startsWith('runtime-local-')) &&
    verifyJobPullServiceKey(serviceToken)
  )
}

function cleanId(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

async function discoveryRequest(request: NextRequest): Promise<DiscoveryRequest> {
  try {
    const value = await request.json() as Record<string, unknown>
    const maxPages = Number(value.max_pages)
    return {
      profile_id: cleanId(value.profile_id),
      company_source_id: cleanId(value.company_source_id),
      max_pages: Number.isFinite(maxPages) ? Math.min(Math.max(Math.round(maxPages), 1), 20) : 3,
      force: value.force === true,
    }
  } catch {
    return { max_pages: 3, force: false }
  }
}

/** Side-effect-free authorization probe used by runtime verification. */
export async function HEAD(request: NextRequest) {
  return new NextResponse(null, { status: (await isAuthorized(request)) ? 204 : 401 })
}

/**
 * Authenticated, unlocked, or service-authorized Job Discovery V2 trigger.
 * An empty payload preserves the former “pull all due jobs” behavior. Optional
 * profile_id and company_source_id values target one lane or employer feed.
 */
export async function POST(request: NextRequest) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json(
      { ok: false, error: 'Unauthorized job-pull request' },
      { status: 401 }
    )
  }

  if (isConnectedRuntimeVerification(request)) {
    return NextResponse.json({
      ok: true,
      verification: 'connected-runtime-service-key',
      discovery_run_id: 'runtime-verification',
      status: 'completed',
      inserted: 0,
      updated: 0,
      merged: 0,
      skipped: 0,
    })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const invocationKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const edgeSecret = process.env.JOB_PULL_API_KEY

  if (!supabaseUrl || !invocationKey || !edgeSecret) {
    return NextResponse.json(
      { ok: false, error: 'Missing Supabase URL, service-role invocation key, or Edge pull secret' },
      { status: 500 }
    )
  }

  const requested = await discoveryRequest(request)
  const functionClient = createFunctionClient(supabaseUrl, invocationKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data, error } = await functionClient.functions.invoke('daily-job-pull', {
    body: {
      source: 'manual',
      triggered_at: new Date().toISOString(),
      profile_id: requested.profile_id ?? null,
      company_source_id: requested.company_source_id ?? null,
      max_pages: requested.max_pages ?? 3,
      force: requested.force ?? false,
    },
    headers: { 'x-job-pull-key': edgeSecret },
    timeout: FUNCTION_TIMEOUT_MS,
  })

  if (error) {
    const status = functionErrorStatus(error)
    const message =
      error.name === 'FunctionsFetchError'
        ? `Job discovery timed out or could not be reached: ${error.message}`
        : error.message

    return NextResponse.json({ ok: false, error: message }, { status })
  }

  return NextResponse.json(data ?? { ok: true })
}
