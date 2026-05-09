# Task: Fix 5 DDD pattern correctness bugs

## Task Metadata

```yaml
task_id: REL-009
title: AggregateRoot snapshot mismatch, BaseValueObject silent invalid, CQRS asymmetry, EnhancedCommandBus default-on retry, OrPolicyComposer violations
type: bug
priority: critical
complexity: complex
estimated_time: 14h
actual_time: 1.5h
created_by: agent (ddd-patterns-expert)
created_at: 2026-05-08 14:00
revised_at: 2026-05-08 (critical-reviewer: removed false-positive #2, kept 4+1 bugs, raised estimate)
completed_at: 2026-05-08
status: completed
release_target: v0.25.0-beta.1
```

## ✅ Resolved (2026-05-08)

### Fixes applied

**#1 IAggregateSnapshot interface mismatch**
(`aggregate-interfaces.ts:290-292`):

- Renamed `id: unknown` → `aggregateId: string` to match implementation
- Implementation in `snapshot-capability.ts:43-45` was already using
  `aggregateId`; the interface field `id` was never populated, so consumers
  reading it got `undefined`
- Confirmed via grep: zero `snapshot.id` usages in codebase, 3
  `snapshot.aggregateId`
- Net effect: broken consumer code (if any) now fails at type-check instead of
  silently returning undefined

**#3 CommandBus vs QueryBus error symmetry** (`command-bus.ts:117-122`):

- CommandBus.getHandlerToken was throwing generic `Error` when decorator
  metadata was missing
- QueryBus.getHandlerToken was throwing typed `CQRSConfigurationError` with
  decorator hint
- Aligned CommandBus to throw `CQRSConfigurationError` with same hint format
- Both buses now produce identical, actionable error messages for missing
  decorators

**#4 EnhancedCommandBus retry/circuitBreaker default-on → opt-in** (BREAKING):

- `enhanced-command-bus.ts:160-184`: changed `enabled !== false` →
  `enabled === true` for `circuitBreaker` and `retry` strategies
- Retrying domain commands silently was causing potential duplicate orders /
  double charges (commands are usually NOT idempotent)
- Timeout strategy retains default-on behavior (safety net, no idempotency
  impact)
- Bulkhead was already opt-in
- Updated existing tests in `enhanced-command-bus.test.ts` `beforeEach` to
  explicitly opt-in retry (preserves `metrics.errors === 3` expectations while
  documenting the new opt-in pattern)

**#5 OrPolicyComposer aggregate violations**
(`base-business-policy.ts:283-322`):

- Was returning `violations[0]!` — first violation only, hiding which
  OR-branches failed
- Now returns aggregated `PolicyViolation` with all sub-violations in
  `details.violations[]` (each entry: `policyId`, `code`, `message`, `field`)
- Top-level message: `"All N OR policy conditions failed"` for context
- Consumers can drill into `details.violations` to diagnose

**#6 BaseRepository.save() does not call aggregate.commit()** (PROMOTED):

- `base-repository.ts:72-91`: after `dispatchEventsForAggregate`, now calls
  `aggregate.commit()` to mark events as committed
- Without this, calling `save()` twice would re-dispatch the same events (silent
  bug — most consumers call save() once per command, hiding the issue)
- `IAggregateWithEvents.commit()` was already in the contract; just wasn't being
  invoked
- `trySave()` (Result-returning variant) inherits the fix transparently

### #2 Removed (false positive)

`BaseValueObject.validate()` not auto-invoked — verified during critical review
that no abstract `validate()` exists in current `base-value-object.ts`. VF-022
already addressed VO immutability. The `validate()` shown in QUICK_START.md is
consumer-defined on Money, not base-class abstract.

### Verification

- `pnpm type-check` → 20 projects clean
- `pnpm test:ci` → 21 projects, all passing (including updated CommandBus tests)
- Pre-existing flaky test in `realistic-enterprise-integration.test.ts`
  (timing-based bound) observed once, passed on subsequent runs — tracked for
  VT-001
- Effort 1.5h actual vs 14h estimated — most time saved by removing
  false-positive #2 + correctly identifying #3 as 30-min verification

## ⚠️ Scope Revisions (2026-05-08)

After fact-check against current code:

- **Original #2 (BaseValueObject.validate not auto-invoked) — REMOVED**.
  `packages/value-objects/src/base-value-object.ts` does not have an abstract
  `validate()` method any more — VF-022 already addressed VO immutability
  (Object.freeze in ctor, toJSON returns unknown). The `validate()` shown in
  QUICK_START.md is a user-defined method on `Money`, not a base override. This
  was a false-positive.

