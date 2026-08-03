export interface ProviderBudgetConfig {
  minuteLimit: number
  dailyLimit: number
  minuteReserve: number
  dailyReserve: number
}

export const DEFAULT_ADZUNA_BUDGET: ProviderBudgetConfig = {
  minuteLimit: 25,
  dailyLimit: 250,
  minuteReserve: 2,
  dailyReserve: 20,
}

function bucketStart(now: Date, type: 'minute' | 'day'): Date {
  const value = new Date(now)
  if (type === 'minute') value.setUTCSeconds(0, 0)
  else value.setUTCHours(0, 0, 0, 0)
  return value
}

export async function reserveAdzunaRequest(
  supabase: any,
  input: { manual: boolean; now?: Date; config?: Partial<ProviderBudgetConfig> }
): Promise<{ allowed: boolean; reason: string }> {
  const now = input.now ?? new Date()
  const config = { ...DEFAULT_ADZUNA_BUDGET, ...(input.config ?? {}) }
  const buckets = [
    {
      type: 'minute' as const,
      start: bucketStart(now, 'minute'),
      limit: config.minuteLimit,
      reserve: config.minuteReserve,
      reset: new Date(bucketStart(now, 'minute').getTime() + 60_000),
    },
    {
      type: 'day' as const,
      start: bucketStart(now, 'day'),
      limit: config.dailyLimit,
      reserve: config.dailyReserve,
      reset: new Date(bucketStart(now, 'day').getTime() + 86_400_000),
    },
  ]

  for (const bucket of buckets) {
    const { data, error } = await supabase.rpc('reserve_provider_request', {
      p_provider: 'adzuna',
      p_bucket_type: bucket.type,
      p_bucket_start: bucket.start.toISOString(),
      p_request_limit: bucket.limit,
      p_reserved_requests: bucket.reserve,
      p_reset_at: bucket.reset.toISOString(),
      p_manual: input.manual,
    })
    if (error) throw new Error(`Budget reservation failed: ${error.message}`)
    if (data !== true) return { allowed: false, reason: `${bucket.type} Adzuna budget is exhausted.` }
  }

  return { allowed: true, reason: 'Adzuna request reserved.' }
}
