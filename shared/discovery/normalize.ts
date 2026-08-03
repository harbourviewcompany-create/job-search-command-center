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
  if (
    workplace.includes('on site') ||
    workplace.includes('onsite') ||
    /\b(on site|onsite|in office|office based)\b/.test(blob)
  ) return 'onsite'
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
  if (value == null || value === '') return null
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function rotateRight(value: number, amount: number): number {
  return (value >>> amount) | (value << (32 - amount))
}

/** Deterministic synchronous SHA-256 for Edge, Node, and browser runtimes. */
export function stableHash(value: string): string {
  const bytes = new TextEncoder().encode(value)
  const bitLength = bytes.length * 8
  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64
  const padded = new Uint8Array(paddedLength)
  padded.set(bytes)
  padded[bytes.length] = 0x80
  const view = new DataView(padded.buffer)
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x1_0000_0000), false)
  view.setUint32(paddedLength - 4, bitLength >>> 0, false)

  const constants = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ])
  const state = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ])
  const words = new Uint32Array(64)

  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      words[index] = view.getUint32(offset + index * 4, false)
    }
    for (let index = 16; index < 64; index += 1) {
      const left = words[index - 15]
      const right = words[index - 2]
      const sigma0 = rotateRight(left, 7) ^ rotateRight(left, 18) ^ (left >>> 3)
      const sigma1 = rotateRight(right, 17) ^ rotateRight(right, 19) ^ (right >>> 10)
      words[index] = (words[index - 16] + sigma0 + words[index - 7] + sigma1) >>> 0
    }

    let [a, b, c, d, e, f, g, h] = state
    for (let index = 0; index < 64; index += 1) {
      const sum1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25)
      const choice = (e & f) ^ (~e & g)
      const temporary1 = (h + sum1 + choice + constants[index] + words[index]) >>> 0
      const sum0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22)
      const majority = (a & b) ^ (a & c) ^ (b & c)
      const temporary2 = (sum0 + majority) >>> 0
      h = g
      g = f
      f = e
      e = (d + temporary1) >>> 0
      d = c
      c = b
      b = a
      a = (temporary1 + temporary2) >>> 0
    }

    state[0] = (state[0] + a) >>> 0
    state[1] = (state[1] + b) >>> 0
    state[2] = (state[2] + c) >>> 0
    state[3] = (state[3] + d) >>> 0
    state[4] = (state[4] + e) >>> 0
    state[5] = (state[5] + f) >>> 0
    state[6] = (state[6] + g) >>> 0
    state[7] = (state[7] + h) >>> 0
  }

  return [...state].map((part) => part.toString(16).padStart(8, '0')).join('')
}

export function contentHash(parts: Array<string | null | undefined>): string {
  return stableHash(parts.map((part) => normalizeText(part)).join('|'))
}
