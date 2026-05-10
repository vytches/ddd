# Task: Foundation tier test coverage gap fill

## Task Metadata

```yaml
task_id: VT-002
title:
  Cover foundation tier files (aggregate-errors, value-object,
  aggregate-utilities)
type: test
priority: high
complexity: medium
estimated_time: 6h
created_by: agent (testing-excellence + orchestrate 2026-05-10)
created_at: 2026-05-10
updated_at: 2026-05-10
status: in_progress
release_target: v0.26.0
branch: feat/vt-002-foundation-coverage
```

## Why This Task Exists

Coverage analysis (2026-05-10, `pnpm vitest run --coverage`) revealed three
foundation-tier files far below the 80% target. These files are imported across
the library and by `juz-ide-api` (16K consumer tests depend on them):

| File                                                  | Stmts  | Branches | Risk                       |
| ----------------------------------------------------- | ------ | -------- | -------------------------- |
| `packages/aggregates/src/aggregate-errors.ts`         | 7.89%  | 0%       | All error classes untested |
| `packages/value-objects/src/value-object.ts`          | 46%    | 48.83%   | BaseValueObject internals  |
| `packages/aggregates/src/core/aggregate-utilities.ts` | 16.49% | 9.63%    | Cross-package utilities    |

VT-001 closed the pre-release scope but did not target these specific files;
re-audit on 2026-05-10 surfaced them as the next foundation gap.

## Scope

### In scope (this task / branch)

- [ ] `packages/aggregates/tests/aggregate-errors.test.ts` — full coverage of
      all exported error classes using `safeRun` pattern (no `toThrow`)
- [ ] `packages/value-objects/tests/value-object.test.ts` — extend existing
      tests to cover deep-freeze, hashCode edge cases, equality with nested VOs,
      serialization round-trip
- [ ] `packages/aggregates/tests/core/aggregate-utilities.test.ts` — utility
      function coverage with edge cases
- [ ] Verify each file ≥80% on all four metrics (statements, branches,
      functions, lines)

### Out of scope (future tasks)

- Capabilities (audit/versioning/snapshot/event-sourcing) → VT-003
- Integration layers (events/integration, policies/integration) → VT-004
- DI adapters → VT-005

## Acceptance Criteria

- [ ] `pnpm vitest run --coverage` reports ≥80% for the three target files
- [ ] All new tests use `safeRun` from `@vytches/ddd-utils` (NO `toThrow`)
- [ ] All new tests live in `packages/*/tests/` (NEVER in `src/`)
- [ ] `pnpm test:ci` passes (no regressions in 215+ existing tests)
- [ ] `pnpm typecheck` passes
- [ ] No new files in `packages/*/src/**/*.test.ts` (forbidden location)

## Patterns Applied

- `claude-patterns/patterns/typescript-library/library-testing-pattern.md` —
  contract tests via barrel imports
- `claude-patterns/patterns/typescript-library/public-api-pattern.md`
- `.claude/agents/testing-excellence.md` — safeRun, /tests location,
  /api-surface

## Verification Plan

```bash
# 1. Run target package tests
pnpm --filter @vytches/ddd-aggregates test --coverage
pnpm --filter @vytches/ddd-value-objects test --coverage

# 2. Verify no tests in src/
find packages/ -name "*.test.ts" -path "*/src/*"  # must return nothing

# 3. Verify no toThrow in new files
grep -rn "toThrow" packages/aggregates/tests/aggregate-errors.test.ts || true
grep -rn "toThrow" packages/aggregates/tests/core/aggregate-utilities.test.ts || true

# 4. Full CI
pnpm test:ci
pnpm typecheck
```

## Coupled with

- VT-001 (parent — overall coverage gap fill, partial complete)
- Future: VT-003 (capabilities), VT-004 (integration layers)

## Notes

- Branch from `develop`, not `main`
- One PR per task (foundation tier in this branch)
- Use `safeRun` for ALL error testing (project convention, NOT
  `expect().toThrow()`)
