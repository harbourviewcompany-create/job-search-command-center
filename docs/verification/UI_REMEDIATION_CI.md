# UI Remediation CI Verification

- Source commit: `8c49105b3fe3453910798a2e0a121c9b17ae9a5b`
- Workflow run: `30640965601`
- Event: `push`
- Generated: `2026-07-31T15:00:38Z`

| Check | Exit code |
|---|---:|
| lockfile sync + npm ci | 0 |
| npm run typecheck | 0 |
| npm run lint | 0 |
| npm test | 0 |
| npm run build | 0 |

## install log tail

```text
$ npm install --package-lock-only --ignore-scripts --no-audit --no-fund

up to date in 833ms

$ npm ci --no-audit --no-fund

added 404 packages in 13s
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

✔ No ESLint warnings or errors
```

## tests log tail

```text

> job-search-command-center@0.1.0 test
> node --test tests/*.test.mjs

TAP version 13
# Subtest: repairs UTF-8 text decoded as Windows-1252
ok 1 - repairs UTF-8 text decoded as Windows-1252
  ---
  duration_ms: 1.164361
  type: 'test'
  ...
# Subtest: repairs Arabic mojibake visible in imported job locations
ok 2 - repairs Arabic mojibake visible in imported job locations
  ---
  duration_ms: 0.281027
  type: 'test'
  ...
# Subtest: preserves valid international text
ok 3 - preserves valid international text
  ---
  duration_ms: 0.223078
  type: 'test'
  ...
# Subtest: removes control characters and collapses whitespace
ok 4 - removes control characters and collapses whitespace
  ---
  duration_ms: 0.16069
  type: 'test'
  ...
# Subtest: uses fallback for missing values
ok 5 - uses fallback for missing values
  ---
  duration_ms: 1.029238
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
# duration_ms 65.083621
```

## build log tail

```text

> job-search-command-center@0.1.0 build
> next build

   ▲ Next.js 15.1.12

   Creating an optimized production build ...
 ✓ Compiled successfully
   Linting and checking validity of types ...
   Collecting page data ...
   Generating static pages (0/5) ...
   Generating static pages (1/5) 
   Generating static pages (2/5) 
   Generating static pages (3/5) 
 ✓ Generating static pages (5/5)
   Finalizing page optimization ...
   Collecting build traces ...

Route (app)                              Size     First Load JS
┌ ○ /                                    145 B           106 kB
├ ○ /_not-found                          979 B           106 kB
├ ƒ /api/jobs/pull                       145 B           106 kB
├ ƒ /applications                        1.36 kB         118 kB
├ ƒ /applications/[id]                   3.88 kB         113 kB
├ ƒ /contacts                            1.12 kB         107 kB
├ ƒ /dashboard                           172 B           109 kB
├ ƒ /jobs                                9.63 kB         126 kB
├ ƒ /opportunities                       145 B           106 kB
└ ƒ /settings                            1.21 kB         107 kB
+ First Load JS shared by all            105 kB
  ├ chunks/4bd1b696-e45e92f545646ecc.js  52.9 kB
  ├ chunks/517-f30518cc560ece48.js       50.6 kB
  └ other shared chunks (total)          1.91 kB


○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand

```

