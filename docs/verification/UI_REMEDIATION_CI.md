# UI Remediation CI Verification

- Source commit: `516a605674beb91b81ddb4fb10ff4d01731f3f23`
- Workflow run: `30640703104`
- Event: `push`
- Generated: `2026-07-31T14:56:27Z`

| Check | Exit code |
|---|---:|
| lockfile sync + npm ci | 0 |
| npm run typecheck | 0 |
| npm run lint | 1 |
| npm test | 0 |
| npm run build | 1 |

## install log tail

```text
$ npm install --package-lock-only --ignore-scripts --no-audit --no-fund

up to date in 1s

$ npm ci --no-audit --no-fund

added 404 packages in 9s
```

## typecheck log tail

```text

> job-search-command-center@0.1.0 typecheck
> tsc --noEmit

```

## lint log tail

```text

> job-search-command-center@0.1.0 lint
> next lint

Attention: Next.js now collects completely anonymous telemetry regarding usage.
This information is used to shape Next.js' roadmap and prioritize features.
You can learn more, including how to opt-out if you'd not like to participate in this anonymous program, by visiting the following URL:
https://nextjs.org/telemetry


./src/app/applications/[id]/page.tsx
29:27  Error: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any

./src/app/contacts/page.tsx
47:39  Error: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any

./src/app/dashboard/page.tsx
64:57  Error: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
80:68  Error: `'` can be escaped with `&apos;`, `&lsquo;`, `&#39;`, `&rsquo;`.  react/no-unescaped-entities
112:43  Error: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
130:50  Error: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
162:37  Error: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
199:40  Error: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any

./src/lib/apollo.ts
72:11  Error: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any

info  - Need to disable some ESLint rules? Learn more here: https://nextjs.org/docs/app/api-reference/config/eslint#disabling-rules
```

## tests log tail

```text

> job-search-command-center@0.1.0 test
> node --test tests/*.test.mjs

TAP version 13
# Subtest: repairs UTF-8 text decoded as Windows-1252
ok 1 - repairs UTF-8 text decoded as Windows-1252
  ---
  duration_ms: 0.836475
  type: 'test'
  ...
# Subtest: repairs Arabic mojibake visible in imported job locations
ok 2 - repairs Arabic mojibake visible in imported job locations
  ---
  duration_ms: 0.198615
  type: 'test'
  ...
# Subtest: preserves valid international text
ok 3 - preserves valid international text
  ---
  duration_ms: 0.168483
  type: 'test'
  ...
# Subtest: removes control characters and collapses whitespace
ok 4 - removes control characters and collapses whitespace
  ---
  duration_ms: 0.117243
  type: 'test'
  ...
# Subtest: uses fallback for missing values
ok 5 - uses fallback for missing values
  ---
  duration_ms: 0.771992
  type: 'test'
  ...
1..5
# tests 5
# suites 0
# pass 5
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 47.873855
```

## build log tail

```text

> job-search-command-center@0.1.0 build
> next build

   ▲ Next.js 15.1.12

   Creating an optimized production build ...
 ✓ Compiled successfully
   Linting and checking validity of types ...

Failed to compile.

./src/app/applications/[id]/page.tsx
29:27  Error: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any

./src/app/contacts/page.tsx
47:39  Error: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any

./src/app/dashboard/page.tsx
64:57  Error: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
80:68  Error: `'` can be escaped with `&apos;`, `&lsquo;`, `&#39;`, `&rsquo;`.  react/no-unescaped-entities
112:43  Error: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
130:50  Error: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
162:37  Error: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
199:40  Error: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any

./src/lib/apollo.ts
72:11  Error: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any

info  - Need to disable some ESLint rules? Learn more here: https://nextjs.org/docs/app/api-reference/config/eslint#disabling-rules
```

