/**
 * Follow-up scheduler — Supabase Edge Function
 *
 * For applications in status=applied older than settings.follow_up_offsets,
 * create a drafted outreach_messages row (type=follow_up_1) if one does not exist.
 * Never sends email — drafts only for human review on the dashboard / application page.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceKey, {
      db: { schema: 'job_search' },
      auth: { persistSession: false },
    })

    const { data: setting } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'follow_up_offsets')
      .maybeSingle()

    const offsets = (setting?.value as {
      follow_up_1_days?: number
      follow_up_2_days?: number
    } | null) ?? {}

    const followUp1Days = offsets.follow_up_1_days ?? 5
    const followUp2Days = offsets.follow_up_2_days ?? 12

    const cutoff1 = new Date()
    cutoff1.setDate(cutoff1.getDate() - followUp1Days)
    const cutoff1Str = cutoff1.toISOString().slice(0, 10)

    const { data: apps } = await supabase
      .from('applications')
      .select('id, applied_at, jobs(title, companies(name))')
      .eq('status', 'applied')
      .not('applied_at', 'is', null)
      .lte('applied_at', cutoff1Str)
      .limit(100)

    let created = 0
    let skipped = 0

    for (const app of apps ?? []) {
      const { data: existing } = await supabase
        .from('outreach_messages')
        .select('id')
        .eq('application_id', app.id)
        .eq('type', 'follow_up_1')
        .maybeSingle()

      if (existing) {
        skipped++
        continue
      }

      const job = (app as any).jobs
      const company = job?.companies?.name ?? 'the company'
      const title = job?.title ?? 'the role'

      const body = `Hi there,\n\nI wanted to follow up on my application for ${title} at ${company}. I remain very interested and would welcome any update on timeline or next steps.\n\nHappy to provide additional materials or speak briefly if helpful.\n\nBest regards,\nTyler Campbell\nharbourviewcompany@gmail.com`

      const { error } = await supabase.from('outreach_messages').insert({
        application_id: app.id,
        type: 'follow_up_1',
        draft_body: body,
        status: 'drafted',
        scheduled_for: new Date().toISOString().slice(0, 10),
      })

      if (error) {
        console.error('follow-up insert', error)
      } else {
        created++
      }
    }

    // Optional second follow-up pass
    const cutoff2 = new Date()
    cutoff2.setDate(cutoff2.getDate() - followUp2Days)
    const cutoff2Str = cutoff2.toISOString().slice(0, 10)

    const { data: apps2 } = await supabase
      .from('applications')
      .select('id, applied_at, jobs(title, companies(name))')
      .eq('status', 'applied')
      .not('applied_at', 'is', null)
      .lte('applied_at', cutoff2Str)
      .limit(50)

    let created2 = 0
    for (const app of apps2 ?? []) {
      const { data: existing } = await supabase
        .from('outreach_messages')
        .select('id')
        .eq('application_id', app.id)
        .eq('type', 'follow_up_2')
        .maybeSingle()

      if (existing) continue

      const job = (app as any).jobs
      const company = job?.companies?.name ?? 'the company'
      const title = job?.title ?? 'the role'

      const body = `Hi,\n\nFollowing up once more on ${title} at ${company}. Still very interested if the role is open.\n\nThank you,\nTyler Campbell`

      const { error } = await supabase.from('outreach_messages').insert({
        application_id: app.id,
        type: 'follow_up_2',
        draft_body: body,
        status: 'drafted',
        scheduled_for: new Date().toISOString().slice(0, 10),
      })
      if (!error) created2++
    }

    const summary = {
      ok: true,
      follow_up_1_days: followUp1Days,
      follow_up_2_days: followUp2Days,
      created_follow_up_1: created,
      skipped_existing: skipped,
      created_follow_up_2: created2,
    }

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
