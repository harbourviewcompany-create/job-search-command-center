import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium, webkit } from 'playwright'

const baseUrl = process.env.RUNTIME_BASE_URL ?? 'http://127.0.0.1:3000'
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const evidenceDir = process.env.RUNTIME_EVIDENCE_DIR ?? 'qa/runtime-browser'
const runToken = (process.env.RUNTIME_RUN_TOKEN ?? `${Date.now()}`)
  .replace(/[^a-zA-Z0-9-]/g, '-')
  .slice(-48)
const marker = `runtime-qa-${runToken}`

assert(supabaseUrl, 'NEXT_PUBLIC_SUPABASE_URL is required')
assert(supabaseKey, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required')
await mkdir(evidenceDir, { recursive: true })

const checks = []
const consoleEvents = []
const networkEvents = []
const screenshots = []
const fixture = {
  companyIds: [],
  jobIds: [],
  contactIds: [],
  manualJobId: null,
  manualCompanyId: null,
}

function detailText(value) {
  if (value === undefined || value === null) return ''
  return typeof value === 'string' ? value : JSON.stringify(value)
}

function record(name, passed, detail = '') {
  checks.push({ name, passed, detail: detailText(detail) })
}

async function verify(name, operation) {
  try {
    const detail = await operation()
    record(name, true, detail)
    return true
  } catch (error) {
    record(name, false, error instanceof Error ? error.stack ?? error.message : String(error))
    return false
  }
}

function safeNetworkUrl(value) {
  try {
    const url = new URL(value)
    return `${url.origin}${url.pathname}`
  } catch {
    return value.split('?')[0]
  }
}

function attachEvidence(page, label) {
  page.on('console', (message) => {
    consoleEvents.push({
      label,
      type: message.type(),
      text: message.text(),
      location: message.location(),
    })
  })
  page.on('pageerror', (error) => {
    consoleEvents.push({ label, type: 'pageerror', text: error.stack ?? error.message })
  })
  page.on('response', (response) => {
    if (response.request().resourceType() === 'document' || response.status() >= 400) {
      networkEvents.push({
        label,
        method: response.request().method(),
        status: response.status(),
        resourceType: response.request().resourceType(),
        url: safeNetworkUrl(response.url()),
      })
    }
  })
  page.on('requestfailed', (request) => {
    networkEvents.push({
      label,
      method: request.method(),
      status: 0,
      resourceType: request.resourceType(),
      url: safeNetworkUrl(request.url()),
      failure: request.failure()?.errorText ?? 'unknown failure',
    })
  })
}

async function capture(page, name, { fullPage = true } = {}) {
  const path = `${evidenceDir}/${name}.png`
  await page.screenshot({ path, fullPage })
  screenshots.push(path)
  return path
}

async function rest(path, { method = 'GET', body, representation = false } = {}) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Accept-Profile': 'job_search',
      'Content-Profile': 'job_search',
      'Content-Type': 'application/json',
      Prefer: representation ? 'return=representation' : 'return=minimal',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await response.text()
  if (!response.ok) {
    throw new Error(`Supabase REST ${method} ${path} failed (${response.status}): ${text.slice(0, 500)}`)
  }
  return text ? JSON.parse(text) : null
}

async function writeFixtureManifest() {
  await writeFile(
    `${evidenceDir}/fixture-manifest.json`,
    JSON.stringify({ marker, runToken, fixture }, null, 2),
    'utf8'
  )
}

