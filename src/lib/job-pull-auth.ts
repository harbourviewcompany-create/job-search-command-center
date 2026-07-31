import 'server-only'

import { createHmac, timingSafeEqual } from 'node:crypto'

export const JOB_PULL_ACCESS_COOKIE = 'job-pull-access'
export const JOB_PULL_ACCESS_MAX_AGE_SECONDS = 12 * 60 * 60

const TOKEN_VERSION = 'v1'

function configuredServiceKey() {
  return process.env.JOB_PULL_API_KEY?.trim() || null
}

function accessSigningKey() {
  return process.env.JOB_PULL_SESSION_SECRET?.trim() || configuredServiceKey()
}

function equalStrings(left: string, right: string) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

function signature(payload: string, key: string) {
  return createHmac('sha256', key).update(payload).digest('base64url')
}

export function isJobPullAccessConfigured() {
  return Boolean(configuredServiceKey())
}

/** Validates an internal service bearer without exposing it to browser code. */
export function verifyJobPullServiceKey(token: string | null) {
  const expected = configuredServiceKey()
  return Boolean(expected && token && equalStrings(token, expected))
}

/** Creates a short-lived signed cookie token after an operator unlocks pulls. */
export function createJobPullAccessToken(now = Date.now()) {
  const key = accessSigningKey()
  if (!key) return null

  const expiresAt = Math.floor(now / 1000) + JOB_PULL_ACCESS_MAX_AGE_SECONDS
  const payload = `${TOKEN_VERSION}.${expiresAt}`
  return `${payload}.${signature(payload, key)}`
}

/** Validates the HttpOnly browser-access cookie used by the single-user app. */
export function verifyJobPullAccessToken(token: string | null, now = Date.now()) {
  const key = accessSigningKey()
  if (!key || !token) return false

  const parts = token.split('.')
  if (parts.length !== 3) return false

  const [version, expiresAtRaw, suppliedSignature] = parts
  if (version !== TOKEN_VERSION) return false

  const expiresAt = Number.parseInt(expiresAtRaw, 10)
  if (!Number.isFinite(expiresAt) || expiresAt < Math.floor(now / 1000)) return false

  const payload = `${version}.${expiresAtRaw}`
  return equalStrings(suppliedSignature, signature(payload, key))
}
