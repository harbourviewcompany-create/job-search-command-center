import { classifyRemoteType } from '../../../../shared/discovery/normalize.ts'
import type { JobProviderAdapter, ProviderDiscoveryContext, ProviderPage } from '../../../../shared/discovery/types.ts'
import { joinLocation, makePosting, requestJson } from './common.ts'

interface GreenhouseJob {
  id: number | string
  internal_job_id?: number | string | null
  title?: string
  updated_at?: string
  location?: { name?: string }
  absolute_url?: string
  content?: string
  departments?: Array<{ name?: string }>
  offices?: Array<{ name?: string; location?: string }>
  metadata?: unknown
}

interface GreenhouseResponse {
  jobs?: GreenhouseJob[]
  meta?: { total?: number }
}

export const greenhouseAdapter: JobProviderAdapter = {
  provider: 'greenhouse',
  async *discover(context: ProviderDiscoveryContext): AsyncGenerator<ProviderPage> {
    const source = context.companySource
    if (!source) throw new Error('Greenhouse discovery requires a company source.')
    const base = source.apiBaseUrl?.replace(/\/$/, '') ?? 'https://boards-api.greenhouse.io/v1/boards'
    const url = `${base}/${encodeURIComponent(source.boardKey)}/jobs?content=true`
    const response = await requestJson<GreenhouseResponse>(url, {
      fetchImpl: context.fetchImpl,
      signal: context.signal,
      headers: {
        ...(source.etag ? { 'If-None-Match': source.etag } : {}),
        ...(source.lastModified ? { 'If-Modified-Since': source.lastModified } : {}),
      },
    })
    if (response.status === 304) {
      yield {
        postings: [],
        nextCursor: null,
        completeSnapshot: false,
        requestsUsed: 1,
        httpStatus: 304,
      }
      return
    }
    if (!response.data) throw new Error(`Greenhouse request failed: ${response.error ?? response.status}`)

    const postings = (response.data.jobs ?? [])
      .filter((job) => job.id != null && job.title)
      .map((job) => {
        const officeLocations = (job.offices ?? []).flatMap((office) => [office.name, office.location])
        const location = joinLocation([job.location?.name, ...officeLocations])
        const remoteType = classifyRemoteType({
          title: job.title,
          location,
          description: job.content,
        })
        return makePosting({
          provider: 'greenhouse',
          externalId: job.id,
          companyName: source.companyName,
          title: job.title,
          location,
          remote: remoteType === 'remote',
          remoteType,
          description: job.content,
          sourceUrl: job.absolute_url,
          applyUrl: job.absolute_url,
          postedAt: job.updated_at,
          employmentType: null,
          seniority: job.title,
          rawPayload: job as unknown as Record<string, unknown>,
          companyJobSourceId: source.id,
        })
      })

    yield {
      postings,
      nextCursor: null,
      completeSnapshot: true,
      requestsUsed: 1,
      httpStatus: response.status,
    }
  },
}
