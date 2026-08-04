import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const evidenceDir = process.env.RUNTIME_EVIDENCE_DIR ?? 'qa/runtime-browser'

if (!supabaseUrl || !supabaseKey) {
  console.log('Supabase credentials are not configured; no runtime fixtures could have been created.')
  process.exit(0)
}

async function rest(path, method = 'GET') {
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Accept-Profile': 'job_search',
      'Content-Profile': 'job_search',
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
  })

  const text = await response.text()
  if (!response.ok) {
    throw new Error(`Supabase cleanup ${method} ${path} failed (${response.status}): ${text.slice(0, 500)}`)
  }
  return text ? JSON.parse(text) : null
}

function inFilter(values) {
  const unique = Array.from(new Set(values.filter(Boolean)))
  return unique.length > 0 ? `in.(${unique.join(',')})` : null
}

async function rows(path) {
  return (await rest(path)) ?? []
}

let manifest = {}
try {
  manifest = JSON.parse(await readFile(`${evidenceDir}/fixture-manifest.json`, 'utf8'))
} catch (error) {
  if (error?.code !== 'ENOENT') throw error
}

const environmentToken = (process.env.RUNTIME_RUN_TOKEN ?? '')
  .replace(/[^a-zA-Z0-9-]/g, '-')
  .slice(-48)
const runToken = manifest.runToken || environmentToken
const marker = manifest.marker || (runToken ? `runtime-qa-${runToken}` : '')

if (!runToken && !marker) {
  console.log('No runtime marker is available; no fixture writes could be attributed to this run.')
  process.exit(0)
}

const fixture = manifest.fixture ?? {}
const jobIds = new Set([...(fixture.jobIds ?? []), fixture.manualJobId].filter(Boolean))
const companyIds = new Set([...(fixture.companyIds ?? []), fixture.manualCompanyId].filter(Boolean))

const discoveredJobs = [
  ...(marker
    ? await rows(`jobs?select=id,company_id&external_id=like.${encodeURIComponent(`${marker}*`)}`)
    : []),
  ...(runToken
    ? await rows(`jobs?select=id,company_id&title=like.${encodeURIComponent(`*${runToken}*`)}`)
    : []),
]
for (const row of discoveredJobs) {
  jobIds.add(row.id)
  if (row.company_id) companyIds.add(row.company_id)
}

const discoveredCompanies = [
  ...(marker
    ? await rows(`companies?select=id&notes=eq.${encodeURIComponent(marker)}`)
    : []),
  ...(runToken
    ? await rows(`companies?select=id&name=like.${encodeURIComponent(`*${runToken}*`)}`)
    : []),
]
for (const row of discoveredCompanies) companyIds.add(row.id)

const jobsFilter = inFilter([...jobIds])
if (jobsFilter) {
  await rest(`applications?job_id=${jobsFilter}`, 'DELETE')
  await rest(`jobs?id=${jobsFilter}`, 'DELETE')
}

if (marker) {
  await rest(`contacts?source=eq.${encodeURIComponent(marker)}`, 'DELETE')
}

const companiesFilter = inFilter([...companyIds])
if (companiesFilter) {
  await rest(`companies?id=${companiesFilter}`, 'DELETE')
}

const remainingJobs = [
  ...(marker
    ? await rows(`jobs?select=id&external_id=like.${encodeURIComponent(`${marker}*`)}`)
    : []),
  ...(runToken
    ? await rows(`jobs?select=id&title=like.${encodeURIComponent(`*${runToken}*`)}`)
    : []),
]
const remainingCompanies = [
  ...(marker
    ? await rows(`companies?select=id&notes=eq.${encodeURIComponent(marker)}`)
    : []),
  ...(runToken
    ? await rows(`companies?select=id&name=like.${encodeURIComponent(`*${runToken}*`)}`)
    : []),
]
const remainingContacts = marker
  ? await rows(`contacts?select=id&source=eq.${encodeURIComponent(marker)}`)
  : []

assert.equal(remainingJobs.length, 0, 'Runtime fixture jobs remain after cleanup')
assert.equal(remainingCompanies.length, 0, 'Runtime fixture companies remain after cleanup')
assert.equal(remainingContacts.length, 0, 'Runtime fixture contacts remain after cleanup')

console.log(`Runtime cleanup complete: ${jobIds.size} jobs, ${companyIds.size} companies.`)
