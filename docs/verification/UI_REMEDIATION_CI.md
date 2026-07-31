# UI Remediation CI Verification

- Source commit: `69dc70375693eb0a9fdf2d14c8ee7dcde2132780`
- Workflow run: `30640584041`
- Event: `push`
- Generated: `2026-07-31T14:54:23Z`

| Check | Exit code |
|---|---:|
| npm ci | 1 |
| npm run typecheck | 125 |
| npm run lint | 125 |
| npm test | 125 |
| npm run build | 125 |

## install log tail

```text
npm error code EUSAGE
npm error
npm error `npm ci` can only install packages when your package.json and package-lock.json or npm-shrinkwrap.json are in sync. Please update your lock file with `npm install` before continuing.
npm error
npm error Missing: docx@9.7.1 from lock file
npm error Missing: @types/node@25.9.5 from lock file
npm error Missing: hash.js@1.1.7 from lock file
npm error Missing: jszip@3.10.1 from lock file
npm error Missing: nanoid@5.1.16 from lock file
npm error Missing: xml@1.0.1 from lock file
npm error Missing: xml-js@1.6.11 from lock file
npm error Missing: inherits@2.0.4 from lock file
npm error Missing: minimalistic-assert@1.0.1 from lock file
npm error Missing: lie@3.3.0 from lock file
npm error Missing: pako@1.0.11 from lock file
npm error Missing: readable-stream@2.3.8 from lock file
npm error Missing: setimmediate@1.0.5 from lock file
npm error Missing: immediate@3.0.6 from lock file
npm error Missing: core-util-is@1.0.3 from lock file
npm error Missing: isarray@1.0.0 from lock file
npm error Missing: process-nextick-args@2.0.1 from lock file
npm error Missing: safe-buffer@5.1.2 from lock file
npm error Missing: string_decoder@1.1.1 from lock file
npm error Missing: sax@1.6.1 from lock file
npm error Missing: undici-types@7.24.6 from lock file
npm error
npm error Clean install a project
npm error
npm error Usage:
npm error npm ci
npm error
npm error Options:
npm error [--install-strategy <hoisted|nested|shallow|linked>] [--legacy-bundling]
npm error [--global-style] [--omit <dev|optional|peer> [--omit <dev|optional|peer> ...]]
npm error [--include <prod|dev|optional|peer> [--include <prod|dev|optional|peer> ...]]
npm error [--strict-peer-deps] [--foreground-scripts] [--ignore-scripts] [--no-audit]
npm error [--no-bin-links] [--no-fund] [--dry-run]
npm error [-w|--workspace <workspace-name> [-w|--workspace <workspace-name> ...]]
npm error [-ws|--workspaces] [--include-workspace-root] [--install-links]
npm error
npm error aliases: clean-install, ic, install-clean, isntall-clean
npm error
npm error Run "npm help ci" for more info
npm error A complete log of this run can be found in: /home/runner/.npm/_logs/2026-07-31T14_54_20_787Z-debug-0.log
```

## typecheck log tail

```text
Dependency installation failed; typecheck skipped.
```

## lint log tail

```text
Dependency installation failed; lint skipped.
```

## tests log tail

```text
Dependency installation failed; tests skipped.
```

## build log tail

```text
Dependency installation failed; build skipped.
```

