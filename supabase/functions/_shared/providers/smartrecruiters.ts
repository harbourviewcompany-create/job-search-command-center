import { classifyRemoteType } from '../../../../shared/discovery/normalize.ts'
import type { JobProviderAdapter, ProviderDiscoveryContext, ProviderPage } from '../../../../shared/discovery/types.ts'
import { joinLocation, makePosting, requestJson } from './common.ts'

interface SmartLabel {
  id?: string
  label?: string
}

interface SmartPosting {
  id?: string
  uuid?: string
  name?: string
  refNumber?: string
  releasedDate?: string
  postingUrl?: string
  applyUrl?: string
  ref?: string
  company?: { identifier?: string; name?: string }
  location?: {
    city?: string
    region?: string
    country?: string
    remote?: boolean
  }
  department?: SmartLabel
  function?: SmartLabel
  experienceLevel?: SmartLabel
  typeOfEmployment?: SmartLabel
  jobAd?: {
    sections?: Record<string, { title?: string; text?: string } | string | null>
  }
}

interface SmartListResponse {
  limit?: number
  offset?: number
  totalFound?: number
  content?: SmartPosting[]
}

function descriptionFromPosting(posting: SmartPosting): string | null {
  const sections = posting.jobAd?.sections
  if (!sections) return null
  const values = Object.values(sections)
    .map((section) => {
      if (typeof section === 'string') return section
      return section?.text ?? ''
    })
    .filter(Boolean)
  return values.length > 0 ? values.join('\n\n') : null
}

export const smartRecruitersAdapter: JobProviderAdapter = {
  provider: 'smartrecruiters',
  async *discover(context: ProviderDiscoveryContext): AsyncGenerator<ProviderPage> {
    const source = context.companySource
    if (!source) throw new Error('SmartRecruiters discovery requires a company source.')
    const pageSize = Math.min(Math.max(context.pageSize ?? 100, 1), 100)
    const maxPages = Math.max(context.maxPages ?? 20, 1)
    const base = source.apiBaseUrl?.replace(/\/$/, '') ?? 'https://api.smartrecruiters.com/v1/companies'

    for (let page = 0; page < maxPages; page += 1) {
      const offset = page * pageSize
      const url = new URL(`${base}/${encodeURIComponent(source.boardKey)}/postings`)
      url.searchParams.set('limit', String(pageSize))
      url.searchParams.set('offset', String(offset))
      url.searchParams.set('destination', 'PUBLIC')
      const response = await requestJson<SmartListResponse>(url.toString(), {
        fetchImpl: context.fetchImpl,
        signal: context.signal,
      })
      if (!response.data) {
        throw new Error(`SmartRecruiters request failed: ${response.error ?? response.status}`)
      }

      const content = response.data.content ?? []
      const postings = content
        .filter((job) => job.name && (job.uuid || job.id))
        .map((job) => {
          const location = joinLocation([
            job.location?.city,
            job.location?.region,
            job.location?.country,
          ])
          const description = descriptionFromPosting(job)
          const remoteType = classifyRemoteType({
            title: job.name,
            location,
            description,
            workplaceType: job.location?.remote ? 'remote' : null,
          })
          return makePosting({
            provider: 'smartrecruiters',
            externalId: job.uuid ?? job.id,
            companyName: job.company?.name ?? source.companyName,
            title: job.name,
            location,
            remote: job.location?.remote ?? remoteType === 'remote',
            remoteType,
            description,
            sourceUrl: job.postingUrl ?? job.ref,
            applyUrl: job.applyUrl,
            postedAt: job.releasedDate,
            employmentType: job.typeOfEmployment?.label,
            seniority: job.experienceLevel?.label ?? job.name,
            rawPayload: job as unknown as Record<string, unknown>,
            companyJobSourceId: source.id,
          })
        })

      const total = response.data.totalFound ?? offset + content.length
      const complete = offset + content.length >= total || content.length < pageSize
      yield {
        postings,
        nextCursor: complete ? null : String(offset + pageSize),
        completeSnapshot: complete,
        requestsUsed: 1,
        httpStatus: response.status,
      }
      if (complete) return
    }
  },
}
