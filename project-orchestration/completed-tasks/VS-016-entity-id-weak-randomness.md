# Task: EntityId.create() and correlation IDs — replace Math.random() with crypto UUID

## Task Metadata

```yaml
task_id: VS-016
title:
  'contracts/policies/aggregates: weak Math.random()-based ID generation →
  crypto.randomUUID()'
type: bug
priority: critical
complexity: simple
estimated_time: 3h
created_by: SEC-AUDIT-2026-07-09
created_at: 2026-07-09
status: done
release_target: pre-first-public-publish
package:
  "'@vytches/ddd-contracts', '@vytches/ddd-policies', '@vytches/ddd-aggregates'"
findings: [SA-C2, SA-L1]
completed_at: 2026-07-10
```

## Why

**SA-C2 (CRITICAL):** `EntityId.create()`
(`packages/contracts/src/domain/entity-id.implementation.ts:145-153`) — the
library's **documented primary ID factory** (JSDoc examples in
`aggregate-root.ts:57,77` point consumers at exactly this import path) —
generates its UUID with a hand-rolled `Math.random()` template. Consequences in
a production consumer:

- **Predictable identifiers**: `Math.random()` is not a CSPRNG; if consumers
  expose these IDs as resource identifiers, they are enumerable (IDOR-adjacent
  risk).
- **Collision risk at scale**: no uniqueness guarantee, unlike v4 UUIDs from a
  CSPRNG.

The fix is a one-line alignment, not a design change: the same package already
uses `globalThis.crypto.randomUUID()` correctly in
`contracts/src/events/domain-event-utils.ts:15-17`, and
`packages/value-objects/src/id.value-object.ts:77-79` already overrides
`create()` correctly via `LibUtils.getUUID()`. Only the base implementation was
left behind.

**SA-L1 (LOW, same theme):** four near-identical
`` `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` ``
generators produce correlation/execution/audit IDs:

- `packages/policies/src/events/policy-event-bus.ts:305`
  (`generateSubscriptionId`)
- `packages/policies/src/events/event-driven-policy.ts:290`
  (`generateExecutionId`)
- `packages/policies/src/events/policy-evaluation-event.ts:145`
  (`generateExecutionId`)
- `packages/aggregates/src/capabilities/audit-capability.ts:162` (fallback
  `eventId`)

Not secrets, but collision-prone under concurrency and inconsistent with the
crypto-strong IDs used everywhere else (`LibUtils.getUUID()` in
events/messaging).

## Acceptance Criteria

1. [x] `EntityId.create()` generates its UUID via
       `globalThis.crypto.randomUUID()` — no new dependency (runtime builtin).
2. [x] The four SA-L1 generators call `LibUtils.getUUID()` (prefix kept as plain
       concatenation: `sub_${uuid}`, `exec_${uuid}`, `audit-${uuid}`; confirmed
       no code/test parses the old `prefix_timestamp_random` shape).
3. [x] Tests: added UUID v4 format assertion for `EntityId.create()`
       (`entity-id.properties.test.ts`); existing pairwise-uniqueness property
       test (fast-check, up to N=20 per run, many runs) already covers collision
       sanity; one pre-existing test in `audit-capability.test.ts` asserted the
       old `audit-<timestamp>-<random>` format and was updated to match
       `audit-<uuid>`. All existing `EntityId`/policies/aggregates tests stay
       green (contracts 119/119, policies 225/225, aggregates 191/191,
       enterprise api-surface 1/1).
4. [x] BC: return type and UUID v4 shape unchanged — behavior hardening, not an
       API break. CHANGELOG is Lerna-generated from conventional commits (no
       manual edit per project convention); the commit message documents the
       change.
5. [x] Grep-verified: only remaining `Math.random()` usages in `packages/*/src`
       are jitter/backoff in `resilience/patterns/retry.ts`,
       `policies/decorators/retry-policy.ts`,
       `messaging/outbox/outbox-processor.ts` — correct uses, left as is.

## Out of scope

- `Math.random()`-based fake-data generators in `packages/testing/src` (fixture
  data, not production identifiers) — cleanup candidate for a testing-package
  task if ever worthwhile.
- Constant-time comparison helpers — no secret-comparison API exists in the
  library (verified in the audit), nothing to fix.

## Activity / Notes

### 2026-07-10 — implemented on `feature/VS-016-entity-id-crypto-uuid`, merged to develop (status: done)

Verification before merge: `@vytches/ddd-contracts` test (119/119, incl. new
UUID v4 format assertion), type-check, lint (0 errors); `@vytches/ddd-policies`
test (225/225), type-check, lint (0 errors); `@vytches/ddd-aggregates` test
(191/191, incl. updated audit-capability fallback-format assertion), type-check,
lint (0 errors); `@vytches/ddd-enterprise` api-surface test (1/1). All green, no
regressions.

## References

- Analysis: `project-orchestration/analysis/SEC-AUDIT-2026-07-09.analysis.md`
  (SA-C2, SA-L1)
- Correct in-repo precedents:
  `contracts/src/events/domain-event-utils.ts:15-17`,
  `value-objects/src/id.value-object.ts:77-79`, `LibUtils.getUUID()`
