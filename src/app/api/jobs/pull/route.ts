import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

/**
 * Manual trigger for the scheduled job pull.
 *
 * The Edge Function performs database writes with its own server-side service
 * role. This route only needs a valid JWT to invoke that function, so it uses
 * the service-role key when configured and otherwise falls back to the legacy
 * anon JWT already required by the application runtime.
 *
 * POST /api/jobs/pull
 */
export async function POST() {
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
  })

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? { ok: true })
}
