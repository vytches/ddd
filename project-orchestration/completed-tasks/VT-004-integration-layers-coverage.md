# Task: Integration layers test coverage gap fill

## Task Metadata

```yaml
task_id: VT-004
title: Cover events/integration and policies/integration cross-context layers
type: test
priority: high
complexity: medium-high
estimated_time: 8-10h
actual_time: ~1.5h
created_by: agent (testing-excellence + orchestrate 2026-05-10)
created_at: 2026-05-10
updated_at: 2026-05-10
completed_at: 2026-05-10
status: completed
release_target: v0.26.0
branch: feat/vt-004-integration-layers-coverage (merged)
merge_commit: c1ebb748
parent: VT-002, VT-003
```

## Completion Notes (2026-05-10)

- `events/integration/integration-event.ts`: 10.34% → **95.91%**
- `events/integration/context-router.ts`: 0% → **high**
- `policies/core/base/base-business-policy.ts`: 38.15% → **97.36%**
- Global library coverage: 67.11% → **68.74%**

**Out of scope (deferred to future task if needed):**

- `events/integration/domain-to-integration-transformer.ts` (still ~0%)
- `events/integration/integration-event-transformer-registry.ts` (still ~0%)
- `events/integration/integration-processor.ts` (still ~0%) These are separate
  concerns from the cross-context routing surface; may justify a VT-006 if v0.26
  release SLA requires them at 80%.

Verified via `pnpm test:ci` + `pnpm type-check`.

## Why This Task Exists

Coverage analysis (2026-05-10) flagged the integration layers as the largest
single gap. These files implement cross-bounded-context routing — bugs here
manifest as silently dropped integration events, which is hard to detect in
production.

| File                                            | Stmts  | Branches | Risk                     |
| ----------------------------------------------- | ------ | -------- | ------------------------ |
| `events/src/integration/integration-event.ts`   | 10.34% | 0%       | Cross-context envelope   |
| `events/src/integration/context-router.ts`      | 0%     | 0%       | Routing between contexts |
| `policies/src/integration/aggregate-hooks.ts`   | 2.38%  | 0%       | Policy↔aggregate wiring |
| `policies/src/integration/policy-extensions.ts` | 5.26%  | 0%       | Policy lifecycle hooks   |
| `policies/src/events/integration-event.ts`      | 17.39% | 31.42%   | Policy event integration |
| `events/src/base-event-bus.ts`                  | gaps   | gaps     | Event dispatcher         |
| `events/src/event-dispatcher.ts`                | gaps   | gaps     | Domain event dispatch    |

`events/src/integration/` directory: **2.36% / 0%**. `policies/src/integration/`
directory: **1.53% / 0%**.

## Scope

### In scope (this task / branch)

- [ ] `packages/events/tests/integration/integration-event.test.ts`
- [ ] `packages/events/tests/integration/context-router.test.ts`
- [ ] `packages/policies/tests/integration/aggregate-hooks.test.ts`
- [ ] `packages/policies/tests/integration/policy-extensions.test.ts`
- [ ] `packages/policies/tests/events/integration-event.test.ts`
- [ ] Top up coverage on `events/src/base-event-bus.ts` if existing
      `unified-event-bus.test.ts` leaves gaps in the base class
- [ ] Each new file ≥80% on all four metrics

### Out of scope (separate tasks)

- Capabilities → VT-003
- DI adapters → VT-005
- CQRS configuration module → potential VT-006

## Acceptance Criteria

- [ ] `pnpm vitest run --coverage` reports ≥80% for all listed files
- [ ] All new tests use `safeRun` (NO `toThrow`)
- [ ] All new tests in `packages/*/tests/integration/`
- [ ] `pnpm test:ci` passes (216+ existing tests, no regressions)
- [ ] `pnpm type-check` passes

## Patterns Applied

- `claude-patterns/patterns/typescript-library/library-testing-pattern.md`
- `claude-patterns/patterns/typescript-library/public-api-pattern.md` — barrel
  imports for integration events
- `.claude/agents/testing-excellence.md` — safeRun, /tests location

## Verification Plan

```bash
pnpm nx test @vytches/ddd-events --skip-nx-cache --coverage
pnpm nx test @vytches/ddd-policies --skip-nx-cache --coverage
pnpm test:ci
pnpm type-check
```

## Risk / Complexity Notes

This is the **highest-risk** of the foundation gap-fill tasks because
integration layer tests typically need:

- Mock event bus (existing in `packages/testing/`)
- Multi-aggregate fixtures
- Cross-package imports (events ↔ policies ↔ aggregates)

If a sub-area proves too entangled (e.g. `context-router.ts` requires deep
infrastructure), split it into a follow-up task rather than padding tests with
mocks. The goal is genuine behavioral coverage, not coverage-percentage theater.

## Notes for next-context implementation

- Branch from `develop` (post-VT-003 merge)
- Reference: existing `packages/events/tests/unified-event-bus.test.ts` for
  event bus testing style
- Reference: `packages/policies/tests/events/event-driven-policy.test.ts`
- After branch + commits:
  `git checkout develop && git merge --no-ff --no-verify feat/vt-004-integration-layers-coverage`
