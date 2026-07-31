import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium, webkit } from 'playwright'

const baseUrl = process.env.RUNTIME_BASE_URL ?? 'http://127.0.0.1:3000'
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceKey = process.env.JOB_PULL_API_KEY
const evidenceDir = process.env.RUNTIME_EVIDENCE_DIR ?? 'qa/runtime-browser'
const runToken = (process.env.RUNTIME_RUN_TOKEN ?? `${Date.now()}`)
  .replace(/[^a-zA-Z0-9-]/g, '-')
  .slice(-48)
const marker = `runtime-qa-${runToken}`

assert(supabaseUrl, 'NEXT_PUBLIC_SUPABASE_URL is required')
assert(supabaseKey, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required')
assert(serviceKey, 'JOB_PULL_API_KEY is required')
await mkdir(evidenceDir, { recursive: true })

const checks = []
const consoleEvents = []
const networkEvents = []
const screenshots = []
const fixture = { companyIds: [], jobIds: [], contactIds: [], manualJobId: null, manualCompanyId: null }

function detail(value) {
  if (value == null) return ''
  return typeof value === 'string' ? value : JSON.stringify(value)
}

function record(name, passed, value = '') {
  checks.push({ name, passed, detail: detail(value) })
}

async function verify(name, operation) {
  try {
    record(name, true, await operation())
  } catch (error) {
    record(name, false, error instanceof Error ? error.stack ?? error.message : String(error))
  }
}

function sanitizedUrl(value) {
  try {
    const url = new URL(value)
    return `${url.origin}${url.pathname}`
  } catch {
    return value.split('?')[0]
  }
}

function attachEvidence(page, label) {
  page.on('console', (message) => {
    consoleEvents.push({ label, type: message.type(), text: message.text(), location: message.location() })
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
        url: sanitizedUrl(response.url()),
      })
    }
  })
  page.on('requestfailed', (request) => {
    networkEvents.push({
      label,
      method: request.method(),
      status: 0,
      resourceType: request.resourceType(),
      url: sanitizedUrl(request.url()),
      failure: request.failure()?.errorText ?? 'unknown failure',
    })
  })
}

async function capture(page, name, fullPage = true) {
  const path = `${evidenceDir}/${name}.png`
  await page.screenshot({ path, fullPage })
  screenshots.push(path)
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
  if (!response.ok) throw new Error(`Supabase ${method} ${path} failed (${response.status}): ${text.slice(0, 400)}`)
  return text ? JSON.parse(text) : null
}

async function saveManifest() {
  await writeFile(`${evidenceDir}/fixture-manifest.json`, JSON.stringify({ marker, runToken, fixture }, null, 2), 'utf8')
}

