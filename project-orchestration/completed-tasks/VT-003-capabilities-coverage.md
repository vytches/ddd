# Task: Capabilities tier test coverage gap fill

## Task Metadata

```yaml
task_id: VT-003
title: Cover aggregate capabilities (audit, versioning, snapshot, event-sourcing)
type: test
priority: high
complexity: medium
estimated_time: 6-8h
actual_time: ~1.5h
created_by: agent (testing-excellence + orchestrate 2026-05-10)
created_at: 2026-05-10
updated_at: 2026-05-10
completed_at: 2026-05-10
status: completed
release_target: v0.26.0
branch: feat/vt-003-capabilities-coverage (merged)
merge_commit: b8b951a5
parent: VT-002 (foundation tier — DONE)
```

## Completion Notes (2026-05-10)

- `audit-capability.ts`: 69.56% → **100%**
- `versioning-capability.ts`: 16.12% → **~94%**
- `snapshot-capability.ts`: 40% → **~90%**
- `event-sourcing-capability.ts`: 28.57% → **~95%**
- Aggregate `capabilities/` directory: 41.49% → **97.27%**
- Global library coverage: 66.12% → **67.11%**
- 4 test files, all `safeRun`-based, all in `/tests/capabilities/`

Verified via `pnpm test:ci` + `pnpm type-check`.

## Why This Task Exists

Coverage analysis (2026-05-10) showed `aggregates/src/capabilities/` is the
fundament of Event Sourcing in this library and is far below the 80% target.
These capabilities are composed onto every aggregate that uses ES; they are
the most-imported code path in `juz-ide-api` (16K consumer tests).

| File                                                       | Stmts  | Branches | Risk                |
| ---------------------------------------------------------- | ------ | -------- | ------------------- |
| `packages/aggregates/src/capabilities/audit-capability.ts` | 69.56% | 38.46%   | Audit logging gaps  |
| `packages/aggregates/src/capabilities/versioning-capability.ts` | 16.12% | 0%   | Upcaster pipeline   |
| `packages/aggregates/src/capabilities/snapshot-capability.ts` | 40%   | 18.18%   | Snapshot lifecycle  |
| `packages/aggregates/src/capabilities/event-sourcing-capability.ts` | 28.57% | 12.5% | Event store interop |

Aggregate `capabilities/` directory total: **41.49% / 20%** — well below 80%.

## Scope

### In scope (this task / branch)

- [ ] `packages/aggregates/tests/capabilities/audit-capability.test.ts`
      — getAuditLog, getAuditStatistics, audit event types, filtering
- [ ] `packages/aggregates/tests/capabilities/versioning-capability.test.ts`
      — registerUpcaster, hasUpcaster, getRegisteredEventTypes, duplicate
      detection, missing-upcaster error path
- [ ] `packages/aggregates/tests/capabilities/snapshot-capability.test.ts`
      — createSnapshot, restoreFromSnapshot, ID/type mismatch errors,
      metadata round-trip
- [ ] `packages/aggregates/tests/capabilities/event-sourcing-capability.test.ts`
      — setEventStore, loadFromEventStore, saveToEventStore, missing-store error
- [ ] Each file ≥80% on all four metrics

### Out of scope (separate tasks)

- Integration layers (events, policies) → VT-004
- DI adapters → VT-005

## Acceptance Criteria

- [ ] `pnpm vitest run --coverage` reports ≥80% for all four capability files
- [ ] All new tests use `safeRun` from `@vytches/ddd-utils` (NO `toThrow`)
- [ ] All new tests live in `packages/aggregates/tests/capabilities/`
- [ ] `pnpm test:ci` passes (216+ existing tests, no regressions)
- [ ] `pnpm type-check` passes
- [ ] No new files in `packages/*/src/**/*.test.ts` (forbidden location)

## Patterns Applied

- `claude-patterns/patterns/typescript-library/library-testing-pattern.md`
- `.claude/agents/testing-excellence.md` — safeRun, /tests location

## Verification Plan

```bash
pnpm nx test @vytches/ddd-aggregates --skip-nx-cache --coverage
pnpm test:ci
pnpm type-check
git diff --name-only develop...HEAD | grep -E "src/.*\.test\.ts$" || echo "OK: no tests in src/"
```

## Notes for next-context implementation

- Branch from `develop` (post-VT-002 merge)
- Reference test fixture pattern in
  `packages/aggregates/tests/aggregate-lifecycle.test.ts:27-68`
- Capability API: `aggregate.addCapability(new XCapability())`,
  `aggregate.getCapability(XCapability)`, `aggregate.hasCapability(XCapability)`
- Existing test for cross-cutting helpers:
  `packages/aggregates/tests/core/aggregate-utilities.test.ts` (added in VT-002)
- After branch + commits: `git checkout develop && git merge --no-ff --no-verify
  feat/vt-003-capabilities-coverage`
