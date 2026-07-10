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
status: backlog
release_target: pre-first-public-publish
package:
  "'@vytches/ddd-contracts', '@vytches/ddd-policies', '@vytches/ddd-aggregates'"
findings: [SA-C2, SA-L1]
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

1. [ ] `EntityId.create()` generates its UUID via
       `globalThis.crypto.randomUUID()` (directly or via the same path the rest
       of contracts uses) — no new dependency (runtime builtin).
2. [ ] The four SA-L1 generators call `LibUtils.getUUID()` (keeping any required
       prefix as a plain concatenation if the format is load-bearing; verify
       nothing parses the old `prefix_timestamp_random` shape first).
3. [ ] Tests: UUID v4 format assertion for `EntityId.create()`; uniqueness
       sanity check (N=10k, no duplicates); existing `EntityId` contract tests
       stay green.
4. [ ] BC assessment (library-api-guardian): return type and UUID v4 shape are
       unchanged, so this is a behavior hardening, not an API break — confirm
       and note in CHANGELOG anyway (IDs become non-reproducible across
       `Math.random`-seeded test setups, if any relied on that).
5. [ ] Grep-verify no other `Math.random()`-based **identifier** generation
       remains in `packages/*/src` (jitter/backoff usages in resilience,
       policies retry, and outbox are correct uses and stay).

## Out of scope

- `Math.random()`-based fake-data generators in `packages/testing/src` (fixture
  data, not production identifiers) — cleanup candidate for a testing-package
  task if ever worthwhile.
- Constant-time comparison helpers — no secret-comparison API exists in the
  library (verified in the audit), nothing to fix.

## References

- Analysis: `project-orchestration/analysis/SEC-AUDIT-2026-07-09.analysis.md`
  (SA-C2, SA-L1)
- Correct in-repo precedents:
  `contracts/src/events/domain-event-utils.ts:15-17`,
  `value-objects/src/id.value-object.ts:77-79`, `LibUtils.getUUID()`