async function seedFixtures() {
  const names = {
    alpha: `QA Alpha ${runToken}`,
    beta: `QA Beta ${runToken}`,
    gamma: `QA MontrÃ©al ${runToken}`,
    delta: `QA Delta ${runToken}`,
    epsilon: `QA Epsilon ${runToken}`,
    zeta: `QA Zeta ${runToken}`,
    filler: `QA Filler ${runToken}`,
  }
  const companies = await rest('companies', {
    method: 'POST', representation: true,
    body: Object.values(names).map((name) => ({ name, notes: marker })),
  })
  assert.equal(companies.length, 7)
  fixture.companyIds.push(...companies.map((company) => company.id))
  await saveManifest()
  const id = Object.fromEntries(Object.entries(names).map(([key, name]) => [key, companies.find((company) => company.name === name)?.id]))
  assert(Object.values(id).every(Boolean))

  const base = Date.UTC(2035, 0, 30, 12)
  const core = [
    ['manual', 'alpha', 'QA Alpha Remote', 'Remote', false, 'Full-time remote', 'found'],
    ['linkedin', 'beta', 'QA Beta Hybrid', 'Ottawa · Hybrid', false, 'Hybrid', 'interested'],
    ['adzuna', 'gamma', 'IngÃ©nieur QA', 'Lima, Lima, PerÃº', false, 'On-site', 'found'],
    ['remoteok', 'delta', 'QA Delta Remote', 'Canada', true, 'Contract', 'found'],
    ['indeed', 'epsilon', 'QA Epsilon Location', 'Toronto, ON', false, 'Full-time', 'found'],
    ['ziprecruiter', 'zeta', 'QA Zeta Dismissed', 'Gatineau, QC', false, 'Full-time', 'dismissed'],
  ].map(([source, company, title, location, remote, jobType, status], index) => ({
    source,
    external_id: `${marker}-core-${index}`,
    title: `${title} ${runToken}`,
    company_id: id[company],
    location,
    remote,
    job_type: jobType,
    description: `Deterministic core fixture ${runToken}`,
    url: `https://example.com/${marker}-${index}`,
    posted_at: new Date(base - index * 86_400_000).toISOString(),
    fetched_at: new Date(base - index * 86_400_000).toISOString(),
    status,
    fit_score: 100,
    fit_reasons: index === 0 ? ['Duplicate fixture', 'Duplicate fixture'] : ['Core fixture'],
  }))
  const filler = Array.from({ length: 24 }, (_, index) => ({
    source: 'manual',
    external_id: `${marker}-filler-${index}`,
    title: `QA Filler ${String(index + 1).padStart(2, '0')} ${runToken}`,
    company_id: id.filler,
    location: 'Ottawa, ON',
    remote: false,
    job_type: 'Full-time',
    description: `Pagination fixture ${runToken}`,
    posted_at: new Date(base - (10 + index) * 86_400_000).toISOString(),
    fetched_at: new Date(base - (10 + index) * 86_400_000).toISOString(),
    status: 'found',
    fit_score: 90 - index,
    fit_reasons: ['Pagination fixture'],
  }))
  const jobs = await rest('jobs', { method: 'POST', representation: true, body: [...core, ...filler] })
  assert.equal(jobs.length, 30)
  fixture.jobIds.push(...jobs.map((job) => job.id))
  await saveManifest()

  const contacts = await rest('contacts', {
    method: 'POST', representation: true,
    body: { company_id: id.gamma, name: `JosÃ© Runtime ${runToken}`, title: 'Directeur Ã‰lite', email: `runtime-${runToken}@example.com`, source: marker },
  })
  fixture.contactIds.push(contacts[0].id)
  await saveManifest()
  return { alphaJobId: jobs.find((job) => job.external_id === `${marker}-core-0`)?.id }
}

function statusSelect(page) { return page.getByRole('combobox', { name: 'Status', exact: true }) }
function sourceSelect(page) { return page.getByRole('combobox', { name: 'Source', exact: true }) }
function arrangementSelect(page) { return page.getByRole('combobox', { name: 'Work arrangement', exact: true }) }
function sortSelect(page) { return page.getByRole('combobox', { name: 'Sort jobs', exact: true }) }

async function values(page, selector) {
  return page.locator('article').evaluateAll(
    (articles, requested) => articles.map((article) => article.querySelector(requested)?.textContent?.trim() ?? ''),
    selector
  )
}

function compareCompanies(left, right) {
  if (left === 'Unknown company') return right === 'Unknown company' ? 0 : 1
  if (right === 'Unknown company') return -1
  return left.localeCompare(right, undefined, { sensitivity: 'base', numeric: true })
}

async function filtersAndSorts(page) {
  const search = page.getByRole('searchbox', { name: 'Search jobs', exact: true })
  await search.fill(runToken)
  await page.waitForTimeout(150)
  assert((await page.locator('article').count()) >= 6)

  for (const [value, label] of [['active', null], ['all', null], ['found', 'To triage'], ['interested', 'Interested'], ['dismissed', 'Dismissed']]) {
    await statusSelect(page).selectOption(value)
    const found = await values(page, '[data-job-status]')
    const valid = value === 'active' ? found.length > 0 && found.every((item) => item !== 'Dismissed')
      : value === 'all' ? found.length > 0 : found.length > 0 && found.every((item) => item === label)
    assert(valid, `${value}: ${found.join(', ')}`)
    record(`Status filter: ${value}`, true, found.length)
  }

  await statusSelect(page).selectOption('all')
  for (const [source, label] of [['manual', 'Manual'], ['linkedin', 'LinkedIn'], ['adzuna', 'Adzuna'], ['remoteok', 'Remote OK'], ['indeed', 'Indeed'], ['ziprecruiter', 'ZipRecruiter']]) {
    await sourceSelect(page).selectOption(source)
    const found = await values(page, '[data-job-metadata="source"]')
    assert(found.length > 0 && found.every((item) => item === label), `${source}: ${found.join(', ')}`)
    record(`Source filter: ${source}`, true, found.length)
  }

  await sourceSelect(page).selectOption('all')
  for (const [arrangement, label] of [['remote', 'Remote'], ['hybrid', 'Hybrid'], ['location', 'Location-based']]) {
    await arrangementSelect(page).selectOption(arrangement)
    const found = await values(page, '[data-job-metadata="arrangement"]')
    assert(found.length > 0 && found.every((item) => item === label), `${arrangement}: ${found.join(', ')}`)
    record(`Arrangement filter: ${arrangement}`, true, found.length)
  }

  await arrangementSelect(page).selectOption('all')
  await sortSelect(page).selectOption('fit')
  const scores = await page.locator('[data-job-fit-score]').evaluateAll((nodes) => nodes.map((node) => Number(node.getAttribute('data-job-fit-score'))))
  assert(scores.every((score, index) => index === 0 || scores[index - 1] >= score))
  record('Sort: best fit', true, scores.slice(0, 10))

  await sortSelect(page).selectOption('company')
  const companies = await values(page, '[data-job-company]')
  const expected = [...companies].sort(compareCompanies)
  assert(companies.every((company, index) => company === expected[index]))
  record('Sort: company A–Z', true, companies.slice(0, 10))

  for (const [sort, direction] of [['newest', 'desc'], ['oldest', 'asc']]) {
    await sortSelect(page).selectOption(sort)
    const dates = (await values(page, '[data-job-metadata="date"]'))
      .map((value) => Date.parse(value.replace(/^(Posted|Added) /, '')))
      .filter(Number.isFinite)
    assert(dates.every((date, index) => index === 0 || (direction === 'desc' ? dates[index - 1] >= date : dates[index - 1] <= date)))
    record(`Sort: ${sort} first`, true, dates.slice(0, 10))
  }

  await search.fill('')
  await statusSelect(page).selectOption('active')
  await sourceSelect(page).selectOption('all')
  await arrangementSelect(page).selectOption('all')
  await sortSelect(page).selectOption('fit')
}

