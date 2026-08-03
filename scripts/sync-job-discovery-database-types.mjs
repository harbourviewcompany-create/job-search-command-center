import { readFile, writeFile } from 'node:fs/promises'

const [inputPath, outputPath = 'src/types/database.ts'] = process.argv.slice(2)
if (!inputPath) {
  throw new Error('Usage: node scripts/sync-job-discovery-database-types.mjs <generated-types> [output]')
}

let source = await readFile(inputPath, 'utf8')

const unions = `export type JobStatus = 'found' | 'interested' | 'dismissed'
export type ApplicationStatus =
  | 'interested'
  | 'applied'
  | 'interview'
  | 'offer'
  | 'rejected'
  | 'closed'
export type OutreachType = 'initial' | 'follow_up_1' | 'follow_up_2'
export type OutreachStatus = 'drafted' | 'sent' | 'skipped'
export type JobSource =
  | 'indeed'
  | 'ziprecruiter'
  | 'manual'
  | 'adzuna'
  | 'linkedin'
  | 'remoteok'
  | 'greenhouse'
  | 'lever'
  | 'ashby'
  | 'smartrecruiters'
export type OpportunityType =
  | 'job_lead'
  | 'contract'
  | 'freelance'
  | 'productized_service'
  | 'outreach'
  | 'recruiting'
  | 'marketplace'
export type OpportunityStatus =
  | 'active'
  | 'in_progress'
  | 'won'
  | 'dismissed'
  | 'expired'
export type DiscoveryLifecycleStatus = 'open' | 'unverified' | 'closed' | 'expired'
export type RemoteType = 'remote' | 'hybrid' | 'onsite' | 'unknown'

`

if (!source.includes('export type Database = {')) {
  throw new Error('Generated Database declaration was not found.')
}
source = source.replace('export type Database = {', `${unions}export type Database = {`)

