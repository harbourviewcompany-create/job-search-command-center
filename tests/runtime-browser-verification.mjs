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

const testToken = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
const testTitle = `Runtime QA ${testToken} – Perú دبي`
const testCompany = `Runtime QA Company ${testToken}`
const corruptedLocation = 'Lima, Lima, PerÃº'
const expectedLocation = 'Lima, Lima, Perú'

const checks = []
const consoleEvents = []
const networkEvents = []
const screenshots = []
let createdJobId = null
let createdCompanyId = null
let pullResult = null

function record(name, passed, detail = '') {
  checks.push({ name, passed, detail })
  if (!passed) throw new Error(`${name}${detail ? `: ${detail}` : ''}`)
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
      url.includes('/rest/v1/') ||
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

async function screenshot(page, name) {
  const path = `${evidenceDir}/${name}.png`
  await page.screenshot({ path, fullPage: true })
  screenshots.push(path)
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
      await rest(`outreach_messages?application_id=in.(select application id unsupported)`).catch(() => null)
      await rest(`applications?job_id=eq.${encodeURIComponent(createdJobId)}`, { method: 'DELETE' })
      await rest(`jobs?id=eq.${encodeURIComponent(createdJobId)}`, { method: 'DELETE' })
    }

    if (createdCompanyId) {
      await rest(`companies?id=eq.${encodeURIComponent(createdCompanyId)}`, { method: 'DELETE' })
    }
  } catch (error) {
    checks.push({ name: 'Cleanup temporary runtime records', passed: false, detail: String(error) })
  }
}

function cardValues(rows) {
  return rows.map((row) => ({
    company: row.company.trim(),
    fit: row.fit === '' ? null : Number(row.fit),
    date: row.date ? Date.parse(row.date) : Number.NaN,
  }))
}

async function readCardValues(page) {
  return cardValues(
    await page.locator('article').evaluateAll((articles) =>
      articles.map((article) => {
        const title = article.querySelector('h2')
        const company = title?.nextElementSibling?.textContent ?? ''
        const fitMatch = article.textContent?.match(/(\d+)% fit/)
        const dateText = Array.from(article.querySelectorAll('dd'))
          .map((node) => node.textContent?.trim() ?? '')
          .find((value) => /^(Posted|Added) /.test(value))
        return {
          company,
          fit: fitMatch?.[1] ?? '',
          date: dateText?.replace(/^(Posted|Added) /, '') ?? '',
        }
      })
    )
  )
}