async function seedFixtures() {
  const companyNames = {
    alpha: `QA Alpha ${runToken}`,
    beta: `QA Beta ${runToken}`,
    gamma: `QA MontrÃ©al ${runToken}`,
    delta: `QA Delta ${runToken}`,
    epsilon: `QA Epsilon ${runToken}`,
    zeta: `QA Zeta ${runToken}`,
    filler: `QA Filler ${runToken}`,
  }
  const companies = await rest('companies', {
    method: 'POST',
    representation: true,
    body: Object.values(companyNames).map((name) => ({ name, notes: marker })),
  })
  assert(Array.isArray(companies) && companies.length === 7, 'Expected seven fixture companies')
  fixture.companyIds.push(...companies.map((company) => company.id))
  await writeFixtureManifest()

  const companyId = Object.fromEntries(
    Object.entries(companyNames).map(([key, name]) => [
      key,
      companies.find((company) => company.name === name)?.id,
    ])
  )
  assert(Object.values(companyId).every(Boolean), 'Fixture company IDs were not resolved')

  const futureBase = Date.UTC(2035, 0, 30, 12, 0, 0)
  const primaryJobs = [
    {
      source: 'manual', external_id: `${marker}-alpha`, title: `QA Alpha Remote ${runToken}`,
      company_id: companyId.alpha, location: 'Remote', remote: false, job_type: 'Full-time remote',
      description: `Deterministic remote fixture ${runToken}`, url: `https://example.com/${marker}-alpha`,
      posted_at: new Date(futureBase).toISOString(), fetched_at: new Date(futureBase).toISOString(),
      status: 'found', fit_score: 100, fit_reasons: ['Exact remote fixture', 'Exact remote fixture'],
    },
    {
      source: 'linkedin', external_id: `${marker}-beta`, title: `QA Beta Hybrid ${runToken}`,
      company_id: companyId.beta, location: 'Ottawa · Hybrid', remote: false, job_type: 'Hybrid',
      description: `Deterministic hybrid fixture ${runToken}`, url: `https://example.com/${marker}-beta`,
      posted_at: new Date(futureBase - 86_400_000).toISOString(), fetched_at: new Date(futureBase - 86_400_000).toISOString(),
      status: 'interested', fit_score: 100, fit_reasons: ['Hybrid fixture'],
    },
    {
      source: 'adzuna', external_id: `${marker}-gamma`, title: `IngÃ©nieur QA ${runToken}`,
      company_id: companyId.gamma, location: 'Lima, Lima, PerÃº', remote: false, job_type: 'On-site',
      description: `Deterministic encoding fixture ${runToken}`, url: `https://example.com/${marker}-gamma`,
      posted_at: new Date(futureBase - 2 * 86_400_000).toISOString(), fetched_at: new Date(futureBase - 2 * 86_400_000).toISOString(),
      status: 'found', fit_score: 100, fit_reasons: ['Encoding fixture'],
    },
    {
      source: 'remoteok', external_id: `${marker}-delta`, title: `QA Delta Remote ${runToken}`,
      company_id: companyId.delta, location: 'Canada', remote: true, job_type: 'Contract',
      description: `Deterministic boolean-remote fixture ${runToken}`, url: `https://example.com/${marker}-delta`,
      posted_at: new Date(futureBase - 3 * 86_400_000).toISOString(), fetched_at: new Date(futureBase - 3 * 86_400_000).toISOString(),
      status: 'found', fit_score: 100, fit_reasons: ['Boolean remote fixture'],
    },
    {
      source: 'indeed', external_id: `${marker}-epsilon`, title: `QA Epsilon Location ${runToken}`,
      company_id: companyId.epsilon, location: 'Toronto, ON', remote: false, job_type: 'Full-time',
      description: `Deterministic location fixture ${runToken}`, url: `https://example.com/${marker}-epsilon`,
      posted_at: new Date(futureBase - 4 * 86_400_000).toISOString(), fetched_at: new Date(futureBase - 4 * 86_400_000).toISOString(),
      status: 'found', fit_score: 100, fit_reasons: ['Location fixture'],
    },
    {
      source: 'ziprecruiter', external_id: `${marker}-zeta`, title: `QA Zeta Dismissed ${runToken}`,
      company_id: companyId.zeta, location: 'Gatineau, QC', remote: false, job_type: 'Full-time',
      description: `Deterministic dismissed fixture ${runToken}`, url: `https://example.com/${marker}-zeta`,
      posted_at: new Date(futureBase - 5 * 86_400_000).toISOString(), fetched_at: new Date(futureBase - 5 * 86_400_000).toISOString(),
      status: 'dismissed', fit_score: 100, fit_reasons: ['Dismissed fixture'],
    },
  ]
  const fillerJobs = Array.from({ length: 24 }, (_, index) => ({
    source: 'manual', external_id: `${marker}-filler-${index + 1}`,
    title: `QA Filler ${String(index + 1).padStart(2, '0')} ${runToken}`,
    company_id: companyId.filler, location: 'Ottawa, ON', remote: false, job_type: 'Full-time',
    description: `Pagination fixture ${runToken}`,
    posted_at: new Date(futureBase - (10 + index) * 86_400_000).toISOString(),
    fetched_at: new Date(futureBase - (10 + index) * 86_400_000).toISOString(),
    status: 'found', fit_score: 90 - index, fit_reasons: ['Pagination fixture'],
  }))
  const jobs = await rest('jobs', {
    method: 'POST', representation: true, body: [...primaryJobs, ...fillerJobs],
  })
  assert(Array.isArray(jobs) && jobs.length === 30, 'Expected thirty fixture jobs')
  fixture.jobIds.push(...jobs.map((job) => job.id))
  await writeFixtureManifest()

  const contacts = await rest('contacts', {
    method: 'POST', representation: true,
    body: {
      company_id: companyId.gamma, name: `JosÃ© Runtime ${runToken}`,
      title: 'Directeur Ã‰lite', email: `runtime-${runToken}@example.com`, source: marker,
    },
  })
  assert(Array.isArray(contacts) && contacts[0]?.id, 'Fixture contact was not created')
  fixture.contactIds.push(contacts[0].id)
  await writeFixtureManifest()

  return {
    alphaJobId: jobs.find((job) => job.external_id === `${marker}-alpha`)?.id,
    gammaJobId: jobs.find((job) => job.external_id === `${marker}-gamma`)?.id,
  }
}

