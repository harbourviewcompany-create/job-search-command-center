import type { Profile } from './profile'
import { DEFAULT_PROFILE } from './profile'

export type OutreachTemplateKey =
  | 'warm'
  | 'semi_warm'
  | 'cold_hiring'
  | 'after_apply'
  | 'recruiter'
  | 'follow_up_1'

export interface OutreachContext {
  contactName?: string | null
  contactTitle?: string | null
  companyName?: string | null
  jobTitle?: string | null
  companyFocus?: string | null
  priorContext?: string | null
}

/**
 * Deterministic outreach drafts from proven templates.
 * Optional Anthropic polish can wrap this later.
 */
export function draftOutreach(
  template: OutreachTemplateKey,
  ctx: OutreachContext,
  profile: Profile = DEFAULT_PROFILE
): string {
  const name = ctx.contactName?.trim() || 'there'
  const company = ctx.companyName?.trim() || 'your company'
  const role = ctx.jobTitle?.trim() || 'the open role'
  const focus =
    ctx.companyFocus?.trim() ||
    'growth and commercial execution'
  const prior =
    ctx.priorContext?.trim() ||
    'our past work together'

  switch (template) {
    case 'warm':
      return `Hi ${name},

Hope you're doing well. I'm actively exploring Business Development / Account Management / Partnerships roles (Ottawa or remote) and wanted to reconnect.

I've spent the last several years growing a $6–8M HVAC portfolio (20% YoY) and more recently building Harbourview — a market-intelligence platform with a 6,000+ global network.

If you hear of anything that fits, or know someone worth talking to, I'd really appreciate the intro. Happy to return the favour any time.

Best,
${profile.name}`

    case 'semi_warm':
      return `Hi ${name},

It's been a while — hope things are going well.

I'm looking at my next chapter in Business Development / Account or Partnerships roles (Ottawa or fully remote). Given ${prior}, I thought of you.

Would you be open to a quick 15-minute call in the next couple of weeks? I'd value your perspective, and of course happy to share anything useful on my side.

Thanks,
${profile.name}
${profile.linkedin}`

    case 'cold_hiring':
      return `Hi ${name},

I noticed ${company} is hiring for ${role}. Your team's focus on ${focus} caught my attention.

I'm a Business Development and Account Management professional with 20+ years in B2B relationship selling — most recently growing a $6–8M HVAC portfolio 20% year-over-year and building a cross-border market-intelligence platform (Harbourview) with a 6,000+ network.

I'd welcome the chance to learn more about the role and share how my background could support ${company}'s goals. Would you be open to a brief conversation?

Best regards,
${profile.name}
Ottawa · ${profile.email}
${profile.linkedin}`

    case 'after_apply':
      return `Hi ${name},

I recently applied for the ${role} position at ${company} and wanted to reach out directly.

My background is 20+ years of B2B business development and account management — including 20% YoY growth on a $6–8M HVAC portfolio and founding a market-intelligence platform that now connects operators across multiple international markets.

I'd welcome the opportunity to discuss how I can contribute.

Thank you for your time,
${profile.name}`

    case 'recruiter':
      return `Hi ${name},

I'm a Business Development / Account Management professional based in Ottawa, open to Ottawa or remote roles in Canada.

Key highlights:
• 20% YoY growth on $6–8M HVAC account portfolio (Carrier Enterprise)
• Consistently top sales performer in high-volume automotive
• Founder of Harbourview — market intelligence + marketplace platform with 6,000+ global network
• Current Client Partnerships / talent pipeline work

If you have mandates that fit BD, Account Management, Partnerships, Market Access, or senior commercial roles, I'd be happy to connect.

Best,
${profile.name}`

    case 'follow_up_1':
      return `Hi ${name},

I wanted to follow up on my application for ${role} at ${company}. I remain very interested and would welcome any update on timeline or next steps.

Happy to provide additional materials or speak briefly if helpful.

Best regards,
${profile.name}
${profile.email}`

    default:
      return draftOutreach('cold_hiring', ctx, profile)
  }
}

/** Optional LLM polish for outreach (falls back to template). */
export async function draftOutreachWithAI(
  template: OutreachTemplateKey,
  ctx: OutreachContext,
  profile: Profile = DEFAULT_PROFILE
): Promise<{ body: string; source: 'template' | 'anthropic' }> {
  const base = draftOutreach(template, ctx, profile)
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return { body: base, source: 'template' }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 800,
        system:
          'You polish professional LinkedIn/email outreach. Keep the facts, tone, and intent. Do not invent experience. Keep under 180 words. Return only the message body.',
        messages: [
          {
            role: 'user',
            content: `Polish this outreach for clarity and warmth. Preserve all factual claims.\n\n${base}`,
          },
        ],
      }),
    })
    if (!res.ok) return { body: base, source: 'template' }
    const data = await res.json()
    const text: string =
      data?.content?.map((b: { text?: string }) => b.text ?? '').join('') ?? ''
    return text.trim()
      ? { body: text.trim(), source: 'anthropic' }
      : { body: base, source: 'template' }
  } catch {
    return { body: base, source: 'template' }
  }
}
