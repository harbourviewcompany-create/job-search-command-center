import { classifyRemoteType } from '../../../../shared/discovery/normalize.ts'
import type { JobProviderAdapter, ProviderDiscoveryContext, ProviderPage } from '../../../../shared/discovery/types.ts'
import { joinLocation, makePosting, requestJson } from './common.ts'

interface LeverPosting {
  id: string
  text?: string
  categories?: {
    location?: string
    allLocations?: string[]
    commitment?: string
    team?: string
    department?: string
  }
  country?: string | null
  descriptionPlain?: string
  description?: string
  openingPlain?: string
  additionalPlain?: string
  hostedUrl?: string
  applyUrl?: string
  workplaceType?: 'unspecified' | 'on-site' | 'remote' | 'hybrid'
  salaryRange?: {
    currency?: string
    interval?: string
    min?: number
    max?: number
  }
}

export const leverAdapter: JobProviderAdapter = {
  provider: 'lever',
  async *discover(context: ProviderDiscoveryContext): AsyncGenerator<ProviderPage> {
    const source = context.companySource
    if (!source) throw new Error('Lever discovery requires a company source.')
    const pageSize = Math.min(Math.max(context.pageSize ?? 100, 1), 100)
    const maxPages = Math.max(context.maxPages ?? 20, 1)
    const base = source.apiBaseUrl?.replace(/\/$/, '') ?? 'https://api.lever.co/v0/postings'

    for (let page = 0; page < maxPages; page += 1) {
      const skip = page * pageSize
      const url = new URL(`${base}/${encodeURIComponent(source.boardKey)}`)
      url.searchParams.set('mode', 'json')
      url.searchParams.set('skip', String(skip))
      url.searchParams.set('limit', String(pageSize))
      const response = await requestJson<LeverPosting[]>(url.toString(), {
        fetchImpl: context.fetchImpl,
        signal: context.signal,
      })
      if (!response.data) throw new Error(`Lever request failed: ${response.error ?? response.status}`)

      const postings = response.data.map((job) => {
        const location = joinLocation([
          job.categories?.location,
          ...(job.categories?.allLocations ?? []),
          job.country,
        ])
        const remoteType = classifyRemoteType({
          title: job.text,
          location,
          description: job.descriptionPlain ?? job.description,
          workplaceType: job.workplaceType,
        })
        return makePosting({
          provider: 'lever',
          externalId: job.id,
          companyName: source.companyName,
          title: job.text,
          location,
          remote: remoteType === 'remote',
          remoteType,
          description: [job.openingPlain, job.descriptionPlain, job.additionalPlain].filter(Boolean).join('\n\n'),
          sourceUrl: job.hostedUrl,
          applyUrl: job.applyUrl,
          postedAt: null,
          employmentType: job.categories?.commitment,
          seniority: job.text,
          salaryMin: job.salaryRange?.min,
          salaryMax: job.salaryRange?.max,
          salaryCurrency: job.salaryRange?.currency,
          rawPayload: job as unknown as Record<string, unknown>,
          companyJobSourceId: source.id,
        })
      })
      const complete = response.data.length < pageSize
      yield {
        postings,
        nextCursor: complete ? null : String(skip + pageSize),
        completeSnapshot: complete,
        requestsUsed: 1,
        httpStatus: response.status,
      }
      if (complete) return
    }
  },
}
