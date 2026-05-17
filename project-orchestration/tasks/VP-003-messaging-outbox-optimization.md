# Task: Outbox throughput parity — adoption blockers (juz-ide-api validated)

## Task Metadata

```yaml
task_id: VP-003
title: Outbox parallel dispatch docs + adaptive re-poll + NestJS module
type: feature
priority: high
complexity: simple
estimated_time: 4h
created_by: human (work-items archive 2026-03-31)
created_at: 2026-03-31
migrated_at: 2026-05-08
revised_at: 2026-05-10 (consumer feedback from juz-ide-api)
status: in_progress
release_target: v0.26.1 (fast-follow patch after v0.26.0 publish)
priority_score: 92/100 (raised from 87 — validated adoption deal)
branch_part_1: feat/vp-003-outbox-parallel-dispatch-docs (in progress)
```

## Why This Task Exists (revised 2026-05-10)

**Original problem statement was speculative.** Original VP-003 (14h) assumed
batching, prioritization, binary serialization were missing. Verification:

- Batching ✅ already present (`batchSize` option, default 10)
- Prioritization ✅ already present (`priorityOrder` option with 4 levels)
- Parallel dispatch ✅ already present (`Promise.allSettled` line 122-125)
- Binary serialization ❌ no consumer signal — DROP
- **Adaptive re-poll ❌ MISSING — real gap, validated**
- **NestJS lifecycle integration ❌ MISSING — real gap, validated**
- **Documentation gap on parallel dispatch ❌ — consumer thought sequential**

Source of validation: juz-ide-api (consumer with 237 aggregates, 16K tests)
performed migration analysis 2026-05-10. They wrote a custom
`OutboxPollerService` because the library missed three specific things. They
explicitly stated they will migrate from custom code to library
`OutboxProcessor` if these are addressed.

This is not "wishlist feedback" — it is a **commitment-style adoption signal**
from a real production consumer.

## Scope (revised — 4h total, sequenced)

### Part 1: parallel dispatch documentation — DONE 2026-05-10 (~30 min)

- ✅ JSDoc on `OutboxProcessor.processBatch()` — explicit `Promise.allSettled`
  contract, ordering caveat, throughput numbers
- ✅ Inline comment at the dispatch site
- ✅ `packages/messaging/LLMGUIDE.md` — new "Dispatch model — parallel within
  batch" section with broker-adapter recipe (no deps added)

Branch: `feat/vp-003-outbox-parallel-dispatch-docs` → merge to develop before
v0.26.0 publish (zero code risk, docs only).

### Part 2: adaptive re-poll — DEFERRED to v0.26.1 (~1.5h)

- Modify `OutboxProcessor.processBatch()` to return
  `{ processed: number; batchSize: number }` (backward-compatible — callers
  ignoring the return value still work)
- Modify `scheduleProcessing()` so that if last batch was full
  (`processed >= batchSize`), next poll fires immediately (delay=0) instead of
  waiting `processingInterval`
- This is **NOT** the full AIMD adaptive system — just the simple
  "if-batch-was-full re-poll immediately" pattern that the consumer described
- Add tests covering: full batch → 0 delay, partial batch → normal interval,
  empty batch → normal interval

### Part 3: NestJS module — DEFERRED to v0.26.1 (~2h)

- Add to `@vytches/ddd-nestjs` package:
  - `OutboxProcessorService` extending `OutboxProcessor`, decorated with
    `@Injectable()`, implementing `OnModuleInit` (`start()`) and
    `OnModuleDestroy` (`stop()`)
  - `OutboxProcessorModule` with `forRoot(options)` static factory
- Zero new external deps — `@nestjs/common` already a dependency of
  `@vytches/ddd-nestjs`
- API surface tests + lifecycle smoke test

### Part 4 (out of scope): full AIMD adaptive batch sizing

- Consumer did not request this; documented as nice-to-have only
- If demand surfaces post-v0.26.1, separate task

### Out of scope (DROPPED from original VP-003)

- ❌ Binary serialization (no consumer signal)
- ❌ Adaptive batchSize (defer until validated demand)
- ❌ Backpressure / Reactive Streams (overkill for outbox use case)
- ❌ Connection pooling for publishers (consumer concern, not library concern)

## Acceptance Criteria

### v0.26.0 (Part 1 only)

- [x] JSDoc explicit on `processBatch` — parallel dispatch contract
- [x] LLMGUIDE.md section on dispatch model
- [x] LLMGUIDE.md adapter recipe (broker-agnostic, no deps)
- [x] No regressions in existing tests
- [x] Merged to develop pre-publish

### v0.26.1 (Parts 2+3 fast-follow)

- [ ] `processBatch` returns `{ processed, batchSize }` (backward compatible)
- [ ] Adaptive re-poll: full batch → immediate next poll
- [ ] Adaptive re-poll covered by tests (3 scenarios)
- [ ] `OutboxProcessorService` in `@vytches/ddd-nestjs` with `@Injectable()` +
      lifecycle hooks
- [ ] `OutboxProcessorModule.forRoot()` exported
- [ ] API surface tests for new NestJS exports
- [ ] juz-ide-api migration prep: post on RELEASE-NOTES.md mentioning the three
      changes by name

## Why This Order

1. Part 1 (docs) is **gift** — eliminates one consumer blocker without code
   change
2. Parts 2+3 wait for v0.26.0 publish to avoid feature creep before launch
3. v0.26.1 within ~1 week is a clean fast-follow pattern; gives juz-ide-api
   concrete migration target

## Coupled With

- REL-000 / REL-003 / REL-011 — v0.26.0 publish chain (do not block)
- v0.26.1 will be the first patch release — natural moment to ship fast-follow

## Notes

- Original 14h estimate was based on speculation; revised 4h is based on
  consumer's explicit must-have list
- juz-ide-api's `BullMQOutboxHandler` pattern is the documentation reference but
  is NOT shipped as library code (no-adapters decision honored)
- Consumer rated current outbox "acceptable" but won't migrate without the three
  blockers — fixing them gives the library its first major production reference
