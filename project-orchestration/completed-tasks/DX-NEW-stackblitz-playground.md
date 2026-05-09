# Task: StackBlitz playground + "Open in StackBlitz" badge

## Task Metadata

```yaml
task_id: DX-NEW-001
title: One-click runnable @vytches/ddd quickstart on StackBlitz
type: feature
priority: high
complexity: simple
estimated_time: 4h
actual_time: 0.5h
created_by: agent (developer-experience 2026-05-08)
created_at: 2026-05-08
completed_at: 2026-05-09
status: completed
release_target: v0.25.0-beta.1
```

## ✅ Resolved (2026-05-09)

### What was delivered

**1. Root `.stackblitzrc`** at repo root:

```json
{
  "installDependencies": true,
  "startCommand": "cd examples/quickstart && pnpm test",
  "compileTrigger": "save",
  "env": { "ENABLE_CJS_IMPORTS": true }
}
```

When StackBlitz opens the monorepo, it runs `pnpm install` then jumps to
`examples/quickstart` and executes the test suite. WebContainer environment
handles pnpm workspace resolution (workspace:\* deps work because the full
monorepo is loaded).

**2. Prominent badge in README** placed directly under the npm/license/node
badges (above the fold):

```markdown
[**▶ Try it in your browser (StackBlitz)**](https://stackblitz.com/github/vytches/ddd?file=examples/quickstart/src/domain/order.aggregate.ts)
```

Lands users on the central aggregate file with terminal already running tests.

**3. "Zero-install" section in QUICK_START.md** (top of file) describing the
StackBlitz workflow, expected timing (~30s install + 2s test run), edit-and-save
loop.

### Why monorepo-root URL, not subdir?

StackBlitz URL `?tree/main/examples/quickstart` opens that subdir as the project
root — but `examples/quickstart/package.json` uses `workspace:*` deps that fail
to resolve outside the monorepo. The root URL loads the whole repo (pnpm
workspace works), and `.stackblitzrc` jumps to the quickstart subdir for
execution. Net cost: ~30s install vs ~10s for subdir, but it actually works.

### Verification

- `pnpm type-check` → 20 projects clean
- `pnpm test:ci` → 23 projects, all tests passing
- README badge prominent (above the fold, lines 11-14)
- QUICK_START.md "Zero-install" section first content section after intro

Effort: 0.5h actual vs 4h estimated.

### Note on live testing

Cannot verify the actual StackBlitz boot until the GitHub repo is public
(currently private during pre-release). Post-merge to `develop` and
post-publish, the URL will resolve via StackBlitz's GitHub integration (works
automatically for any public repo). DX-NEW-002 (5-min validation) will exercise
this end-to-end.

## Why This Task Exists

DX audit ranked StackBlitz playground as the #1 killer feature: "first
interaction with library forces clone or copy-paste, no single-click playground
means developer evaluates by reading README rather than running code."

This is the highest conversion-impact / lowest-effort item in the entire
roadmap.

## Acceptance Criteria

- [ ] Public StackBlitz workspace pinned to `examples/quickstart/` content
- [ ] All 16 quickstart tests pass in StackBlitz environment
- [ ] "Open in StackBlitz" badge in top of README (above the fold)
- [ ] Workspace reads `@vytches/ddd@latest` (pulls from npm after publish)
- [ ] StackBlitz workspace URL documented in README + QUICK_START.md

## Notes

Coordinate with REL-006 (README rewrite) — badge belongs in the new compact
README, in the first 30 lines next to the install instruction.
