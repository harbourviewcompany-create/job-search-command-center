import { NextResponse } from 'next/server'

/**
 * Manual trigger for daily job pull (for testing without waiting for cron).
 * Calls the Supabase Edge Function with the service role key.
 *
 * POST /api/jobs/pull
 */
export async function POST() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { ok: false, error: 'Missing SUPABASE_URL or SERVICE_ROLE_KEY' },
      { status: 500 }
    )
  }

  const res = await fetch(`${supabaseUrl}/functions/v1/daily-job-pull`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({ source: 'manual', triggered_at: new Date().toISOString() }),
  })

  const body = await res.json().catch(() => ({}))
  return NextResponse.json(body, { status: res.status })
}