async function discoverManualJob(title) {
  const rows = await rest(`jobs?select=id,company_id,status,title&title=eq.${encodeURIComponent(title)}`)
  const row = rows?.[0] ?? null
  if (row) {
    fixture.manualJobId = row.id
    fixture.manualCompanyId = row.company_id
    await writeFixtureManifest()
  }
  return row
}

function inFilter(values) {
  const unique = Array.from(new Set(values.filter(Boolean)))
  return unique.length > 0 ? `in.(${unique.join(',')})` : null
}

async function cleanupFixtures() {
  try {
    const discoveredJobs = await rest(
      `jobs?select=id,company_id&external_id=like.${encodeURIComponent(`${marker}*`)}`
    )
    const manualRows = await rest(
      `jobs?select=id,company_id&title=like.${encodeURIComponent(`*${runToken}*`)}`
    )
    const jobIds = new Set([
      ...fixture.jobIds,
      ...((discoveredJobs ?? []).map((row) => row.id)),
      ...((manualRows ?? []).map((row) => row.id)),
      fixture.manualJobId,
    ].filter(Boolean))
    const companyIds = new Set([
      ...fixture.companyIds,
      ...((discoveredJobs ?? []).map((row) => row.company_id).filter(Boolean)),
      ...((manualRows ?? []).map((row) => row.company_id).filter(Boolean)),
      fixture.manualCompanyId,
    ].filter(Boolean))

    const jobsFilter = inFilter([...jobIds])
    if (jobsFilter) {
      await rest(`applications?job_id=${jobsFilter}`, { method: 'DELETE' })
      await rest(`jobs?id=${jobsFilter}`, { method: 'DELETE' })
    }
    await rest(`contacts?source=eq.${encodeURIComponent(marker)}`, { method: 'DELETE' })
    const companiesFilter = inFilter([...companyIds])
    if (companiesFilter) await rest(`companies?id=${companiesFilter}`, { method: 'DELETE' })

    const remaining = await rest(`jobs?select=id&external_id=like.${encodeURIComponent(`${marker}*`)}`)
    assert.equal(remaining?.length ?? 0, 0, 'Fixture jobs remain after cleanup')
    record('Cleanup temporary runtime records', true, `${jobIds.size} jobs; ${companyIds.size} companies`)
  } catch (error) {
    record('Cleanup temporary runtime records', false, error instanceof Error ? error.message : String(error))
  }
}

