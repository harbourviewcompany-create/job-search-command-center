import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const baseUrl = process.env.RUNTIME_BASE_URL ?? 'http://127.0.0.1:3000'
const outputDir = process.env.DISCOVERY_BROWSER_OUTPUT ?? 'qa/job-discovery-v2/actual'
const widths = [390, 768, 1440]

await mkdir(outputDir, { recursive: true })

const browser = await chromium.launch({ headless: true })
const report = {
  baseUrl,
  generatedAt: new Date().toISOString(),
  viewports: [],
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

try {
  for (const width of widths) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      reducedMotion: 'reduce',
    })
    const page = await context.newPage()
    const consoleErrors = []
    const requestFailures = []

    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text())
    })
    page.on('requestfailed', (request) => {
      requestFailures.push(`${request.method()} ${request.url()} — ${request.failure()?.errorText ?? 'failed'}`)
    })

    await page.goto(`${baseUrl}/settings/discovery`, { waitUntil: 'networkidle' })
    await page.getByRole('heading', { name: 'Discovery control center', exact: true }).waitFor()
    await page.getByRole('heading', { name: 'Strategic Business Development', exact: true }).waitFor()
    await page.getByRole('heading', { name: 'Acme Markets', exact: true }).first().waitFor()
    await page.getByRole('heading', { name: 'Discovery run history', exact: true }).waitFor()

    const settingsError = await page.getByRole('alert').allTextContents()
    assert(
      !settingsError.some((message) => message.includes('Discovery data is not fully available')),
      `Discovery settings reported unavailable data at ${width}px: ${settingsError.join(' ')}`
    )

    const settingsOverflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth
    )
    assert(settingsOverflow <= 1, `Discovery settings overflowed horizontally by ${settingsOverflow}px at ${width}px.`)

    const settingsScreenshot = path.join(outputDir, `discovery-settings-${width}.png`)
    await page.screenshot({ path: settingsScreenshot, fullPage: true })

    await page.goto(`${baseUrl}/jobs`, { waitUntil: 'networkidle' })
    await page.getByRole('heading', { name: 'Strategic Partnerships Manager', exact: true }).first().waitFor()
    await page.locator('select option[value="smartrecruiters"]').waitFor({ state: 'attached' })
    const evidenceButton = page.getByRole('button', { name: 'Discovery evidence' }).first()
    await evidenceButton.click()
    await page.getByText('Search-lane scores', { exact: true }).waitFor()
    await page.getByText('Source observations', { exact: true }).waitFor()
    await page.getByText('Partnerships and Alliances', { exact: true }).waitFor()

    const jobsOverflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth
    )
    assert(jobsOverflow <= 1, `Jobs page overflowed horizontally by ${jobsOverflow}px at ${width}px.`)

    const jobScreenshot = path.join(outputDir, `job-discovery-evidence-${width}.png`)
    await page.screenshot({ path: jobScreenshot, fullPage: true })

    const pageErrors = consoleErrors.filter((message) =>
      !message.includes('401') &&
      !message.includes('No authenticated user in connected browser verification')
    )
    assert(pageErrors.length === 0, `Console errors at ${width}px: ${pageErrors.join(' | ')}`)
    assert(requestFailures.length === 0, `Request failures at ${width}px: ${requestFailures.join(' | ')}`)

    report.viewports.push({
      width,
      settingsScreenshot,
      jobScreenshot,
      settingsOverflow,
      jobsOverflow,
      consoleErrors,
      requestFailures,
    })

    await context.close()
  }
} finally {
  await browser.close()
}

await writeFile(
  path.join(outputDir, 'connected-browser-report.json'),
  `${JSON.stringify(report, null, 2)}\n`,
  'utf8'
)

console.log(JSON.stringify(report, null, 2))
