import { NextRequest, NextResponse } from 'next/server'
import {
  createJobPullAccessToken,
  isJobPullAccessConfigured,
  JOB_PULL_ACCESS_COOKIE,
  JOB_PULL_ACCESS_MAX_AGE_SECONDS,
  verifyJobPullAccessToken,
  verifyJobPullServiceKey,
} from '@/lib/job-pull-auth'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

function secureCookie(request: Request) {
  return new URL(request.url).protocol === 'https:'
}

/** Reports whether the browser authorization can actually be revoked by DELETE. */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  const sessionAuthorized = !error && Boolean(data.user)
  const cookieAuthorized = verifyJobPullAccessToken(
    request.cookies.get(JOB_PULL_ACCESS_COOKIE)?.value ?? null
  )

  return NextResponse.json({
    ok: true,
    sessionAuthorized,
    cookieAuthorized,
    canLock: cookieAuthorized && !sessionAuthorized,
  })
}

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
    secure: secureCookie(request),
    path: '/',
    maxAge: JOB_PULL_ACCESS_MAX_AGE_SECONDS,
  })
  return response
}

export async function DELETE(request: Request) {
  const response = NextResponse.json({ ok: true })
  response.cookies.set(JOB_PULL_ACCESS_COOKIE, '', {
    httpOnly: true,
    sameSite: 'strict',
    secure: secureCookie(request),
    path: '/',
    maxAge: 0,
  })
  return response
}
