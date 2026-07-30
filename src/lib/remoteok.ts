/**
 * RemoteOK free public API adapter
 * Endpoint: https://remoteok.com/api — no authentication required.
 * Source value: 'remoteok' (ensure migrations allow this source).
 */

export interface RemoteOKJob {
  id: string | number
  date?: string
  company?: string
  position?: string
  location?: string
  tags?: string[]
  description?: string
  url?: string
  apply_url?: string
  salary_min?: number
  salary_max?: number
  [key: string]: unknown
}

export interface NormalizedJob {
  source: 'remoteok'
  external_id: string
  title: string
  company_name: string
  location: string | null
  remote: boolean
  description: string | null
  url: string | null
  posted_at: string | null
  raw?: unknown
}

/**
 * Fetch and normalize RemoteOK jobs.
 * Optional tag filter examples: 'sales', 'business-development', 'b2b'
 */
export async function fetchRemoteOKJobs(options?: {
  tags?: string[]
  limit?: number
}): Promise<NormalizedJob[]> {
  const res = await fetch('https://remoteok.com/api', {
    headers: {
      'User-Agent': 'JobSearchCommandCenter/1.0 (personal use; Tyler Campbell)',
    },
  })
  if (!res.ok) {
    throw new Error(`RemoteOK fetch failed: ${res.status}`)
  }

  const data = (await res.json()) as RemoteOKJob[]
  // First element is often metadata; filter real jobs
  const jobs = data.filter((j) => j.id && j.position)

  const tagFilter = options?.tags?.map((t) => t.toLowerCase()) ?? []

  let normalized: NormalizedJob[] = jobs.map((j) => {
    const location = j.location ? String(j.location) : 'Remote'
    return {
      source: 'remoteok' as const,
      external_id: String(j.id),
      title: String(j.position || 'Untitled'),
      company_name: String(j.company || 'Unknown'),
      location,
      remote: true,
      description: j.description ? String(j.description) : null,
      url: j.url || j.apply_url ? String(j.url || j.apply_url) : null,
      posted_at: j.date
        ? new Date(Number(j.date) * 1000).toISOString().slice(0, 10)
        : null,
      raw: j,
    }
  })

  if (tagFilter.length > 0) {
    normalized = normalized.filter((job) => {
      const blob = `${job.title} ${job.description || ''}`.toLowerCase()
      const tags = ((job.raw as RemoteOKJob)?.tags || []).map((t) => String(t).toLowerCase())
      return tagFilter.some((t) => blob.includes(t) || tags.includes(t))
    })
  }

  if (options?.limit) {
    normalized = normalized.slice(0, options.limit)
  }

  return normalized
}
