import 'server-only'

import { createHmac, timingSafeEqual } from 'node:crypto'

const TOKEN_VERSION = 'v1'
const TOKEN_TTL_SECONDS = 10 * 60

function signingKey() {
  return process.env.JOB_PULL_API_KEY?.trim() || null
}

function signature(payload: string, key: string) {
  return createHmac('sha256', key).update(payload).digest('base64url')
}

/** Creates a short-lived signed token without exposing the service-level key. */
export function createJobPullToken(now = Date.now()) {
  const key = signingKey()
  if (!key) return null

  const expiresAt = Math.floor(now / 1000) + TOKEN_TTL_SECONDS
  const payload = `${TOKEN_VERSION}.${expiresAt}`
  return `${payload}.${signature(payload, key)}`
}

/** Validates the signed token used by the internal job-pull button. */
export function verifyJobPullToken(token: string | null, now = Date.now()) {
  const key = signingKey()
  if (!key || !token) return false

  const [version, expiresAtRaw, suppliedSignature, ...extra] = token.split('.')
  if (extra.length > 0 || version !== TOKEN_VERSION || !expiresAtRaw || !suppliedSignature) {
    return false
  }

  const expiresAt = Number.parseInt(expiresAtRaw, 10)
  if (!Number.isFinite(expiresAt) || expiresAt < Math.floor(now / 1000)) return false

  const payload = `${version}.${expiresAtRaw}`
  const expectedSignature = signature(payload, key)
  const supplied = Buffer.from(suppliedSignature)
  const expected = Buffer.from(expectedSignature)

  return supplied.length === expected.length && timingSafeEqual(supplied, expected)
}
