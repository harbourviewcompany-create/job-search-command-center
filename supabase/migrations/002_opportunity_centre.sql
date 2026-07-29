-- Opportunity Command Centre extensions
-- Fit scoring, commercial opportunities, structured profile support

-- Fit score on jobs (0-100)
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS fit_score SMALLINT,
  ADD COLUMN IF NOT EXISTS fit_reasons TEXT[];

CREATE INDEX IF NOT EXISTS idx_jobs_fit_score ON jobs (fit_score DESC NULLS LAST);

-- Commercial / cash opportunities (freelance, productized, outreach plays)
CREATE TABLE IF NOT EXISTS opportunities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL CHECK (type IN (
    'job_lead', 'contract', 'freelance', 'productized_service',
    'outreach', 'recruiting', 'marketplace'
  )),
  title TEXT NOT NULL,
  description TEXT,
  company_or_channel TEXT,
  estimated_value TEXT,          -- e.g. "$80-100k" or "$2-5k project"
  effort TEXT,                   -- low / medium / high
  time_to_cash TEXT,             -- e.g. "2-4 weeks", "immediate"
  fit_score SMALLINT,
  fit_reasons TEXT[],
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'in_progress', 'won', 'dismissed', 'expired')),
  action_url TEXT,
  draft_pitch TEXT,              -- ready-to-send or ready-to-post text
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_opportunities_status ON opportunities (status);
CREATE INDEX IF NOT EXISTS idx_opportunities_fit_score ON opportunities (fit_score DESC NULLS LAST);

CREATE TRIGGER opportunities_updated_at
  BEFORE UPDATE ON opportunities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Structured profile seed (Tyler Campbell) — upsert into settings
