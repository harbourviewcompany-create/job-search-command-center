import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'Invalid job identity.' }, { status: 400 })
  }

  // Removed once src/types/database.ts is regenerated for migrations 010–017.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any
  const [jobResult, sourceResult, scoreResult] = await Promise.all([
    supabase
      .from('jobs')
      .select('id,lifecycle_status,preferred_source,source_count,first_seen_at,last_seen_at,last_verified_at,closed_at,salary_min,salary_max,salary_currency,employment_type,seniority,remote_type,description_changed_at')
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('job_source_postings')
      .select('id,source,external_id,source_url,apply_url,lifecycle_status,first_seen_at,last_seen_at,last_verified_at,is_primary')
      .eq('job_id', id)
      .order('is_primary', { ascending: false })
      .order('last_verified_at', { ascending: false }),
    supabase
      .from('job_scores')
      .select('search_profile_id,overall_score,hard_disqualified,disqualifiers,title_score,responsibility_score,experience_score,industry_score,seniority_score,location_score,compensation_score,freshness_score,company_priority_score,source_quality_score,application_effort_score,reasons,search_profiles(name)')
      .eq('job_id', id)
      .order('hard_disqualified', { ascending: true })
      .order('overall_score', { ascending: false }),
  ])

  const error = jobResult.error ?? sourceResult.error ?? scoreResult.error
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!jobResult.data) {
    return NextResponse.json({ error: 'Job not found.' }, { status: 404 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scores = (scoreResult.data ?? []).map((score: any) => ({
    ...score,
    profile_name: Array.isArray(score.search_profiles)
      ? score.search_profiles[0]?.name ?? 'Search lane'
      : score.search_profiles?.name ?? 'Search lane',
    search_profiles: undefined,
  }))

  return NextResponse.json({
    job: jobResult.data,
    sources: sourceResult.data ?? [],
    scores,
  })
}
