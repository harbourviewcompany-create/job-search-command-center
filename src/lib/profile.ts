/** Structured profile — sourced from settings.profile via getProfile(), falls back to DEFAULT_PROFILE */

import type { createClient } from '@/lib/supabase/server'

export interface Profile {
  name: string
  headline: string
  location: string
  email: string
  linkedin: string
  summary: string
  target_titles: string[]
  skills: string[]
  industries: string[]
  constraints: {
    locations: string[]
    remote_ok: boolean
    min_comp_cad: number | null
    notes: string
  }
  experience_highlights: string[]
}

export const DEFAULT_PROFILE: Profile = {
  name: 'Tyler Campbell',
  headline: 'Business Development · Account Management · International Trade',
  location: 'Ottawa, Ontario, Canada',
  email: 'harbourviewcompany@gmail.com',
  linkedin: 'linkedin.com/in/wtylercampbell',
  summary:
    'Results-driven business development and account management professional with 20+ years of experience building client relationships, opening new markets, and driving revenue across international trade, HVAC, insurance, and automotive sectors. Founder of Harbourview, a B2B market intelligence and marketplace platform.',
  target_titles: [
    'Business Development Manager',
    'Director of Business Development',
    'Account Executive',
    'Strategic Account Manager',
    'Partnerships Manager',
    'Head of Sales',
    'Market Development Manager',
    'Client Partnerships Manager',
    'Revenue Leader',
    'General Manager',
  ],
  skills: [
    'Business Development',
    'Account Management',
    'B2B Sales',
    'Client Relationship Management',
    'International Trade',
    'Market Expansion',
    'Talent Acquisition',
    'Recruiting',
    'HVAC Solutions',
    'Insurance Sales',
    'Automotive Sales',
    'Operations Management',
    'Team Leadership',
    'Revenue Growth',
    'Market Intelligence',
    'Cross-border Trade',
    'Channel Partnerships',
  ],
  industries: [
    'International Trade',
    'B2B Marketplace',
    'HVAC',
    'Insurance',
    'Automotive',
    'Recruiting / Staffing',
    'Cannabis / Licensed Operators',
    'Supply Chain',
  ],
  constraints: {
    locations: ['Ottawa', 'Ontario', 'Canada', 'Remote'],
    remote_ok: true,
    min_comp_cad: null,
    notes:
      'Open to full-time, contract, and commercial opportunities that leverage BD and network.',
  },
  experience_highlights: [
    'Founder & CEO, Harbourview — B2B market intelligence & marketplace; 6,000+ global industry network',
    'Client Partnerships Manager, White Ash Group — full-cycle recruiting and market intelligence for operators',
    'Account Manager, Carrier Enterprise Canada — 5+ years HVAC portfolio growth and retention',
    'Manager, Krown Queensdale — ~20 years branch operations, P&L, customer loyalty',
    'Business Development Agent, Allstate — prospecting, referral networks, commercial & personal lines',
    'Top-performing sales, Southbank Dodge — full-cycle automotive sales and referrals',
  ],
}

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

/** Load the profile from settings.profile, falling back to DEFAULT_PROFILE for missing/malformed fields. */
export async function getProfile(supabase: SupabaseServerClient): Promise<Profile> {
  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'profile')
    .maybeSingle()

  const stored = data?.value as Partial<Profile> | undefined
  if (!stored) return DEFAULT_PROFILE

  return {
    ...DEFAULT_PROFILE,
    ...stored,
    constraints: { ...DEFAULT_PROFILE.constraints, ...(stored.constraints ?? {}) },
  }
}

/** Base resume markdown used for tailoring */
export function profileToResumeMarkdown(p: Profile = DEFAULT_PROFILE): string {
  return `# ${p.name}
${p.headline}
${p.location} · ${p.email} · ${p.linkedin}

## Professional Summary
${p.summary}

## Core Competencies
${p.skills.join(' · ')}

## Experience Highlights
${p.experience_highlights.map((h) => `• ${h}`).join('\n')}
`
}