async function verifyFiltersAndSorts(page) {
  const cards = page.locator('article')
  const search = page.getByLabel('Search jobs')
  const firstTitle = (await cards.first().locator('h2').textContent())?.trim()
  assert(firstTitle, 'At least one job card is required for search verification')

  await search.fill(firstTitle)
  await page.waitForTimeout(150)
  record('Search filters by a real job title', (await cards.count()) >= 1, firstTitle)
  await search.fill('')

  const statusSelect = page.getByLabel('Status')
  for (const value of ['active', 'all', 'found', 'interested', 'dismissed']) {
    await statusSelect.selectOption(value)
    await page.waitForTimeout(100)
    const texts = await cards.allTextContents()
    if (value === 'active') record('Status filter: active', texts.every((text) => !text.includes('Dismissed')), `${texts.length} cards`)
    if (value === 'found') record('Status filter: found', texts.every((text) => text.includes('To triage')), `${texts.length} cards`)
    if (value === 'interested') record('Status filter: interested', texts.every((text) => text.includes('Interested')), `${texts.length} cards`)
    if (value === 'dismissed') record('Status filter: dismissed', texts.every((text) => text.includes('Dismissed')), `${texts.length} cards`)
    if (value === 'all') record('Status filter: all', texts.length > 0, `${texts.length} cards`)
  }
  await statusSelect.selectOption('active')

  const sourceSelect = page.getByLabel('Source')
  const sourceOptions = await sourceSelect.locator('option').evaluateAll((options) => options.map((option) => option.value))
  for (const value of sourceOptions) {
    await sourceSelect.selectOption(value)
    await page.waitForTimeout(100)
    const count = await cards.count()
    if (value === 'all') {
      record('Source filter: all sources', count > 0, `${count} cards`)
    } else {
      const expected = value === 'remoteok' ? 'Remote OK' : value === 'linkedin' ? 'LinkedIn' : value.charAt(0).toUpperCase() + value.slice(1)
      const texts = await cards.allTextContents()
      record(`Source filter: ${value}`, texts.every((text) => text.includes(expected)), `${texts.length} cards`)
    }
  }
  await sourceSelect.selectOption('all')

  const arrangementSelect = page.getByLabel('Work arrangement')
  for (const [value, expected] of [
    ['all', null],
    ['remote', 'Remote'],
    ['hybrid', 'Hybrid'],
    ['location', 'Location-based'],
  ]) {
    await arrangementSelect.selectOption(value)
    await page.waitForTimeout(100)
    const texts = await cards.allTextContents()
    record(
      `Arrangement filter: ${value}`,
      expected === null || texts.every((text) => text.includes(expected)),
      `${texts.length} cards`
    )
  }
  await arrangementSelect.selectOption('all')

  const sortSelect = page.getByLabel('Sort jobs')

  await sortSelect.selectOption('fit')
  let values = await readCardValues(page)
  const fits = values.map((value) => value.fit).filter((value) => value !== null)
  record('Sort: best fit', fits.every((value, index) => index === 0 || fits[index - 1] >= value), fits.slice(0, 8).join(', '))

  await sortSelect.selectOption('company')
  values = await readCardValues(page)
  const companies = values.map((value) => value.company)
  const sortedCompanies = [...companies].sort((left, right) => left.localeCompare(right))
  record('Sort: company A–Z', companies.every((value, index) => value === sortedCompanies[index]), companies.slice(0, 5).join(' | '))

  await sortSelect.selectOption('newest')
  values = await readCardValues(page)
  const newestDates = values.map((value) => value.date).filter(Number.isFinite)
  record('Sort: newest first', newestDates.every((value, index) => index === 0 || newestDates[index - 1] >= value), newestDates.slice(0, 8).join(', '))

  await sortSelect.selectOption('oldest')
  values = await readCardValues(page)
  const oldestDates = values.map((value) => value.date).filter(Number.isFinite)
  record('Sort: oldest first', oldestDates.every((value, index) => index === 0 || oldestDates[index - 1] <= value), oldestDates.slice(0, 8).join(', '))

  await sortSelect.selectOption('fit')
}

async function verifyKeyboard(page) {
  await page.evaluate(() => {
    window.scrollTo(0, 0)
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
  })
  await page.keyboard.press('Tab')
  const firstFocus = await page.evaluate(() => ({
    text: document.activeElement?.textContent?.trim(),
    href: document.activeElement?.getAttribute('href'),
  }))
  record('Keyboard: skip link receives first focus', firstFocus.text === 'Skip to main content', JSON.stringify(firstFocus))
  await page.keyboard.press('Enter')
  const mainFocused = await page.evaluate(() => document.activeElement?.id === 'main-content' || location.hash === '#main-content')
  record('Keyboard: skip link reaches main content', mainFocused)

  const focused = []
  for (let index = 0; index < 18; index += 1) {
    await page.keyboard.press('Tab')
    focused.push(
      await page.evaluate(() => ({
        tag: document.activeElement?.tagName,
        text: document.activeElement?.textContent?.trim().slice(0, 80),
        visible: document.activeElement instanceof HTMLElement
          ? Boolean(document.activeElement.offsetWidth || document.activeElement.offsetHeight || document.activeElement.getClientRects().length)
          : false,
      }))
    )
  }
  record('Keyboard: interactive focus remains visible', focused.every((entry) => entry.visible), JSON.stringify(focused))
}

async function verifyReducedMotion(browser) {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, reducedMotion: 'reduce' })
  const page = await context.newPage()
  attachEvidence(page, 'reduced-motion')
  await page.goto(`${baseUrl}/jobs`, { waitUntil: 'networkidle' })
  const duration = await page.getByRole('button', { name: 'Pull latest jobs' }).evaluate((element) => getComputedStyle(element).transitionDuration)
  const seconds = duration.split(',').map((value) => value.trim()).map((value) => value.endsWith('ms') ? Number.parseFloat(value) / 1000 : Number.parseFloat(value))
  record('Reduced motion collapses transitions', seconds.every((value) => Number.isFinite(value) && value <= 0.00002), duration)
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
      hasSafeAreaRule: css.includes('env(safe-area-inset-top)') && css.includes('env(safe-area-inset-bottom)'),
      horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }
  })

  record('iOS: viewport-fit cover enabled', result.viewport.includes('viewport-fit=cover'), result.viewport)
  record('iOS: safe-area CSS rules present', result.hasSafeAreaRule, JSON.stringify(result))
  record('iOS: header and content do not overlap', result.headerTop >= 0 && result.mainTop >= result.headerBottom - 1, JSON.stringify(result))
  record('iOS: no horizontal overflow at 375px', result.horizontalOverflow <= 1, `${result.horizontalOverflow}px`)
  await screenshot(page, 'jobs-webkit-ios-375')
  await context.close()
  await browser.close()
}