INSERT INTO settings (key, value) VALUES
(
  'profile',
  '{
    "name": "Tyler Campbell",
    "headline": "Business Development · Account Management · International Trade",
    "location": "Ottawa, Ontario, Canada",
    "email": "harbourviewcompany@gmail.com",
    "linkedin": "linkedin.com/in/wtylercampbell",
    "summary": "Results-driven business development and account management professional with 20+ years of experience building client relationships, opening new markets, and driving revenue across international trade, HVAC, insurance, and automotive sectors. Founder of Harbourview, a B2B market intelligence and marketplace platform.",
    "target_titles": [
      "Business Development Manager",
      "Director of Business Development",
      "Account Executive",
      "Strategic Account Manager",
      "Partnerships Manager",
      "Head of Sales",
      "Market Development Manager",
      "Client Partnerships Manager",
      "Revenue Leader",
      "General Manager"
    ],
    "skills": [
      "Business Development",
      "Account Management",
      "B2B Sales",
      "Client Relationship Management",
      "International Trade",
      "Market Expansion",
      "Talent Acquisition",
      "Recruiting",
      "HVAC Solutions",
      "Insurance Sales",
      "Automotive Sales",
      "Operations Management",
      "Team Leadership",
      "Revenue Growth",
      "Market Intelligence",
      "Cross-border Trade",
      "Channel Partnerships"
    ],
    "industries": [
      "International Trade",
      "B2B Marketplace",
      "HVAC",
      "Insurance",
      "Automotive",
      "Recruiting / Staffing",
      "Cannabis / Licensed Operators",
      "Supply Chain"
    ],
    "constraints": {
      "locations": ["Ottawa", "Ontario", "Canada", "Remote"],
      "remote_ok": true,
      "min_comp_cad": null,
      "notes": "Open to full-time, contract, and commercial opportunities that leverage BD and network."
    },
    "experience_highlights": [
      "Founder & CEO, Harbourview — B2B market intelligence & marketplace; 6,000+ global industry network",
      "Client Partnerships Manager, White Ash Group — full-cycle recruiting and market intelligence for operators",
      "Account Manager, Carrier Enterprise Canada — 5+ years HVAC portfolio growth and retention",
      "Manager, Krown Queensdale — ~20 years branch operations, P&L, customer loyalty",
      "Business Development Agent, Allstate — prospecting, referral networks, commercial & personal lines",
      "Top-performing sales, Southbank Dodge — full-cycle automotive sales and referrals"
    ]
  }'::jsonb
),
(
  'search_terms',
  '{
    "terms": [
      "business development manager",
      "account executive",
      "strategic account manager",
      "partnerships manager",
      "director business development",
      "sales manager",
      "market development",
      "client partnerships",
      "revenue manager",
      "B2B sales"
    ],
    "locations": ["Ottawa", "Ontario", "Canada", "Remote"]
  }'::jsonb
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- Seed high-value commercial plays from profile (cash-oriented)
INSERT INTO opportunities (type, title, description, company_or_channel, estimated_value, effort, time_to_cash, fit_score, fit_reasons, draft_pitch, status)
VALUES
(
  'marketplace',
  'Harbourview operator introductions — paid market access',
  'Package your 6,000+ network into paid introductions: Canadian producers ↔ EU/LATAM/Asia buyers and licensed operators. Charge per qualified intro or monthly retainer for market intelligence.',
  'Harbourview Company',
  '$1.5k–5k/mo or $250–750 per qualified intro',
  'medium',
  '2–4 weeks',
  95,
  ARRAY['Owns the network', 'Already built platform', 'Clear B2B buyer'],
  'Harbourview connects licensed operators and exporters with vetted international partners across Europe, LATAM, Asia, and ANZ. I run a curated network of 6,000+ industry professionals and can structure paid introductions or a monthly market-intelligence retainer for operators who need cross-border access without building the network from scratch.',
  'active'
),
(
  'recruiting',
  'Operator talent pipelines (Canada)',
  'Productize White Ash-style recruiting: retainers for growing licensed operators who need senior hires. Use existing market intel on comp and talent availability.',
  'Direct to operators / agencies',
  '$8k–20k per senior placement or monthly retained search',
  'medium',
  '4–8 weeks',
  88,
  ARRAY['Recent Client Partnerships Manager experience', 'Comp & org design intel', 'Operator relationships'],
  'I help growing operators build durable hiring pipelines for senior and specialized roles — including compensation benchmarks and market availability — so leadership can hire with confidence instead of reactive posting.',
  'active'
),
(
  'contract',
  'Fractional BD / market-entry for trade-oriented SMEs',
  'Offer 90-day fractional business development: open one new channel or geography using your international trade and HVAC/B2B playbook.',
  'Canadian exporters & B2B suppliers',
  '$4k–8k / 90 days',
  'medium',
  '2–6 weeks to first invoice',
  85,
  ARRAY['20+ years BD', 'International trade focus', 'Concrete channel experience'],
  'Fractional BD engagement: I help B2B and trade-oriented companies open a new market or channel in 90 days — targeting, outreach, and first conversations — drawing on two decades of account management and cross-border network building.',
  'active'
),
(
  'outreach',
  'HVAC distributor / manufacturer BD roles (warm path)',
  'Target Carrier-adjacent and regional HVAC distributors for Account Manager / BD roles. Use 5+ years Carrier Enterprise credibility.',
  'HVAC channel (Canada)',
  'Full-time comp band (role-dependent)',
  'low',
  '2–6 weeks to interviews',
  82,
  ARRAY['5+ years Carrier Enterprise', 'Contractor & engineer relationships', 'Ottawa/region coverage'],
  'I spent over five years growing commercial and residential HVAC accounts at Carrier Enterprise Canada, working daily with contractors, facility managers, and engineers. I am exploring Account Manager / BD roles with distributors and manufacturers who value retained relationships and new-logo growth in Ontario.',
  'active'
),
(
  'productized_service',
  'Market intelligence brief for one target geography',
  'Sell a fixed-scope brief: operators, importers, regulatory notes, and warm intro paths for one country/region — productized from Harbourview data.',
  'Producers & exporters',
  '$750–2,000 per brief',
  'low',
  '1–2 weeks',
  80,
  ARRAY['Harbourview data asset', 'Clear deliverable', 'Fast to cash'],
  'Fixed-scope market brief: for one target geography I deliver a practical map of relevant operators/importers, channel notes, and introduction paths — so your team can prioritize outreach instead of starting from a blank page.',
  'active'
);
