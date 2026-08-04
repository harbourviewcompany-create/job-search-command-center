import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8')

test('migration versions are unique and PR8 security migrations follow main', () => {
  const names = fs.readdirSync(path.join(root, 'supabase/migrations')).filter((name) => name.endsWith('.sql'))
  const versions = names.map((name) => name.split('_', 1)[0])
  assert.equal(new Set(versions).size, versions.length)
  assert(names.includes('010_operator_boundary_rls.sql'))
  assert(names.includes('011_jobs_effective_timestamp.sql'))
  assert(!names.includes('008_operator_boundary_rls.sql'))
  assert(!names.includes('009_jobs_effective_timestamp.sql'))
})

test('Supabase sessions are restricted to the configured operator identity', () => {
  const auth = read('src/lib/operator-auth.ts')
  assert.match(auth, /OPERATOR_USER_ID/)
  assert.match(auth, /OPERATOR_EMAIL/)
  assert.match(auth, /isConfiguredOperatorUser/)
  assert.doesNotMatch(auth, /!error && data\.user\) return/)
  assert.match(read('src/app/api/jobs/pull/access/route.ts'), /isAuthorizedOperatorSession/)
  assert.match(read('src/app/api/jobs/pull/route.ts'), /isAuthorizedOperatorSession/)
})

test('the Next wrapper and Edge Function enforce the same pull secret', () => {
  const route = read('src/app/api/jobs/pull/route.ts')
  const edge = read('supabase/functions/daily-job-pull/index.ts')
  assert.match(route, /x-job-pull-key/)
  assert.match(route, /SUPABASE_SERVICE_ROLE_KEY/)
  assert.match(edge, /isAuthorizedPullRequest/)
  assert.match(edge, /JOB_PULL_API_KEY/)
  assert.match(edge, /Unauthorized job-pull request/)
})
