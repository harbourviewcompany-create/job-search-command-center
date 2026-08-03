import { scoreJob } from '../../../../shared/discovery/scoring.ts'
import type { NormalizedSourcePosting, SearchProfile } from '../../../../shared/discovery/types.ts'
import type { SearchProfileRow } from './registry.ts'
import { toSearchProfile } from './registry.ts'

export interface IngestResult {
  jobId: string
  sourcePostingId: string
  action: 'created' | 'updated' | 'merged'
  bestScore: number | null
}

function scoringConfig(row: SearchProfileRow) {
  return (row.scoring_configs ?? [])
    .filter((config) => config.enabled)
    .sort((left, right) => right.version - left.version)[0] ?? null
}

export async function ingestPosting(
  supabase: any,
  posting: NormalizedSourcePosting,
  profileRows: SearchProfileRow[]
): Promise<IngestResult> {
  const { data, error } = await supabase.rpc('ingest_job_source_posting', {
    p_source: posting.provider,
    p_external_id: posting.externalId,
    p_company_name: posting.companyName,
    p_title: posting.title,
    p_location: posting.location,
    p_remote: posting.remote,
    p_description: posting.description,
    p_source_url: posting.sourceUrl,
    p_apply_url: posting.applyUrl,
    p_posted_at: posting.postedAt,
    p_employment_type: posting.employmentType,
    p_seniority: posting.seniority,
    p_remote_type: posting.remoteType,
    p_salary_min: posting.salaryMin,
    p_salary_max: posting.salaryMax,
    p_salary_currency: posting.salaryCurrency,
    p_company_job_source_id: posting.companyJobSourceId ?? null,
    p_search_profile_id: posting.searchProfileId ?? null,
    p_content_hash: posting.contentHash,
    p_raw_payload: posting.rawPayload,
    p_verified_at: new Date().toISOString(),
  })
  if (error) throw new Error(`Canonical ingestion failed: ${error.message}`)
  const result = Array.isArray(data) ? data[0] : data
  if (!result?.job_id || !result?.source_posting_id) {
    throw new Error('Canonical ingestion returned no job identity.')
  }

  const eligibleProfiles = posting.searchProfileId
    ? profileRows.filter((row) => row.id === posting.searchProfileId)
    : profileRows
  let bestScore: number | null = null
  let bestReasons: string[] = []
  const disqualifiedReasons: string[] = []

  for (const profileRow of eligibleProfiles) {
    const profile: SearchProfile = toSearchProfile(profileRow)
    const config = scoringConfig(profileRow)
    if (!config) continue
    const scored = scoreJob({
      title: posting.title,
      description: posting.description,
      companyName: posting.companyName,
      location: posting.location,
      remote: posting.remote,
      remoteType: posting.remoteType,
      employmentType: posting.employmentType,
      seniority: posting.seniority,
      salaryMin: posting.salaryMin,
      salaryMax: posting.salaryMax,
      salaryCurrency: posting.salaryCurrency,
      postedAt: posting.postedAt,
      preferredSource: posting.provider,
      companyPriority: posting.companyJobSourceId ? 100 : 50,
      lifecycleStatus: 'open',
    }, profile, {
      weights: config.weights,
      thresholds: config.thresholds,
    })

    const { error: scoreError } = await supabase.from('job_scores').upsert({
      job_id: result.job_id,
      search_profile_id: profileRow.id,
      scoring_config_id: config.id,
      scoring_version: config.version,
      overall_score: scored.overallScore,
      title_score: scored.dimensions.title,
      responsibility_score: scored.dimensions.responsibility,
      experience_score: scored.dimensions.experience,
      industry_score: scored.dimensions.industry,
      seniority_score: scored.dimensions.seniority,
      location_score: scored.dimensions.location,
      compensation_score: scored.dimensions.compensation,
      freshness_score: scored.dimensions.freshness,
      company_priority_score: scored.dimensions.companyPriority,
      source_quality_score: scored.dimensions.sourceQuality,
      application_effort_score: scored.dimensions.applicationEffort,
      hard_disqualified: scored.hardDisqualified,
      disqualifiers: scored.disqualifiers,
      reasons: scored.reasons,
      scored_at: new Date().toISOString(),
    }, { onConflict: 'job_id,search_profile_id,scoring_version' })
    if (scoreError) throw new Error(`Score persistence failed: ${scoreError.message}`)

    if (scored.hardDisqualified) {
      disqualifiedReasons.push(...scored.disqualifiers.map((reason) => `${profile.name}: ${reason}`))
    } else if (bestScore == null || scored.overallScore > bestScore) {
      bestScore = scored.overallScore
      bestReasons = scored.reasons
    }
  }

  const compatibility = bestScore == null
    ? { fit_score: null, fit_reasons: [...new Set(disqualifiedReasons)].slice(0, 12) }
    : { fit_score: Math.round(bestScore), fit_reasons: bestReasons }
  const { error: compatibilityError } = await supabase
    .from('jobs')
    .update(compatibility)
    .eq('id', result.job_id)
  if (compatibilityError) {
    throw new Error(`Compatibility score update failed: ${compatibilityError.message}`)
  }

  return {
    jobId: result.job_id,
    sourcePostingId: result.source_posting_id,
    action: result.ingest_action,
    bestScore,
  }
}
