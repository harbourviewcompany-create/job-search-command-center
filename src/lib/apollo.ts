/**
 * Apollo.io people search (Phase 3).
 * Requires APOLLO_API_KEY. Never auto-emails — lookup only.
 *
 * Docs: https://docs.apollo.io/reference/people-api-search
 */

export interface ApolloPerson {
  name: string
  title: string | null
  email: string | null
  linkedin_url: string | null
  organization_name: string | null
  apollo_id: string | null
}

export interface ApolloSearchParams {
  companyName: string
  titles?: string[]
  limit?: number
}

export async function searchApolloPeople(
  params: ApolloSearchParams
): Promise<{ people: ApolloPerson[]; error?: string }> {
  const apiKey = process.env.APOLLO_API_KEY
  if (!apiKey) {
    return {
      people: [],
      error: 'APOLLO_API_KEY is not set. Add it in Vercel / .env.local.',
    }
  }

  const titles =
    params.titles && params.titles.length > 0
      ? params.titles
      : [
          'hiring manager',
          'head of sales',
          'director of business development',
          'vp sales',
          'recruiter',
          'talent acquisition',
        ]

  try {
    const res = await fetch('https://api.apollo.io/api/v1/mixed_people/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'X-Api-Key': apiKey,
      },
      body: JSON.stringify({
        q_organization_name: params.companyName,
        person_titles: titles,
        page: 1,
        per_page: Math.min(params.limit ?? 5, 10),
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      return {
        people: [],
        error: `Apollo ${res.status}: ${body.slice(0, 200)}`,
      }
    }

    const data = await res.json()
    const people: ApolloPerson[] = (data.people ?? data.contacts ?? []).map(
      (p: any) => ({
        name:
          [p.first_name, p.last_name].filter(Boolean).join(' ') ||
          p.name ||
          'Unknown',
        title: p.title ?? p.headline ?? null,
        email: p.email ?? p.email_status === 'verified' ? p.email : null,
        linkedin_url: p.linkedin_url ?? null,
        organization_name:
          p.organization?.name ?? p.organization_name ?? params.companyName,
        apollo_id: p.id ? String(p.id) : null,
      })
    )

    return { people }
  } catch (err) {
    return { people: [], error: String(err) }
  }
}
