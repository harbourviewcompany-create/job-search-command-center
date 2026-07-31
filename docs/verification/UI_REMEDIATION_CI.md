# UI Remediation CI Verification

- Source commit: `c9d69e5fc8973228bb7d14d7b5969704c46726c8`
- Workflow run: `30657270157`
- Event: `push`
- Generated: `2026-07-31T18:59:09Z`

| Check | Exit code |
|---|---:|
| lockfile sync + npm ci | 0 |
| npm run typecheck | 2 |
| npm run lint | 0 |
| npm test | 0 |
| npm run build | 1 |

## install log tail

```text
$ npm install --package-lock-only --ignore-scripts --no-audit --no-fund

up to date in 2s

$ npm ci --no-audit --no-fund

added 404 packages in 11s
```

## typecheck log tail

```text

> job-search-command-center@0.1.0 typecheck
> tsc --noEmit

src/app/jobs/page.tsx(98,7): error TS2322: Type '{ initialJobs: JobWithCompany[]; metrics: { triage: number; interested: number; dismissed: number; applied: number; interviews: number; offers: number; }; pagination: { page: number; pageSize: number; total: number; totalPages: number; }; pullAuthorizationToken: string | null; terms: string[]; locations: string[]; l...' is not assignable to type 'IntrinsicAttributes & Props'.
  Property 'pagination' does not exist on type 'IntrinsicAttributes & Props'.
src/components/JobsCommandCenter.tsx(164,14): error TS2741: Property 'authorizationToken' is missing in type '{}' but required in type 'Props'.
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
  duration_ms: 1.226512
  type: 'test'
  ...
# Subtest: repairs Arabic mojibake visible in imported job locations
ok 2 - repairs Arabic mojibake visible in imported job locations
  ---
  duration_ms: 0.212407
  type: 'test'
  ...
# Subtest: preserves valid international text
ok 3 - preserves valid international text
  ---
  duration_ms: 0.269294
  type: 'test'
  ...
# Subtest: removes control characters and collapses whitespace
ok 4 - removes control characters and collapses whitespace
  ---
  duration_ms: 0.989278
  type: 'test'
  ...
# Subtest: uses fallback for missing values
ok 5 - uses fallback for missing values
  ---
  duration_ms: 0.188282
  type: 'test'
  ...
# Subtest: repairMojibake always returns a string for arbitrary input
ok 6 - repairMojibake always returns a string for arbitrary input
  ---
  duration_ms: 0.138629
  type: 'test'
  ...
1..6
# tests 6
# suites 0
# pass 6
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 68.805967
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

./src/app/jobs/page.tsx:98:7
Type error: Type '{ initialJobs: JobWithCompany[]; metrics: { triage: number; interested: number; dismissed: number; applied: number; interviews: number; offers: number; }; pagination: { page: number; pageSize: number; total: number; totalPages: number; }; pullAuthorizationToken: string | null; terms: string[]; locations: string[]; l...' is not assignable to type 'IntrinsicAttributes & Props'.
  Property 'pagination' does not exist on type 'IntrinsicAttributes & Props'.

[0m [90m  96 |[39m         offers[33m:[39m offerResult[33m.[39mcount [33m?[39m[33m?[39m [35m0[39m[33m,[39m[0m
[0m [90m  97 |[39m       }}[0m
[0m[31m[1m>[22m[39m[90m  98 |[39m       pagination[33m=[39m{{ page[33m,[39m pageSize[33m:[39m [33mPAGE_SIZE[39m[33m,[39m total[33m:[39m totalJobs[33m,[39m totalPages }}[0m
[0m [90m     |[39m       [31m[1m^[22m[39m[0m
[0m [90m  99 |[39m       pullAuthorizationToken[33m=[39m{createJobPullToken()}[0m
[0m [90m 100 |[39m       terms[33m=[39m{terms}[0m
[0m [90m 101 |[39m       locations[33m=[39m{locations}[0m
Next.js build worker exited with code: 1 and signal: null
```

