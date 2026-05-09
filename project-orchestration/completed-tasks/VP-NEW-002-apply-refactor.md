# Task: AggregateRoot.apply() Object.create + sanitizeMetadata refactor

## Task Metadata

```yaml
task_id: VP-NEW-002
title: Eliminate duplicate Object.create + double sanitizeMetadata in apply()
type: optimization
priority: high
complexity: medium
estimated_time: 6h
actual_time: 30m
created_by: agent (performance-optimizer 2026-05-08, deferred from VP-NEW-001)
created_at: 2026-05-08
completed_at: 2026-05-09
status: completed
release_target: post-v0.25 (delivered 2026-05-09)
priority_score: derived from VP-NEW-001 hot-path analysis
goal: Reduce per-event allocation cost on the hottest path in the library
```

## Why This Task Exists

Deferred from VP-NEW-001 because the apply() method is the single most
performance-sensitive code path in the library — a careful migration window was
needed. Performance-optimizer audit (2026-05-08) identified two issues:

1. **Double allocation in object-event-with-metadata branch**:
   `apply(event, undefined, metadata)` produced two
   `Object.create + Object.assign` round-trips (first to merge user metadata,
   second to enrich with aggregate metadata).
2. **Double sanitization**: `sanitizeMetadata` was called once on the merged
   user metadata, then again on the enriched metadata. Even though sanitization
   is cheap, the second call re-iterated the same fields.
3. **`sanitizeMetadata` always allocated** a new object even when no
   prototype-pollution keys were present (the common case).

## What Was Delivered (2026-05-09)

Shipped on `develop` (commit `54155470`). Refactor of
`packages/aggregates/src/core/aggregate-root.ts`.

**Refactor 1** — unified one-pass enrichment in `apply()`:

- Build `baseMetadata` once (string path: from `createDomainEvent`; object path:
  spread merge of event.metadata + user metadata).
- Sanitize once at enrichment time, not twice.
- Single `Object.create + Object.assign` to produce `enrichedEvent` — prototype
  chain still preserved for class-based events.

**Refactor 2** — fast-path `sanitizeMetadata`:

- If none of `__proto__`, `constructor`, `prototype` are own properties of the
  input, return the input unchanged.
- Slow path (allocate + filter) only runs when pollution is detected.

## Bench Results (vitest bench, Node 22)

| Benchmark                               | Baseline (VP-NEW-001) | After VP-NEW-002  | Δ      |
| --------------------------------------- | --------------------- | ----------------- | ------ |
| `apply() — single event`                | 1,578,919 ops/sec     | 1,640,055 ops/sec | +3.9%  |
| `apply() — 100-event replay`            | 32,103 ops/sec        | 39,056 ops/sec    | +21.7% |
| Other benchmarks (BaseValueObject etc.) | n/a                   | within ±5% noise  | 0%     |

100-event replay improvement (~3.9M events/s) is material for launch marketing
benchmark numbers.

## Verification

- `pnpm type-check` → 20 projects clean
- `pnpm test:ci` → 23 projects, 216+ tests passing (incl. lifecycle suite from
  VT-001 covering metadata enrichment, maxEvents guard, prototype preservation
  invariants)
- API contracts: zero changes — apply() signature, enrichment fields,
  sanitization rules all preserved

Verification: performance-optimizer agent — APPROVE. Semantic equivalence
verified for both string and object event paths. Fast-path `hasOwnProperty` is
symmetric to in-loop key check for prototype- pollution detection. Three
additional quick wins documented for future tasks.

## Future Work

- Spread elimination on string path (~2-3% gain on string path alone)
- Static method inlining hint for V8 (`sanitizeMetadata` from `static` →
  module-level function): speculative +2-5% on replay
- Pre-allocated metadata template for the hot field set (`aggregateId`,
  `aggregateType`, `aggregateVersion`, `timestamp`) — micro-optimization, may
  not be worth the complexity