function statusSelect(page) {
  return page.getByRole('combobox', { name: 'Status', exact: true })
}
function sourceSelect(page) {
  return page.getByRole('combobox', { name: 'Source', exact: true })
}
function arrangementSelect(page) {
  return page.getByRole('combobox', { name: 'Work arrangement', exact: true })
}
function sortSelect(page) {
  return page.getByRole('combobox', { name: 'Sort jobs', exact: true })
}
async function cardValues(page, selector) {
  return page.locator('article').evaluateAll(
    (articles, requestedSelector) =>
      articles.map((article) => article.querySelector(requestedSelector)?.textContent?.trim() ?? ''),
    selector
  )
}
function compareDisplayedCompanies(left, right) {
  const leftUnknown = left === 'Unknown company'
  const rightUnknown = right === 'Unknown company'
  if (leftUnknown && rightUnknown) return 0
  if (leftUnknown) return 1
  if (rightUnknown) return -1
  return left.localeCompare(right, undefined, { sensitivity: 'base', numeric: true })
}

async function verifyFiltersAndSorts(page) {
  const cards = page.locator('article')
  const search = page.getByRole('searchbox', { name: 'Search jobs', exact: true })
  await search.fill(runToken)
  await page.waitForTimeout(200)
  assert((await cards.count()) >= 6, 'Seeded baseline is not visible on page one')
  record('Search filters to deterministic fixtures', true, `${await cards.count()} cards`)

  for (const [value, expected] of [
    ['active', null], ['all', null], ['found', 'To triage'],
    ['interested', 'Interested'], ['dismissed', 'Dismissed'],
  ]) {
    await statusSelect(page).selectOption(value)
    await page.waitForTimeout(100)
    const values = await cardValues(page, '[data-job-status]')
    const valid = value === 'active'
      ? values.length > 0 && values.every((item) => item !== 'Dismissed')
      : value === 'all'
        ? values.length > 0
        : values.length > 0 && values.every((item) => item === expected)
    record(`Status filter: ${value}`, valid, `${values.length} cards; ${[...new Set(values)].join(', ')}`)
  }

  await statusSelect(page).selectOption('all')
  const expectedSources = new Map([
    ['manual', 'Manual'], ['linkedin', 'LinkedIn'], ['adzuna', 'Adzuna'],
    ['remoteok', 'Remote OK'], ['indeed', 'Indeed'], ['ziprecruiter', 'ZipRecruiter'],
  ])
  for (const [value, label] of expectedSources) {
    await sourceSelect(page).selectOption(value)
    await page.waitForTimeout(100)
    const values = await cardValues(page, '[data-job-metadata="source"]')
    record(
      `Source filter: ${value}`,
      values.length > 0 && values.every((item) => item === label),
      `${values.length} cards; ${[...new Set(values)].join(', ')}`
    )
  }
  await sourceSelect(page).selectOption('all')

  for (const [value, label] of [
    ['remote', 'Remote'], ['hybrid', 'Hybrid'], ['location', 'Location-based'],
  ]) {
    await arrangementSelect(page).selectOption(value)
    await page.waitForTimeout(100)
    const values = await cardValues(page, '[data-job-metadata="arrangement"]')
    record(
      `Arrangement filter: ${value}`,
      values.length > 0 && values.every((item) => item === label),
      `${values.length} cards; ${[...new Set(values)].join(', ')}`
    )
  }
  await arrangementSelect(page).selectOption('all')

  await sortSelect(page).selectOption('fit')
  let numericValues = await page.locator('article [data-job-fit-score]').evaluateAll((nodes) =>
    nodes.map((node) => Number(node.getAttribute('data-job-fit-score')))
  )
  record('Sort: best fit', numericValues.every((value, index) => index === 0 || numericValues[index - 1] >= value), numericValues.slice(0, 12))

  await sortSelect(page).selectOption('company')
  const companies = await cardValues(page, '[data-job-company]')
  const sortedCompanies = [...companies].sort(compareDisplayedCompanies)
  record('Sort: company A–Z', companies.every((value, index) => value === sortedCompanies[index]), companies.slice(0, 10))

  for (const [option, direction] of [['newest', 'desc'], ['oldest', 'asc']]) {
    await sortSelect(page).selectOption(option)
    const dateValues = await cardValues(page, '[data-job-metadata="date"]')
    numericValues = dateValues
      .map((value) => Date.parse(value.replace(/^(Posted|Added) /, '')))
      .filter(Number.isFinite)
    const valid = numericValues.every((value, index) => {
      if (index === 0) return true
      return direction === 'desc' ? numericValues[index - 1] >= value : numericValues[index - 1] <= value
    })
    record(`Sort: ${option} first`, valid, numericValues.slice(0, 12))
  }

  await sortSelect(page).selectOption('fit')
  await statusSelect(page).selectOption('active')
  await search.fill('')
}

