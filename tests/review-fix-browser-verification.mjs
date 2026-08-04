import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'

const baseUrl = process.env.RUNTIME_BASE_URL ?? 'http://127.0.0.1:3000'
const accessKey = process.env.JOB_PULL_API_KEY
const evidenceDir = process.env.RUNTIME_EVIDENCE_DIR ?? 'qa/runtime-browser'

assert(accessKey, 'JOB_PULL_API_KEY is required')
await mkdir(evidenceDir, { recursive: true })

const checks = []
function record(name, detail = '') {
  checks.push({ name, passed: true, detail: typeof detail === 'string' ? detail : JSON.stringify(detail) })
}

let failure = null
const browser = await chromium.launch()
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  try {
    const page = await context.newPage()

    await page.goto(`${baseUrl}/jobs?q=remote&status=all`, { waitUntil: 'networkidle' })
    const search = page.getByRole('searchbox', { name: 'Search jobs', exact: true })
    await search.fill('stale-query-that-must-not-return')
    await page.getByRole('button', { name: 'Clear filters', exact: true }).click()
    await page.waitForURL((url) => url.pathname === '/jobs' && url.search === '')
    await page.waitForTimeout(800)
    assert.equal(new URL(page.url()).search, '')
    await page.waitForFunction(() => {
      const section = document.querySelector('section[data-filter-query]')
      return section?.getAttribute('data-filter-query') === '' &&
        section?.getAttribute('data-filter-status') === 'active'
    })
    record('Clear filters cancels stale debounced search updates', page.url())

    const lockedProbe = await page.request.head(`${baseUrl}/api/jobs/pull`)
    assert.equal(lockedProbe.status(), 401)
    record('Locked browser is unauthorized', lockedProbe.status())

    await page.getByLabel('Operator access key').fill(accessKey)
    await page.getByRole('button', { name: 'Unlock operator', exact: true }).click()
    await page.getByText('Operator access unlocked for this browser.', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Pull latest jobs', exact: true }).waitFor()
    assert.equal(await page.getByRole('button', { name: 'Pull latest jobs', exact: true }).isEnabled(), true)

    const cookies = await context.cookies(baseUrl)
    const accessCookie = cookies.find((cookie) => cookie.name === 'job-pull-access')
    assert(accessCookie, 'Unlock cookie was not stored')
    assert.equal(accessCookie.httpOnly, true)
    assert.equal(accessCookie.sameSite, 'Strict')

    const unlockedProbe = await page.request.head(`${baseUrl}/api/jobs/pull`)
    assert.equal(unlockedProbe.status(), 204)
    record('Single-user unlock authorizes the browser with an HttpOnly cookie', {
      httpOnly: accessCookie.httpOnly,
      sameSite: accessCookie.sameSite,
      status: unlockedProbe.status(),
    })

    await page.getByRole('button', { name: 'Lock', exact: true }).click()
    await page.getByText('Operator access locked.', { exact: true }).waitFor()
    await page.waitForTimeout(400)
    const relockedProbe = await page.request.head(`${baseUrl}/api/jobs/pull`)
    assert.equal(relockedProbe.status(), 401)
    record('Lock removes browser authorization', relockedProbe.status())
  } finally {
    await context.close()
  }
} catch (error) {
  failure = error
  checks.push({
    name: 'Focused browser verification completed',
    passed: false,
    detail: error instanceof Error ? error.stack ?? error.message : String(error),
  })
} finally {
  await browser.close()
  await writeFile(
    `${evidenceDir}/review-fix-browser-evidence.json`,
    JSON.stringify({ generatedAt: new Date().toISOString(), checks }, null, 2),
    'utf8'
  )
}

if (failure) throw failure
console.log(`${checks.length}/${checks.length} focused review-fix checks passed.`)
