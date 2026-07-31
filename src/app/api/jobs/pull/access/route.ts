import { NextResponse } from 'next/server'
import {
  createJobPullAccessToken,
  isJobPullAccessConfigured,
  JOB_PULL_ACCESS_COOKIE,
  JOB_PULL_ACCESS_MAX_AGE_SECONDS,
  verifyJobPullServiceKey,
} from '@/lib/job-pull-auth'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  if (!isJobPullAccessConfigured()) {
    return NextResponse.json(
      { ok: false, error: 'Manual job-pull access is not configured.' },
      { status: 503 }
    )
  }

  let key = ''
  try {
    const body = (await request.json()) as { key?: unknown }
    key = typeof body.key === 'string' ? body.key.trim() : ''
  } catch {
    return NextResponse.json({ ok: false, error: 'A valid access key is required.' }, { status: 400 })
  }

  if (!verifyJobPullServiceKey(key)) {
    return NextResponse.json({ ok: false, error: 'Invalid job-pull access key.' }, { status: 401 })
  }

  const token = createJobPullAccessToken()
  if (!token) {
    return NextResponse.json(
      { ok: false, error: 'Manual job-pull access is not configured.' },
      { status: 503 }
    )
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set(JOB_PULL_ACCESS_COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: JOB_PULL_ACCESS_MAX_AGE_SECONDS,
  })
  return response
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true })
  response.cookies.set(JOB_PULL_ACCESS_COOKIE, '', {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  })
  return response
}
