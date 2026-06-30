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

1. [ ] Check adapter's own registry BEFORE `moduleRef.get`; avoid throw+catch on
       the hot path (no exception-driven control flow per resolution).
2. [ ] Resolve `design:paramtypes` reflection ONCE at registration time and
       cache a ready-to-call factory; resolve hot path performs no
       `Reflect.getMetadata`.
3. [ ] Remove/serialize the silent `new paramType()` fallback (explicit, logged,
       or removed) — no accidental instance construction.
4. [ ] `createScope()` no longer duplicates the full singleton descriptor set
       per scope (share by reference / lazy view).
5. [ ] Consumer-side regression measurement (in `juz-ide-api` or a
       representative NestJS fixture): first-time resolve and cold start tracked
       and documented.
6. [ ] Backward-compat: adapter public behavior preserved (resolution results,
       error types, scope semantics). Assess `@vytches/nestjs` surface
       separately from the `@vytches/ddd-di` snapshot.

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
