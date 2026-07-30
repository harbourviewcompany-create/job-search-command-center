/**
 * Daily job pull — Supabase Edge Function
 *
 * Sources:
 * 1. Adzuna (primary, official free API) — country `ca` for Canada
 * 2. Indeed Publisher API (optional legacy) — only if INDEED_PUBLISHER_ID is set
 *
 * Reads search_terms from settings, upserts jobs, scores against profile.
 * Schedule via pg_cron (see migrations/003_schedule_job_pull.sql).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SearchTerms {
  terms: string[]
  locations: string[]
}

interface NormalizedJob {
  source: 'indeed' | 'adzuna'
  external_id: string
  title: string
  company_name: string
  location: string | null
  remote: boolean
  description: string | null
  url: string | null
  posted_at: string | null
}

// --- Fit scoring (mirrors src/lib/scoring.ts; keep in sync) ---

const PROFILE = {
  target_titles: [
    'business development manager',
    'director of business development',
    'account executive',
    'strategic account manager',
    'partnerships manager',
    'head of sales',
    'market development manager',
    'client partnerships manager',
    'revenue leader',
    'general manager',
    'account manager',
    'sales manager',
  ],
  skills: [
    'business development',
    'account management',
    'b2b sales',
    'client relationship',
    'international trade',
    'market expansion',
    'talent acquisition',
    'recruiting',
    'hvac',
    'insurance',
    'automotive',
    'operations management',
    'team leadership',
    'revenue growth',
    'market intelligence',
    'cross-border',
    'channel partnerships',
    'partnerships',
  ],
  industries: [
    'international trade',
    'marketplace',
    'hvac',
    'insurance',
    'automotive',
    'recruiting',
    'staffing',
    'cannabis',
    'supply chain',
  ],
  locations: ['ottawa', 'ontario', 'canada', 'remote'],
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9+.# ]/g, ' ')
}

function scoreJob(job: {
  title: string
  description?: string | null
  location?: string | null
  remote?: boolean
}): { score: number; reasons: string[] } {
  const blob = normalize([job.title, job.description ?? '', job.location ?? ''].join(' '))
  const reasons: string[] = []
  let score = 20

  const titleNorm = normalize(job.title)
  const titleHit = PROFILE.target_titles.find((t) => {
    const words = t.split(' ').filter((w) => w.length > 3)
    return titleNorm.includes(t) || (words.length > 0 && words.every((w) => titleNorm.includes(w)))
  })
  if (titleHit) {
    score += 35
    reasons.push(`Title aligns with ${titleHit}`)
  }

  const skillHits = PROFILE.skills.filter((s) => blob.includes(s))
  if (skillHits.length >= 4) {
    score += 25
    reasons.push(`Skills: ${skillHits.slice(0, 4).join(', ')}`)
  } else if (skillHits.length >= 2) {
    score += 15
    reasons.push(`Skills: ${skillHits.slice(0, 3).join(', ')}`)
  } else if (skillHits.length === 1) {
    score += 8
    reasons.push(`Skill: ${skillHits[0]}`)
  }

  const industryHits = PROFILE.industries.filter((i) => blob.includes(i))
  if (industryHits.length > 0) {
    score += 12
    reasons.push(`Industry: ${industryHits[0]}`)
  }

  // Unknown location (loc.length === 0) is neutral, not a match
  const loc = normalize(job.location ?? '')
  const remoteMatch = job.remote || loc.includes('remote')
  const locationMatch = PROFILE.locations.some((l) => loc.includes(l))
  if (remoteMatch || locationMatch) {
    score += 10
    reasons.push(remoteMatch ? 'Remote-friendly' : 'Location match')
  } else if (loc.length > 0) {
    score -= 15
    reasons.push('Location may not match')
  }

  // Multi-word phrases are specific enough to check anywhere; single generic words
  // (b2b, revenue) only count in the title to avoid false positives from incidental
  // mentions in a job description.
  const bdPhraseSignals = [
    'business development',
    'account manager',
    'account executive',
    'partnership',
    'sales manager',
  ]
  const bdGenericTitleSignals = ['b2b', 'revenue']
  const bdSignalHit =
    bdPhraseSignals.some((s) => blob.includes(s)) ||
    bdGenericTitleSignals.some((s) => titleNorm.includes(s))
  if (bdSignalHit) {
    score += 8
    if (!reasons.some((r) => r.startsWith('Title'))) reasons.push('BD/sales role signal')
  }

  score = Math.max(0, Math.min(100, score))
  if (reasons.length === 0) reasons.push('Limited keyword overlap')
  return { score, reasons }
}

// --- Providers ---

async function fetchAdzuna(
  term: string,
  location: string,
  appId: string,
  appKey: string
): Promise<NormalizedJob[]> {
  // Canada country code; results_per_page max typically 50
  const params = new URLSearchParams({
    app_id: appId,
    app_key: appKey,
    what: term,
    where: location,
    results_per_page: '25',
    content_type: 'jobs',
    sort_by: 'date',
  })
  const url = `https://api.adzuna.com/v1/api/jobs/ca/search/1?${params}`
  const res = await fetch(url)
  if (!res.ok) {
    console.error('Adzuna error', res.status, await res.text())
    return []
  }
  const data = await res.json()
  const results = data.results ?? []
  return results.map((r: any): NormalizedJob => {
    const desc = (r.description ?? '').replace(/<[^>]+>/g, ' ').slice(0, 4000)
    const loc = r.location?.display_name ?? location
    const remote =
      /remote|work from home|wfh/i.test(`${r.title} ${desc} ${loc}`) ||
      false
    return {
      source: 'adzuna',
      external_id: String(r.id),
      title: r.title ?? 'Untitled',
      company_name: r.company?.display_name ?? 'Unknown',
      location: loc,
      remote,
      description: desc || null,
      url: r.redirect_url ?? r.adref ?? null,
      posted_at: r.created ? String(r.created).slice(0, 10) : null,
    }
  })
}

/** Legacy Indeed Publisher API — often unavailable; only used if key present */
async function fetchIndeed(
  term: string,
  location: string,
  publisherId: string
): Promise<NormalizedJob[]> {
  const params = new URLSearchParams({
    publisher: publisherId,
    q: term,
    l: location,
    format: 'json',
    v: '2',
    limit: '25',
    co: 'ca',
    userip: '1.2.3.4',
    useragent: 'JobSearchCommandCenter/1.0',
  })
  const url = `https://api.indeed.com/ads/apisearch?${params}`
  try {
    const res = await fetch(url)
    if (!res.ok) {
      console.error('Indeed API error', res.status, await res.text())
      return []
    }
    const data = await res.json()
    const results = data.results ?? []
    return results.map((r: any): NormalizedJob => ({
      source: 'indeed',
      external_id: String(r.jobkey ?? r.url ?? `${r.company}-${r.jobtitle}`),
      title: r.jobtitle ?? 'Untitled',
      company_name: r.company ?? 'Unknown',
      location: r.formattedLocation ?? location,
      remote: /remote/i.test(`${r.jobtitle} ${r.snippet ?? ''}`),
      description: r.snippet ?? null,
      url: r.url ?? null,
      posted_at: r.date ? String(r.date).slice(0, 10) : null,
    }))
  } catch (e) {
    console.error('Indeed fetch failed', e)
    return []
  }
}

