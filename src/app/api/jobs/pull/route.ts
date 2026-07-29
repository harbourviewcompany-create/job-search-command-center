import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

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

  const supabase = createServiceClient()
  const { data, error } = await supabase.functions.invoke('daily-job-pull', {
    body: { source: 'manual', triggered_at: new Date().toISOString() },
  })

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? { ok: true })
}
