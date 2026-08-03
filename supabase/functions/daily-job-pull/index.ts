/**
 * Job Discovery V2 orchestrator.
 *
 * Runs due target-company ATS snapshots and profile-based aggregator queries,
 * persists every provider observation, canonicalizes duplicates, scores jobs
 * against configurable search lanes, and records run/source lifecycle evidence.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.111.0'
import { shouldContinuePagination } from '../../../shared/discovery/budget.ts'
import type { DiscoveryQuery, ProviderPage } from '../../../shared/discovery/types.ts'
import { reserveAdzunaRequest } from '../_shared/discovery/budget.ts'
import { ingestPosting } from '../_shared/discovery/ingest.ts'
import { completeCompanySnapshot, expireStaleAggregators } from '../_shared/discovery/lifecycle.ts'
import {
  emptyTotals,
  finishDiscoveryRun,
  finishRunStep,
  startDiscoveryRun,
  startRunStep,
} from '../_shared/discovery/run-recorder.ts'
import {
  type SearchProfileRow,
  toCompanySource,
  toDiscoveryQuery,
  toSearchProfile,
} from '../_shared/discovery/registry.ts'
import { scheduleCompanySources, scheduleQueries } from '../_shared/discovery/scheduler.ts'
import { getProviderAdapter } from '../_shared/providers/index.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}

interface TriggerBody {
  source?: 'manual' | 'scheduled' | 'verification'
  profile_id?: string | null
  company_source_id?: string | null
  max_pages?: number
  force?: boolean
  triggered_at?: string
}

interface CompanySourceRow extends Record<string, any> {
  id: string
  provider: 'greenhouse' | 'lever' | 'ashby' | 'smartrecruiters'
  last_checked_at?: string | null
  poll_interval_minutes?: number
  consecutive_failures?: number
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders })
}

function runTrigger(body: TriggerBody): 'scheduled' | 'manual' | 'profile' | 'company' | 'verification' {
  if (body.source === 'verification') return 'verification'
  if (body.company_source_id) return 'company'
  if (body.profile_id) return 'profile'
  if (body.source === 'manual') return 'manual'
  return 'scheduled'
}

function syntheticRemoteQueries(profileRows: SearchProfileRow[]): DiscoveryQuery[] {
  return profileRows.flatMap((row) => {
    const profile = toSearchProfile(row)
    const terms = [...profile.primaryTitles, ...profile.titleAliases].slice(0, 3)
    return terms.map((queryText, index) => ({
      searchProfileId: row.id,
      provider: 'remoteok' as const,
      queryType: 'exact_title' as const,
      queryText,
      location: 'Remote',
      priority: (row.priority ?? 100) + index,
      lastRunAt: null,
      lastResultCount: 0,
      lastNewJobCount: 0,
    }))
  })
}

function oldestAgeDays(page: ProviderPage): number | null {
  const times = page.postings
    .map((posting) => posting.postedAt ? new Date(posting.postedAt).getTime() : Number.NaN)
    .filter(Number.isFinite)
  if (times.length === 0) return null
  return Math.max(0, (Date.now() - Math.min(...times)) / 86_400_000)
}

async function getAdzunaCredentials(supabase: any) {
  let appId = Deno.env.get('ADZUNA_APP_ID') ?? undefined
  let appKey = Deno.env.get('ADZUNA_APP_KEY') ?? undefined
  if (appId && appKey) return { appId, appKey }

  const { data, error } = await supabase.rpc('get_adzuna_credentials').maybeSingle()
  if (error) console.error('get_adzuna_credentials RPC failed', error)
  const value = Array.isArray(data) ? data[0] : data
  appId = appId ?? value?.app_id ?? undefined
  appKey = appKey ?? value?.app_key ?? undefined
  return { appId, appKey }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) {
    return json({ ok: false, error: 'Missing Supabase Edge Function configuration' }, 500)
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    db: { schema: 'job_search' },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  let body: TriggerBody = {}
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const maxPages = Math.min(Math.max(Number(body.max_pages ?? 3), 1), 20)
  const manual = body.source === 'manual'
  const errors: string[] = []
  const totals = emptyTotals()
  let runId: string | null = null

  try {
    let profilesQuery = supabase
      .from('search_profiles')
      .select('*, scoring_configs(*)')
      .eq('enabled', true)
      .order('priority', { ascending: true })
    if (body.profile_id) profilesQuery = profilesQuery.eq('id', body.profile_id)
    const { data: profileData, error: profileError } = await profilesQuery
    if (profileError) throw new Error(`Search profiles could not be loaded: ${profileError.message}`)
    const profileRows = (profileData ?? []) as SearchProfileRow[]
    if (profileRows.length === 0) throw new Error('No enabled search profiles matched this run.')

    runId = await startDiscoveryRun(supabase, {
      triggerType: runTrigger(body),
      requestedProfileId: body.profile_id ?? null,
      budgetSnapshot: {
        adzuna: { minuteLimit: 25, dailyLimit: 250, manualReserve: 20 },
        maxPages,
      },
    })

    const { appId: adzunaAppId, appKey: adzunaAppKey } = await getAdzunaCredentials(supabase)

    let sourcesQuery = supabase
      .from('company_job_sources')
      .select('*, companies(name), search_profile_company_sources(search_profile_id,enabled)')
      .eq('enabled', true)
    if (body.company_source_id) sourcesQuery = sourcesQuery.eq('id', body.company_source_id)
    const { data: sourceData, error: sourceError } = await sourcesQuery
    if (sourceError) throw new Error(`Company ATS sources could not be loaded: ${sourceError.message}`)

    const rawSources = (sourceData ?? []) as CompanySourceRow[]
    const profileIds = new Set(profileRows.map((row) => row.id))
    const filteredSources = rawSources.filter((row) => {
      if (body.company_source_id) return true
      const links = row.search_profile_company_sources ?? []
      if (links.length === 0) return true
      return links.some((link: any) => link.enabled && profileIds.has(String(link.search_profile_id)))
    })
    const companySources = scheduleCompanySources(
      filteredSources.map((row) => ({
        ...toCompanySource(row),
        lastCheckedAt: row.last_checked_at ?? null,
        pollIntervalMinutes: Number(row.poll_interval_minutes ?? 360),
        row,
      })),
      new Date()
    )

    for (const source of companySources) {
      if (!body.force && !manual && body.company_source_id == null) {
        // scheduleCompanySources already removed non-due entries.
      }
      totals.providers.add(source.provider)
      const adapter = getProviderAdapter(source.provider)
      const iterator = adapter.discover({
        companySource: source,
        pageSize: 100,
        maxPages,
      })[Symbol.asyncIterator]()
      const observedExternalIds: string[] = []
      let completeSnapshot = false
      let pageNumber = 1
      let sourceFailed = false

      while (pageNumber <= maxPages) {
        const stepId = await startRunStep(supabase, {
          runId,
          provider: source.provider,
          companyJobSourceId: source.id,
          pageNumber,
        })
        try {
          const next = await iterator.next()
          if (next.done) {
            await finishRunStep(supabase, stepId, { status: 'skipped', metadata: { reason: 'provider completed' } })
            break
          }
          const page = next.value
          totals.requestsUsed += page.requestsUsed
          totals.postingsFetched += page.postings.length
          observedExternalIds.push(...page.postings.map((posting) => posting.externalId))
          let created = 0
          let updated = 0
          let merged = 0

          for (const posting of page.postings) {
            const result = await ingestPosting(supabase, posting, profileRows)
            if (result.action === 'created') created += 1
            else if (result.action === 'updated') updated += 1
            else merged += 1
          }
          totals.created += created
          totals.updated += updated
          totals.merged += merged
          completeSnapshot = page.completeSnapshot

          await finishRunStep(supabase, stepId, {
            status: 'completed',
            httpStatus: page.httpStatus,
            resultsReceived: page.postings.length,
            newJobs: created,
            updatedJobs: updated,
            mergedPostings: merged,
            rateLimitRemaining: page.rateLimitRemaining,
            retryAfterSeconds: page.retryAfterSeconds,
            metadata: { completeSnapshot: page.completeSnapshot },
          })
          if (!page.nextCursor) break
          pageNumber += 1
        } catch (error) {
          sourceFailed = true
          totals.errors += 1
          const message = error instanceof Error ? error.message : String(error)
          errors.push(`${source.provider}:${source.boardKey}: ${message}`)
          await finishRunStep(supabase, stepId, { status: 'failed', error: message })
          await supabase.from('company_job_sources').update({
            last_checked_at: new Date().toISOString(),
            last_error_at: new Date().toISOString(),
            last_error: message,
            consecutive_failures: Number(source.row?.consecutive_failures ?? 0) + 1,
          }).eq('id', source.id)
          break
        }
      }

      if (!sourceFailed) {
        const lifecycle = await completeCompanySnapshot(supabase, {
          companyJobSourceId: source.id,
          observedExternalIds,
          complete: completeSnapshot,
        })
        totals.closed += lifecycle.closed
        totals.reopened += lifecycle.reopened
      }
    }

    let queryBuilder = supabase
      .from('search_profile_queries')
      .select('*')
      .eq('enabled', true)
    if (body.profile_id) queryBuilder = queryBuilder.eq('search_profile_id', body.profile_id)
    const { data: queryData, error: queryError } = await queryBuilder
    if (queryError) throw new Error(`Search queries could not be loaded: ${queryError.message}`)
    const persistedQueries = (queryData ?? []).map((row) => toDiscoveryQuery(row))
    const hasRemoteOk = persistedQueries.some((query) => query.provider === 'remoteok')
    const scheduledQueries = scheduleQueries([
      ...persistedQueries,
      ...(hasRemoteOk ? [] : syntheticRemoteQueries(profileRows)),
    ])

    for (const query of scheduledQueries) {
      const profileRow = profileRows.find((row) => row.id === query.searchProfileId)
      if (!profileRow) continue
      if (query.provider === 'adzuna' && (!adzunaAppId || !adzunaAppKey)) {
        errors.push(`adzuna:${query.queryText}: credentials are not configured`)
        totals.errors += 1
        continue
      }

      totals.providers.add(query.provider)
      const adapter = getProviderAdapter(query.provider)
      const iterator = adapter.discover({
        query,
        countryCode: profileRow.country_code,
        pageSize: query.provider === 'adzuna' ? 50 : 100,
        maxPages,
        credentials: {
          ADZUNA_APP_ID: adzunaAppId,
          ADZUNA_APP_KEY: adzunaAppKey,
        },
      })[Symbol.asyncIterator]()
      let pageNumber = 1
      let queryResults = 0
      let queryNew = 0

      while (pageNumber <= maxPages) {
        if (query.provider === 'adzuna') {
          const reservation = await reserveAdzunaRequest(supabase, { manual })
          if (!reservation.allowed) {
            const stepId = await startRunStep(supabase, {
              runId,
              provider: query.provider,
              searchProfileId: query.searchProfileId,
              searchProfileQueryId: query.id ?? null,
              pageNumber,
            })
            await finishRunStep(supabase, stepId, {
              status: 'rate_limited',
              error: reservation.reason,
            })
            break
          }
        }

        const stepId = await startRunStep(supabase, {
          runId,
          provider: query.provider,
          searchProfileId: query.searchProfileId,
          searchProfileQueryId: query.id ?? null,
          pageNumber,
        })
        try {
          const next = await iterator.next()
          if (next.done) {
            await finishRunStep(supabase, stepId, { status: 'skipped', metadata: { reason: 'provider completed' } })
            break
          }
          const page = next.value
          totals.requestsUsed += page.requestsUsed
          totals.postingsFetched += page.postings.length
          queryResults += page.postings.length
          let created = 0
          let updated = 0
          let merged = 0

          for (const posting of page.postings) {
            const result = await ingestPosting(supabase, posting, profileRows)
            if (result.action === 'created') created += 1
            else if (result.action === 'updated') updated += 1
            else merged += 1
          }
          queryNew += created
          totals.created += created
          totals.updated += updated
          totals.merged += merged

          await finishRunStep(supabase, stepId, {
            status: 'completed',
            httpStatus: page.httpStatus,
            resultsReceived: page.postings.length,
            newJobs: created,
            updatedJobs: updated,
            mergedPostings: merged,
            rateLimitRemaining: page.rateLimitRemaining,
            retryAfterSeconds: page.retryAfterSeconds,
          })

          const decision = shouldContinuePagination({
            page: pageNumber,
            maxPages,
            resultCount: page.postings.length,
            pageSize: query.provider === 'adzuna' ? 50 : 100,
            newJobCount: created,
            duplicateCount: updated + merged,
            budgetRemaining: 1,
            oldestResultAgeDays: oldestAgeDays(page),
            maximumPostingAgeDays: profileRow.maximum_posting_age_days,
          })
          if (!page.nextCursor || !decision.continue) break
          pageNumber += 1
        } catch (error) {
          totals.errors += 1
          const message = error instanceof Error ? error.message : String(error)
          errors.push(`${query.provider}:${query.queryText}:${query.location ?? ''}: ${message}`)
          await finishRunStep(supabase, stepId, { status: 'failed', error: message })
          break
        }
      }

      if (query.id) {
        await supabase.from('search_profile_queries').update({
          last_run_at: new Date().toISOString(),
          last_result_count: queryResults,
          last_new_job_count: queryNew,
        }).eq('id', query.id)
      }
    }

    await expireStaleAggregators(supabase, 60)
    const status = totals.errors === 0 ? 'completed' : totals.postingsFetched > 0 ? 'partial' : 'failed'
    await finishDiscoveryRun(supabase, runId, totals, {
      status,
      errorSummary: errors.length > 0 ? errors.slice(0, 20).join('\n') : null,
      summary: {
        trigger: runTrigger(body),
        profileCount: profileRows.length,
        companySourceCount: companySources.length,
        queryCount: scheduledQueries.length,
      },
    })

    return json({
      ok: status !== 'failed',
      discovery_run_id: runId,
      status,
      inserted: totals.created,
      updated: totals.updated,
      merged: totals.merged,
      skipped: 0,
      closed: totals.closed,
      reopened: totals.reopened,
      requests_used: totals.requestsUsed,
      postings_fetched: totals.postingsFetched,
      providers: [...totals.providers],
      errors,
    }, status === 'failed' ? 500 : 200)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('Job Discovery V2 run failed', error)
    totals.errors += 1
    errors.push(message)
    if (runId) {
      try {
        await finishDiscoveryRun(supabase, runId, totals, {
          status: 'failed',
          errorSummary: errors.join('\n'),
        })
      } catch (finishError) {
        console.error('Discovery run failure could not be recorded', finishError)
      }
    }
    return json({ ok: false, discovery_run_id: runId, error: message, errors }, 500)
  }
})
