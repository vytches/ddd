# Task: NestJS Container Adapter Performance

## Task Metadata

```yaml
task_id: VP-006b
title: NestJSContainerAdapter resolve/cold-start optimization
type: optimization
priority: normal
complexity: complex
estimated_time: 12h
created_by: VP-006 analysis carve-out (2026-06-30)
created_at: 2026-06-30
status: backlog
release_target: post-v0.26
parent: VP-006-di-container-performance
package: '@vytches/nestjs'
```

## Why this is separate from VP-006

VP-006 analysis
(`project-orchestration/analysis/VP-006-di-container-performance.analysis.md`,
OQ-2 / D-6) established that the reported consumer metrics (cold start 2.5–4s,
first-time resolve 15–25ms, 8–12MB metadata, measured on `juz-ide-api` / NestJS)
are **not** attributable to the framework-agnostic `@vytches/ddd-di` core —
`SimpleContainer` does plain `Map.get` + zero-arg `new ctor()` with no
reflection on the hot path. The real cost lives in `NestJSContainerAdapter`
(`packages/nestjs/src/adapters/nestjs-container.adapter.ts`).

Keeping this in VP-006 would cross package boundaries
(`package-boundary-pattern`) and conflate two backward-compat surfaces. Hence a
sibling task in `@vytches/nestjs`.

## Confirmed hot-path issues (from VP-006 code map)

`packages/nestjs/src/adapters/nestjs-container.adapter.ts`:

1. **`resolve()` always calls `moduleRef.get(token, { strict: false })` FIRST**
   on every resolution, before checking the adapter's own registry. On a miss,
   NestJS `ModuleRef.get` **throws**, and the throw is swallowed by try/catch —
   throw+catch on the hot path for every internally-registered service.
2. **`createInstance()` does reflection on the hot path**:
   `Reflect.getMetadata('design:paramtypes', constructor)` + **recursive
   `this.resolve()` per constructor param** — the real dependency-graph
   traversal; cost compounds with graph depth (N reflection lookups + N
   swallowed throws on first-time resolve).
3. **Silent fallback** `new paramType()` inside the catch can construct
   unintended instances.
4. **`createScope()` copies the full singleton descriptor set into every scope**
   — per-request scoping multiplies live Map entries + string keys (memory).

## Acceptance Criteria

> AC1 and AC2 reworded per the approved analysis
> (`project-orchestration/analysis/VP-006b-nestjs-adapter-performance.analysis.md`,
> section "AC rewording", OQ-1/OQ-5 approved 2026-07-11).

1. [ ] `resolve()` checks the adapter's own registry first and falls back to
       `moduleRef.get` on an internal miss; no exception-driven control flow for
       internally-registered tokens. Precedence for dual-registered tokens
       becomes internal-wins (ADR-0014 alignment) — covered by a new explicit
       precedence test and a CHANGELOG note.
2. [ ] Cache `design:paramtypes` lazily, once per constructor, on first
       `createInstance()` (module-level
       `WeakMap<Constructor, readonly    Constructor[]>`, empty-array results
       cached too). After first materialization of a constructor, no further
       `Reflect.getMetadata` calls occur for it;
       `registerFactory`/`registerInstance` paths are unaffected.
3. [x] Remove/serialize the silent `new paramType()` fallback (explicit, logged,
       or removed) — no accidental instance construction. **Satisfied by VF-030
       (ADR-0038, merged 2026-07-11)**: `createInstance()` resolves constructor
       dependencies through the inherited throwing `resolveDependency()`
       (`ContainerServiceNotFoundError` naming the owning service,
       `CircularDependencyError` with the full chain). Verify-only in VP-006b —
       done (existing ghost-instance + `CircularDependencyError` tests pin it).
4. [ ] `createScope()` no longer duplicates the full singleton descriptor set
       per scope (share by reference / lazy view).
5. [ ] Consumer-side regression measurement (in `juz-ide-api` or a
       representative NestJS fixture): first-time resolve and cold start tracked
       and documented.
6. [ ] Backward-compat: adapter public behavior preserved (resolution results,
       error types, scope semantics). Assess `@vytches/nestjs` surface
       separately from the `@vytches/ddd-di` snapshot.

## OQ-4 audit result

Divergent dual registration of handler classes exists on the GLOBAL
`SimpleContainer` path (`discoverAndRegisterHandlers` registers Transient class
tokens while NestJS holds fully-injected singletons), but resolution never
traverses `NestJSContainerAdapter` — off-surface for VP-006b. Escalation
resolved per analysis OQ-1/OQ-4 POST-AUDIT RESOLUTION: proceed with Option A +
dev-only divergence guard + MINOR classification.

## AC4 measurement outcome

AC4 measurement (read-only) on `perf/VP-006b-nestjs-adapter` via the delivered
bench: `NODE_OPTIONS='--expose-gc' pnpm --filter @vytches/ddd-nestjs bench`
(`vitest.bench.config.ts`, `benchmarks/memory.bench.ts`; GC-hinted heap deltas,
singletons pre-materialized, all 1000 scopes kept live). Two full runs, results
stable to 0.01 KB.

Raw numbers, `createScope()`×1000, median across samples:

- N=100: retained 7.62 KB/scope, mean 0.0040 ms/scope
- N=500: retained 28.62 KB/scope, mean 0.0180 ms/scope
- N=1000: retained 56.62 KB/scope, mean 0.0507 ms/scope

Verdict: retained heap at N=1000 (56.62 KB/scope) exceeds the 50 KB materiality
threshold (`benchmarks/baseline.json`, `slos.scope`), so the win is MATERIAL —
copy-on-write implemented per OQ-2 variant (a), preserving the VF-030 D5
snapshot semantics (post-COW re-run: `createScope()` mean ≈ 0.0076 ms/scope at
N=1000, `benchmarks/results.json`).

## Out of scope

- Anything inside `@vytches/ddd-di` core (handled by VP-006: `tryResolve`,
  `getTokenKey` memoization + anonymous-class fix, `Set` cycle detection,
  double-retention removal, dev-only bench).

## Dependencies / sequencing

- Best done AFTER VP-006 internal changes land (shared `ServiceLocator` /
  `SimpleContainer` semantics stable), but independent package — can proceed in
  parallel once VP-006 `tryResolve`/error-contract decisions are final.

## References

- Analysis:
  `project-orchestration/analysis/VP-006-di-container-performance.analysis.md`
- Parent task: `project-orchestration/tasks/VP-006-di-container-performance.md`