function tableBounds(text, table) {
  const marker = `      ${table}: {`
  const start = text.indexOf(marker)
  if (start < 0) throw new Error(`Generated table ${table} was not found.`)
  const tail = text.slice(start + marker.length)
  const match = /^      [A-Za-z0-9_]+: \{$|^    Views: \{$/m.exec(tail)
  if (!match) throw new Error(`Generated table ${table} has no detectable boundary.`)
  return [start, start + marker.length + match.index]
}

function replaceField(block, field, oldType, newType, expected) {
  const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const oldEscaped = oldType.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const expression = new RegExp(`^(\\s+)${escaped}: ${oldEscaped}$`, 'gm')
  let count = 0
  const result = block.replace(expression, (_match, indentation) => {
    count += 1
    return `${indentation}${field}: ${newType}`
  })
  if (count !== expected) {
    throw new Error(`${field}: expected ${expected} generated replacements, received ${count}.`)
  }
  return result
}

function mutateTable(text, table, fields) {
  const [start, end] = tableBounds(text, table)
  let block = text.slice(start, end)
  for (const [field, oldType, newType, expected] of fields) {
    block = replaceField(block, field, oldType, newType, expected)
  }
  return `${text.slice(0, start)}${block}${text.slice(end)}`
}

source = mutateTable(source, 'applications', [
  ['status', 'string', 'ApplicationStatus', 1],
  ['status?', 'string', 'ApplicationStatus', 2],
])
source = mutateTable(source, 'jobs', [
  ['source', 'string', 'JobSource', 2],
  ['source?', 'string', 'JobSource', 1],
  ['status', 'string', 'JobStatus', 1],
  ['status?', 'string', 'JobStatus', 2],
  ['lifecycle_status', 'string', 'DiscoveryLifecycleStatus', 1],
  ['lifecycle_status?', 'string', 'DiscoveryLifecycleStatus', 2],
  ['remote_type', 'string | null', 'RemoteType | null', 1],
  ['remote_type?', 'string | null', 'RemoteType | null', 2],
  ['preferred_source', 'string | null', 'JobSource | null', 1],
  ['preferred_source?', 'string | null', 'JobSource | null', 2],
])
source = mutateTable(source, 'job_source_postings', [
  ['source', 'string', 'JobSource', 2],
  ['source?', 'string', 'JobSource', 1],
  ['lifecycle_status', 'string', 'DiscoveryLifecycleStatus', 1],
  ['lifecycle_status?', 'string', 'DiscoveryLifecycleStatus', 2],
])
source = mutateTable(source, 'outreach_messages', [
  ['status', 'string', 'OutreachStatus', 1],
  ['status?', 'string', 'OutreachStatus', 2],
  ['type', 'string', 'OutreachType', 2],
  ['type?', 'string', 'OutreachType', 1],
])
source = mutateTable(source, 'opportunities', [
  ['status', 'string', 'OpportunityStatus', 1],
  ['status?', 'string', 'OpportunityStatus', 2],
  ['type', 'string', 'OpportunityType', 2],
  ['type?', 'string', 'OpportunityType', 1],
])

source = source.replace(
  'Extract<keyof Database, "public">',
  'Extract<keyof Database, "job_search">'
)

const aliases = `
export type Company = Database['job_search']['Tables']['companies']['Row']
export type Job = Database['job_search']['Tables']['jobs']['Row']
export type Application = Database['job_search']['Tables']['applications']['Row']
export type Contact = Database['job_search']['Tables']['contacts']['Row']
export type OutreachMessage = Database['job_search']['Tables']['outreach_messages']['Row']
export type Setting = Database['job_search']['Tables']['settings']['Row']
export type Opportunity = Database['job_search']['Tables']['opportunities']['Row']
export type SearchProfileRow = Database['job_search']['Tables']['search_profiles']['Row']
export type CompanyJobSourceRow = Database['job_search']['Tables']['company_job_sources']['Row']
export type JobSourcePostingRow = Database['job_search']['Tables']['job_source_postings']['Row']
export type JobScoreRow = Database['job_search']['Tables']['job_scores']['Row']
export type DiscoveryRunRow = Database['job_search']['Tables']['discovery_runs']['Row']

export type JobWithCompany = Job & {
  companies: Company | null
}

export type ApplicationWithJob = Application & {
  jobs: JobWithCompany
}

`

const defaultSchema = 'type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "job_search">]\n'
if (!source.includes(defaultSchema)) {
  throw new Error('Generated DefaultSchema declaration was not found or was not normalized.')
}
source = source.replace(defaultSchema, `${defaultSchema}${aliases}`)

for (const required of [
  'search_profiles',
  'job_source_postings',
  'discovery_runs',
  'ingest_job_source_posting',
  "| 'smartrecruiters'",
  'export type JobWithCompany',
]) {
  if (!source.includes(required)) throw new Error(`Generated database type is missing ${required}.`)
}

await writeFile(outputPath, source, 'utf8')

async function updateFile(path, transform) {
  const current = await readFile(path, 'utf8')
  const next = transform(current)
  if (next === current) return false
  await writeFile(path, next, 'utf8')
  return true
}

await updateFile('src/app/jobs/page.tsx', (content) => {
  const original = "const JOB_SOURCES: JobSource[] = ['indeed', 'ziprecruiter', 'manual', 'adzuna', 'linkedin', 'remoteok']"
  const replacement = `const JOB_SOURCES: JobSource[] = [
  'indeed',
  'ziprecruiter',
  'manual',
  'adzuna',
  'linkedin',
  'remoteok',
  'greenhouse',
  'lever',
  'ashby',
  'smartrecruiters',
]`
  if (content.includes(replacement)) return content
  if (!content.includes(original)) throw new Error('Jobs source registry line was not found.')
  return content.replace(original, replacement)
})

await updateFile('src/lib/jobs.ts', (content) => {
  const existing = "  if (normalized === 'smartrecruiters') return 'SmartRecruiters'\n"
  if (content.includes(existing)) return content
  const anchor = "  if (normalized === 'ziprecruiter') return 'ZipRecruiter'\n"
  if (!content.includes(anchor)) throw new Error('Job source label anchor was not found.')
  return content.replace(anchor, `${anchor}${existing}`)
})

console.log(`Synchronized ${outputPath} and direct ATS job-source filters.`)
