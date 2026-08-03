import type { RemoteType } from './types'

export function normalizeText(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9+#.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function stripHtml(value: string | null | undefined): string {
  return (value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

export function normalizeUrl(value: string | null | undefined): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    url.hash = ''
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|gh_src|lever-source|source|ref|trk)/i.test(key)) {
        url.searchParams.delete(key)
      }
    }
    url.hostname = url.hostname.toLowerCase()
    url.pathname = url.pathname.replace(/\/+$/, '') || '/'
    return url.toString()
  } catch {
    return value.trim() || null
  }
}

export function classifyRemoteType(input: {
  remote?: boolean | null
  title?: string | null
  location?: string | null
  description?: string | null
  workplaceType?: string | null
}): RemoteType {
  const workplace = normalizeText(input.workplaceType)
  const blob = normalizeText(
    [input.title, input.location, input.description, input.workplaceType]
      .filter(Boolean)
      .join(' ')
  )

  if (workplace.includes('hybrid') || /\bhybrid\b/.test(blob)) return 'hybrid'
  if (
    input.remote === true ||
    workplace.includes('remote') ||
    /\b(remote|work from home|wfh|distributed)\b/.test(blob)
  ) return 'remote'
  if (workplace.includes('on site') || workplace.includes('onsite')) return 'onsite'
  if (blob) return 'onsite'
  return 'unknown'
}

export function normalizeEmploymentType(value: string | null | undefined): string | null {
  const normalized = normalizeText(value)
  if (!normalized) return null
  if (/full.?time/.test(normalized)) return 'full_time'
  if (/part.?time/.test(normalized)) return 'part_time'
  if (/contract|contractor|temporary|fixed term/.test(normalized)) return 'contract'
  if (/intern/.test(normalized)) return 'internship'
  if (/casual/.test(normalized)) return 'casual'
  return normalized.replace(/\s+/g, '_')
}

export function normalizeSeniority(value: string | null | undefined): string | null {
  const normalized = normalizeText(value)
  if (!normalized) return null
  if (/chief|c level|executive|vice president|\bvp\b/.test(normalized)) return 'executive'
  if (/director|head of/.test(normalized)) return 'director'
  if (/senior|sr\b|lead|principal/.test(normalized)) return 'senior'
  if (/manager|management/.test(normalized)) return 'manager'
  if (/junior|entry|associate|graduate/.test(normalized)) return 'junior'
  return 'individual_contributor'
}

export function parseDate(value: unknown): string | null {
  if (value == null || value === '') return null
  const date = value instanceof Date ? value : new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export function finiteNumber(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function stableHash(value: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export function contentHash(parts: Array<string | null | undefined>): string {
  return stableHash(parts.map((part) => normalizeText(part)).join('|'))
}
