# Task: Fill critical test coverage gaps

## Task Metadata

```yaml
task_id: VT-001
title: Cover aggregates/domain-primitives/messaging/contracts; standardize on .test.ts
type: feature
priority: high
complexity: medium
estimated_time: 16h
created_by: agent (testing-excellence 2026-05-08)
created_at: 2026-05-08
status: planned
release_target: v0.25.0-beta.1 (partial) + post-v0.25 (full)
```

## Why This Task Exists

Testing-excellence audit (2026-05-08) graded test quality 4/10 with these
specific findings:

- `aggregates`: 3 test files / 11 source — 0.27 ratio, the heart of DDD library
- `domain-primitives`: 1 test / 8 source — 0.12 ratio
- `messaging`: 2 tests / 7 source — outbox pattern barely covered
- `contracts`: 4 tests / 31 source — surface tests missing for most types
- `enterprise`: 0 tests despite re-exporting whole API surface
- `domain-services/tests/di-integration/`: 3 files with `describe.skip` blocks
- 82 `.test.ts` vs 31 `.spec.ts` (no convention)
- 1348 of 1371 `it()` in `should X` style; zero GWT

## Pre-release scope (REL-005 hard requirement)

- [ ] API surface tests for all 21 packages (asserts exported names list)
- [ ] Remove or fix `describe.skip` in `domain-services/di-integration/`
- [ ] Standardize on `.test.ts` (or `.spec.ts`); add ESLint rule
- [ ] Fix flaky timer tests in `circuit-breaker.test.ts:118` and
      `cached-policy.test.ts:131` (use `vi.useFakeTimers()`)

## Post-release scope (v0.26+)

- [ ] Property-based tests via fast-check for ValueObject equality / hashCode
      invariants (5 packages: value-objects, domain-primitives)
- [ ] Aggregate lifecycle / snapshotting / capability tests
- [ ] Outbox sequence integration tests in messaging
- [ ] Migrate test naming to GWT for core DDD packages (aggregates,
      value-objects, events) — opportunistically during fix work

## Acceptance Criteria

### Pre-release (must-have)
- [ ] `pnpm test:contracts` validates 21 surface snapshots
- [ ] No `describe.skip` blocks in active code
- [ ] Single test-file convention enforced
- [ ] Zero flaky timer tests (verified by 10× CI runs)

### Post-release (target)
- [ ] `aggregates` test ratio ≥ 0.6 (6+ tests / 11 src)
- [ ] `domain-primitives` test ratio ≥ 0.5
- [ ] `messaging` outbox ≥ 4 integration tests
- [ ] PBT covers VO equality / hashCode in 2+ packages

## Coupled with

- REL-005 — surface tests are part of API cleanup acceptance
- REL-006 — `examples/quickstart/` test count (currently 16) is good baseline
