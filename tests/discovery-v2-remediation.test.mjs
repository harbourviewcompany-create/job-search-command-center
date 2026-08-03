import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

const root = process.cwd()
const sources = [
  'shared/discovery/types.ts',
  'shared/discovery/normalize.ts',
  'shared/discovery/canonicalize.ts',
  'shared/discovery/scoring.ts',
  'supabase/functions/_shared/providers/common.ts',
  'supabase/functions/_shared/providers/lever.ts',
  'supabase/functions/_shared/providers/ashby.ts',
  'supabase/functions/_shared/providers/smartrecruiters.ts',
]

const modulesPromise = (async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'job-discovery-v2-remediation-'))
  for (const relative of sources) {
    const source = await readFile(path.join(root, relative), 'utf8')
    const output = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
      },
      fileName: relative,
      reportDiagnostics: true,
    })
    const errors = (output.diagnostics ?? []).filter((item) => item.category === ts.DiagnosticCategory.Error)
    assert.equal(errors.length, 0, `Transpile diagnostics in ${relative}`)
    const javascript = output.outputText.replace(
      /(from\s+|import\s*\()(['"])([^'"]+)\2/g,
      (match, prefix, quote, specifier) => {
        if (!specifier.startsWith('.')) return match
        const replacement = specifier.endsWith('.ts')
          ? `${specifier.slice(0, -3)}.mjs`
          : path.extname(specifier) ? specifier : `${specifier}.mjs`
        return `${prefix}${quote}${replacement}${quote}`
      }
    )
    const target = path.join(tempRoot, relative.replace(/\.ts$/, '.mjs'))
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, javascript)
  }
  return tempRoot
})()

async function load(relative) {
  const tempRoot = await modulesPromise
  return import(pathToFileURL(path.join(tempRoot, relative.replace(/\.ts$/, '.mjs'))).href)
}

function profile(overrides = {}) {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'Release lane',
    slug: 'release-lane',
    enabled: true,
    priority: 1,
    locations: ['Ottawa'],
    remotePolicy: 'remote_only',
    employmentTypes: [],
    primaryTitles: ['Account Manager'],
    titleAliases: [],
    requiredTerms: [],
    preferredTerms: ['enterprise'],
    excludedTerms: ['commission only'],
    excludedCompanies: [],
    maximumPostingAgeDays: 45,
    minimumSalaryCad: null,
    resultBudgetPerRun: 100,
    ...overrides,
  }
}

test('normalization preserves unknown workplace state and uses SHA-256 content identity', async () => {
  const { classifyRemoteType, contentHash, finiteNumber } = await load('shared/discovery/normalize.ts')
  assert.equal(classifyRemoteType({ title: 'Account Manager', description: 'Build customer relationships.' }), 'unknown')
  assert.equal(contentHash(['same', 'content']).length, 64)
  assert.notEqual(contentHash(['same', 'content']), contentHash(['same', 'different']))
  assert.equal(finiteNumber(''), null)
  assert.equal(finiteNumber(null), null)
})

test('scoring does not hard-disqualify unknown remote state or unordered exclusion words', async () => {
  const { scoreJob } = await load('shared/discovery/scoring.ts')
  const result = scoreJob({
    title: 'Account Manager',
    description: 'Manage commission planning only after annual review.',
    companyName: 'Example',
    location: null,
    remoteType: 'unknown',
    lifecycleStatus: 'open',
  }, profile(), { now: new Date('2026-08-03T12:00:00Z') })
  assert.equal(result.hardDisqualified, false)
  assert.equal(result.dimensions.experience, 50)
  assert.equal(result.dimensions.industry, 50)
  assert.equal(result.scoringVersion, 3)
})

test('Lever preserves creation time and Ashby identity remains URL-derived', async () => {
  const { leverAdapter } = await load('supabase/functions/_shared/providers/lever.ts')
  const { ashbyAdapter } = await load('supabase/functions/_shared/providers/ashby.ts')
  const source = { id: 's1', provider: 'lever', boardKey: 'board', companyId: 'c1', companyName: 'Example', priority: 1, enabled: true }
  const leverFetch = async () => new Response(JSON.stringify([{ id: 'l1', text: 'Manager', createdAt: 1_700_000_000_000 }]), { status: 200 })
  const leverPage = (await leverAdapter.discover({ companySource: source, fetchImpl: leverFetch, maxPages: 1 }).next()).value
  assert.match(leverPage.postings[0].postedAt, /^2023-/)

  const ashbyFetch = async () => new Response(JSON.stringify({ jobs: [{ id: 'mutable-id', title: 'Manager', jobUrl: 'https://jobs.ashbyhq.com/example/role?utm_source=x' }] }), { status: 200 })
  const ashbyPage = (await ashbyAdapter.discover({ companySource: { ...source, provider: 'ashby' }, fetchImpl: ashbyFetch }).next()).value
  assert.match(ashbyPage.postings[0].externalId, /^url:[0-9a-f]{64}$/)
})

test('SmartRecruiters hydrates detail descriptions before returning postings', async () => {
  const { smartRecruitersAdapter } = await load('supabase/functions/_shared/providers/smartrecruiters.ts')
  const calls = []
  const fetchImpl = async (url) => {
    calls.push(String(url))
    if (String(url).endsWith('/postings/sr-1')) {
      return new Response(JSON.stringify({ uuid: 'sr-1', name: 'Director', jobAd: { sections: { responsibilities: { text: 'Lead enterprise growth.' } } } }), { status: 200 })
    }
    return new Response(JSON.stringify({ totalFound: 1, content: [{ uuid: 'sr-1', name: 'Director' }] }), { status: 200 })
  }
  const source = { id: 's1', provider: 'smartrecruiters', boardKey: 'example', companyId: 'c1', companyName: 'Example', priority: 1, enabled: true }
  const page = (await smartRecruitersAdapter.discover({ companySource: source, fetchImpl, maxPages: 1 }).next()).value
  assert.equal(calls.length, 2)
  assert.equal(page.requestsUsed, 2)
  assert.equal(page.postings[0].description, 'Lead enterprise growth.')
})

test('release migrations contain concurrency, lifecycle, privacy, atomic budget, and transactional source controls', async () => {
  const ingestion = await readFile(path.join(root, 'supabase/migrations/016_discovery_ingestion_functions.sql'), 'utf8')
  const hardening = await readFile(path.join(root, 'supabase/migrations/018_discovery_release_hardening.sql'), 'utf8')
  assert.match(ingestion, /pg_advisory_xact_lock/)
  assert.match(ingestion, /Complete snapshot returned zero postings/)
  assert.match(ingestion, /REVOKE ALL ON FUNCTION job_search\.recompute_job_lifecycle/)
  assert.match(hardening, /reserve_provider_requests/)
  assert.match(hardening, /save_company_job_source/)
  assert.match(hardening, /REVOKE ALL PRIVILEGES ON job_search\.canonical_job_sources FROM anon, authenticated/)
  assert.match(hardening, /LEFT JOIN LATERAL/)
})