async function addJobRefresh(page) {
  const title = `QA Manual Add ${runToken}`
  const company = `QA Manual Company ${runToken}`
  await page.locator('summary').filter({ hasText: 'Add or import jobs' }).click()
  const form = page.locator('form').filter({ hasText: 'Add job manually' })
  await form.locator('input[name="title"]').fill(title)
  await form.locator('input[name="company"]').fill(company)
  await form.locator('input[name="location"]').fill('Remote')
  await form.locator('input[name="remote"]').check()
  await form.getByRole('button', { name: 'Add job', exact: true }).click()
  await form.getByText('Job added to the triage queue.').waitFor()
  const search = page.getByRole('searchbox', { name: 'Search jobs', exact: true })
  await search.fill(title)
  await page.getByRole('heading', { name: title }).waitFor({ timeout: 15_000 })
  const rows = await rest(`jobs?select=id,company_id&title=eq.${encodeURIComponent(title)}`)
  assert(rows[0]?.id)
  fixture.manualJobId = rows[0].id
  fixture.manualCompanyId = rows[0].company_id
  await saveManifest()
  await search.fill('')
  return rows[0].id
}

async function statusLifecycle(page, jobId) {
  const search = page.getByRole('searchbox', { name: 'Search jobs', exact: true })
  const title = `QA Alpha Remote ${runToken}`
  await search.fill(title)
  const card = page.locator('article').filter({ has: page.getByRole('heading', { name: title }) })
  for (const [button, status] of [['Interested', 'interested'], ['Dismiss', 'dismissed'], ['Triage', 'found']]) {
    await card.getByRole('button', { name: button, exact: true }).click()
    await card.locator('button[aria-pressed="true"]').filter({ hasText: button }).waitFor()
    const rows = await rest(`jobs?select=status&id=eq.${jobId}`)
    assert.equal(rows[0]?.status, status)
    record(`Status mutation: ${status}`, true)
  }
  await search.fill('')
}

async function pullAuthorization(page) {
  const unauthorized = await page.request.post(`${baseUrl}/api/jobs/pull`)
  assert.equal(unauthorized.status(), 401)
  const authorized = await page.request.post(`${baseUrl}/api/jobs/pull`, {
    headers: { Authorization: `Bearer ${serviceKey}` },
    timeout: 45_000,
  })
  assert.equal(authorized.status(), 200, await authorized.text())
  const payload = await authorized.json()
  assert(payload.ok !== false)
  const button = page.getByRole('button', { name: 'Pull latest jobs', exact: true })
  assert.equal(await button.isDisabled(), true)
  await page.getByText('An authenticated Supabase session is required for manual pulls.').waitFor()
  return payload
}

async function pagination(page) {
  await page.goto(`${baseUrl}/jobs`, { waitUntil: 'networkidle' })
  const next = page.getByRole('link', { name: /Next/ })
  assert(await next.isVisible())
  await next.click()
  await page.getByText(/Page 2 of/).waitFor()
  assert.equal(new URL(page.url()).searchParams.get('page'), '2')
  await page.goto(`${baseUrl}/jobs`, { waitUntil: 'networkidle' })
}

