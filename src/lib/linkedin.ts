/**
 * LinkedIn integration helpers
 *
 * LinkedIn does NOT provide a public Job Search API for individuals.
 * Official job APIs (Job Posting, Apply Connect, RSC) are enterprise/partner-only
 * and are oriented toward posting jobs TO LinkedIn, not searching the index.
 *
 * What we support legitimately:
 * 1. Deep links into LinkedIn Jobs search with your saved terms/locations
 * 2. Import a single job by pasting a LinkedIn job URL (+ title/company/description)
 * 3. Provider stub for future partner credentials (LINKEDIN_CLIENT_ID etc.)
 */

export interface LinkedInSearchParams {
  terms: string[]
  locations: string[]
}

/** Build LinkedIn Jobs search URLs from settings (opens in browser — user applies there). */
export function buildLinkedInJobSearchUrls(
  params: LinkedInSearchParams,
  limit = 6
): { label: string; url: string }[] {
  const terms = params.terms?.length
    ? params.terms
    : ['business development manager']
  const locations = params.locations?.length ? params.locations : ['Canada']

  const links: { label: string; url: string }[] = []

  for (const term of terms.slice(0, 4)) {
    for (const location of locations.slice(0, 2)) {
      if (links.length >= limit) break
      // LinkedIn public jobs search query params (web UI)
      const q = new URLSearchParams({
        keywords: term,
        location: location,
        f_TPR: 'r86400', // past 24 hours — good for daily triage
        sortBy: 'DD', // most recent
      })
      // Remote filter when location suggests it
      if (/remote/i.test(location)) {
        q.set('f_WT', '2') // LinkedIn remote filter (may vary by region)
      }
      links.push({
        label: `${term} · ${location}`,
        url: `https://www.linkedin.com/jobs/search/?${q.toString()}`,
      })
    }
    if (links.length >= limit) break
  }

  return links
}

/** Extract job id from common LinkedIn job URL shapes. */
export function parseLinkedInJobId(url: string): string | null {
  try {
    const u = new URL(url.trim())
    if (!u.hostname.includes('linkedin.com')) return null

    // https://www.linkedin.com/jobs/view/1234567890/
    const view = u.pathname.match(/\/jobs\/view\/(\d+)/)
    if (view) return view[1]

    // https://www.linkedin.com/jobs/collections/recommended/?currentJobId=1234567890
    const current = u.searchParams.get('currentJobId')
    if (current && /^\d+$/.test(current)) return current

    // https://www.linkedin.com/jobs/search/?currentJobId=1234567890
    const searchId = u.searchParams.get('currentJobId')
    if (searchId && /^\d+$/.test(searchId)) return searchId

    return null
  } catch {
    return null
  }
}

export function isLinkedInJobUrl(url: string): boolean {
  return parseLinkedInJobId(url) !== null || /linkedin\.com\/jobs/i.test(url)
}
