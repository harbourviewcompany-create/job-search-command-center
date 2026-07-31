import 'server-only'

import { timingSafeEqual } from 'node:crypto'

function configuredServiceKey() {
  return process.env.JOB_PULL_API_KEY?.trim() || null
}

/** Validates an internal service bearer without exposing it to browser code. */
export function verifyJobPullServiceKey(token: string | null) {
  const expected = configuredServiceKey()
  if (!expected || !token) return false

  const suppliedBuffer = Buffer.from(token)
  const expectedBuffer = Buffer.from(expected)
  return suppliedBuffer.length === expectedBuffer.length && timingSafeEqual(suppliedBuffer, expectedBuffer)
}
