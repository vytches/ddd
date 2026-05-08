# Task: Fix Nx Project Graph + validate:types

## Task Metadata

```yaml
task_id: REL-002
title: Repair MultipleProjectsWithSameNameError + fix tsc --noEmit chain
type: bug
priority: critical
complexity: medium
estimated_time: 4h
created_by: agent (library-quality-verifier)
created_at: 2026-05-08 14:00
status: planned
release_target: v0.25.0-beta.1
blocks:
  - REL-006 (build/release pipeline)
  - REL-010 (prerelease quality gates)
```

## Why This Task Exists

`pnpm type-check` and all `nx run-many` targets fail with
`MultipleProjectsWithSameNameError`. Without a working project graph the entire
release pipeline (`prerelease` script) is non-executable.

Independently, `pnpm validate:types` runs `tsc --noEmit` without a `--project`
argument, hitting a missing-`--jsx` error.

## Current State

- `pnpm type-check` → throws Nx graph error
- `pnpm test`, `pnpm build`, `pnpm lint` (any nx target) → same error
- `pnpm validate:types` → `error TS17004: Cannot use JSX unless...`
- `pnpm prerelease` → cannot complete

## Desired State

- All `nx run-many` invocations succeed
- `pnpm type-check` exits clean across 21 packages
- `pnpm validate:types` runs against `tsconfig.base.json` correctly

## Acceptance Criteria

- [ ] `pnpm type-check` succeeds end-to-end (≤90s)
- [ ] `pnpm test:ci` runs without graph errors
- [ ] `pnpm validate:types` uses `--project tsconfig.base.json` or per-package tsconfigs
- [ ] Investigate `examples/` and `.claude/worktrees/` as sources of duplicate project names
- [ ] Document root cause in `lessons-learned/`

## Investigation Hints

- Check `nx.json` for stale entries
- Verify `packages/*/project.json` names are unique
- **Most likely root cause** (confirmed by critical-reviewer 2026-05-08):
  `.claude/worktrees/agent-*/` directories created by background agents
  contain `package.json` files. `pnpm-workspace.yaml` includes `packages/**`
  but does not exclude `.claude/worktrees`. Two such worktrees were found.
- **Quick fix**: add `!.claude/**` to `pnpm-workspace.yaml` packages list,
  or `rm -rf .claude/worktrees/agent-*` in pre-build cleanup
- Also clean empty `packages/cli/` directory (REL-001 covers this; both fixes
  often unblock Nx together)
