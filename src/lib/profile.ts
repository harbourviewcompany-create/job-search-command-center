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
  keywords_boost?: string[]
  keywords_penalty?: string[]
}

export const DEFAULT_PROFILE: Profile = {
  name: 'Tyler Campbell',
  headline: 'Business Development · Account Management · International Trade',
  location: 'Ottawa, Ontario, Canada',
  email: 'harbourviewcompany@gmail.com',
  linkedin: 'linkedin.com/in/wtylercampbell',
  summary:
    'Results-driven business development and account management professional with 20+ years of experience building client relationships, opening new markets, and driving revenue across international trade, HVAC, insurance, and automotive sectors. Delivered a 20% year-over-year sales increase on a $6–8M HVAC account portfolio and was consistently recognized as a top sales performer. Founder of Harbourview — a B2B market intelligence and marketplace platform with a curated global network of 6,000+ industry professionals. Open to Business Development, Account Management, Partnerships, Market Access, and Client Partnerships roles — Ottawa or remote (Canada preferred).',
  target_titles: [
    'Business Development Manager',
    'Business Development Director',
    'Director of Business Development',
    'Account Manager',
    'Key Account Manager',
    'Senior Account Manager',
    'Strategic Account Manager',
    'Client Partnerships Manager',
    'Partnerships Manager',
    'Strategic Partnerships Manager',
    'Market Access Manager',
    'Commercial Development Manager',
    'Sales Manager',
    'B2B Sales Manager',
    'Talent Acquisition Manager',
    'Recruiting Manager',
    'International Trade Manager',
    'Export Development Manager',
    'Channel Partnerships Manager',
    'Account Executive',
    'Head of Sales',
    'Market Development Manager',
    'Revenue Leader',
  ],
  skills: [
    'Business Development',
    'Account Management',
    'B2B Sales',
    'Client Relationship Management',
    'International Trade',
    'Market Expansion',
    'Revenue Growth',
    'Cross-border',
    'Market Access',
    'Network Building',
    'Partnership Development',
    'Key Account',
    'Portfolio Management',
    'HVAC',
    'Insurance',
    'Automotive Sales',
    'Talent Acquisition',
    'Recruiting',
    'Operations Management',
    'Team Leadership',
    'Client Partnerships',
    'Strategic Partnerships',
    'Commercial Development',
    'Export',
    'Market Intelligence',
    'Channel Partnerships',
    'Consultative Selling',
    'Relationship Selling',
  ],
  industries: [
    'International Trade',
    'B2B Marketplace',
    'HVAC',
    'Building Solutions',
    'Insurance',
    'Automotive',
    'Recruiting / Staffing',
    'Cannabis / Licensed Operators',
    'Regulated Markets',
    'Supply Chain',
    'Logistics',
    'Market Intelligence',
    'B2B SaaS',
  ],
  constraints: {
    locations: [
      'Ottawa',
      'Ontario',
      'Canada',
      'Remote',
      'Work from home',
      'Hybrid',
      'National Capital Region',
      'Gatineau',
    ],
    remote_ok: true,
    min_comp_cad: null,
    notes:
      'Prefer Ottawa or fully remote (Canada). Strong fit for BD, Account, Partnerships, Market Access, and Client Partnerships roles. Avoid pure junior SDR / cold-call-only roles.',
  },
  experience_highlights: [
    'Founder & CEO, Harbourview — B2B market intelligence & marketplace; 6,000+ global industry network spanning Canada, Europe, LATAM, Asia, ANZ',
    'Client Partnerships Manager, White Ash Group — full-cycle recruiting and market intelligence for operators across Canada',
    'Account Manager, Carrier Enterprise Canada — managed $6–8M HVAC portfolio; delivered 20% year-over-year sales growth over 5+ years',
    'Manager, Krown Queensdale — ~20 years branch operations, P&L, customer loyalty, and team leadership',
    'Business Development Agent, Allstate — prospecting, referral networks, commercial & personal lines',
    'Top-performing sales representative, Southbank Dodge — full-cycle automotive sales and personal referral network',
  ],
  keywords_boost: [
    'business development',
    'account manager',
    'key account',
    'partnerships',
    'market access',
    'client partnerships',
    'international trade',
    'revenue growth',
    'portfolio',
    'b2b',
    'remote',
    'ottawa',
  ],
  keywords_penalty: [
    'junior sdr',
    'entry level sales',
    'cold calling only',
    'door to door',
    'telemarketing',
    'commission only no base',
    'internship',
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
  return `# ${p.name}\n${p.headline}\n${p.location} · ${p.email} · ${p.linkedin}\n\n## Professional Summary\n${p.summary}\n\n## Core Competencies\n${p.skills.join(' · ')}\n\n## Experience Highlights\n${p.experience_highlights.map((h) => `• ${h}`).join('\n')}\n`
}