async function waitForStatus(card, label) {
  await card.locator('button[aria-pressed="true"]').filter({ hasText: label }).waitFor()
}

async function verifyStatusMutations(page, alphaJobId) {
  const search = page.getByRole('searchbox', { name: 'Search jobs', exact: true })
  await search.fill(`QA Alpha Remote ${runToken}`)
  const card = page.locator('article').filter({ has: page.getByRole('heading', { name: `QA Alpha Remote ${runToken}` }) })
  await card.waitFor()
  for (const [buttonLabel, expectedStatus] of [
    ['Interested', 'interested'], ['Dismiss', 'dismissed'], ['Triage', 'found'],
  ]) {
    await card.getByRole('button', { name: buttonLabel, exact: true }).click()
    await waitForStatus(card, buttonLabel)
    const rows = await rest(`jobs?select=status&id=eq.${alphaJobId}`)
    assert.equal(rows?.[0]?.status, expectedStatus)
    record(`Status mutation: ${expectedStatus}`, true, rows[0])
  }
  await search.fill('')
}

async function verifyAddJobRefresh(page) {
  const manualTitle = `QA Manual Add ${runToken}`
  const manualCompany = `QA Manual Company ${runToken}`
  await page.locator('summary').filter({ hasText: 'Add or import jobs' }).click()
  const form = page.locator('form').filter({ hasText: 'Add job manually' })
  await form.locator('input[name="title"]').fill(manualTitle)
  await form.locator('input[name="company"]').fill(manualCompany)
  await form.locator('input[name="location"]').fill('Remote')
  await form.locator('textarea[name="description"]').fill(`Manual refresh fixture ${runToken}`)
  await form.locator('input[name="remote"]').check()
  await form.getByRole('button', { name: 'Add job', exact: true }).click()
  await form.getByText('Job added to the triage queue.').waitFor()
  const search = page.getByRole('searchbox', { name: 'Search jobs', exact: true })
  await search.fill(manualTitle)
  await page.getByRole('heading', { name: manualTitle }).waitFor({ timeout: 15_000 })
  const created = await discoverManualJob(manualTitle)
  assert(created?.id, 'Manual job was not found in Supabase')
  record('Add job refreshes the existing command-center state', true, created.id)
  await search.fill('')
}

