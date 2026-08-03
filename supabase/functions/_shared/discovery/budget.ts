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
  const minuteStart = bucketStart(now, 'minute')
  const dailyStart = bucketStart(now, 'day')

  const { data, error } = await supabase.rpc('reserve_provider_requests', {
    p_provider: 'adzuna',
    p_minute_bucket_start: minuteStart.toISOString(),
    p_minute_limit: config.minuteLimit,
    p_minute_reserved: config.minuteReserve,
    p_minute_reset_at: new Date(minuteStart.getTime() + 60_000).toISOString(),
    p_daily_bucket_start: dailyStart.toISOString(),
    p_daily_limit: config.dailyLimit,
    p_daily_reserved: config.dailyReserve,
    p_daily_reset_at: new Date(dailyStart.getTime() + 86_400_000).toISOString(),
    p_manual: input.manual,
  })
  if (error) throw new Error(`Atomic budget reservation failed: ${error.message}`)
  return data === true
    ? { allowed: true, reason: 'Adzuna minute and daily requests reserved atomically.' }
    : { allowed: false, reason: 'Adzuna minute or daily budget is exhausted.' }
}