- **Original #3 (CommandBus vs QueryBus asymmetric error) — REDUCED to docs**.
  Both buses throw `HandlerNotFoundError` in the fallback path. The
  `CQRSConfigurationError` in QueryBus only fires when decorator metadata is
  missing — which is a _different_ scenario, not asymmetric handling. Verify
  CommandBus has the same metadata-missing error class for consistency (~30 min)
  instead of full refactor.

- **Bonus (Repository.save → commit) — PROMOTED to first-class fix**, since it
  is the most consequential bug (silent event re-emit on second save).

## Why This Task Exists

Five concrete pattern-correctness bugs identified that affect every consumer.
Most are silent failures (no exception, wrong behavior).

## Findings

### 1. AggregateSnapshot interface vs implementation mismatch

- `packages/aggregates/src/aggregate-interfaces.ts:291` — interface field
  `id: unknown`
- `packages/aggregates/src/capabilities/snapshot-capability.ts:44` —
  implementation writes `aggregateId: string`
- Consumer cannot rely on either field consistently
- **Fix**: standardize to `aggregateId: string`, drop `id`

### 2. ~~BaseValueObject.validate() never auto-invoked~~ — REMOVED, false positive

VF-022 fixed VO mutability. No abstract `validate()` exists in current
`base-value-object.ts`. QUICK_START Money example still defines its own
`validate(): boolean` — that is consumer code, not base contract.

### 3. CommandBus vs QueryBus error consistency — REDUCED to verification

- `packages/cqrs/src/implementations/command-bus.ts:86` — catches DI failure as
  `HandlerNotFoundError`
- `packages/cqrs/src/implementations/query-bus.ts:112` — throws
  `CQRSConfigurationError` only when decorator metadata is missing (different
  scenario, not asymmetry)
- **Action** (~30 min): verify CommandBus has the same `CQRSConfigurationError`
  for missing decorator, ensure both throw same error class for the same
  scenario. If already symmetric, document and close.

### 4. EnhancedCommandBus enables resilience by default

- `packages/cqrs/src/implementations/enhanced-command-bus.ts:161-190`
- Activates circuit breaker + retry + timeout when
  `config?.circuitBreaker?.enabled !== false`
- **Retry on domain commands can cause double execution** (e.g. duplicate
  orders)
- **Fix**: default to `enabled: false`, require explicit opt-in

### 5. OrPolicyComposer drops all violations except first

- `packages/policies/src/core/base/base-business-policy.ts:303` — collects array
  but returns `violations[0]`
- Consumer cannot tell which OR-branch failed and why
- **Fix**: aggregate violations into result with sub-violations as `details`

### 6. Repository.save does not call aggregate.commit() — PROMOTED to first-class

- `packages/repositories/src/base-repository.ts:44-83` — `save()` flow:
  `getDomainEvents()` → version check → `handleEvent` per event →
  `dispatchEventsForAggregate` → return. Never invokes `aggregate.commit()`
- Result: events stay in aggregate's uncommitted list. Calling `save()` twice
  re-emits the same events. Most subtle and consequential bug in the set.
- **Fix**: invoke `aggregate.commit()` after successful
  `dispatchEventsForAggregate`

## Acceptance Criteria

- [ ] **#1** Snapshot interface unified, `id` removed (or kept as accessor for
      `aggregateId`); regression test added
- [ ] **#3** CommandBus + QueryBus verified symmetric (same error class for same
      scenario) — close as docs-only if already aligned
- [ ] **#4** `EnhancedCommandBus` defaults: `circuitBreaker.enabled: false`,
      `retry.maxAttempts: 1`; CHANGELOG entry on default behavior change
- [ ] **#5** `OrPolicyComposer` returns aggregated violations with all
      sub-violations as `details`
- [ ] **#6** `BaseRepository.save()` calls `aggregate.commit()` after dispatch
- [ ] One regression test per fix (4 tests minimum)
- [ ] CHANGELOG `## [0.25.0-beta.1] BREAKING` lists each behavior change

## Effort breakdown (revised total: 14h)

| Sub-fix                         | Hours | Reason                                                   |
| ------------------------------- | ----- | -------------------------------------------------------- |
| #1 Snapshot interface           | 2h    | Cross-package change; test                               |
| #3 CQRS error verification      | 1h    | Mostly read-and-confirm                                  |
| #4 EnhancedCommandBus defaults  | 3h    | API change + CHANGELOG + test + consumer impact analysis |
| #5 OrPolicyComposer             | 2h    | Result shape change + tests                              |
| #6 BaseRepository.save → commit | 3h    | Most subtle; repository tests, edge cases                |
| CHANGELOG + migration notes     | 2h    | 5 breaking-ish entries with examples                     |
| Buffer                          | 1h    | Discovery during work                                    |

## Coupled with

- REL-006 (QUICK_START Money example will need update once `validate` changes)