// --- Main ---

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const adzunaAppId = Deno.env.get('ADZUNA_APP_ID')
    const adzunaAppKey = Deno.env.get('ADZUNA_APP_KEY')
    const indeedPublisher = Deno.env.get('INDEED_PUBLISHER_ID')

    const supabase = createClient(supabaseUrl, serviceKey)

    // Load search terms
    const { data: setting } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'search_terms')
      .maybeSingle()

    const search: SearchTerms = (setting?.value as SearchTerms) ?? {
      terms: ['business development manager', 'account executive'],
      locations: ['Ottawa', 'Ontario', 'Remote'],
    }

    const terms = search.terms?.length ? search.terms : ['business development']
    const locations = search.locations?.length ? search.locations : ['Canada']

    // Cap combinations to stay within free-tier rate limits
    const maxCombos = 12
    const combos: { term: string; location: string }[] = []
    for (const term of terms.slice(0, 6)) {
      for (const location of locations.slice(0, 3)) {
        combos.push({ term, location })
        if (combos.length >= maxCombos) break
      }
      if (combos.length >= maxCombos) break
    }

    const collected: NormalizedJob[] = []

    for (const { term, location } of combos) {
      if (adzunaAppId && adzunaAppKey) {
        const jobs = await fetchAdzuna(term, location, adzunaAppId, adzunaAppKey)
        collected.push(...jobs)
        await delay(300) // be kind to free tier
      }
      if (indeedPublisher) {
        const jobs = await fetchIndeed(term, location, indeedPublisher)
        collected.push(...jobs)
        await delay(300)
      }
    }

    // Dedupe within this run
    const seen = new Set<string>()
    const unique = collected.filter((j) => {
      const key = `${j.source}:${j.external_id}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    let inserted = 0
    let updated = 0
    let skipped = 0

    for (const job of unique) {
      // Company upsert by name
      let companyId: string | null = null
      const { data: existingCo } = await supabase
        .from('companies')
        .select('id')
        .ilike('name', job.company_name)
        .maybeSingle()

      if (existingCo) {
        companyId = existingCo.id
      } else {
        const { data: created, error: companyError } = await supabase
          .from('companies')
          .insert({ name: job.company_name })
          .select('id')
          .single()
        if (companyError) {
          console.error('Company insert error', job.company_name, companyError)
        }
        companyId = created?.id ?? null
      }

      const fit = scoreJob(job)

      // Upsert on (source, external_id) — only insert if new; refresh score on existing found jobs
      const { data: existing } = await supabase
        .from('jobs')
        .select('id, status')
        .eq('source', job.source)
        .eq('external_id', job.external_id)
        .maybeSingle()

      if (existing) {
        if (existing.status === 'found') {
          await supabase
            .from('jobs')
            .update({
              fit_score: fit.score,
              fit_reasons: fit.reasons,
              fetched_at: new Date().toISOString(),
            })
            .eq('id', existing.id)
          updated++
        } else {
          skipped++
        }
        continue
      }

      const { error } = await supabase.from('jobs').insert({
        source: job.source,
        external_id: job.external_id,
        title: job.title,
        company_id: companyId,
        location: job.location,
        remote: job.remote,
        description: job.description,
        url: job.url,
        posted_at: job.posted_at,
        status: 'found',
        fit_score: fit.score,
        fit_reasons: fit.reasons,
      })

      if (error) {
        // Unique violation race
        if (error.code === '23505') skipped++
        else console.error('Insert error', error)
      } else {
        inserted++
      }
    }

    const summary = {
      ok: true,
      combos: combos.length,
      fetched: collected.length,
      unique: unique.length,
      inserted,
      updated,
      skipped,
      providers: {
        adzuna: Boolean(adzunaAppId && adzunaAppKey),
        indeed: Boolean(indeedPublisher),
      },
    }

    console.log(JSON.stringify(summary))
    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}
