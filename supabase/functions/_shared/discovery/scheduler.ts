import { queryYieldScore } from '../../../../shared/discovery/budget.ts'
import type { CompanyJobSource, DiscoveryQuery } from '../../../../shared/discovery/types.ts'

export function scheduleQueries(queries: DiscoveryQuery[], now = new Date()): DiscoveryQuery[] {
  return [...queries].sort((left, right) => {
    return queryYieldScore({
      priority: right.priority,
      lastRunAt: right.lastRunAt,
      lastResultCount: right.lastResultCount,
      lastNewJobCount: right.lastNewJobCount,
      now,
    }) - queryYieldScore({
      priority: left.priority,
      lastRunAt: left.lastRunAt,
      lastResultCount: left.lastResultCount,
      lastNewJobCount: left.lastNewJobCount,
      now,
    })
  })
}

export function sourceIsDue(
  source: CompanyJobSource & { lastCheckedAt?: string | null; pollIntervalMinutes?: number },
  now = new Date()
): boolean {
  if (!source.lastCheckedAt) return true
  const checked = new Date(source.lastCheckedAt).getTime()
  if (Number.isNaN(checked)) return true
  return now.getTime() - checked >= (source.pollIntervalMinutes ?? 360) * 60_000
}

export function scheduleCompanySources<T extends CompanyJobSource & {
  lastCheckedAt?: string | null
  pollIntervalMinutes?: number
}>(sources: T[], now = new Date()): T[] {
  // A source-specific API request filters the registry to one record before
  // scheduling. Always include that single source so “Poll source” is a real
  // forced verification even when its normal cadence has not elapsed.
  const eligible = sources.length === 1
    ? [...sources]
    : sources.filter((source) => sourceIsDue(source, now))

  return eligible.sort((left, right) => {
    if (left.priority !== right.priority) return left.priority - right.priority
    const leftTime = left.lastCheckedAt ? new Date(left.lastCheckedAt).getTime() : 0
    const rightTime = right.lastCheckedAt ? new Date(right.lastCheckedAt).getTime() : 0
    return leftTime - rightTime
  })
}
