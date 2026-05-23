# Task: Repository Query Performance Enhancement

## Task Metadata

```yaml
task_id: VP-002
title: Repository caching + indexed queries + N+1 prevention
type: optimization
priority: normal
complexity: complex
estimated_time: 20h
actual_time: ~45m so far (N+1 contract + spec memoization only)
created_by: human (work-items archive 2026-03-31)
created_at: 2026-03-31
migrated_at: 2026-05-08
updated_at: 2026-05-09
status: in_progress
release_target: post-v0.25
priority_score: 88/100
```

## Why This Task Exists

Repository performance bottlenecks:

- Aggregate loading with complex specifications
- N+1 query problems in related entity fetching
- No query result caching
- Inefficient specification evaluation
- No indexed query support

**Business Impact**: 35% faster aggregate loading.

## Why Post-Release

Performance optimization belongs after API stabilization. Refactoring
performance characteristics post-1.0 with semver-bound API would be much harder
than now — but the bottleneck risk is small for v0.25 beta consumers (a
production consumer is already running this code in production, performance is
"acceptable").

## Acceptance Criteria (preserved + amended)

Note: original criteria assumed library would ship DB/ORM adapters. Per the
no-adapters principle (memory: "biblioteka jest dependency-free"), aggregate
loading time and indexed-query support are owned by storage adapters, not the
library. Library-side criteria amended below.

1. [ ] Reduce aggregate loading time by 35% — **out of scope** (adapter concern)
2. [x] Eliminate N+1 query problems (library-side: provide a contract adapters
       can implement) — DONE 2026-05-09 via `IBatchRepository`
3. [ ] Intelligent caching strategy — **out of scope** for storage; **partial**
       for spec evaluation (see partial delivery)
4. [ ] Indexed query support for common patterns — **out of scope** (adapter
       concern)
5. [x] Specification-based query optimization — DONE 2026-05-09 via
       `MemoizedSpecification`

## Partial delivery (2026-05-09)

Shipped on `develop` (commit `3d06546e`).

**1. `IBatchRepository<T>` contract**
(`packages/contracts/src/repositories/repository.interfaces.ts`):

- Extends `IExtendedRepository<T>` with
  `findByIds(ids): Promise<Array<T | null>>`
- Order-preserving result with null for misses (callers can zip with input)
- Adapter authors implement once via WHERE id IN, MGET, or DataLoader
- Service-layer code type-narrows at call site to pick batched fetch over per-id
  loops

**2. `MemoizedSpecification<T>`**
(`packages/validation/src/specifications/memoized-specification.ts`):

- WeakMap<T, boolean> per-candidate memoization
- `invalidate(candidate)` for manual eviction
- Defensive primitive-bypass
- Composes with `and/or/not`
- 12 unit tests covering basic memoization, lifecycle, composition, primitive
  bypass, isolation between instances, explainFailure forwarding
- Documented as **per-query helper** (NOT singleton-safe per Evans-canonical
  contract — intentionally stateful)

Verification: ddd-patterns-expert agent — APPROVE_WITH_FIXES, all 3 applied
(IBatchRepository extends IExtendedRepository for consistent hierarchy, JSDoc
note on findByIds id-type contract, lifecycle warning on MemoizedSpecification).

## Remaining scope (post-2026-05-09)

- `CachedRepository<T>` wrapper (compose pattern, in-memory TTL cache) —
  optional helper for adapter authors
- Specification AST → indexable hints (advanced; may overlap with VP-003 /
  VP-004 if those reframe around adapters)
- `findManyByIds` benchmarks (no library benchmark target makes sense without a
  reference adapter; see VP-NEW-001 baseline approach)