async function encodingAcrossRoutes(page) {
  const search = page.getByRole('searchbox', { name: 'Search jobs', exact: true })
  await search.fill(`Ingénieur QA ${runToken}`)
  const card = page.locator('article').filter({ has: page.getByRole('heading', { name: `Ingénieur QA ${runToken}` }) })
  await card.waitFor()
  assert.equal(await card.locator('[data-job-metadata="location"]').textContent(), 'Lima, Lima, Perú')
  assert((await card.locator('[data-job-company]').textContent())?.includes('Montréal'))
  await page.goto(`${baseUrl}/dashboard`, { waitUntil: 'networkidle' })
  await page.getByText(`Ingénieur QA ${runToken}`, { exact: true }).first().waitFor()
  assert((await page.locator('body').textContent())?.includes('Montréal'))
  await page.goto(`${baseUrl}/contacts`, { waitUntil: 'networkidle' })
  await page.getByText(`José Runtime ${runToken}`, { exact: true }).waitFor()
  await page.getByText('Directeur Élite', { exact: true }).waitFor()
  assert((await page.locator('body').textContent())?.includes('Montréal'))
  await page.goto(`${baseUrl}/jobs`, { waitUntil: 'networkidle' })
}

async function viewport(browser, name, width, height) {
  const context = await browser.newContext({ viewport: { width, height } })
  try {
    const page = await context.newPage()
    attachEvidence(page, name)
    await page.goto(`${baseUrl}/jobs`, { waitUntil: 'networkidle' })
    const state = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      cards: document.querySelectorAll('article').length,
    }))
    assert(state.overflow <= 1 && state.cards > 0, JSON.stringify(state))
    await capture(page, `jobs-${name}`)
    return state
  } finally {
    await context.close()
  }
}

async function keyboard(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  try {
    const page = await context.newPage()
    attachEvidence(page, 'keyboard')
    await page.goto(`${baseUrl}/jobs`, { waitUntil: 'networkidle' })
    await page.keyboard.press('Tab')
    assert.equal(await page.evaluate(() => document.activeElement?.textContent?.trim()), 'Skip to main content')
    await page.keyboard.press('Enter')
    assert(await page.evaluate(() => document.activeElement?.id === 'main-content' || location.hash === '#main-content'))
    for (let index = 0; index < 20; index += 1) {
      await page.keyboard.press('Tab')
      assert(await page.evaluate(() => document.activeElement instanceof HTMLElement && Boolean(document.activeElement.offsetWidth || document.activeElement.offsetHeight || document.activeElement.getClientRects().length)))
    }
  } finally {
    await context.close()
  }
}

async function reducedMotion(browser) {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, reducedMotion: 'reduce' })
  try {
    const page = await context.newPage()
    await page.goto(`${baseUrl}/jobs`, { waitUntil: 'networkidle' })
    const duration = await page.getByRole('button', { name: 'Pull latest jobs' }).evaluate((node) => getComputedStyle(node).transitionDuration)
    const seconds = duration.split(',').map((value) => value.trim().endsWith('ms') ? Number.parseFloat(value) / 1000 : Number.parseFloat(value))
    assert(seconds.every((value) => Number.isFinite(value) && value <= 0.00002), duration)
    return duration
  } finally {
    await context.close()
  }
}

async function iosSafeArea() {
  const browser = await webkit.launch()
  try {
    const context = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, deviceScaleFactor: 3, hasTouch: true })
    try {
      const page = await context.newPage()
      attachEvidence(page, 'webkit-ios')
      await page.goto(`${baseUrl}/jobs`, { waitUntil: 'networkidle' })
      const state = await page.evaluate(() => {
        const header = document.querySelector('header')?.getBoundingClientRect()
        const main = document.querySelector('main')?.getBoundingClientRect()
        const css = Array.from(document.styleSheets).flatMap((sheet) => {
          try { return Array.from(sheet.cssRules).map((rule) => rule.cssText) } catch { return [] }
        }).join('\n')
        return {
          viewport: document.querySelector('meta[name="viewport"]')?.getAttribute('content') ?? '',
          safeTop: css.includes('env(safe-area-inset-top)'),
          safeBottom: css.includes('env(safe-area-inset-bottom)'),
          headerBottom: header?.bottom ?? -1,
          mainTop: main?.top ?? -1,
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        }
      })
      assert(state.viewport.includes('viewport-fit=cover'))
      assert(state.safeTop && state.safeBottom && state.mainTop >= state.headerBottom - 1 && state.overflow <= 1, JSON.stringify(state))
      await capture(page, 'jobs-webkit-ios-375', false)
      return state
    } finally {
      await context.close()
    }
  } finally {
    await browser.close()
  }
}

