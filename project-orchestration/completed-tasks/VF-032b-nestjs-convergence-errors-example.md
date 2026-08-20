# Task: NestJS module convergence, discovery dedup, typed errors, end-to-end example

## Task Metadata

```yaml
task_id: VF-032b
title:
  'nestjs: converge forRoot/forContext/forContexts/forFeature to one documented
  pattern, consolidate duplicated handler discovery, typed error hierarchy,
  runnable aggregate→repository→bus→handler example'
type: refactor
priority: normal
complexity: complex
estimated_time: 8h
created_by: VF-032 split (2026-08-20)
created_at: 2026-08-20
status: done
completed_at: 2026-08-20
parent_task: VF-032
release_target:
  deprecation markers preferred pre-first-publish; the rest may land
  incrementally after
package: "'@vytches/ddd-nestjs'"
findings: [UX-T5, UX-T2.4]
```

> **Split from VF-032 (2026-08-20).** Blocked on VF-032a, not by tooling but by
> sequencing: AC1 and AC4 below document "the one recommended pattern", and that
> pattern is not decided until `forRootAsync` and the `forFeature()` options
> shape land in VF-032a. Writing the docs first guarantees rewriting them.

## Why

1. **Four overlapping module factories** — `forRoot` / `forContext` /
   `forContexts` / `forFeature` — with no guidance on which is current.
   `forContext`/`forContexts` read as an earlier iteration nobody removed.
2. **Duplicated handler discovery (UX-T2.4).** `CQRSDiscoveryPlugin` (cqrs) and
   `VytchesExplorerService`/`FeatureHandlerRegistrar` (nestjs) independently
   reimplement the same `di:handler-type` reflection scan. A change to the
   metadata shape has to be applied twice, and only luck keeps them in step.
3. **Untyped errors in nestjs.** Verified 2026-08-20 — **4** raw
   `new Error(...)` sites remain (the task's original count of 6 is stale; the
   two in `nestjs-container.adapter.ts` were replaced under VF-030):

   - `vytches-ddd.module.ts:130` — empty context name
   - `feature/vytches-ddd-feature.module.ts:48` — empty `forFeature` context
     name
   - `services/bus-registration-ledger.ts:85`
   - `services/vytches-explorer.service.ts:528` — non-Error rethrow wrapper

   Against cqrs's `BaseError` hierarchy, a consumer catching by type misses
   every adapter-level failure.

4. **Concept count.** 4 module factories, ~6 DI tokens, 3 decorator source
   packages, and mixed `@Inject()` ergonomics — abstract-class tokens work bare,
   Symbol tokens do not, and that is explained nowhere.
5. **No aggregates/repositories wiring or end-to-end example.** Zero references
   to `AggregateRoot`/`IBaseRepository` anywhere in `packages/nestjs`, and no
   runnable example of the core flow (aggregate → `repository.save()` → bus →
   handler) under `examples/`.

## Acceptance Criteria

1. [x] One recommended module pattern documented, matching the shape VF-032a
       settled on. `forContext`/`forContexts` either merged into `forFeature()`
       or JSDoc-`@deprecated` with a migration note naming the replacement call.
2. [x] Handler discovery consolidated: the nestjs explorer/registrar delegate
       the decorator-metadata scan to `CQRSDiscoveryPlugin` (NestJS-specific
       provider traversal stays separate), **or** a recorded rationale in the
       task file for why the two scanners must stay independent.
3. [x] A typed nestjs error hierarchy extending `BaseError` replaces the 4 raw
       `new Error` sites listed above. Class naming coordinated with VF-024 AC2
       (`ServiceNotFoundError` collision) and VF-030 AC4 — both now in
       `completed-tasks/`, so check the names they actually shipped rather than
       the names those tasks proposed.
4. [x] Golden-path docs updated to the final recommended pattern
       (`README_SIMPLE_INTEGRATION.md` and the package LLMGUIDE).
   > Note (2026-07-12): the nonexistent `forRoot({ autoRegister })` reference
   > was already removed under VD-005 AC10d. This AC is documentation of the
   > post-VF-032a shape only.
