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
status: blocked
blocked_by: VF-032a
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

1. [ ] One recommended module pattern documented, matching the shape VF-032a
       settled on. `forContext`/`forContexts` either merged into `forFeature()`
       or JSDoc-`@deprecated` with a migration note naming the replacement call.
2. [ ] Handler discovery consolidated: the nestjs explorer/registrar delegate
       the decorator-metadata scan to `CQRSDiscoveryPlugin` (NestJS-specific
       provider traversal stays separate), **or** a recorded rationale in the
       task file for why the two scanners must stay independent.
3. [ ] A typed nestjs error hierarchy extending `BaseError` replaces the 4 raw
       `new Error` sites listed above. Class naming coordinated with VF-024 AC2
       (`ServiceNotFoundError` collision) and VF-030 AC4 — both now in
       `completed-tasks/`, so check the names they actually shipped rather than
       the names those tasks proposed.
4. [ ] Golden-path docs updated to the final recommended pattern
       (`README_SIMPLE_INTEGRATION.md` and the package LLMGUIDE).
   > Note (2026-07-12): the nonexistent `forRoot({ autoRegister })` reference
   > was already removed under VD-005 AC10d. This AC is documentation of the
   > post-VF-032a shape only.
5. [ ] One runnable end-to-end example under `examples/`: aggregate → command
       handler → repository (with an in-memory persistence handler) →
       per-context event bus → event handler, wired via `forFeature()`. Must
       compile under the docs-compile-gate introduced by VD-005.
6. [ ] Regression: the VB-003 `forFeature` isolation e2e suite stays green;
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