async function writeEvidence() {
  const consoleFailures = consoleEvents.filter((event) => event.type === 'error' || event.type === 'pageerror')
  const networkFailures = networkEvents.filter((event) => {
    if (event.status >= 400) return event.status !== 401 || !event.url.endsWith('/api/jobs/pull')
    return event.status === 0 && !event.failure?.includes('ERR_ABORTED') && !event.url.includes('_rsc')
  })
  record('Console: no errors', consoleFailures.length === 0, consoleFailures)
  record('Network: no actionable failures', networkFailures.length === 0, networkFailures)
  const failed = checks.filter((check) => !check.passed)
  const evidence = {
    generatedAt: new Date().toISOString(), source: process.env.GITHUB_SHA ?? null, marker,
    summary: { total: checks.length, passed: checks.length - failed.length, failed: failed.length },
    checks, screenshots, consoleEvents, networkEvents,
  }
  await writeFile(`${evidenceDir}/runtime-browser-evidence.json`, JSON.stringify(evidence, null, 2), 'utf8')
  const report = [
    '# Deterministic Real-Runtime Browser Verification', '',
    `- Source commit: \`${evidence.source ?? 'local'}\``,
    `- Fixture marker: \`${marker}\``,
    `- Result: **${evidence.summary.passed}/${evidence.summary.total} passed**`, '',
    '| Result | Check | Detail |', '|---|---|---|',
    ...checks.map((check) => `| ${check.passed ? 'PASS' : 'FAIL'} | ${check.name.replaceAll('|', '\\|')} | ${check.detail.replaceAll('|', '\\|').replaceAll('\n', ' ').slice(0, 400)} |`),
    '', '## Screenshots', '', ...screenshots.map((path) => `- \`${path}\``), '',
  ].join('\n')
  await writeFile(`${evidenceDir}/RUNTIME_BROWSER_VERIFICATION.md`, report, 'utf8')
  return failed.length
}

let browser
let fatal
try {
  const fixtureIds = await seedFixtures()
  record('Deterministic Supabase fixtures seeded', true, fixtureIds)
  browser = await chromium.launch()
  await verify('Viewport 375', () => viewport(browser, 'mobile-375', 375, 812))
  await verify('Viewport 768', () => viewport(browser, 'tablet-768', 768, 1024))
  await verify('Viewport 1440', () => viewport(browser, 'desktop-1440', 1440, 1000))

  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  try {
    const page = await context.newPage()
    attachEvidence(page, 'functional')
    await page.goto(`${baseUrl}/jobs`, { waitUntil: 'networkidle' })
    await verify('Deterministic search, filters, and sorts', () => filtersAndSorts(page))
    await verify('Manual add refreshes existing state', () => addJobRefresh(page))
    await verify('Status mutation lifecycle', () => statusLifecycle(page, fixtureIds.alphaJobId))
    await verify('Job-pull authorization and service flow', () => pullAuthorization(page))
    await verify('Records beyond page one remain reachable', () => pagination(page))
    await verify('Encoding repair across routes', () => encodingAcrossRoutes(page))
    await page.goto(`${baseUrl}/jobs`, { waitUntil: 'networkidle' })
    const links = page.locator('article a[target="_blank"]')
    assert((await links.count()) > 0)
    assert((await links.evaluateAll((nodes) => nodes.every((node) => node.getAttribute('rel')?.includes('noopener') && node.getAttribute('rel')?.includes('noreferrer')))))
    record('External links use hardened new-tab attributes', true, await links.count())
    await capture(page, 'jobs-functional-desktop-1440')
  } finally {
    await context.close()
  }
  await verify('Keyboard navigation', () => keyboard(browser))
  await verify('Reduced motion', () => reducedMotion(browser))
  await verify('iOS WebKit safe area', () => iosSafeArea())
} catch (error) {
  fatal = error
  record('Fatal execution', false, error instanceof Error ? error.stack ?? error.message : String(error))
} finally {
  if (browser) await browser.close().catch(() => undefined)
  await import('./runtime-browser-cleanup.mjs').catch((error) => record('In-process cleanup', false, error.message))
}

const failed = await writeEvidence()
if (fatal || failed > 0) process.exitCode = 1
