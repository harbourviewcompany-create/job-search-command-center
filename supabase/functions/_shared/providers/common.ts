import { contentHash, finiteNumber, normalizeEmploymentType, normalizeSeniority, parseDate, stripHtml } from '../../../../shared/discovery/normalize.ts'
import type { NormalizedSourcePosting, RemoteType } from '../../../../shared/discovery/types.ts'

export interface JsonResponse<T> {
  data: T | null
  status: number
  headers: Headers
  retryAfterSeconds: number | null
  error: string | null
}

export async function requestJson<T>(
  url: string,
  input: RequestInit & { fetchImpl?: typeof fetch; timeoutMs?: number } = {}
): Promise<JsonResponse<T>> {
  const { fetchImpl = fetch, timeoutMs = 15_000, signal: callerSignal, ...init } = input
  const controller = new AbortController()
  const abortFromCaller = () => controller.abort(callerSignal?.reason)
  if (callerSignal?.aborted) abortFromCaller()
  callerSignal?.addEventListener('abort', abortFromCaller, { once: true })
  const timeout = setTimeout(() => controller.abort(new Error(`Provider request timed out after ${timeoutMs}ms.`)), timeoutMs)

  try {
    const response = await fetchImpl(url, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'JobSearchCommandCenter/2.0',
        ...(init.headers ?? {}),
      },
    })
    const retryAfter = response.headers.get('retry-after')
    const retryAfterSeconds = retryAfter == null
      ? null
      : Number.isFinite(Number(retryAfter))
        ? Number(retryAfter)
        : Math.max(0, (new Date(retryAfter).getTime() - Date.now()) / 1000)
    const text = await response.text()
    if (!response.ok) {
      return {
        data: null,
        status: response.status,
        headers: response.headers,
        retryAfterSeconds,
        error: text.slice(0, 1000) || `HTTP ${response.status}`,
      }
    }
    return {
      data: text ? JSON.parse(text) as T : ({} as T),
      status: response.status,
      headers: response.headers,
      retryAfterSeconds,
      error: null,
    }
  } catch (error) {
    const message = controller.signal.aborted && !callerSignal?.aborted
      ? `Provider request timed out after ${timeoutMs}ms.`
      : error instanceof Error ? error.message : String(error)
    return {
      data: null,
      status: 0,
      headers: new Headers(),
      retryAfterSeconds: null,
      error: message,
    }
  } finally {
    clearTimeout(timeout)
    callerSignal?.removeEventListener('abort', abortFromCaller)
  }
}

export function joinLocation(parts: Array<string | null | undefined>): string | null {
  const values = [...new Set(parts.map((part) => part?.trim()).filter(Boolean) as string[])]
  return values.length > 0 ? values.join(', ') : null
}

export function makePosting(input: {
  provider: NormalizedSourcePosting['provider']
  externalId: unknown
  companyName: unknown
  title: unknown
  location?: unknown
  remote?: boolean
  remoteType?: RemoteType
  description?: unknown
  sourceUrl?: unknown
  applyUrl?: unknown
  postedAt?: unknown
  employmentType?: unknown
  seniority?: unknown
  salaryMin?: unknown
  salaryMax?: unknown
  salaryCurrency?: unknown
  rawPayload: Record<string, unknown>
  companyJobSourceId?: string | null
  searchProfileId?: string | null
}): NormalizedSourcePosting {
  const title = String(input.title ?? 'Untitled').trim() || 'Untitled'
  const companyName = String(input.companyName ?? 'Unknown').trim() || 'Unknown'
  const location = input.location == null ? null : String(input.location).trim() || null
  const description = input.description == null ? null : stripHtml(String(input.description)) || null
  const sourceUrl = input.sourceUrl == null ? null : String(input.sourceUrl)
  const applyUrl = input.applyUrl == null ? sourceUrl : String(input.applyUrl)
  const employmentType = normalizeEmploymentType(input.employmentType == null ? null : String(input.employmentType))
  const seniority = normalizeSeniority(input.seniority == null ? title : String(input.seniority))
  const remoteType = input.remoteType ?? (input.remote ? 'remote' : 'unknown')

  return {
    provider: input.provider,
    externalId: String(input.externalId),
    companyName,
    title,
    location,
    remote: input.remote ?? remoteType === 'remote',
    remoteType,
    description,
    sourceUrl,
    applyUrl,
    postedAt: parseDate(input.postedAt),
    employmentType,
    seniority,
    salaryMin: finiteNumber(input.salaryMin),
    salaryMax: finiteNumber(input.salaryMax),
    salaryCurrency: input.salaryCurrency == null || input.salaryCurrency === ''
      ? null
      : String(input.salaryCurrency).toUpperCase(),
    contentHash: contentHash([title, companyName, location, description, sourceUrl, applyUrl]),
    rawPayload: input.rawPayload,
    companyJobSourceId: input.companyJobSourceId ?? null,
    searchProfileId: input.searchProfileId ?? null,
  }
}
