import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { verifyJobPullToken } from '@/lib/job-pull-auth'

export const runtime = 'nodejs'

function bearerToken(request: Request) {
  const authorization = request.headers.get('authorization')
  if (!authorization?.startsWith('Bearer ')) return null
  return authorization.slice('Bearer '.length).trim() || null
}

function functionErrorStatus(error: { name?: string; message?: string }) {
  if (error.name === 'FunctionsFetchError') return 504
  return 502
}

/**
 * Authorized manual trigger for the scheduled job pull.
 *
 * The browser receives a short-lived signed token, never the service-level
 * signing key. The Edge Function performs writes with its own server-side
 * service role; this route only invokes the function with a valid Supabase JWT.
 */
export async function POST(request: Request) {
  if (!verifyJobPullToken(bearerToken(request))) {
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

  const supabase = createClient(supabaseUrl, invocationKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data, error } = await supabase.functions.invoke('daily-job-pull', {
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