async function verifyPullAuthorizationAndFeedback(page) {
  const unauthorized = await page.request.post(`${baseUrl}/api/jobs/pull`)
  assert.equal(unauthorized.status(), 401)
  record('Job-pull API rejects missing authorization', true, unauthorized.status())
  const button = page.getByRole('button', { name: 'Pull latest jobs', exact: true })
  assert.equal(await button.isEnabled(), true, 'Job pull button is disabled')
  await button.click()
  const feedback = page.getByText(/\d+ new · \d+ refreshed/)
  await feedback.waitFor({ timeout: 45_000 })
  record('Authorized job pull returns UI feedback', true, await feedback.textContent())
}

async function verifyExternalLinks(page) {
  const links = page.locator('article a[target="_blank"]')
  const count = await links.count()
  assert(count > 0, 'No external listing links found')
  const attributes = await links.evaluateAll((nodes) => nodes.map((node) => ({
    target: node.getAttribute('target'), rel: node.getAttribute('rel'),
  })))
  assert(attributes.every((item) => item.target === '_blank' && item.rel?.includes('noopener') && item.rel?.includes('noreferrer')))
  record('External listing links use hardened new-tab attributes', true, `${count} links`)
}

async function verifyPagination(page) {
  await page.goto(`${baseUrl}/jobs`, { waitUntil: 'networkidle' })
  const totalText = await page.locator('[data-pagination-total]').textContent()
  const next = page.getByRole('link', { name: /Next/ })
  assert(await next.isVisible(), `Next-page link missing: ${totalText}`)
  await next.click()
  await page.getByText(/Page 2 of/).waitFor()
  assert.equal(new URL(page.url()).searchParams.get('page'), '2')
  record('Pagination exposes records beyond the first page', true, page.url())
  await page.goto(`${baseUrl}/jobs`, { waitUntil: 'networkidle' })
}

async function verifyEncodingAcrossRoutes(page) {
  const search = page.getByRole('searchbox', { name: 'Search jobs', exact: true })
  await search.fill(`Ingénieur QA ${runToken}`)
  const card = page.locator('article').filter({ has: page.getByRole('heading', { name: `Ingénieur QA ${runToken}` }) })
  await card.waitFor()
  assert.equal(await card.locator('[data-job-metadata="location"]').textContent(), 'Lima, Lima, Perú')
  assert((await card.locator('[data-job-company]').textContent())?.includes('Montréal'))
  record('Jobs repair imported encoding', true)

  await page.goto(`${baseUrl}/dashboard`, { waitUntil: 'networkidle' })
  await page.getByText(`Ingénieur QA ${runToken}`, { exact: true }).first().waitFor()
  assert((await page.locator('body').textContent())?.includes('Montréal'))
  record('Dashboard repairs imported encoding', true)

  await page.goto(`${baseUrl}/contacts`, { waitUntil: 'networkidle' })
  await page.getByText(`José Runtime ${runToken}`, { exact: true }).waitFor()
  await page.getByText('Directeur Élite', { exact: true }).waitFor()
  assert((await page.locator('body').textContent())?.includes('Montréal'))
  record('Contacts repair imported encoding', true)
  await page.goto(`${baseUrl}/jobs`, { waitUntil: 'networkidle' })
}

async function verifyViewport(browser, name, width, height) {
  const context = await browser.newContext({ viewport: { width, height } })
  try {
    const page = await context.newPage()
    attachEvidence(page, name)
    await page.goto(`${baseUrl}/jobs`, { waitUntil: 'networkidle' })
    const result = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      cardCount: document.querySelectorAll('article').length,
    }))
    assert(result.overflow <= 1, `${result.overflow}px horizontal overflow`)
    assert(result.cardCount > 0, 'No job cards rendered')
    await capture(page, `jobs-${name}`)
    return result
  } finally {
    await context.close()
  }
}

