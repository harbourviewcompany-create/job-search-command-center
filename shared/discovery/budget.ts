export interface BudgetBucket {
  provider: string
  bucketType: 'minute' | 'day' | 'week' | 'month'
  requestLimit: number
  requestsUsed: number
  reservedRequests: number
  resetAt: string
}

export interface BudgetDecision {
  allowed: boolean
  remaining: number
  reason: string
}

export function budgetDecision(bucket: BudgetBucket, manual = false): BudgetDecision {
  const usableLimit = manual
    ? bucket.requestLimit
    : Math.max(0, bucket.requestLimit - bucket.reservedRequests)
  const remaining = Math.max(0, usableLimit - bucket.requestsUsed)
  return {
    allowed: remaining > 0,
    remaining,
    reason: remaining > 0
      ? `${remaining} ${bucket.bucketType} request(s) remain.`
      : manual
        ? `${bucket.bucketType} provider budget is exhausted.`
        : `${bucket.bucketType} automated budget is exhausted; reserved requests are preserved for manual pulls.`,
  }
}

export function shouldContinuePagination(input: {
  page: number
  maxPages: number
  resultCount: number
  pageSize: number
  newJobCount: number
  duplicateCount: number
  budgetRemaining: number
  oldestResultAgeDays?: number | null
  maximumPostingAgeDays?: number | null
}): { continue: boolean; reason: string } {
  if (input.page >= input.maxPages) return { continue: false, reason: 'maximum page count reached' }
  if (input.resultCount === 0) return { continue: false, reason: 'provider returned an empty page' }
  if (input.resultCount < input.pageSize) return { continue: false, reason: 'provider returned a short page' }
  if (input.budgetRemaining <= 0) return { continue: false, reason: 'request budget exhausted' }
  const totalObserved = input.newJobCount + input.duplicateCount
  if (totalObserved >= input.pageSize && input.newJobCount / Math.max(totalObserved, 1) < 0.08) {
    return { continue: false, reason: 'duplicate saturation threshold reached' }
  }
  if (
    input.oldestResultAgeDays != null &&
    input.maximumPostingAgeDays != null &&
    input.oldestResultAgeDays > input.maximumPostingAgeDays
  ) {
    return { continue: false, reason: 'results exceed the profile posting-age limit' }
  }
  return { continue: true, reason: 'more pages are eligible' }
}

export function queryYieldScore(input: {
  priority: number
  lastRunAt?: string | null
  lastResultCount?: number
  lastNewJobCount?: number
  now?: Date
}): number {
  const now = input.now ?? new Date()
  const lastRun = input.lastRunAt ? new Date(input.lastRunAt).getTime() : 0
  const hoursSinceRun = lastRun > 0 ? Math.max(0, (now.getTime() - lastRun) / 3_600_000) : 168
  const yieldRate = (input.lastNewJobCount ?? 0) / Math.max(input.lastResultCount ?? 0, 1)
  return Math.round((1000 - input.priority * 3 + Math.min(hoursSinceRun, 168) * 2 + yieldRate * 500) * 100) / 100
}
