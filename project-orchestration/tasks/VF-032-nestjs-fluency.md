# Task: NestJS integration fluency — forRootAsync, forFeature→CQRSConfiguration, one module story

## Task Metadata

```yaml
task_id: VF-032
title:
  'nestjs/cqrs: add forRootAsync, route forFeature through CQRSConfiguration
  (middleware + Enhanced buses per context), converge
  forRoot/forContext/forContexts/forFeature to one documented pattern,
  consolidate duplicated handler discovery, typed error hierarchy'
type: refactor
priority: normal
complexity: complex
estimated_time: 14h
created_by: LIB-UX-AUDIT-2026-07-10
created_at: 2026-07-10
status: split
split_into: [VF-032a, VF-032b]
updated_at: 2026-08-20
release_target:
  API-shape decisions (AC1-AC3) pre-first-publish preferred; implementation may
  land incrementally after
package: "'@vytches/ddd-nestjs', '@vytches/ddd-cqrs'"
findings: [UX-T5, UX-T2.2, UX-T2.4]
```

> **SPLIT 2026-08-20 — nie implementuj tego pliku.** The 14h scope mixed two
> decisions about the module's public shape with convergence/hygiene work that
> can only be written once those decisions land. Owner-approved split:
>
> - **`VF-032a-nestjs-async-config-feature-buses.md`** (~6h) — `forRootAsync`
>   (AC1), `forFeature()` through `CQRSConfiguration` (AC2), and the ghost
>   `types/index.ts` decision that VF-031 AC3 deferred here. This is the half
>   with the runtime payoff: today `forFeature()` silently costs the consumer
>   resilience and metrics.
> - **`VF-032b-nestjs-convergence-errors-example.md`** (~8h, blocked on VF-032a)
>   — factory convergence (AC3), handler-discovery dedup (AC4), typed errors
>   (AC5), golden-path docs (AC6), end-to-end example (AC7).
>
> The criteria below are kept verbatim as the historical record. **AC5's count
> is stale**: verified 2026-08-20, only **4** raw `new Error` sites remain — the
> two in `nestjs-container.adapter.ts` were replaced under VF-030. AC6's
> `autoRegister` half was already closed by VD-005 AC10d.

## Why

The NestJS golden path works and is correctness-hardened (VB-003 isolation with
real e2e coverage), but it is not "natural, fluent, efficient":

1. **No `forRootAsync`** on `VytchesDDDModule` — every Nest-ecosystem module
   supports async config (`ConfigService`); internally inconsistent too:
   `OutboxProcessorModule` offers **only** `forRootAsync`, the main module only
   sync variants. The never-wired ghost `types/index.ts` (VF-031 AC3) is the
   designed-but-abandoned API for exactly this.
2. **`forFeature()` bypasses `CQRSConfiguration`** — manually
   `new CommandBus(new NestJSContainerAdapter(moduleRef))`
   (`vytches-ddd-feature.module.ts:56-67`): no supported way to pass middleware
   into a per-context bus, and contexts never get
   `EnhancedCommandBus`/`EnhancedQueryBus` (resilience/metrics) without
   undocumented provider overrides — defeating the point of `forFeature()`.
3. **Four overlapping module factories** (`forRoot`/`forContext`/`forContexts`/
   `forFeature`) with no guidance which is current; `forContext`/`forContexts`
   read as an earlier iteration nobody removed.
4. **Duplicated handler discovery (UX-T2.4):** `CQRSDiscoveryPlugin` (cqrs) vs
   `VytchesExplorerService`/`FeatureHandlerRegistrar` (nestjs) independently
   reimplement the same `di:handler-type` reflection scan — a metadata-shape
   change must be applied twice by luck.
5. **Zero typed errors in nestjs** — 6 raw `new Error(...)` sites
   (`vytches-ddd.module.ts:110`, `vytches-ddd-feature.module.ts:41`,
   `vytches-explorer.service.ts:488`, `bus-registration-ledger.ts:85`,
   `nestjs-container.adapter.ts:72,89`) vs cqrs's `BaseError` hierarchy —
   consumers catching by type miss every adapter-level failure.
6. **Concept count**: 4 module factories, ~6 DI tokens, 3 decorator source
   packages, mixed `@Inject()` ergonomics (abstract-class tokens work bare,
   Symbol tokens don't — explained nowhere).
7. **No aggregates/repositories wiring or end-to-end example** — zero references
   to `AggregateRoot`/`IBaseRepository` in packages/nestjs; no runnable example
   of the core flow (aggregate → repository.save() → bus → handler) anywhere in
   `examples/`.

## Acceptance Criteria

1. [ ] `VytchesDDDModule.forRootAsync()` (useFactory/useClass/useExisting) —
       either wiring the ghost `types/index.ts` API or a new minimal options
       type; decision synchronized with VF-031 AC3 (the ghost file must not
       survive unwired).
2. [ ] `forFeature()` routed through `CQRSConfiguration`: `middlewares` and bus
       type (`basic`/`enhanced`) exposed as `forFeature()` options; per-context
       resilience no longer requires undocumented provider overrides.
3. [ ] One recommended module pattern documented; `forContext`/`forContexts`
       either merged into `forFeature()` or JSDoc-`@deprecated` with a migration
       note.
4. [ ] Handler discovery consolidated: nestjs explorer/registrar delegate the
       decorator-metadata scan to `CQRSDiscoveryPlugin` (keeping NestJS-specific
       provider traversal separate), OR a recorded rationale why the two
       scanners must stay independent.
5. [ ] Typed nestjs error hierarchy extending `BaseError` replaces the 6 raw
       `new Error` sites — coordinate class naming with VF-024 AC2
       (`ServiceNotFoundError` collision) and VF-030 AC4.
6. [ ] Golden-path docs updated to the final recommended pattern; nonexistent
       `forRoot({ autoRegister })` removed from `README_SIMPLE_INTEGRATION.md`
       (doc-drift umbrella: VD-005 AC10).
   > Note (2026-07-12): the `autoRegister` reference itself was already removed
   > under VD-005 AC10d. This AC's remaining scope is only the
   > `forRootAsync`/`forFeature` design work above (items 1-3).
7. [ ] One runnable end-to-end example under `examples/`: aggregate → command
       handler → repository (with an in-memory persistence handler) →
       per-context event bus → event handler, wired via `forFeature()`.
8. [ ] Regression: `forFeature` isolation e2e suite (VB-003) stays green;
       `nx run @vytches/ddd-nestjs:type-check` clean (Vitest alone is not
       sufficient for this package).

## Out of scope

- `NestJSContainerAdapter` hot-path/lifetime fixes — VP-006b + VF-030.
- `FeatureHandlerRegistrar.findOwnModule()`'s reliance on non-public NestJS
  internals — acknowledged risk; add a canary test if trivial, otherwise leave
  documented (no redesign here).
- Outbox module API changes.

## References

- Analysis: `project-orchestration/analysis/LIB-UX-AUDIT-2026-07-10.analysis.md`
  (theme T5; T2.2, T2.4)
- VB-003 analysis + e2e suite — the regression baseline for AC8.
- VF-031 AC3 (ghost types file), VF-024 AC2 / VF-030 AC4 (error naming) —
  coordination points.
