export interface DiscoveryTotals {
  requestsUsed: number
  postingsFetched: number
  created: number
  updated: number
  merged: number
  closed: number
  reopened: number
  errors: number
  providers: Set<string>
}

export function emptyTotals(): DiscoveryTotals {
  return {
    requestsUsed: 0,
    postingsFetched: 0,
    created: 0,
    updated: 0,
    merged: 0,
    closed: 0,
    reopened: 0,
    errors: 0,
    providers: new Set<string>(),
  }
}

export async function startDiscoveryRun(
  supabase: any,
  input: { triggerType: string; requestedProfileId?: string | null; budgetSnapshot?: Record<string, unknown> }
): Promise<string> {
  const { data, error } = await supabase.from('discovery_runs').insert({
    trigger_type: input.triggerType,
    requested_profile_id: input.requestedProfileId ?? null,
    status: 'running',
    budget_snapshot: input.budgetSnapshot ?? {},
  }).select('id').single()
  if (error) throw new Error(`Discovery run creation failed: ${error.message}`)
  return String(data.id)
}

export async function startRunStep(
  supabase: any,
  input: {
    runId: string
    provider: string
    searchProfileId?: string | null
    searchProfileQueryId?: string | null
    companyJobSourceId?: string | null
    pageNumber?: number | null
    cursor?: string | null
  }
): Promise<string> {
  const { data, error } = await supabase.from('discovery_run_steps').insert({
    discovery_run_id: input.runId,
    provider: input.provider,
    search_profile_id: input.searchProfileId ?? null,
    search_profile_query_id: input.searchProfileQueryId ?? null,
    company_job_source_id: input.companyJobSourceId ?? null,
    page_number: input.pageNumber ?? null,
    cursor: input.cursor ?? null,
    status: 'running',
  }).select('id').single()
  if (error) throw new Error(`Discovery step creation failed: ${error.message}`)
  return String(data.id)
}

export async function finishRunStep(
  supabase: any,
  stepId: string,
  input: {
    status: 'completed' | 'skipped' | 'failed' | 'rate_limited'
    httpStatus?: number | null
    resultsReceived?: number
    newJobs?: number
    updatedJobs?: number
    mergedPostings?: number
    rateLimitRemaining?: number | null
    retryAfterSeconds?: number | null
    error?: string | null
    metadata?: Record<string, unknown>
  }
): Promise<void> {
  const { error } = await supabase.from('discovery_run_steps').update({
    request_finished_at: new Date().toISOString(),
    status: input.status,
    http_status: input.httpStatus ?? null,
    results_received: input.resultsReceived ?? 0,
    new_jobs: input.newJobs ?? 0,
    updated_jobs: input.updatedJobs ?? 0,
    merged_postings: input.mergedPostings ?? 0,
    rate_limit_remaining: input.rateLimitRemaining ?? null,
    retry_after_seconds: input.retryAfterSeconds ?? null,
    error: input.error ?? null,
    metadata: input.metadata ?? {},
  }).eq('id', stepId)
  if (error) throw new Error(`Discovery step completion failed: ${error.message}`)
}

export async function finishDiscoveryRun(
  supabase: any,
  runId: string,
  totals: DiscoveryTotals,
  input: { status: 'completed' | 'partial' | 'failed'; errorSummary?: string | null; summary?: Record<string, unknown> }
): Promise<void> {
  const { error } = await supabase.from('discovery_runs').update({
    status: input.status,
    finished_at: new Date().toISOString(),
    providers_attempted: [...totals.providers],
    requests_used: totals.requestsUsed,
    postings_fetched: totals.postingsFetched,
    canonical_jobs_created: totals.created,
    canonical_jobs_updated: totals.updated,
    postings_merged: totals.merged,
    jobs_closed: totals.closed,
    jobs_reopened: totals.reopened,
    errors_count: totals.errors,
    summary: input.summary ?? {},
    error_summary: input.errorSummary ?? null,
  }).eq('id', runId)
  if (error) throw new Error(`Discovery run completion failed: ${error.message}`)
}
