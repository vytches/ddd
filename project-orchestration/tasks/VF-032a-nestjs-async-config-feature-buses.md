# Task: NestJS async config + route forFeature through CQRSConfiguration

## Task Metadata

```yaml
task_id: VF-032a
title:
  'nestjs/cqrs: add VytchesDDDModule.forRootAsync, route forFeature() through
  CQRSConfiguration (middlewares + Enhanced buses per context), resolve the
  ghost types/index.ts either way'
type: refactor
priority: normal
complexity: medium
estimated_time: 6h
created_by: VF-032 split (2026-08-20)
created_at: 2026-08-20
status: backlog
parent_task: VF-032
release_target:
  API-shape decisions preferred pre-first-publish — forFeature() options are an
  additive change, forRootAsync is additive, the ghost-file decision is a
  removal and therefore hard-gated on the pre-publish window
package: "'@vytches/ddd-nestjs', '@vytches/ddd-cqrs'"
findings: [UX-T5, UX-T2.2, VF-031 AC3]
```

> **Split from VF-032 (2026-08-20).** VF-032's 14h scope mixed two decisions
> about the module's public shape (this task) with convergence/hygiene work that
> can only be documented once those decisions land (VF-032b). This half carries
> the runtime payoff: today a consumer who adopts `forFeature()` silently loses
> resilience and metrics, and has no supported way to get them back.

## Why

Verified against the working tree on 2026-08-20 (branch
`fix/VB-006-policy-cache-v2`) — all three findings still reproduce:

1. **`forFeature()` bypasses `CQRSConfiguration`.**
   `packages/nestjs/src/feature/vytches-ddd-feature.module.ts:64-73` constructs
   the per-context buses by hand:

   ```typescript
   provide: ICommandBus,
   useFactory: (moduleRef: ModuleRef) =>
     new CommandBus(new NestJSContainerAdapter(moduleRef)),
   inject: [ModuleRef],
   ```

   There is no supported way to pass middleware into a per-context bus, and a
   context never receives `EnhancedCommandBus`/`EnhancedQueryBus` — so
   per-context resilience and metrics require undocumented provider overrides.
   This defeats the point of `forFeature()`: the isolation win from VB-003 comes
   at the cost of every cross-cutting concern the enhanced buses provide.

2. **No `forRootAsync` on `VytchesDDDModule`.** Every module in the Nest
   ecosystem supports async config via `ConfigService`. This library is also
   internally inconsistent: `OutboxProcessorModule.forRootAsync()` exists
   (`packages/nestjs/src/outbox/outbox-processor.module.ts:71`) while the main
   module offers only sync variants.

3. **The ghost `types/index.ts` is the abandoned design for exactly this.**
   `packages/nestjs/src/types/index.ts` is 251 lines and 11 exported interfaces
   — including `VytchesDDDAsyncOptions` and `VytchesDDDOptionsFactory`, a
   ready-made `forRootAsync` contract. Nothing imports it: `index.ts:29` and
   `vytches-ddd.module.ts:9` both import from `'./types'`, which resolves to the
   sibling `types.ts`, not to `types/index.ts`. VF-031 AC3 deliberately deferred
   the removal here because it is circularly gated on this task's AC1 — the
   shape decision has to come first.

## Acceptance Criteria

1. [ ] `VytchesDDDModule.forRootAsync()` supporting `useFactory`, `useClass` and
       `useExisting`, consistent with `OutboxProcessorModule.forRootAsync()`'s
       existing shape. Backward compatible: the sync `forRoot()` keeps its
       signature and behaviour.
2. [ ] `forFeature()` routed through `CQRSConfiguration`. `middlewares` and bus
       type (`basic` / `enhanced`) exposed as `forFeature()` options;
       per-context resilience and metrics no longer require undocumented
       provider overrides. Non-breaking: `forFeature('orders')` with no options
       keeps today's behaviour (see AC6).
3. [ ] The ghost `packages/nestjs/src/types/index.ts` no longer survives unwired
       — **either** its `VytchesDDDAsyncOptions` / `VytchesDDDOptionsFactory`
       become the real `forRootAsync` contract (and the remaining 9 unused
       interfaces are dropped), **or** the whole file is deleted and a minimal
       options type is written next to `types.ts`. Closes VF-031 AC3 either way;
       a file left importable-but-unimported is not an acceptable outcome.
4. [ ] Whichever route AC3 takes, exactly one `types` module remains resolvable
       under `packages/nestjs/src/` — no `types.ts` / `types/index.ts` pair that
       silently shadows.
5. [ ] Contract tests: `forRootAsync` wiring (all three factory forms), and a
       `forFeature({ busType: 'enhanced', middlewares: [...] })` test asserting
       the per-context bus actually is the enhanced one and the middleware runs.
6. [ ] Regression: the `forFeature` isolation e2e suite from VB-003 stays green
       (it is the baseline proving F-C4 cross-context event leak stays fixed).
7. [ ] `nx run @vytches/ddd-nestjs:type-check` clean. Vitest alone is **not**
       sufficient for this package — esbuild misses excess-property regressions
       on the new options types.

## Out of scope

- `forContext` / `forContexts` convergence and the single documented module
  pattern — **VF-032b AC1** (needs this task's final shape to document).
- Handler-discovery consolidation, typed error hierarchy, golden-path docs, the
  runnable end-to-end example — **VF-032b**.
- `NestJSContainerAdapter` hot-path/lifetime work — VP-006b (done) + VF-030
  (done); the shared base-class half is VP-006c.
- Outbox module API changes.

## References

- Parent: [VF-032](./VF-032-nestjs-fluency.md) (`status: split`, historical
  record of the original 14h scope)
- Sibling: [VF-032b](./VF-032b-nestjs-convergence-errors-example.md)
- Analysis: `project-orchestration/analysis/LIB-UX-AUDIT-2026-07-10.analysis.md`
  (theme T5; T2.2)
- `completed-tasks/VF-031-prepublish-surface-diet.md` — AC3 deferral rationale
- `completed-tasks/VB-003-nestjs-forfeature-di-wiring.md` — regression baseline
  for AC6
