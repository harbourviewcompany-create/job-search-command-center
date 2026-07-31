import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium, webkit } from 'playwright'

const baseUrl = process.env.RUNTIME_BASE_URL ?? 'http://127.0.0.1:3000'
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const evidenceDir = process.env.RUNTIME_EVIDENCE_DIR ?? 'qa/runtime-browser'

assert(supabaseUrl, 'NEXT_PUBLIC_SUPABASE_URL is required')
assert(supabaseKey, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required')

await mkdir(evidenceDir, { recursive: true })

const token = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
const testTitle = `Runtime QA ${token} – Perú دبي`
const testCompany = `Runtime QA Company ${token}`
const corruptedLocation = 'Lima, Lima, PerÃº'
const repairedLocation = 'Lima, Lima, Perú'

const checks = []
const consoleEvents = []
const networkEvents = []
const screenshots = []
let createdJobId = null
let createdCompanyId = null
let pullResult = null

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
    const url = response.url()
    if (
      response.request().resourceType() === 'document' ||
      url.includes('/api/jobs/pull') ||
      response.status() >= 400
    ) {
      networkEvents.push({
        label,
        method: response.request().method(),
        status: response.status(),
        resourceType: response.request().resourceType(),
        url,
      })
    }
  })

  page.on('requestfailed', (request) => {
    networkEvents.push({
      label,
      method: request.method(),
      status: 0,
      resourceType: request.resourceType(),
      url: request.url(),
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

async function rest(path, { method = 'GET', body } = {}) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Accept-Profile': 'job_search',
      'Content-Profile': 'job_search',
      'Content-Type': 'application/json',
      Prefer: method === 'POST' ? 'return=representation' : 'return=minimal',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  const text = await response.text()
  if (!response.ok) {
    throw new Error(`Supabase REST ${method} ${path} failed (${response.status}): ${text.slice(0, 500)}`)
  }
  return text ? JSON.parse(text) : null
}

async function findCreatedJob() {
  const url = new URL(`${supabaseUrl}/rest/v1/jobs`)
  url.searchParams.set('select', 'id,company_id,status,location,title')
  url.searchParams.set('title', `eq.${testTitle}`)

  const response = await fetch(url, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Accept-Profile': 'job_search',
    },
  })
  assert.equal(response.status, 200, `Created-job query returned ${response.status}`)
  const rows = await response.json()
  return rows[0] ?? null
}

async function cleanup() {
  try {
    if (!createdJobId) {
      const row = await findCreatedJob()
      createdJobId = row?.id ?? null
      createdCompanyId = row?.company_id ?? null
    }

    if (createdJobId) {
      await rest(`applications?job_id=eq.${encodeURIComponent(createdJobId)}`, { method: 'DELETE' })
      await rest(`jobs?id=eq.${encodeURIComponent(createdJobId)}`, { method: 'DELETE' })
    }

    if (createdCompanyId) {
      await rest(`companies?id=eq.${encodeURIComponent(createdCompanyId)}`, { method: 'DELETE' })
    }
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

async function cardStatusValues(page) {
  return page.locator('article').evaluateAll((articles) =>
    articles.map((article) => article.querySelector('.badge')?.textContent?.trim() ?? '')
  )
}

async function cardMetadataValues(page, kind) {
  return page.locator('article').evaluateAll((articles, requestedKind) =>
    articles.map((article) => {
      const values = Array.from(article.querySelectorAll('dd')).map((node) => node.textContent?.trim() ?? '')
      if (requestedKind === 'arrangement') {
        return values.find((value) => ['Remote', 'Hybrid', 'Location-based'].includes(value)) ?? ''
      }
      if (requestedKind === 'source') {
        return values[2] ?? ''
      }
      return ''
    }),
    kind
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
  const firstTitle = (await cards.first().locator('h2').textContent())?.trim()
  assert(firstTitle, 'At least one live job is required')

  await search.fill(firstTitle)
  await page.waitForTimeout(150)
  record('Search filters by a real title', (await cards.count()) >= 1, firstTitle)
  await search.fill('')

  const statuses = [
    ['active', null],
    ['all', null],
    ['found', 'To triage'],
    ['interested', 'Interested'],
    ['dismissed', 'Dismissed'],
  ]
  for (const [value, expected] of statuses) {
    await statusSelect(page).selectOption(value)
    await page.waitForTimeout(120)
    const values = await cardStatusValues(page)
    const valid = value === 'active'
      ? values.length > 0 && values.every((item) => item !== 'Dismissed')
      : value === 'all'
        ? values.length > 0
        : values.length > 0 && values.every((item) => item === expected)
    record(`Status filter: ${value}`, valid, `${values.length} cards; ${[...new Set(values)].join(', ')}`)
  }

  await statusSelect(page).selectOption('all')
  const sources = await sourceSelect(page).locator('option').evaluateAll((options) =>
    options.map((option) => ({ value: option.value, label: option.textContent?.trim() ?? '' }))
  )
  for (const source of sources) {
    await sourceSelect(page).selectOption(source.value)
    await page.waitForTimeout(120)
    const values = await cardMetadataValues(page, 'source')
    const valid = source.value === 'all'
      ? values.length > 0
      : values.length > 0 && values.every((item) => item === source.label)
    record(`Source filter: ${source.value}`, valid, `${values.length} cards; ${[...new Set(values)].join(', ')}`)
  }
  await sourceSelect(page).selectOption('all')

  const arrangements = [
    ['all', null],
    ['remote', 'Remote'],
    ['hybrid', 'Hybrid'],
    ['location', 'Location-based'],
  ]
  for (const [value, expected] of arrangements) {
    await arrangementSelect(page).selectOption(value)
    await page.waitForTimeout(120)
    const values = await cardMetadataValues(page, 'arrangement')
    const valid = value === 'all'
      ? values.length > 0
      : values.every((item) => item === expected)
    record(`Arrangement filter: ${value}`, valid, `${values.length} cards; ${[...new Set(values)].join(', ') || 'empty result'}`)
  }
  await arrangementSelect(page).selectOption('all')

  await sortSelect(page).selectOption('fit')
  let result = await cards.evaluateAll((articles) => {
    const values = articles
      .map((article) => article.textContent?.match(/(\d+)% fit/)?.[1])
      .filter(Boolean)
      .map(Number)
    return { values, valid: values.every((value, index) => index === 0 || values[index - 1] >= value) }
  })
  record('Sort: best fit', result.valid, result.values.slice(0, 12).join(', '))

  await sortSelect(page).selectOption('company')
  result = await cards.evaluateAll((articles) => {
    const values = articles.map((article) => article.querySelector('h2')?.nextElementSibling?.textContent?.trim() ?? '')
    return { values }
  })
  const sortedCompanies = [...result.values].sort(compareDisplayedCompanies)
  record(
    'Sort: company A–Z',
    result.values.every((value, index) => value === sortedCompanies[index]),
    result.values.slice(0, 8).join(' | ')
  )

  for (const [option, direction] of [['newest', 'desc'], ['oldest', 'asc']]) {
    await sortSelect(page).selectOption(option)
    result = await cards.evaluateAll((articles, requestedDirection) => {
      const values = articles
        .map((article) => {
          const dateText = Array.from(article.querySelectorAll('dd'))
            .map((node) => node.textContent?.trim() ?? '')
            .find((value) => /^(Posted|Added) /.test(value))
          return dateText ? Date.parse(dateText.replace(/^(Posted|Added) /, '')) : Number.NaN
        })
        .filter(Number.isFinite)
      const valid = values.every((value, index) => {
        if (index === 0) return true
        return requestedDirection === 'desc' ? values[index - 1] >= value : values[index - 1] <= value
      })
      return { values, valid }
    }, direction)
    record(`Sort: ${option} first`, result.valid, result.values.slice(0, 12).join(', '))
  }

  await sortSelect(page).selectOption('fit')
  await statusSelect(page).selectOption('active')
}

async function waitForStatus(page, title, visibleLabel) {
  await page.waitForFunction(
    ({ expectedTitle, expectedLabel }) => {
      const card = Array.from(document.querySelectorAll('article')).find(
        (node) => node.querySelector('h2')?.textContent?.trim() === expectedTitle
      )
      return card?.querySelector('button[aria-pressed="true"]')?.textContent?.includes(expectedLabel)
    },
    { expectedTitle: title, expectedLabel: visibleLabel }
  )
}

async function verifyKeyboard(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
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
  record('Keyboard: skip link is first focus target', true, first)

  await page.keyboard.press('Enter')
  const mainFocused = await page.evaluate(() => document.activeElement?.id === 'main-content' || location.hash === '#main-content')
  record('Keyboard: skip link reaches main content', mainFocused)

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
  record('Keyboard: focus sequence remains visible', sequence.every((item) => item.visible), sequence)
  await context.close()
}

async function verifyReducedMotion(browser) {
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
    reducedMotion: 'reduce',
  })
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
  record('Reduced motion collapses transitions', true, duration)
  await context.close()
}

async function verifyIosSafeArea() {
  const browser = await webkit.launch()
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
    isMobile: true,
    deviceScaleFactor: 3,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  })
  const page = await context.newPage()
  attachEvidence(page, 'webkit-ios-375')
  await page.goto(`${baseUrl}/jobs`, { waitUntil: 'networkidle' })

  const result = await page.evaluate(() => {
    const header = document.querySelector('header')?.getBoundingClientRect()
    const main = document.querySelector('main')?.getBoundingClientRect()
    const viewport = document.querySelector('meta[name="viewport"]')?.getAttribute('content') ?? ''
    const css = Array.from(document.styleSheets).flatMap((sheet) => {
      try {
        return Array.from(sheet.cssRules).map((rule) => rule.cssText)
      } catch {
        return []
      }
    }).join('\n')
    return {
      headerTop: header?.top ?? -1,
      headerBottom: header?.bottom ?? -1,
      mainTop: main?.top ?? -1,
      viewport,
      safeAreaTop: css.includes('env(safe-area-inset-top)'),
      safeAreaBottom: css.includes('env(safe-area-inset-bottom)'),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }
  })

  assert(result.viewport.includes('viewport-fit=cover'), result.viewport)
  assert(result.safeAreaTop && result.safeAreaBottom, JSON.stringify(result))
  assert(result.headerTop >= 0 && result.mainTop >= result.headerBottom - 1, JSON.stringify(result))
  assert(result.overflow <= 1, `${result.overflow}px`)
  record('iOS WebKit: viewport-fit and safe-area rules verified', true, result)
  await capture(page, 'jobs-webkit-ios-375', { fullPage: false })
  await context.close()
  await browser.close()
}

