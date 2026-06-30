# Task: DI Container Performance Optimization

## Task Metadata

```yaml
task_id: VP-006
title: Cold-start, service-resolution, auto-discovery performance
type: optimization
priority: normal
complexity: complex
estimated_time: 16h
actual_time: ~30m so far (auto-discovery refactor only)
created_by: human (work-items archive 2026-03-31)
created_at: 2026-03-31
migrated_at: 2026-05-08
updated_at: 2026-06-30
completed_at: 2026-06-30
status: done
release_target: post-v0.25
priority_score: 72/100
merged: develop (e63dae38, perf 38f7f543 + docs c4d8f97e)
```

> **CLOSED 2026-06-30 (reframed scope, analysis-approved).** Library-side work
> in `@vytches/ddd-di` delivered + merged to `develop`. Original NestJS-consumer
> criteria (cold start, first-time resolve, ≤4MB) were reframed to
> library-isolated SLOs (met) and the NestJS-adapter remainder carved out to
> **VP-006b**. See `analysis/VP-006-di-container-performance.analysis.md`.
>
> Delivered: `SimpleContainer.tryResolve` (no double lookup), `getTokenKey`
> memoize + anonymous-class key fix, `Set` cycle detection, single-instance
> retention, dev-only `vitest` bench with library-isolated SLOs + baseline +
> timestamped results archive. 102/102 di tests green; public API unchanged.

## Current Performance Issues (from work-item)

- Cold start: 2.5–4s for full container init
- First-time service resolution: 15–25ms
- Container metadata: 8–12MB for large apps
- Auto-discovery: 40% of startup time
- Multi-context resolution: +5–8ms

## Confirmed by 2026-05-08 performance audit

`packages/nestjs/src/discovery/auto-discovery.service.ts:98–148` — N×5
`Reflect.getMetadata()` calls per provider. With 200+ handlers in a large
consumer project, that's measurable in cold start.

## Why Post-Release

Performance optimization with API stability dependency. Schedule as v0.26 work.

## Acceptance Criteria (preserved + amended)

1. [ ] Reduce cold start by 50% (target: 1–2s) — partial (auto-discovery side
       done)
2. [ ] Service resolution &lt;5ms first-time — not addressed yet
3. [x] Single-pass reflection in auto-discovery (1 call per provider, not 5) —
       DONE 2026-05-09
4. [x] Memoize `scanModule` results in `cqrs-discovery-plugin.ts` — DONE in
       VP-NEW-001 (2026-05-09)
5. [ ] Container metadata ≤4MB for typical apps — not addressed yet

## Partial delivery (2026-05-09)

Shipped on `develop` (commit `0749bb72`): refactor of
`packages/nestjs/src/discovery/auto-discovery.service.ts`.

**Single-pass reflection in `processClass()`**:

- Before: 5 unconditional `Reflect.getMetadata` calls per provider
- After: one `Reflect.getMetadataKeys` scan + boolean flags + targeted fetches
  only for keys we know exist
- Fast-exit paths: keys.length === 0, no DDD keys present
- Register-call order preserved: Domain → Command → Query → Event → Saga

**WeakSet `processedTargets` memoization**:

- Multi-context apps (large consumer project: 10+ bounded contexts) previously
  rescanned the same shared base classes per context. Now scanned at most once
  per service instance.
- Public `reset()` method clears the cache for test isolation / hot-reload.
- Documented assumption: one instance = one options set.

**Estimated cold-start savings** (per perf agent):

- Single context, 200 providers: ~2-5ms
- Multi-context (10× contexts × 200 providers): ~15-30ms

**6 new tests** (`packages/nestjs/tests/auto-discovery-perf.test.ts`):
memoization, reset(), multi-decorator classes, register-call order, null safety,
skip non-DDD-metadata-only classes.

Verification: performance-optimizer agent — APPROVE (semantic equivalence
verified). 2 minor doc fixes applied: assumption documented, register-call
assertion added to memoization test.

## Scope update (2026-06-30, analysis approved)

See `project-orchestration/analysis/VP-006-di-container-performance.analysis.md`
(status: approved). Key reframing:

- Criteria 2 (<5ms resolve) and 5 (≤4MB metadata) were measured on the NestJS
  consumer and are **not** library-addressable. Reframed to library-isolated
  SLOs (resolve overhead µs/op; descriptor memory KB/1000 services), locked by a
  dev-only `vitest/bench` regression gate. Old NestJS numbers downgraded to
  best-effort / measure-and-document (NOT v0.26 blockers).
- NestJS adapter optimization (the actual source of 15–25ms first-time resolve)
  **carved out** to sibling task **VP-006b**
  (`project-orchestration/tasks/VP-006b-nestjs-adapter-performance.md`).
- VP-006 now scopes ONLY `@vytches/ddd-di` internal changes: `tryResolve` (no
  double lookup), `getTokenKey` memoization + anonymous-class key fix, `Set`
  cycle detection, single-instance retention, dev-only bench. NO freeze/intern.

## Remaining scope (post-2026-05-09)

- Service resolution <5ms first-time (criterion 2)
- Container metadata ≤4MB (criterion 5)
- Cold-start regression test in benchmarks/ to lock the gain
- Any further inlining of `scanModule` lookups beyond what VP-NEW-001 + VP-006
  partial already delivered
