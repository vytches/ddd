# Task: Fix 5 DDD pattern correctness bugs

## Task Metadata

```yaml
task_id: REL-009
title: AggregateRoot snapshot mismatch, BaseValueObject silent invalid, CQRS asymmetry, EnhancedCommandBus default-on retry, OrPolicyComposer violations
type: bug
priority: critical
complexity: complex
estimated_time: 14h
created_by: agent (ddd-patterns-expert)
created_at: 2026-05-08 14:00
revised_at: 2026-05-08 (critical-reviewer: removed false-positive #2, kept 4+1 bugs, raised estimate)
status: planned
release_target: v0.25.0-beta.1
```

## ⚠️ Scope Revisions (2026-05-08)

After fact-check against current code:

- **Original #2 (BaseValueObject.validate not auto-invoked) — REMOVED**.
  `packages/value-objects/src/base-value-object.ts` does not have an abstract
  `validate()` method any more — VF-022 already addressed VO immutability
  (Object.freeze in ctor, toJSON returns unknown). The `validate()` shown in
  QUICK_START.md is a user-defined method on `Money`, not a base override.
  This was a false-positive.

- **Original #3 (CommandBus vs QueryBus asymmetric error) — REDUCED to docs**.
  Both buses throw `HandlerNotFoundError` in the fallback path. The
  `CQRSConfigurationError` in QueryBus only fires when decorator metadata is
  missing — which is a *different* scenario, not asymmetric handling. Verify
  CommandBus has the same metadata-missing error class for consistency
  (~30 min) instead of full refactor.

- **Bonus (Repository.save → commit) — PROMOTED to first-class fix**, since
  it is the most consequential bug (silent event re-emit on second save).

## Why This Task Exists

Five concrete pattern-correctness bugs identified that affect every consumer.
Most are silent failures (no exception, wrong behavior).

## Findings

### 1. AggregateSnapshot interface vs implementation mismatch

- `packages/aggregates/src/aggregate-interfaces.ts:291` — interface field `id: unknown`
- `packages/aggregates/src/capabilities/snapshot-capability.ts:44` — implementation
  writes `aggregateId: string`
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
- **Retry on domain commands can cause double execution** (e.g. duplicate orders)
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
- **Fix**: invoke `aggregate.commit()` after successful `dispatchEventsForAggregate`

## Acceptance Criteria

- [ ] **#1** Snapshot interface unified, `id` removed (or kept as accessor for
      `aggregateId`); regression test added
- [ ] **#3** CommandBus + QueryBus verified symmetric (same error class for
      same scenario) — close as docs-only if already aligned
- [ ] **#4** `EnhancedCommandBus` defaults: `circuitBreaker.enabled: false`,
      `retry.maxAttempts: 1`; CHANGELOG entry on default behavior change
- [ ] **#5** `OrPolicyComposer` returns aggregated violations with all
      sub-violations as `details`
- [ ] **#6** `BaseRepository.save()` calls `aggregate.commit()` after dispatch
- [ ] One regression test per fix (4 tests minimum)
- [ ] CHANGELOG `## [0.25.0-beta.1] BREAKING` lists each behavior change

## Effort breakdown (revised total: 14h)

| Sub-fix | Hours | Reason |
|---|---|---|
| #1 Snapshot interface | 2h | Cross-package change; test |
| #3 CQRS error verification | 1h | Mostly read-and-confirm |
| #4 EnhancedCommandBus defaults | 3h | API change + CHANGELOG + test + consumer impact analysis |
| #5 OrPolicyComposer | 2h | Result shape change + tests |
| #6 BaseRepository.save → commit | 3h | Most subtle; repository tests, edge cases |
| CHANGELOG + migration notes | 2h | 5 breaking-ish entries with examples |
| Buffer | 1h | Discovery during work |

## Coupled with

- REL-006 (QUICK_START Money example will need update once `validate` changes)
