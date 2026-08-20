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
status: done
completed_at: 2026-08-20
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

## Decisions

Three-agent advisory panel, 2026-08-20 (`library-api-guardian`,
`library-quality-verifier`, `developer-experience`), run before any code was
written. All three independently rejected reviving the ghost file; each found a
different defect, which is why the verdict is treated as settled rather than as
one opinion.

**D1 — AC1's outbox claim was false; corrected in place.** All three agents
flagged it. `OutboxProcessorModuleAsyncOptions` is not an async-config triad.
Precedent for the triad shape comes from Nest itself, not from this repo. See
the note under AC1.

**D2 — `forRootAsync`'s factory returns `VytchesDDDModuleOptions`, never a new
options bag.** The ghost's `VytchesDDDAsyncOptions.useFactory` returns the
ghost's own `VytchesDDDOptions` (`autoDiscovery`/`cqrs`/`events`/`messaging`/
`container`), which shares no fields with the live `VytchesDDDModuleOptions`
(`providers`/`imports`/`exports`/`context`/`contexts`/`isGlobal`) that
`forRoot()`, `forFeature()`, `forContexts()` and `forTesting()` actually accept
(`vytches-ddd.module.ts:71,127,162,246`). Reviving it verbatim would ship a
`forRootAsync()` whose result `forRoot()` cannot consume — breaking AC1 on day
one. This is the concrete blocker named by the quality verifier, and AC5b exists
to make it unrepeatable.

**D3 — `types/index.ts` is deleted whole; nothing is salvaged but the envelope
shape.** Only `inject?` / `useFactory?` / `useClass?` / `useExisting?` +
`Pick<ModuleMetadata, 'imports'>` carries over, and it is rewritten against the
live options type rather than moved. The other 9 interfaces are dropped, not
made internal. Two reasons beyond mere disuse:

- **Name collision.** The ghost declares its own `CQRSOptions`, colliding with
  the real one in `packages/cqrs/src/configuration/cqrs-options.interface.ts`
  that `CQRSConfiguration` already consumes in production — the very type AC2
  needs. The ghost models middleware as `{ class: Type<unknown>, options? }` (a
  Nest class to instantiate) instead of `ICQRSMiddleware` instances. Two
  same-named types in one package would force consumers to alias imports.
- **Contradicts settled library direction.** The ghost carries
  `messaging.sagas?: boolean`,
  `events.eventStore: 'memory'|'postgresql'| 'mongodb'` and
  `messaging.provider: 'redis'|'rabbitmq'|'kafka'` — aspirational API that
  violates two standing decisions (no saga/process-manager surface; no adapters,
  the library stays dependency-free and adapter recipes are docs-only). VF-031
  was removing exactly this class of thing from other packages. Salvaging part
  of the file invites someone to later salvage the rest.

**D4 — the shadowing is a defect in its own right and dies in this PR.** A
`types.ts` sitting next to a `types/` directory means `'./types'` silently
resolves to the file; that is what kept the ghost invisible for months. Fixing
it is unconditional, independent of the options-shape work.

**D5 — naming: `VytchesDDDModuleAsyncOptions`.** The panel split here — DX
proposed `VytchesDDDModuleAsyncOptions`, api-guardian
`VytchesDDDAsyncModuleOptions`, both citing "convention". Settled on a fact
rather than a preference: the only existing precedent in this repo is
`OutboxProcessorModuleAsyncOptions` (`outbox-processor.module.ts:39`, barrel-
exported at `index.ts:33`), i.e. `Xxx**Module**AsyncOptions`. Nest agrees
(`TypeOrmModuleAsyncOptions`, `JwtModuleAsyncOptions`). Target shape, both in
`types.ts`:

```typescript
export interface VytchesDDDModuleAsyncOptions
  extends Pick<ModuleMetadata, 'imports'> {
  inject?: unknown[];
  useFactory?: (
    ...args: unknown[]
  ) => Promise<VytchesDDDModuleOptions> | VytchesDDDModuleOptions;
  useClass?: Type<VytchesDDDOptionsFactory>;
  useExisting?: Type<VytchesDDDOptionsFactory>;
}

export interface VytchesDDDOptionsFactory {
  createVytchesDDDOptions():
    | Promise<VytchesDDDModuleOptions>
    | VytchesDDDModuleOptions;
}
```