async function verifyKeyboard(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  try {
    const page = await context.newPage()
    attachEvidence(page, 'keyboard')
    await page.goto(`${baseUrl}/jobs`, { waitUntil: 'networkidle' })
    await page.keyboard.press('Tab')
    const first = await page.evaluate(() => ({
      text: document.activeElement?.textContent?.trim(),
      href: document.activeElement?.getAttribute('href'),
    }))
    assert.equal(first.text, 'Skip to main content')
    assert.equal(first.href, '#main-content')
    await page.keyboard.press('Enter')
    const mainFocused = await page.evaluate(() => document.activeElement?.id === 'main-content' || location.hash === '#main-content')
    assert(mainFocused)
    const sequence = []
    for (let index = 0; index < 20; index += 1) {
      await page.keyboard.press('Tab')
      sequence.push(await page.evaluate(() => ({
        tag: document.activeElement?.tagName ?? '',
        text: document.activeElement?.textContent?.trim().slice(0, 80) ?? '',
        visible: document.activeElement instanceof HTMLElement
          ? Boolean(document.activeElement.offsetWidth || document.activeElement.offsetHeight || document.activeElement.getClientRects().length)
          : false,
      })))
    }
    assert(sequence.every((item) => item.visible))
    return sequence
  } finally {
    await context.close()
  }
}

async function verifyReducedMotion(browser) {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, reducedMotion: 'reduce' })
  try {
    const page = await context.newPage()
    attachEvidence(page, 'reduced-motion')
    await page.goto(`${baseUrl}/jobs`, { waitUntil: 'networkidle' })
    const duration = await page.getByRole('button', { name: 'Pull latest jobs' }).evaluate(
      (element) => getComputedStyle(element).transitionDuration
    )
    const seconds = duration.split(',').map((value) => {
      const item = value.trim()
      return item.endsWith('ms') ? Number.parseFloat(item) / 1000 : Number.parseFloat(item)
    })
    assert(seconds.every((value) => Number.isFinite(value) && value <= 0.00002), duration)
    return duration
  } finally {
    await context.close()
  }
}

async function verifyIosSafeArea() {
  const browser = await webkit.launch()
  try {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 }, isMobile: true, deviceScaleFactor: 3, hasTouch: true,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    })
    try {
      const page = await context.newPage()
      attachEvidence(page, 'webkit-ios-375')
      await page.goto(`${baseUrl}/jobs`, { waitUntil: 'networkidle' })
      const result = await page.evaluate(() => {
        const header = document.querySelector('header')?.getBoundingClientRect()
        const main = document.querySelector('main')?.getBoundingClientRect()
        const viewport = document.querySelector('meta[name="viewport"]')?.getAttribute('content') ?? ''
        const css = Array.from(document.styleSheets).flatMap((sheet) => {
          try { return Array.from(sheet.cssRules).map((rule) => rule.cssText) } catch { return [] }
        }).join('\n')
        return {
          viewport, safeAreaTop: css.includes('env(safe-area-inset-top)'),
          safeAreaBottom: css.includes('env(safe-area-inset-bottom)'),
          headerTop: header?.top ?? -1, headerBottom: header?.bottom ?? -1,
          mainTop: main?.top ?? -1,
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        }
      })
      assert(result.viewport.includes('viewport-fit=cover'), result.viewport)
      assert(result.safeAreaTop && result.safeAreaBottom, JSON.stringify(result))
      assert(result.headerTop >= 0 && result.mainTop >= result.headerBottom - 1, JSON.stringify(result))
      assert(result.overflow <= 1, `${result.overflow}px`)
      await capture(page, 'jobs-webkit-ios-375', { fullPage: false })
      return result
    } finally {
      await context.close()
    }
  } finally {
    await browser.close()
  }
}

