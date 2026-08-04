import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'

const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const evidenceDir = process.env.RUNTIME_EVIDENCE_DIR ?? 'qa/runtime-browser'
const marker = `Boundary QA ${process.env.RUNTIME_RUN_TOKEN ?? Date.now()}`

assert(baseUrl, 'NEXT_PUBLIC_SUPABASE_URL is required')
assert(anonKey, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required')
assert(serviceRoleKey, 'SUPABASE_SERVICE_ROLE_KEY is required')
await mkdir(evidenceDir, { recursive: true })

const endpoint = `${baseUrl}/rest/v1`
const checks = []
let companyId = null
let jobId = null

function headers(key, extra = {}) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    'Content-Profile': 'job_search',
    'Accept-Profile': 'job_search',
    ...extra,
  }
}

async function request(key, path, options = {}) {
  return fetch(`${endpoint}/${path}`, {
    ...options,
    headers: headers(key, options.headers),
  })
}

function record(name, passed, detail) {
  checks.push({ name, passed, detail })
  assert(passed, `${name}: ${detail}`)
}

function denied(response) {
  return response.status === 401 || response.status === 403
}

try {
  const anonInsert = await request(anonKey, 'companies', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ name: marker, notes: marker }),
  })
  record('Anon INSERT is denied', denied(anonInsert), `HTTP ${anonInsert.status}`)

  const serviceInsert = await request(serviceRoleKey, 'companies', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ name: marker, notes: marker }),
  })
  const companyRows = await serviceInsert.json()
  record('Service-role INSERT succeeds', serviceInsert.ok && companyRows[0]?.id, `HTTP ${serviceInsert.status}`)
  companyId = companyRows[0].id

  const serviceJobInsert = await request(serviceRoleKey, 'jobs', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      source: 'manual',
      title: marker,
      company_id: companyId,
      status: 'found',
      external_id: `boundary-${process.env.RUNTIME_RUN_TOKEN ?? Date.now()}`,
    }),
  })
  const jobRows = await serviceJobInsert.json()
  record('Service-role fixture creation succeeds', serviceJobInsert.ok && jobRows[0]?.id, `HTTP ${serviceJobInsert.status}`)
  jobId = jobRows[0].id

  const anonUpdate = await request(anonKey, `jobs?id=eq.${jobId}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ status: 'interested' }),
  })
  record('Anon UPDATE is denied', denied(anonUpdate), `HTTP ${anonUpdate.status}`)

  const anonDelete = await request(anonKey, `jobs?id=eq.${jobId}`, {
    method: 'DELETE',
    headers: { Prefer: 'return=representation' },
  })
  record('Anon DELETE is denied', denied(anonDelete), `HTTP ${anonDelete.status}`)

  const anonRead = await request(anonKey, `jobs?id=eq.${jobId}&select=id,title`, { method: 'GET' })
  const visibleRows = await anonRead.json()
  record('Anon read access remains available', anonRead.ok && visibleRows[0]?.id === jobId, `HTTP ${anonRead.status}`)
} finally {
  if (jobId) {
    await request(serviceRoleKey, `applications?job_id=eq.${jobId}`, { method: 'DELETE' })
    await request(serviceRoleKey, `jobs?id=eq.${jobId}`, { method: 'DELETE' })
  }
  if (companyId) {
    await request(serviceRoleKey, `companies?id=eq.${companyId}`, { method: 'DELETE' })
  }

  await writeFile(
    `${evidenceDir}/operator-boundary-evidence.json`,
    JSON.stringify({ generatedAt: new Date().toISOString(), marker, checks }, null, 2),
    'utf8'
  )
}

console.log(`${checks.filter((check) => check.passed).length}/${checks.length} operator-boundary checks passed.`)
