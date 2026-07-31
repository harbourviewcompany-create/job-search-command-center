const WINDOWS_1252_BYTES = new Map([
  [0x20ac, 0x80],
  [0x201a, 0x82],
  [0x0192, 0x83],
  [0x201e, 0x84],
  [0x2026, 0x85],
  [0x2020, 0x86],
  [0x2021, 0x87],
  [0x02c6, 0x88],
  [0x2030, 0x89],
  [0x0160, 0x8a],
  [0x2039, 0x8b],
  [0x0152, 0x8c],
  [0x017d, 0x8e],
  [0x2018, 0x91],
  [0x2019, 0x92],
  [0x201c, 0x93],
  [0x201d, 0x94],
  [0x2022, 0x95],
  [0x2013, 0x96],
  [0x2014, 0x97],
  [0x02dc, 0x98],
  [0x2122, 0x99],
  [0x0161, 0x9a],
  [0x203a, 0x9b],
  [0x0153, 0x9c],
  [0x017e, 0x9e],
  [0x0178, 0x9f],
])

const MOJIBAKE_PATTERN = /(?:Ã.|Â.|â.|ð.|Ø.|Ù.|Ð.|Ñ.|�)/g
const CONTROL_CHAR_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g

function suspiciousScore(value) {
  return (value.match(MOJIBAKE_PATTERN)?.length ?? 0) * 3 +
    (value.match(CONTROL_CHAR_PATTERN)?.length ?? 0) * 5 +
    (value.match(/�/g)?.length ?? 0) * 10
}

function windows1252Bytes(value) {
  const bytes = []

  for (const character of value) {
    const codePoint = character.codePointAt(0)
    if (codePoint === undefined) return null

    if (codePoint <= 0xff) {
      bytes.push(codePoint)
      continue
    }

    const mappedByte = WINDOWS_1252_BYTES.get(codePoint)
    if (mappedByte === undefined) return null
    bytes.push(mappedByte)
  }

  return Uint8Array.from(bytes)
}

function decodeMojibakePass(value) {
  const bytes = windows1252Bytes(value)
  if (!bytes) return value

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return value
  }
}

/**
 * Repairs common UTF-8 text that was decoded as Windows-1252 one or more times.
 * It is conservative: a decoded candidate is accepted only when it reduces
 * known corruption markers.
 */
export function repairMojibake(input) {
  if (typeof input !== 'string' || input.length === 0) return input ?? ''

  let value = input
  for (let pass = 0; pass < 2; pass += 1) {
    if (suspiciousScore(value) === 0) break
    const candidate = decodeMojibakePass(value)
    if (candidate === value || suspiciousScore(candidate) >= suspiciousScore(value)) break
    value = candidate
  }

  return value
}

/** Normalizes text for safe, stable UI display without changing stored data. */
export function normalizeDisplayText(input, fallback = '') {
  if (typeof input !== 'string') return fallback

  const normalized = repairMojibake(input)
    .replace(CONTROL_CHAR_PATTERN, '')
    .replace(/\s+/g, ' ')
    .trim()
    .normalize('NFC')

  return normalized || fallback
}