async function writeEvidence() {
  const actionableConsole = consoleEvents.filter((event) => event.type === 'error' || event.type === 'pageerror')
  const actionableNetwork = networkEvents.filter((event) => {
    if (event.status >= 400) return event.status !== 401 || !event.url.endsWith('/api/jobs/pull')
    if (event.status !== 0) return false
    return !event.failure?.includes('ERR_ABORTED') && !event.url.includes('_rsc')
  })
  record('Console: no errors or page errors', actionableConsole.length === 0, actionableConsole)
  record('Network: no actionable request failures', actionableNetwork.length === 0, actionableNetwork)
  const failed = checks.filter((check) => !check.passed)
  const evidence = {
    generatedAt: new Date().toISOString(), source: process.env.GITHUB_SHA ?? null, marker,
    summary: { total: checks.length, passed: checks.length - failed.length, failed: failed.length },
    checks, screenshots, consoleEvents, networkEvents,
  }
  await writeFile(`${evidenceDir}/runtime-browser-evidence.json`, JSON.stringify(evidence, null, 2), 'utf8')
  const markdown = [
    '# Deterministic Real-Runtime Browser Verification', '',
    `- Source commit: \`${evidence.source ?? 'local'}\``,
    `- Fixture marker: \`${marker}\``,
    `- Checks: **${evidence.summary.passed}/${evidence.summary.total} passed**`,
    `- Failed: **${evidence.summary.failed}**`, '',
    '| Result | Check | Detail |', '|---|---|---|',
    ...checks.map((check) => `| ${check.passed ? 'PASS' : 'FAIL'} | ${check.name.replaceAll('|', '\\|')} | ${check.detail.replaceAll('|', '\\|').replaceAll('\n', ' ').slice(0, 500)} |`),
    '', '## Screenshots', '', ...screenshots.map((path) => `- \`${path}\``), '',
  ].join('\n')
  await writeFile(`${evidenceDir}/RUNTIME_BROWSER_VERIFICATION.md`, markdown, 'utf8')
  return evidence.summary.failed
}

let browser = null
let fixtureIds = null
let fatalError = null
try {
  fixtureIds = await seedFixtures()
  assert(fixtureIds.alphaJobId && fixtureIds.gammaJobId, 'Primary fixture job IDs are missing')
  record('Deterministic Supabase fixtures seeded', true, fixtureIds)
  browser = await chromium.launch()
  await verify('Viewport 375: no horizontal overflow', () => verifyViewport(browser, 'mobile-375', 375, 812))
  await verify('Viewport 768: no horizontal overflow', () => verifyViewport(browser, 'tablet-768', 768, 1024))
  await verify('Viewport 1440: no horizontal overflow', () => verifyViewport(browser, 'desktop-1440', 1440, 1000))

  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  try {
    const page = await context.newPage()
    attachEvidence(page, 'functional-desktop-1440')
    await page.goto(`${baseUrl}/jobs`, { waitUntil: 'networkidle' })
    await verify('Search, filters, and sorts', () => verifyFiltersAndSorts(page))
    await verify('External listing links', () => verifyExternalLinks(page))
    await verify('Add-job refresh behavior', () => verifyAddJobRefresh(page))
    await verify('Status mutation lifecycle', () => verifyStatusMutations(page, fixtureIds.alphaJobId))
    await verify('Authorized pull flow', () => verifyPullAuthorizationAndFeedback(page))
    await verify('Paginated jobs remain reachable', () => verifyPagination(page))
    await verify('Encoding repair across routes', () => verifyEncodingAcrossRoutes(page))
    await page.goto(`${baseUrl}/jobs`, { waitUntil: 'networkidle' })
    await capture(page, 'jobs-functional-desktop-1440')
  } finally {
    await context.close()
  }
  await verify('Keyboard navigation', () => verifyKeyboard(browser))
  await verify('Reduced motion', () => verifyReducedMotion(browser))
  await verify('iOS WebKit safe area', () => verifyIosSafeArea())
} catch (error) {
  fatalError = error
  record('Fatal runtime verification execution', false, error instanceof Error ? error.stack ?? error.message : String(error))
} finally {
  if (browser) await browser.close().catch(() => undefined)
  await cleanupFixtures()
}

const failedCount = await writeEvidence()
if (fatalError || failedCount > 0) process.exitCode = 1
