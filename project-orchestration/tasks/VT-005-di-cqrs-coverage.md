# Task: DI adapters and CQRS configuration coverage gap fill

## Task Metadata

```yaml
task_id: VT-005
title: Cover di/adapters, di/discovery, cqrs/configuration
type: test
priority: medium
complexity: medium
estimated_time: 4-6h
created_by: agent (testing-excellence + orchestrate 2026-05-10)
created_at: 2026-05-10
updated_at: 2026-05-10
status: pending
release_target: v0.26.0
branch: feat/vt-005-di-cqrs-coverage
parent: VT-002, VT-003, VT-004
```

## Why This Task Exists

Coverage analysis (2026-05-10) showed two infrastructure modules with 0%
statement coverage despite being part of the public API:

| File                                            | Stmts  | Branches | Risk |
| ----------------------------------------------- | ------ | -------- | ---- |
| `di/src/adapters/base-adapter.ts`               | **0%** | **0%**   | All DI adapter inheritors broken if base regresses |
| `di/src/discovery/directory-registry.ts`        | 16.66% | 0%       | Auto-discovery of handlers |
| `cqrs/src/configuration/configuration.ts`       | **0%** | **0%**   | CQRS module config |
| `cqrs/src/configuration/cqrs-module.ts`         | **0%** | **0%**   | NestJS module entry point |
| `cqrs/src/errors/*.ts`                          | 41.66% | gaps     | CQRS error classes |

These modules are smaller in surface than VT-003/004 but have **zero** tests,
which is a release-blocker risk: a typo in `base-adapter.ts` would not be
caught by any existing test.

## Scope

### In scope (this task / branch)

- [ ] `packages/di/tests/adapters/base-adapter.test.ts`
- [ ] `packages/di/tests/discovery/directory-registry.test.ts`
- [ ] `packages/cqrs/tests/configuration/configuration.test.ts`
- [ ] `packages/cqrs/tests/configuration/cqrs-module.test.ts`
- [ ] `packages/cqrs/tests/errors/*` — top up to ≥80%
- [ ] Each file ≥80% on all four metrics

### Out of scope

- NestJS-specific DI (separate package, has its own tests)
- Performance tests for DI lookups (covered by VP-006)

## Acceptance Criteria

- [ ] `pnpm vitest run --coverage` reports ≥80% for all listed files
- [ ] All new tests use `safeRun` (NO `toThrow`)
- [ ] All new tests in `packages/*/tests/`
- [ ] `pnpm test:ci` passes
- [ ] `pnpm type-check` passes

## Patterns Applied

- `claude-patterns/patterns/typescript-library/library-testing-pattern.md`
- `claude-patterns/patterns/typescript-library/public-api-pattern.md`
- `.claude/agents/testing-excellence.md` — safeRun, /tests location

## Verification Plan

```bash
pnpm nx test @vytches/ddd-di --skip-nx-cache --coverage
pnpm nx test @vytches/ddd-cqrs --skip-nx-cache --coverage
pnpm test:ci
pnpm type-check
```

## Notes for next-context implementation

- Branch from `develop` (post-VT-004 merge)
- `cqrs/configuration/cqrs-module.ts` likely needs NestJS test container —
  reference `packages/nestjs/tests/` for fixtures
- `di/adapters/base-adapter.ts` is an abstract class — test via concrete
  subclass fixture, not direct instantiation
- After branch + commits: `git checkout develop && git merge --no-ff --no-verify
  feat/vt-005-di-cqrs-coverage`

## Final state after VT-002 → VT-005

Expected global coverage progression:
- Before VT-002: 63.98% statements
- After VT-002 (foundation): 66.12% (✓ DONE)
- After VT-003 (capabilities): ~70% projected
- After VT-004 (integration): ~77% projected
- After VT-005 (DI/CQRS config): ~80%+ projected

This series brings the library to the canonical 80% threshold for the first
time and closes the largest single gap before v0.26.0 release.
