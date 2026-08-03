import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

const root = process.cwd()

async function transpileDiscoveryModules() {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'job-discovery-v2-'))
  const sources = [
    'shared/discovery/types.ts',
    'shared/discovery/normalize.ts',
    'shared/discovery/canonicalize.ts',
    'shared/discovery/scoring.ts',
    'shared/discovery/budget.ts',
    'supabase/functions/_shared/providers/common.ts',
    'supabase/functions/_shared/providers/greenhouse.ts',
    'supabase/functions/_shared/providers/lever.ts',
    'supabase/functions/_shared/providers/ashby.ts',
    'supabase/functions/_shared/providers/smartrecruiters.ts',
    'supabase/functions/_shared/providers/adzuna.ts',
    'supabase/functions/_shared/providers/remoteok.ts',
  ]

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
    const errors = (output.diagnostics ?? []).filter(
      (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error
    )
    assert.equal(errors.length, 0, `Transpile diagnostics in ${relative}: ${errors.map((item) => item.messageText).join('; ')}`)

    const javascript = output.outputText.replace(
      /(from\s+|import\s*\()(['"])([^'"]+)\2/g,
      (match, prefix, quote, specifier) => {
        if (!specifier.startsWith('.')) return match
        const replacement = specifier.endsWith('.ts')
          ? `${specifier.slice(0, -3)}.mjs`
          : path.extname(specifier)
            ? specifier
            : `${specifier}.mjs`
        return `${prefix}${quote}${replacement}${quote}`
      }
    )
    const target = path.join(tempRoot, relative.replace(/\.ts$/, '.mjs'))
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, javascript)
  }

  return tempRoot
}

const modulesPromise = transpileDiscoveryModules()

async function load(relative) {
  const tempRoot = await modulesPromise
  return import(pathToFileURL(path.join(tempRoot, relative.replace(/\.ts$/, '.mjs'))).href)
}

async function fixture(relative) {
  return JSON.parse(await readFile(path.join(root, 'tests/fixtures/providers', relative), 'utf8'))
}

function companySource(provider, overrides = {}) {
  return {
    id: `${provider}-source`,
    companyId: '00000000-0000-0000-0000-000000000001',
    companyName: 'Acme Markets',
    provider,
    boardKey: 'acme',
    careersUrl: null,
    apiBaseUrl: null,
    priority: 10,
    ...overrides,
  }
}

function searchQuery(provider, queryText = 'Strategic Partnerships Manager') {
  return {
    id: `${provider}-query`,
    searchProfileId: '00000000-0000-0000-0000-000000000010',
    provider,
    queryType: 'exact_title',
    queryText,
    location: 'Canada',
    priority: 10,
  }
}

function jsonFetch(payload, headers = {}) {
  return async () => new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

async function firstPage(adapter, context) {
  const iterator = adapter.discover(context)[Symbol.asyncIterator]()
  const result = await iterator.next()
  assert.equal(result.done, false)
  return result.value
}

test('canonicalization merges direct ATS and aggregator redirect copies', async () => {
  const { canonicalizePosting, likelySameJob } = await load('shared/discovery/canonicalize.ts')
  const base = {
    externalId: '1',
    companyName: 'Acme Markets',
    title: 'Strategic Partnerships Manager',
    location: 'Remote, Canada',
    remote: true,
    remoteType: 'remote',
    description: 'Strategic alliances and channel growth.',
    postedAt: '2026-08-01T10:00:00Z',
    employmentType: 'full_time',
    seniority: 'manager',
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    contentHash: 'hash',
    rawPayload: {},
    companyJobSourceId: null,
    searchProfileId: null,
  }
  const direct = {
    ...base,
    provider: 'greenhouse',
    sourceUrl: 'https://boards.greenhouse.io/acme/jobs/1',
    applyUrl: 'https://boards.greenhouse.io/acme/jobs/1',
  }
  const aggregator = {
    ...base,
    provider: 'adzuna',
    externalId: 'adzuna-1',
    sourceUrl: 'https://www.adzuna.ca/details/adzuna-1',
    applyUrl: 'https://www.adzuna.ca/details/adzuna-1',
  }
  assert.equal(canonicalizePosting(direct).canonicalKey, canonicalizePosting(aggregator).canonicalKey)
  assert.deepEqual(likelySameJob(direct, aggregator), {
    match: true,
    confidence: 0.9,
    reason: 'company, title, location, and posting week',
  })

  const differentLocation = { ...aggregator, location: 'Vancouver, Canada' }
  assert.notEqual(canonicalizePosting(direct).canonicalKey, canonicalizePosting(differentLocation).canonicalKey)
})

test('multidimensional scoring is deterministic, explainable, and lane-specific', async () => {
  const { scoreJob } = await load('shared/discovery/scoring.ts')
  const profile = {
    name: 'Partnerships and Alliances',
    slug: 'partnerships',
    remotePolicy: 'remote_or_local',
    locations: ['Ottawa', 'Ontario', 'Canada', 'Remote'],
    employmentTypes: ['full_time'],
    primaryTitles: ['Strategic Partnerships Manager'],
    titleAliases: ['Channel Partnerships Manager', 'Alliance Manager'],
    requiredTerms: ['partnerships'],
    preferredTerms: ['channel', 'alliances', 'enterprise revenue'],
    excludedTerms: ['commission only', 'entry level'],
    excludedCompanies: [],
    maximumPostingAgeDays: 45,
    minimumSalaryCad: 90000,
    sourcePriority: { greenhouse: 100, adzuna: 60 },
  }
  const job = {
    title: 'Strategic Partnerships Manager',
    description: 'Own strategic partnerships, channel alliances, and enterprise revenue growth.',
    companyName: 'Acme Markets',
    location: 'Remote, Canada',
    remote: true,
    remoteType: 'remote',
    employmentType: 'full_time',
    seniority: 'manager',
    salaryMin: 110000,
    salaryMax: 135000,
    salaryCurrency: 'CAD',
    postedAt: '2026-08-01T10:00:00Z',
    preferredSource: 'greenhouse',
    lifecycleStatus: 'open',
  }
  const now = new Date('2026-08-03T14:00:00Z')
  const first = scoreJob(job, profile, { now })
  const second = scoreJob(job, profile, { now })
  assert.deepEqual(first, second)
  assert.equal(first.hardDisqualified, false)
  assert.ok(first.overallScore >= 75, JSON.stringify(first))
  assert.equal(first.dimensions.title, 100)
  assert.equal(first.dimensions.sourceQuality, 100)
  assert.ok(first.reasons.some((reason) => reason.includes('Title aligns')))

  const disqualified = scoreJob({ ...job, description: `${job.description} Commission only.` }, profile, { now })
  assert.equal(disqualified.hardDisqualified, true)
  assert.ok(disqualified.disqualifiers.some((reason) => reason.includes('commission only')))
  assert.ok(disqualified.overallScore <= 20)
})

test('budget and pagination policy preserve manual reserve and stop low-yield pages', async () => {
  const { budgetDecision, shouldContinuePagination, queryYieldScore } = await load('shared/discovery/budget.ts')
  const bucket = {
    provider: 'adzuna',
    bucketType: 'day',
    requestLimit: 250,
    requestsUsed: 230,
    reservedRequests: 20,
    resetAt: '2026-08-04T00:00:00Z',
  }
  assert.equal(budgetDecision(bucket, false).allowed, false)
  assert.equal(budgetDecision(bucket, true).allowed, true)
  assert.equal(shouldContinuePagination({
    page: 1,
    maxPages: 3,
    resultCount: 50,
    pageSize: 50,
    newJobCount: 2,
    duplicateCount: 48,
    budgetRemaining: 10,
  }).continue, false)
  assert.ok(queryYieldScore({ priority: 10, lastResultCount: 20, lastNewJobCount: 10 }) >
    queryYieldScore({ priority: 100, lastResultCount: 20, lastNewJobCount: 0 }))
})

test('Greenhouse adapter normalizes a complete employer snapshot', async () => {
  const { greenhouseAdapter } = await load('supabase/functions/_shared/providers/greenhouse.ts')
  const page = await firstPage(greenhouseAdapter, {
    companySource: companySource('greenhouse'),
    fetchImpl: jsonFetch(await fixture('greenhouse/jobs.json')),
  })
  assert.equal(page.completeSnapshot, true)
  assert.equal(page.postings.length, 1)
  assert.equal(page.postings[0].provider, 'greenhouse')
  assert.equal(page.postings[0].companyName, 'Acme Markets')
  assert.match(page.postings[0].description, /strategic alliances/i)
})

test('Lever adapter normalizes location, arrangement, and compensation', async () => {
  const { leverAdapter } = await load('supabase/functions/_shared/providers/lever.ts')
  const page = await firstPage(leverAdapter, {
    companySource: companySource('lever'),
    pageSize: 100,
    maxPages: 1,
    fetchImpl: jsonFetch(await fixture('lever/postings-page-1.json')),
  })
  assert.equal(page.completeSnapshot, true)
  assert.equal(page.postings[0].remoteType, 'hybrid')
  assert.equal(page.postings[0].salaryCurrency, 'CAD')
  assert.equal(page.postings[0].salaryMin, 105000)
})

test('Ashby adapter preserves direct apply and compensation data', async () => {
  const { ashbyAdapter } = await load('supabase/functions/_shared/providers/ashby.ts')
  const page = await firstPage(ashbyAdapter, {
    companySource: companySource('ashby'),
    fetchImpl: jsonFetch(await fixture('ashby/job-board.json')),
  })
  assert.equal(page.completeSnapshot, true)
  assert.equal(page.postings[0].remoteType, 'remote')
  assert.equal(page.postings[0].salaryMax, 155000)
  assert.match(page.postings[0].applyUrl, /application$/)
})

test('SmartRecruiters adapter normalizes public postings', async () => {
  const { smartRecruitersAdapter } = await load('supabase/functions/_shared/providers/smartrecruiters.ts')
  const page = await firstPage(smartRecruitersAdapter, {
    companySource: companySource('smartrecruiters'),
    pageSize: 100,
    maxPages: 1,
    fetchImpl: jsonFetch(await fixture('smartrecruiters/publications-page-1.json')),
  })
  assert.equal(page.completeSnapshot, true)
  assert.equal(page.postings[0].title, 'Market Access Manager')
  assert.match(page.postings[0].description, /cross-border partnerships/i)
})

test('Adzuna and RemoteOK adapters use the shared provider contract', async () => {
  const { adzunaAdapter } = await load('supabase/functions/_shared/providers/adzuna.ts')
  const { remoteOkAdapter } = await load('supabase/functions/_shared/providers/remoteok.ts')
  const adzuna = await firstPage(adzunaAdapter, {
    query: searchQuery('adzuna'),
    credentials: { ADZUNA_APP_ID: 'fixture', ADZUNA_APP_KEY: 'fixture' },
    countryCode: 'CA',
    pageSize: 50,
    maxPages: 1,
    fetchImpl: jsonFetch(await fixture('adzuna/search-page-1.json'), { 'x-ratelimit-remaining': '249' }),
  })
  assert.equal(adzuna.completeSnapshot, false)
  assert.equal(adzuna.postings[0].salaryCurrency, 'CAD')
  assert.equal(adzuna.postings[0].searchProfileId, searchQuery('adzuna').searchProfileId)

  const remote = await firstPage(remoteOkAdapter, {
    query: searchQuery('remoteok', 'Channel Partnerships Manager'),
    pageSize: 100,
    fetchImpl: jsonFetch(await fixture('remoteok/jobs.json')),
  })
  assert.equal(remote.completeSnapshot, false)
  assert.equal(remote.postings.length, 1)
  assert.equal(remote.postings[0].remoteType, 'remote')
})

test('discovery migration versions are unique and the approved sequence exists', async () => {
  const files = (await readdir(path.join(root, 'supabase/migrations'))).filter((file) => file.endsWith('.sql'))
  const versions = files.map((file) => file.split('_')[0])
  const duplicates = versions.filter((version, index) => versions.indexOf(version) !== index)
  assert.deepEqual(duplicates, [], `Duplicate migration versions: ${duplicates.join(', ')}`)
  for (const version of ['010', '011', '012', '013', '014', '015', '016', '017']) {
    assert.ok(versions.includes(version), `Missing migration ${version}`)
  }
  assert.equal(files.includes('008_operator_boundary_rls.sql'), false)
  assert.equal(files.includes('009_jobs_effective_timestamp.sql'), false)
})
