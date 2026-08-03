import { classifyRemoteType } from '../../../../shared/discovery/normalize.ts'
import type { JobProviderAdapter, ProviderDiscoveryContext, ProviderPage } from '../../../../shared/discovery/types.ts'
import { makePosting, requestJson } from './common.ts'

interface RemoteOkJob {
  id?: string | number
  position?: string
  company?: string
  location?: string
  description?: string
  tags?: string[]
  url?: string
  apply_url?: string
  date?: string | number
  epoch?: number
  salary_min?: number
  salary_max?: number
}

export const remoteOkAdapter: JobProviderAdapter = {
  provider: 'remoteok',
  async *discover(context: ProviderDiscoveryContext): AsyncGenerator<ProviderPage> {
    const query = context.query
    if (!query) throw new Error('RemoteOK discovery requires a search-profile query.')
    const response = await requestJson<RemoteOkJob[]>('https://remoteok.com/api', {
      fetchImpl: context.fetchImpl,
      signal: context.signal,
    })
    if (!response.data) throw new Error(`RemoteOK request failed: ${response.error ?? response.status}`)

    const terms = query.queryText.toLowerCase().split(/\s+/).filter((term) => term.length > 2)
    const postings = response.data
      .filter((job) => job.id != null && job.position)
      .filter((job) => {
        const blob = `${job.position ?? ''} ${job.description ?? ''} ${(job.tags ?? []).join(' ')}`.toLowerCase()
        return terms.length === 0 || terms.every((term) => blob.includes(term))
      })
      .slice(0, context.pageSize ?? 100)
      .map((job) => {
        const remoteType = classifyRemoteType({
          remote: true,
          title: job.position,
          location: job.location ?? 'Remote',
          description: job.description,
          workplaceType: 'remote',
        })
        const postedAt = job.epoch
          ? new Date(job.epoch * 1000).toISOString()
          : job.date
        return makePosting({
          provider: 'remoteok',
          externalId: job.id,
          companyName: job.company ?? 'Unknown',
          title: job.position,
          location: job.location ?? 'Remote',
          remote: true,
          remoteType,
          description: job.description,
          sourceUrl: job.url,
          applyUrl: job.apply_url ?? job.url,
          postedAt,
          employmentType: null,
          seniority: job.position,
          salaryMin: job.salary_min,
          salaryMax: job.salary_max,
          salaryCurrency: 'USD',
          rawPayload: job as unknown as Record<string, unknown>,
          searchProfileId: query.searchProfileId,
        })
      })

    yield {
      postings,
      nextCursor: null,
      completeSnapshot: false,
      requestsUsed: 1,
      httpStatus: response.status,
    }
  },
}