const chromiumBrowser = await chromium.launch()

try {
  for (const viewport of [
    { width: 375, height: 812, name: 'mobile-375' },
    { width: 768, height: 1024, name: 'tablet-768' },
    { width: 1440, height: 1000, name: 'desktop-1440' },
  ]) {
    await verify(`${viewport.name}: live /jobs rendering`, async () => {
      const context = await chromiumBrowser.newContext({ viewport })
      const page = await context.newPage()
      attachEvidence(page, viewport.name)
      const response = await page.goto(`${baseUrl}/jobs`, { waitUntil: 'networkidle' })
      assert.equal(response?.status(), 200)
      await page.getByRole('heading', { name: 'Job Search Command Center' }).waitFor()
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      assert(overflow <= 1, `${overflow}px horizontal overflow`)
      const path = await capture(page, `jobs-${viewport.name}`)
      await context.close()
      return { status: 200, horizontalOverflow: overflow, screenshot: path }
    })
  }

  const context = await chromiumBrowser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage()
  attachEvidence(page, 'functional-desktop')
  await page.goto(`${baseUrl}/jobs`, { waitUntil: 'networkidle' })

  await verify('Connected Supabase jobs load', async () => {
    const count = await page.locator('article').count()
    assert(count > 0, 'No job cards loaded')
    return `${count} active jobs`
  })

  await verify('Search, every filter, and every sort option', async () => {
    const failureCountBefore = checks.filter((check) => !check.passed).length
    await verifyFiltersAndSorts(page)
    const newFailures = checks.filter((check) => !check.passed).slice(failureCountBefore)
    assert.equal(newFailures.length, 0, newFailures.map((item) => item.name).join(', '))
    return 'All search/filter/sort assertions completed'
  })

  await verify('External listing links are explicit and hardened', async () => {
    const links = page.locator('article a[target="_blank"]')
    const attributes = await links.evaluateAll((nodes) => nodes.map((node) => ({
      href: node.getAttribute('href'),
      target: node.getAttribute('target'),
      rel: node.getAttribute('rel'),
    })))
    assert(attributes.length > 0, 'No external listing links found')
    assert(attributes.every((item) =>
      /^https?:\/\//.test(item.href ?? '') &&
      item.target === '_blank' &&
      item.rel?.includes('noopener') &&
      item.rel?.includes('noreferrer')
    ), JSON.stringify(attributes.filter((item) => !item.rel?.includes('noopener'))))
    return `${attributes.length} links`
  })

  await verify('Add-job feedback and connected Supabase write', async () => {
    await page.locator('summary').filter({ hasText: 'Add or import jobs' }).click()
    const form = page.locator('form').filter({
      has: page.getByRole('heading', { name: 'Add job manually', exact: true }),
    })
    await form.getByLabel(/Job title/).fill(testTitle)
    await form.getByLabel(/Company/).fill(testCompany)
    await form.getByLabel('Location', { exact: true }).fill(corruptedLocation)
    await form.getByLabel('Listing URL', { exact: true }).fill('https://example.com/runtime-qa')
    await form.getByLabel('Description or notes', { exact: true }).fill(
      'Temporary runtime browser verification record; removed after this run.'
    )
    await form.getByLabel('Remote role', { exact: true }).check()
    await form.getByRole('button', { name: 'Add job', exact: true }).click()
    await page.getByText('Job added to the triage queue.', { exact: true }).waitFor({ timeout: 20000 })

    const row = await findCreatedJob()
    assert(row, 'Temporary job not found in connected Supabase')
    assert.equal(row.location, corruptedLocation)
    createdJobId = row.id
    createdCompanyId = row.company_id
    return row.id
  })

  await verify('Corrupted international text is repaired at display time', async () => {
    assert(createdJobId, 'Temporary job was not created')
    await page.reload({ waitUntil: 'networkidle' })
    await statusSelect(page).selectOption('all')
    await page.getByRole('searchbox', { name: 'Search jobs', exact: true }).fill(testTitle)
    const card = page.locator('article').filter({
      has: page.getByRole('heading', { name: testTitle, exact: true }),
    })
    await card.waitFor({ timeout: 20000 })
    const text = await card.textContent()
    assert(text?.includes(repairedLocation), text ?? 'No card text')
    assert(!text?.includes('PerÃº'), text ?? 'No card text')
    return repairedLocation
  })

  await verify('Status mutation: found → interested', async () => {
    const card = page.locator('article').filter({ hasText: testTitle })
    await card.getByRole('button', { name: 'Interested', exact: true }).click()
    await waitForStatus(page, testTitle, 'Interested')
    const row = await findCreatedJob()
    assert.equal(row?.status, 'interested')
    return row.status
  })

  await verify('Status mutation: interested → dismissed', async () => {
    const card = page.locator('article').filter({ hasText: testTitle })
    await card.getByRole('button', { name: 'Dismiss', exact: true }).click()
    await waitForStatus(page, testTitle, 'Dismiss')
    const row = await findCreatedJob()
    assert.equal(row?.status, 'dismissed')
    return row.status
  })

  await verify('Status mutation: dismissed → found', async () => {
    const card = page.locator('article').filter({ hasText: testTitle })
    await card.getByRole('button', { name: 'Triage', exact: true }).click()
    await waitForStatus(page, testTitle, 'Triage')
    const row = await findCreatedJob()
    assert.equal(row?.status, 'found')
    return row.status
  })

  await verify('Pull-job action and user feedback', async () => {
    await page.getByRole('searchbox', { name: 'Search jobs', exact: true }).fill('')
    const responsePromise = page.waitForResponse(
      (response) => response.url().includes('/api/jobs/pull') && response.request().method() === 'POST',
      { timeout: 180000 }
    )
    await page.getByRole('button', { name: 'Pull latest jobs' }).click()
    const response = await responsePromise
    const body = await response.text()
    await page.waitForTimeout(500)
    const message = await page.getByRole('button', { name: 'Pull latest jobs' })
      .locator('..')
      .locator('[aria-live="polite"]')
      .textContent()
    pullResult = { status: response.status(), body: body.slice(0, 1500), message: message?.trim() ?? '' }
    assert(response.ok(), JSON.stringify(pullResult))
    assert(pullResult.message && !/failed|missing|error/i.test(pullResult.message), JSON.stringify(pullResult))
    return pullResult
  })

  await capture(page, 'jobs-functional-desktop-1440')
  await context.close()

  await verify('Keyboard navigation and visible focus', () => verifyKeyboard(chromiumBrowser))
  await verify('Reduced-motion behavior', () => verifyReducedMotion(chromiumBrowser))
  await verify('iOS WebKit safe-area behavior', () => verifyIosSafeArea())

  await verify('No browser console or page errors', async () => {
    const serious = consoleEvents.filter((event) => event.type === 'error' || event.type === 'pageerror')
    assert.equal(serious.length, 0, JSON.stringify(serious))
    return `${consoleEvents.length} captured console events; 0 errors`
  })

  await verify('No failed runtime network requests', async () => {
    const serious = networkEvents.filter((event) => {
      if (event.status >= 400) return true
      if (event.status !== 0) return false
      const benignNextPrefetchAbort = event.failure === 'net::ERR_ABORTED' && event.url.includes('_rsc=')
      return !benignNextPrefetchAbort
    })
    assert.equal(serious.length, 0, JSON.stringify(serious))
    const benign = networkEvents.filter((event) => event.status === 0 && event.failure === 'net::ERR_ABORTED' && event.url.includes('_rsc='))
    return `${networkEvents.length} captured requests; ${benign.length} benign cancelled Next.js prefetches`
  })
} catch (error) {
  record('Runtime harness completed', false, error instanceof Error ? error.stack ?? error.message : String(error))
} finally {
  await cleanup()
  await chromiumBrowser.close()

  const remaining = await findCreatedJob().catch(() => null)
  record(
    'Temporary runtime records removed',
    remaining === null,
    remaining ? remaining : 'No temporary job remains'
  )

  const failed = checks.filter((check) => !check.passed)
  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    testTitle,
    summary: { passed: checks.length - failed.length, failed: failed.length, total: checks.length },
    pullResult,
    checks,
    screenshots,
    consoleEvents,
    networkEvents,
  }

  await writeFile(
    `${evidenceDir}/runtime-browser-evidence.json`,
    `${JSON.stringify(report, null, 2)}\n`
  )

  const markdown = [
    '# Runtime Browser Verification',
    '',
    `- Generated: \`${report.generatedAt}\``,
    `- Runtime: \`${baseUrl}\``,
    `- Checks passed: \`${report.summary.passed}/${report.summary.total}\``,
    '',
    '| Check | Result | Evidence |',
    '|---|---|---|',
    ...checks.map((check) =>
      `| ${check.name.replaceAll('|', '\\|')} | ${check.passed ? 'PASS' : 'FAIL'} | ${check.detail.replaceAll('|', '\\|').replaceAll('\n', ' ').slice(0, 700)} |`
    ),
    '',
    '## Screenshots',
    '',
    ...screenshots.map((path) => `- \`${path}\``),
    '',
    '## Pull result',
    '',
    '```json',
    JSON.stringify(pullResult, null, 2),
    '```',
    '',
    '## Console evidence',
    '',
    '```json',
    JSON.stringify(consoleEvents, null, 2),
    '```',
    '',
    '## Network evidence',
    '',
    '```json',
    JSON.stringify(networkEvents, null, 2),
    '```',
    '',
  ].join('\n')

  await writeFile(`${evidenceDir}/RUNTIME_BROWSER_VERIFICATION.md`, markdown)

  if (failed.length > 0 || remaining) process.exitCode = 1
}