5. [x] One runnable end-to-end example under `examples/`: aggregate → command
       handler → repository (with an in-memory persistence handler) →
       per-context event bus → event handler, wired via `forFeature()`. Must
       compile under the docs-compile-gate introduced by VD-005.
6. [x] Regression: the VB-003 `forFeature` isolation e2e suite stays green;
       `nx run @vytches/ddd-nestjs:type-check` clean (Vitest alone is not
       sufficient for this package).

## Out of scope

- `forRootAsync`, the `forFeature()` options shape, and the ghost
  `types/index.ts` decision — **VF-032a**.
- `NestJSContainerAdapter` hot-path/lifetime fixes — VP-006b + VF-030 (done);
  base-class half is VP-006c.
- `FeatureHandlerRegistrar.findOwnModule()`'s reliance on non-public NestJS
  internals — acknowledged risk; add a canary test if trivial, otherwise leave
  documented. No redesign here.
- Outbox module API changes.

## References

- Parent: [VF-032](./VF-032-nestjs-fluency.md) (`status: split`)
- Sibling / blocker: [VF-032a](./VF-032a-nestjs-async-config-feature-buses.md)
- Analysis: `project-orchestration/analysis/LIB-UX-AUDIT-2026-07-10.analysis.md`
  (theme T5; T2.4)
- `completed-tasks/VF-024-prepublish-api-surface.md`,
  `completed-tasks/VF-030-di-token-identity.md` — error-naming coordination
- `completed-tasks/VB-003-nestjs-forfeature-di-wiring.md` — regression baseline

## Outcome (2026-08-20)

All six criteria met.

**AC2 — split verdict, not a full merge.** The shared part (`di:*` metadata
read) is extracted to `src/services/handler-metadata.ts` and used by both
`VytchesExplorerService` and `FeatureHandlerRegistrar`, so those two can no
longer drift. `CQRSDiscoveryPlugin` deliberately stays independent, and the
rationale is recorded in that file's header: it walks
`Object.entries(moduleNamespace)` over an ES-module's exports and requires
`di:registration-pending`, while both NestJS scanners walk NestJS's own DI graph
where that flag never applies. Merging the traversals would mean teaching a
framework-agnostic core package about NestJS internals.

**AC3 — the hierarchy does not extend `BaseError`, and could not.** Nx boundary
rules forbid a `scope:nestjs` project from depending on
`scope:domain-primitives` (`nx lint` fails on the import; the allowlist is di,
utils, events, resilience, cqrs, acl, policies, messaging, validation,
contracts, testing). Widening that allowlist is an architectural decision well
outside this task. `VytchesNestJSError extends Error` reproduces `BaseError`'s
behaviour verbatim (name from constructor, stack capture outside production), so
if the boundary is ever widened the base class can change without touching a
single subclass. All five raw `new Error` sites replaced:
`InvalidContextNameError` (×2), `ModuleConfigurationError`,
`ConflictingHandlerRegistrationError`; the fifth site
(`vytches-explorer.service.ts`) is a non-Error rethrow wrapper and correctly
stays as it is.

**AC1** — `forContext`/`forContexts` carry `@deprecated` with migration
snippets. Both leave the buses shared, so they never isolated anything;
`forContexts()` additionally falls back to `forRoot()` on a missing/non-object
`contexts` option, meaning a typo yields zero contexts and no error. Documented.

Gates (`--skip-nx-cache`): nestjs 271/271, tsc clean, lint 0 errors, build
clean; `examples/nestjs` 4/4 and its own `tsc --noEmit` clean; full repo suite
2656 passed / 7 skipped / 11 todo.

**tsc caught three defects Vitest passed** — the same blind spot AC6 warns
about, three times in one task: a variance error in the shared reader's return
type, and in the new example both an `apply()` visibility violation (the example
would have taught consumers to break aggregate encapsulation) and, earlier, a
placeholder `StockReceived` event with quantity 0 that the runtime test did
catch. Treat a green Vitest run on this package as no evidence at all.

**Follow-up worth filing** (not done here, out of scope): `packages/nestjs` is
still absent from `api-extractor` coverage, so every symbol this task added to
the barrel — four error classes, `VytchesDDDFeatureOptions`,
`VytchesDDDModuleAsyncOptions`, `VytchesDDDOptionsFactory` — has no automated
drift gate.
