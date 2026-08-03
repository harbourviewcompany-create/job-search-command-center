import { classifyRemoteType } from '../../../../shared/discovery/normalize.ts'
import type { JobProviderAdapter, ProviderDiscoveryContext, ProviderPage } from '../../../../shared/discovery/types.ts'
import { joinLocation, makePosting, requestJson } from './common.ts'

interface AshbyCompensationTier {
  minSalary?: number
  maxSalary?: number
  currencyCode?: string
}

interface AshbyJob {
  id?: string
  title?: string
  location?: string
  secondaryLocations?: Array<{ location?: string }>
  department?: string
  team?: string
  employmentType?: string
  workplaceType?: string
  publishedAt?: string
  jobUrl?: string
  applyUrl?: string
  descriptionHtml?: string
  descriptionPlain?: string
  isListed?: boolean
  compensation?: {
    compensationTiers?: AshbyCompensationTier[]
    scrapeableCompensationSalarySummary?: string
  }
}

interface AshbyResponse {
  apiVersion?: string
  jobs?: AshbyJob[]
}

export const ashbyAdapter: JobProviderAdapter = {
  provider: 'ashby',
  async *discover(context: ProviderDiscoveryContext): AsyncGenerator<ProviderPage> {
    const source = context.companySource
    if (!source) throw new Error('Ashby discovery requires a company source.')
    const base = source.apiBaseUrl?.replace(/\/$/, '') ?? 'https://api.ashbyhq.com/posting-api/job-board'
    const url = `${base}/${encodeURIComponent(source.boardKey)}?includeCompensation=true`
    const response = await requestJson<AshbyResponse>(url, {
      fetchImpl: context.fetchImpl,
      signal: context.signal,
    })
    if (!response.data) throw new Error(`Ashby request failed: ${response.error ?? response.status}`)

    const postings = (response.data.jobs ?? [])
      .filter((job) => job.isListed !== false && job.title && (job.id || job.jobUrl))
      .map((job) => {
        const tiers = job.compensation?.compensationTiers ?? []
        const salaryTier = tiers.find((tier) => tier.minSalary != null || tier.maxSalary != null)
        const location = joinLocation([
          job.location,
          ...(job.secondaryLocations ?? []).map((entry) => entry.location),
        ])
        const remoteType = classifyRemoteType({
          title: job.title,
          location,
          description: job.descriptionPlain ?? job.descriptionHtml,
          workplaceType: job.workplaceType,
        })
        return makePosting({
          provider: 'ashby',
          externalId: job.id ?? job.jobUrl,
          companyName: source.companyName,
          title: job.title,
          location,
          remote: remoteType === 'remote',
          remoteType,
          description: job.descriptionPlain ?? job.descriptionHtml,
          sourceUrl: job.jobUrl,
          applyUrl: job.applyUrl,
          postedAt: job.publishedAt,
          employmentType: job.employmentType,
          seniority: job.title,
          salaryMin: salaryTier?.minSalary,
          salaryMax: salaryTier?.maxSalary,
          salaryCurrency: salaryTier?.currencyCode,
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
