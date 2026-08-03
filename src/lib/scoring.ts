import { scoreJob, toLegacyFitResult } from '../../shared/discovery/scoring'
import type { SearchProfile } from '../../shared/discovery/types'
import { DEFAULT_PROFILE, type Profile } from './profile'

export interface FitResult {
  score: number
  reasons: string[]
  tier?: 'strong' | 'good' | 'review' | 'weak'
}

function legacyProfileToSearchProfile(profile: Profile): SearchProfile {
  return {
    name: profile.name,
    slug: 'legacy-primary-profile',
    remotePolicy: profile.constraints.remote_ok ? 'remote_or_local' : 'local_only',
    locations: profile.constraints.locations,
    employmentTypes: [],
    primaryTitles: profile.target_titles,
    titleAliases: [],
    requiredTerms: [],
    preferredTerms: [
      ...profile.skills,
      ...profile.industries,
      ...(profile.keywords_boost ?? []),
    ],
    excludedTerms: profile.keywords_penalty ?? [],
    excludedCompanies: [],
    maximumPostingAgeDays: 60,
    minimumSalaryCad: profile.constraints.min_comp_cad,
    sourcePriority: {
      greenhouse: 100,
      lever: 100,
      ashby: 100,
      smartrecruiters: 100,
      manual: 90,
      linkedin: 80,
      adzuna: 60,
      remoteok: 50,
    },
  }
}

/**
 * Compatibility entrypoint used by existing job, LinkedIn, and rescore flows.
 * The implementation is shared with the Edge Function through Job Discovery V2.
 */
export function scoreJobAgainstProfile(
  job: {
    title: string
    description?: string | null
    location?: string | null
    remote?: boolean | null
  },
  profile: Profile = DEFAULT_PROFILE
): FitResult {
  const result = scoreJob({
    title: job.title,
    description: job.description,
    location: job.location,
    remote: job.remote,
    remoteType: job.remote ? 'remote' : 'unknown',
    lifecycleStatus: 'open',
  }, legacyProfileToSearchProfile(profile), {
    experienceTerms: profile.skills,
    industryTerms: profile.industries,
  })

  return toLegacyFitResult(result)
}

export { scoreJob, toLegacyFitResult }
export type { SearchProfile }