Exactly these two names join the barrel; nothing else from the ghost does.

**D6 — `forFeature()` options reuse the real CQRS contract (AC2).** The options
type must import from `@vytches/ddd-cqrs` (`CQRSOptions` /`ICQRSMiddleware`)
rather than mint a parallel middleware model. Whether the public knob is spelled
`busType: 'basic'|'enhanced'` (this task's vocabulary) mapped internally onto
`commandBusType`/`queryBusType`, or the CQRS field names are exposed directly,
is left to the implementer — but the middleware type is not negotiable.

**D7 — what an async factory can and cannot supply (found during implementation,
not by the panel).** NestJS resolves a `DynamicModule`'s `providers`, `imports`,
`exports` and `global` flag _before_ the DI container exists, so a factory that
itself depends on DI cannot produce them. D2 still holds — the factory returns
`VytchesDDDModuleOptions`, one vocabulary — but only the runtime-read fields of
that object take effect asynchronously (`autoDiscovery`, `context`).
`providers`/`imports`/`isGlobal` are declared statically on
`VytchesDDDModuleAsyncOptions` instead. This is documented on the type rather
than left for a consumer to discover: returning `providers` from the factory is
not an error, it is simply ignored, and silently ignoring a field is exactly the
kind of thing that produced the ghost in the first place.

**D8 — `autoDiscovery.enabled` was an inert switch; it now works.** Verified
while wiring D7: `forRoot()` read only `providers`, `imports` and `isGlobal`
from its options — `autoDiscovery.enabled` was declared, JSDoc'd
`@default true`, and consumed by nothing. A `forRootAsync()` whose factory
result nothing reads would have been a second ghost, so the options are now
published under the already-existing-but-unused `VYTCHES_DDD_OPTIONS` token
(both entry points), and `VytchesExplorerService` skips the reflection scan when
`enabled === false`.

Same defect class as VB-006's `cacheFailures`/`enableMetrics`: a documented
public switch that silently did nothing. **Behavioural change**: a consumer who
passed `autoDiscovery: { enabled: false }` previously got handler discovery
anyway; now they get what the docs always promised. Safe in the pre-publish
window, and the alternative — leaving the flag inert — was not acceptable once
the token had to exist regardless.

## Acceptance Criteria

1. [x] `VytchesDDDModule.forRootAsync()` supporting `useFactory`, `useClass` and
       `useExisting` — the standard Nest async-config triad
       (`TypeOrmModule.forRootAsync` / `JwtModule.forRootAsync` shape).
       `useFactory` must return `VytchesDDDModuleOptions` — the same type
       `forRoot()` already accepts (see D2). Backward compatible: the sync
       `forRoot()` keeps its signature and behaviour.
   > **Corrected 2026-08-20 (D1).** This AC previously read "consistent with
   > `OutboxProcessorModule.forRootAsync()`'s existing shape" — that claim is
   > false and all three review agents flagged it independently.
   > `OutboxProcessorModuleAsyncOptions`
   > (`outbox/outbox-processor.module.ts:39`) is a flat
   > `{ imports?, processors[], isGlobal? }`, and the `useFactory` at `:84` is a
   > per-processor provider factory, not a module async-config triad.
   > Consistency with outbox applies to **JSDoc style** (rich `@example` showing
   > full `DynamicModule` usage), not to the options shape.
2. [x] `forFeature()` routed through `CQRSConfiguration`. `middlewares` and bus
       type (`basic` / `enhanced`) exposed as `forFeature()` options;
       per-context resilience and metrics no longer require undocumented
       provider overrides. Non-breaking: `forFeature('orders')` with no options
       keeps today's behaviour (see AC6).
3. [x] `packages/nestjs/src/types/index.ts` **deleted in full** — all 11
       interfaces, nothing relocated to an `internal` module (D2/D3). Closes the
       VF-031 AC3 deferral. `types/extended.ts` stays untouched: it has a real,
       explicit import path (`'../types/extended'`) and is not part of this
       defect.
4. [x] Exactly one `types` module resolvable under `packages/nestjs/src/` — the
       flat `types.ts`, holding both the sync and the new async options types.
       The `types.ts` / `types/index.ts` shadowing pair is gone (D4).
5. [x] Contract tests: `forRootAsync` wiring (all three factory forms resolving
       into a working `DynamicModule`, not merely typechecking), and a
       `forFeature({ busType: 'enhanced', middlewares: [...] })` test asserting
       the per-context bus actually is the enhanced one and the middleware runs.
       5b. [ ] **Type test** (`expect-type`, under tsc — Vitest/esbuild cannot
       catch this): assert
       `VytchesDDDOptionsFactory['createVytchesDDDOptions']`'s return type is
       assignable to the parameter type of `forRoot()`. This is the exact defect
       D2 rejects; a test must make it unrepeatable.
6. [x] Regression: the `forFeature` isolation e2e suite from VB-003 stays green
       (it is the baseline proving F-C4 cross-context event leak stays fixed).
7. [x] `nx run @vytches/ddd-nestjs:type-check` clean, run with
       `--skip-nx-cache`. Vitest alone is **not** sufficient for this package —
       esbuild misses excess-property regressions on the new options types, and
       the review pass hit a stale-cache false pass on this exact target.

## Out of scope

- `forContext` / `forContexts` convergence and the single documented module
  pattern — **VF-032b AC1** (needs this task's final shape to document).
- Handler-discovery consolidation, typed error hierarchy, golden-path docs, the
  runnable end-to-end example — **VF-032b**.
- `NestJSContainerAdapter` hot-path/lifetime work — VP-006b (done) + VF-030
  (done); the shared base-class half is VP-006c.
- Outbox module API changes.
- Bringing `@vytches/ddd-nestjs` under `api-extractor`. Found during the
  2026-08-20 panel: `validate:api` covers only `contracts`, `events`,
  `enterprise` and `value-objects` — `packages/nestjs/` has no
  `api-extractor.json` and appears in neither validation chain, so this
  package's public surface (including everything this task adds) has **no**
  automated drift gate. Recorded here as a fact; needs its own task.

## References

- Parent: [VF-032](./VF-032-nestjs-fluency.md) (`status: split`, historical
  record of the original 14h scope)
- Sibling: [VF-032b](./VF-032b-nestjs-convergence-errors-example.md)
- Analysis: `project-orchestration/analysis/LIB-UX-AUDIT-2026-07-10.analysis.md`
  (theme T5; T2.2)
- `completed-tasks/VF-031-prepublish-surface-diet.md` — AC3 deferral rationale
- `completed-tasks/VB-003-nestjs-forfeature-di-wiring.md` — regression baseline
  for AC6

## Outcome (2026-08-20)

All eight criteria met. Gates, each run with `--skip-nx-cache`:

| Gate                                   | Result                             |
| -------------------------------------- | ---------------------------------- |
| `@vytches/ddd-nestjs:test`             | 271/271 (was 257 — 14 new)         |
| `@vytches/ddd-nestjs:type-check` (tsc) | clean                              |
| `@vytches/ddd-nestjs:lint`             | 0 errors (9 pre-existing warnings) |
| `@vytches/ddd-nestjs:build`            | clean                              |
| `@vytches/ddd-enterprise:build`        | clean (re-exports the package)     |
| `@vytches/ddd-cqrs` tests              | 300/300                            |

Notes for whoever picks up VF-032b:

- **The type test earned its place immediately.** `async-config.types.test.ts`
  passed under Vitest while `tsc` rejected it — the exact esbuild blind spot AC7
  warns about. Do not treat a green Vitest run as evidence for this package.
- **One test needed extending, not fixing**:
  `tests/feature/global-bus-acl.test.ts` mocks `@vytches/ddd-cqrs` wholesale, so
  routing `forFeature()` through `CQRSConfiguration` made the mock incomplete.
  The mock now models the configuration class. Any further CQRS dependency added
  to the feature module will hit the same wall.
- **Raw `new Error` sites are now 5, not 4** — `forRootAsync()` validates that
  one factory form is present. VF-032b AC3 should expect five.
