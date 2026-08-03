import { classifyRemoteType } from '../../../../shared/discovery/normalize.ts'
import type { JobProviderAdapter, ProviderDiscoveryContext, ProviderPage } from '../../../../shared/discovery/types.ts'
import { joinLocation, makePosting, requestJson } from './common.ts'

interface AdzunaJob {
  id?: string | number
  title?: string
  description?: string
  redirect_url?: string
  adref?: string
  created?: string
  contract_time?: string
  contract_type?: string
  salary_min?: number
  salary_max?: number
  company?: { display_name?: string }
  location?: { display_name?: string; area?: string[] }
  category?: { label?: string; tag?: string }
}

interface AdzunaResponse {
  count?: number
  results?: AdzunaJob[]
  mean?: number
}

export const adzunaAdapter: JobProviderAdapter = {
  provider: 'adzuna',
  async *discover(context: ProviderDiscoveryContext): AsyncGenerator<ProviderPage> {
    const query = context.query
    if (!query) throw new Error('Adzuna discovery requires a search-profile query.')
    const appId = context.credentials?.ADZUNA_APP_ID
    const appKey = context.credentials?.ADZUNA_APP_KEY
    if (!appId || !appKey) throw new Error('Adzuna credentials are not configured.')

    const pageSize = Math.min(Math.max(context.pageSize ?? 50, 1), 50)
    const maxPages = Math.max(context.maxPages ?? 3, 1)
    const country = (context.countryCode ?? 'CA').toLowerCase()

    for (let page = 1; page <= maxPages; page += 1) {
      const params = new URLSearchParams({
        app_id: appId,
        app_key: appKey,
        what: query.queryText,
        results_per_page: String(pageSize),
        content_type: 'jobs',
        sort_by: 'date',
      })
      if (query.location) params.set('where', query.location)
      const url = `https://api.adzuna.com/v1/api/jobs/${encodeURIComponent(country)}/search/${page}?${params}`
      const response = await requestJson<AdzunaResponse>(url, {
        fetchImpl: context.fetchImpl,
        signal: context.signal,
      })
      if (!response.data) {
        const error = new Error(`Adzuna request failed: ${response.error ?? response.status}`)
        Object.assign(error, { status: response.status, retryAfterSeconds: response.retryAfterSeconds })
        throw error
      }

      const results = response.data.results ?? []
      const postings = results
        .filter((job) => job.id != null && job.title)
        .map((job) => {
          const location = joinLocation([
            job.location?.display_name,
            ...(job.location?.area ?? []),
          ])
          const remoteType = classifyRemoteType({
            title: job.title,
            location,
            description: job.description,
          })
          return makePosting({
            provider: 'adzuna',
            externalId: job.id,
            companyName: job.company?.display_name ?? 'Unknown',
            title: job.title,
            location,
            remote: remoteType === 'remote',
            remoteType,
            description: job.description,
            sourceUrl: job.redirect_url ?? job.adref,
            applyUrl: job.redirect_url ?? job.adref,
            postedAt: job.created,
            employmentType: job.contract_time ?? job.contract_type,
            seniority: job.title,
            salaryMin: job.salary_min,
            salaryMax: job.salary_max,
            salaryCurrency: country === 'ca' ? 'CAD' : null,
            rawPayload: job as unknown as Record<string, unknown>,
            searchProfileId: query.searchProfileId,
          })
        })

      const total = response.data.count ?? (page - 1) * pageSize + results.length
      const complete = results.length < pageSize || page * pageSize >= total
      yield {
        postings,
        nextCursor: complete ? null : String(page + 1),
        completeSnapshot: false,
        requestsUsed: 1,
        httpStatus: response.status,
        rateLimitRemaining: Number(response.headers.get('x-ratelimit-remaining')) || null,
        retryAfterSeconds: response.retryAfterSeconds,
      }
      if (complete) return
    }
  },
}
