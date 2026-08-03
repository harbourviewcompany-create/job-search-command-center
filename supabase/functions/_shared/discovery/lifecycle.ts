export async function completeCompanySnapshot(
  supabase: any,
  input: {
    companyJobSourceId: string
    observedExternalIds: string[]
    complete: boolean
    verifiedAt?: string
  }
): Promise<{ closed: number; reopened: number }> {
  const { data, error } = await supabase.rpc('mark_source_snapshot_complete', {
    p_company_job_source_id: input.companyJobSourceId,
    p_observed_external_ids: input.observedExternalIds,
    p_complete: input.complete,
    p_verified_at: input.verifiedAt ?? new Date().toISOString(),
  })
  if (error) throw new Error(`Snapshot lifecycle update failed: ${error.message}`)
  const result = Array.isArray(data) ? data[0] : data
  return {
    closed: Number(result?.closed_postings ?? 0),
    reopened: Number(result?.reopened_postings ?? 0),
  }
}

export async function expireStaleAggregators(
  supabase: any,
  maxAgeDays = 60
): Promise<number> {
  const { data, error } = await supabase.rpc('expire_stale_aggregator_postings', {
    p_max_age: `${Math.max(1, Math.round(maxAgeDays))} days`,
    p_verified_at: new Date().toISOString(),
  })
  if (error) throw new Error(`Aggregator expiry failed: ${error.message}`)
  return Number(data ?? 0)
}
