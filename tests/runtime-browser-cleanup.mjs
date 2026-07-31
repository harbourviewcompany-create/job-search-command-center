import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const evidenceDir = process.env.RUNTIME_EVIDENCE_DIR ?? 'qa/runtime-browser'

assert(supabaseUrl, 'NEXT_PUBLIC_SUPABASE_URL is required')
assert(supabaseKey, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required')

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

let manifest
try {
  manifest = JSON.parse(await readFile(`${evidenceDir}/fixture-manifest.json`, 'utf8'))
} catch (error) {
  if (error?.code === 'ENOENT') {
    console.log('No runtime fixture manifest found; cleanup is not required.')
    process.exit(0)
  }
  throw error
}

const fixture = manifest.fixture ?? {}
const marker = manifest.marker
const jobIds = new Set([...(fixture.jobIds ?? []), fixture.manualJobId].filter(Boolean))
const companyIds = new Set([...(fixture.companyIds ?? []), fixture.manualCompanyId].filter(Boolean))

if (marker) {
  const discoveredJobs = await rest(
    `jobs?select=id,company_id&external_id=like.${encodeURIComponent(`${marker}*`)}`
  )
  for (const row of discoveredJobs ?? []) {
    jobIds.add(row.id)
    if (row.company_id) companyIds.add(row.company_id)
  }
}

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

if (marker) {
  const remaining = await rest(
    `jobs?select=id&external_id=like.${encodeURIComponent(`${marker}*`)}`
  )
  assert.equal(remaining?.length ?? 0, 0, 'Runtime fixture jobs remain after cleanup')
}

console.log(`Runtime cleanup complete: ${jobIds.size} jobs, ${companyIds.size} companies.`)