const browser = await chromium.launch()

try {
  for (const viewport of [
    { width: 375, height: 812, name: 'mobile-375' },
    { width: 768, height: 1024, name: 'tablet-768' },
    { width: 1440, height: 1000, name: 'desktop-1440' },
  ]) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } })
    const page = await context.newPage()
    attachEvidence(page, viewport.name)
    const response = await page.goto(`${baseUrl}/jobs`, { waitUntil: 'networkidle' })
    record(`${viewport.name}: /jobs returns 200`, response?.status() === 200, String(response?.status()))
    await page.getByRole('heading', { name: 'Job Search Command Center' }).waitFor()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    record(`${viewport.name}: no horizontal overflow`, overflow <= 1, `${overflow}px`)
    await screenshot(page, `jobs-${viewport.name}`)
    await context.close()
  }

  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage()
  attachEvidence(page, 'functional-desktop')
  await page.goto(`${baseUrl}/jobs`, { waitUntil: 'networkidle' })

  const cardCount = await page.locator('article').count()
  record('Live Supabase data loaded', cardCount > 0, `${cardCount} active cards`)

  await verifyFiltersAndSorts(page)

  const externalLinks = page.locator('article a[target="_blank"]')
  const externalCount = await externalLinks.count()
  const externalAttributes = await externalLinks.evaluateAll((links) => links.map((link) => ({
    href: link.getAttribute('href'),
    target: link.getAttribute('target'),
    rel: link.getAttribute('rel'),
  })))
  record(
    'External listing links are explicit and hardened',
    externalCount > 0 && externalAttributes.every((link) => /^https?:\/\//.test(link.href ?? '') && link.target === '_blank' && link.rel?.includes('noopener') && link.rel?.includes('noreferrer')),
    `${externalCount} links`
  )

  await page.getByText('Add or import jobs', { exact: true }).click()
  const addForm = page.getByRole('heading', { name: 'Add job manually' }).locator('..').locator('..')
  await addForm.getByLabel(/Job title/).fill(testTitle)
  await addForm.getByLabel(/Company/).fill(testCompany)
  await addForm.getByLabel('Location').fill(corruptedLocation)
  await addForm.getByLabel('Listing URL').fill('https://example.com/runtime-qa')
  await addForm.getByLabel('Description or notes').fill('Runtime browser verification record. Temporary and removed after the test.')
  await addForm.getByLabel('Remote role').check()
  await addForm.getByRole('button', { name: 'Add job' }).click()
  await page.getByText('Job added to the triage queue.', { exact: true }).waitFor({ timeout: 15000 })
  record('Add-job success feedback is announced', true)

  let created = await findCreatedJob()
  assert(created, 'Temporary job was not found in Supabase after add action')
  createdJobId = created.id
  createdCompanyId = created.company_id
  record('Add-job action wrote to connected Supabase', created.location === corruptedLocation, created.id)

  await page.reload({ waitUntil: 'networkidle' })
  await page.getByLabel('Search jobs').fill(testTitle)
  const testCard = page.locator('article').filter({ has: page.getByRole('heading', { name: testTitle, exact: true }) })
  await testCard.waitFor({ timeout: 15000 })
  const testCardText = await testCard.textContent()
  record('Encoding repair displays corrupted international text correctly', testCardText?.includes(expectedLocation) && !testCardText.includes('PerÃº'), testCardText?.slice(0, 300) ?? '')

  await testCard.getByRole('button', { name: 'Interested' }).click()
  await testCard.getByRole('button', { name: 'Interested' }).waitFor()
  await page.waitForFunction((title) => {
    const card = Array.from(document.querySelectorAll('article')).find((node) => node.querySelector('h2')?.textContent?.trim() === title)
    return card?.querySelector('button[aria-pressed="true"]')?.textContent?.includes('Interested')
  }, testTitle)
  created = await findCreatedJob()
  record('Status mutation: found → interested', created?.status === 'interested', created?.status ?? 'missing')

  await testCard.getByRole('button', { name: 'Dismiss' }).click()
  await page.waitForFunction((title) => {
    const card = Array.from(document.querySelectorAll('article')).find((node) => node.querySelector('h2')?.textContent?.trim() === title)
    return card?.querySelector('button[aria-pressed="true"]')?.textContent?.includes('Dismiss')
  }, testTitle)
  created = await findCreatedJob()
  record('Status mutation: interested → dismissed', created?.status === 'dismissed', created?.status ?? 'missing')

  await testCard.getByRole('button', { name: 'Triage' }).click()
  await page.waitForFunction((title) => {
    const card = Array.from(document.querySelectorAll('article')).find((node) => node.querySelector('h2')?.textContent?.trim() === title)
    return card?.querySelector('button[aria-pressed="true"]')?.textContent?.includes('Triage')
  }, testTitle)
  created = await findCreatedJob()
  record('Status mutation: dismissed → found', created?.status === 'found', created?.status ?? 'missing')

  await page.getByLabel('Search jobs').fill('')
  const pullResponsePromise = page.waitForResponse((response) => response.url().includes('/api/jobs/pull') && response.request().method() === 'POST', { timeout: 120000 })
  await page.getByRole('button', { name: 'Pull latest jobs' }).click()
  const pullResponse = await pullResponsePromise
  const pullBody = await pullResponse.text()
  await page.waitForTimeout(300)
  const pullLiveText = await page.getByRole('button', { name: 'Pull latest jobs' }).locator('..').locator('[aria-live="polite"]').textContent()
  pullResult = { status: pullResponse.status(), body: pullBody.slice(0, 1000), message: pullLiveText?.trim() ?? '' }
  record('Pull-job action returns success feedback', pullResponse.ok() && Boolean(pullResult.message) && !/failed|missing/i.test(pullResult.message), JSON.stringify(pullResult))

  await verifyKeyboard(page)
  await screenshot(page, 'jobs-functional-after-verification')
  await context.close()

  await verifyReducedMotion(browser)
  await verifyIosSafeArea()

  const seriousConsoleEvents = consoleEvents.filter((event) => event.type === 'error' || event.type === 'pageerror')
  record('No browser console or page errors', seriousConsoleEvents.length === 0, JSON.stringify(seriousConsoleEvents))

  const failedNetwork = networkEvents.filter((event) => event.status === 0 || event.status >= 400)
  record('No failed runtime network requests', failedNetwork.length === 0, JSON.stringify(failedNetwork))
} catch (error) {
  checks.push({ name: 'Runtime verification completed', passed: false, detail: error.stack ?? String(error) })
  process.exitCode = 1
} finally {
  await cleanup()
  await browser.close()

  const cleanupRow = await findCreatedJob().catch(() => null)
  checks.push({
    name: 'Temporary runtime records removed',
    passed: cleanupRow === null,
    detail: cleanupRow ? JSON.stringify(cleanupRow) : 'No temporary job remains',
  })
  if (cleanupRow) process.exitCode = 1

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    testTitle,
    pullResult,
    checks,
    screenshots,
    consoleEvents,
    networkEvents,
  }

  await writeFile(`${evidenceDir}/runtime-browser-evidence.json`, `${JSON.stringify(report, null, 2)}\n`)

  const markdown = [
    '# Runtime Browser Verification',
    '',
    `- Generated: \`${report.generatedAt}\``,
    `- Runtime: \`${baseUrl}\``,
    `- Checks passed: \`${checks.filter((check) => check.passed).length}/${checks.length}\``,
    '',
    '| Check | Result | Evidence |',
    '|---|---|---|',
    ...checks.map((check) => `| ${check.name.replaceAll('|', '\\|')} | ${check.passed ? 'PASS' : 'FAIL'} | ${(check.detail || '').replaceAll('|', '\\|').replaceAll('\n', ' ').slice(0, 500)} |`),
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
    '## Console events',
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
}
