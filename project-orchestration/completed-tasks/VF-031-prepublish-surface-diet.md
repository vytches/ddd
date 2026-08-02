# Task: Pre-publish API surface diet — delete zero-consumer speculative scaffolding

## Task Metadata

```yaml
task_id: VF-031
title:
  'all packages: delete or @internal-mark dead/aspirational surface (events
  audit+integration subsystems, ACLDiscoveryPlugin, ghost nestjs types/index.ts,
  DI discovery scaffolding, speculative aggregate interfaces, unused validation
  layer, PolicyEventBus status) before first publish'
type: refactor
priority: high
complexity: medium
estimated_time: 8h
created_by: LIB-UX-AUDIT-2026-07-10
created_at: 2026-07-10
status: done
completed_at: 2026-07-11
release_target:
  pre-first-public-publish (HARD window — every removal becomes a breaking
  change after publish; sibling of VF-024)
package:
  'events, acl, nestjs, di, domain-services, aggregates, validation, policies,
  resilience'
findings: [UX-T1, UX-C13, UX-C14]
```

## Why

The 2026-07-10 usability audit found the same systemic pattern in **every**
audited package: large public (or dist-compiled) surface with **zero consumers
anywhere in the monorepo or examples**, some of it broken or carrying phantom
dependencies. Verified per-item by repo-wide grep (see analysis for evidence):

- **events:** entire `audit/` subsystem, entire `integration/` pipeline
  (`IntegrationEventProcessor`, `DomainToIntegrationTransformer`,
  `ContextRouter`, transformer registry), `subscribeToContext`,
  `EventHandlerOptions.priority` (never read — no ordering effect),
  `GenericEventPersistenceHandler` (dead file, not even exported).
- **acl:** `ACLDiscoveryPlugin` + `@ACLAdapter`/`@ACLConfig`/`@ACLContext`
  decorators — referenced only by a commented-out line in `packages/di`, and
  `import 'reflect-metadata'` with **no declared dependency** (throws on import
  unless a framework polyfilled it).
- **nestjs:** ghost `src/types/index.ts` (250 lines incl. a designed-but-never-
  wired `forRootAsync` options-factory API, zero importers).
- **di / domain-services:** unexported `DiscoveryRegistry`/`Factory` whose
  plugin list is entirely commented out; write-only
  `DIDomainServiceMetadataRegistry` + dead `autoRegister` flag (the promised
  `DomainServiceDiscoveryPlugin` does not exist).
- **aggregates:** duplicate capability-interface block
  (`aggregate-interfaces.ts:141-238`) diverging from the canonical
  `contracts/capability-types.ts` the concrete classes actually implement (local
  `IEventSourcingCapability.replayEvents()` implemented nowhere); publicly
  exported `IAggregateBuilder` implemented by nothing (shape incompatible with
  the real `AggregateBuilder`); speculative unimplemented interfaces
  (`ICachingCapability`, `IMetricsCapability`, `ISecurityCapability`,
  `IAggregateFactory`, `IAggregateValidator`, …).
- **validation:** ~60% of exported symbols have zero consumers
  (`RulesRegistry`/`CoreRules`, `ValidationFacade`, `SpecificationValidator`,
  `BaseValidationAdapter`/`AdapterUtils`) — and the correctness bugs found in
  the package (VF-033) live exactly in that unused layer.
- **policies:** `PolicyEventBus` (~380 LOC) duplicates the `UnifiedEventBus`
  concept; the whole package has zero real consumers in the monorepo.
- **resilience:** `getResilienceMetrics()` returns config, not metrics — its own
  source comment admits it's a stub; the documented metrics workflow is
  aspirational.
- **UX-C13:** `VersioningCapability` upcasting activates only on
  `metadata.targetVersion`, which nothing in the library ever sets — the feature
  is non-functional as documented (`versioning-capability.ts:96-104`).
- **UX-C14:** `AuditCapability.attach()` monkey-patches `aggregate.apply` via
  instance-property reassignment — unique among capabilities, fragile under
  stacking (`audit-capability.ts:57-98`).

This is the cheapest moment the library will ever have to shed this weight.
External consumers exist — before deleting anything exported, confirm against
the primary downstream consumer's actual imports.

## Acceptance Criteria

1. [x] **events:** `audit/` + `integration/` subsystems, `subscribeToContext`,
       inert `priority` option, `GenericEventPersistenceHandler` — each deleted
       or `@internal`-marked, decision recorded per item (default: delete; they
       are `@public @stable` by JSDoc only, unpublished).
2. [x] **acl:** `ACLDiscoveryPlugin` + decorators deleted (default), or wired
       for real with `reflect-metadata` declared as optional peer dependency —
       no phantom import either way.
3. [ ] **nestjs:** ghost `src/types/index.ts` deleted **unless** VF-032 decides
       to wire `forRootAsync` against it — synchronize the decision with VF-032
       AC1 before touching the file. **DEFERRED to VF-032** (see D-6 and the
       "AC3 status" note below) — not implemented in this task, by design.
4. [x] **di/domain-services:** dead `DiscoveryRegistry` scaffolding and the
       write-only domain-service metadata registry either wired (mirroring how
       events/cqrs discovery plugins actually work) or removed; stop advertising
       auto-discovery for domain services until it exists.
5. [x] **aggregates:** duplicate capability-interface block deleted in favor of
       `@vytches/ddd-contracts` canonical types (same treatment REL-009 gave
       `IAggregateSnapshot`); `IAggregateBuilder` export dropped or the real
       builder made to implement it; speculative unimplemented interfaces
       removed.
6. [x] **validation:** documented decision on the zero-consumer 60% —
       keep-and-fix (then VF-033 executes) or deprecate/`@internal`. The "bring
       your own zod" adapter story (`useExternal`/`BaseValidationAdapter`) stays
       either way (it is the honest zero-deps answer).
7. [x] **policies:** `PolicyEventBus` public status decided (fold into VF-024's
       `globalPolicyEventBus` AC9 review); **resilience:**
       `getResilienceMetrics()` renamed/deprecated or wired to real per-instance
       state (pairs with VF-028 AC2's WeakMap).
8. [x] **UX-C13/C14:** fate of `VersioningCapability` (fix self-driving
       upcasting vs `@internal` + doc warning) and `AuditCapability`'s
       monkey-patch (replace with a structural `onEventApplied` hook vs document
       the constraint) decided in the same pass — both currently have zero
       non-test consumers, so deletion/demotion is also on the table.
9. [x] Phantom dependencies removed: `validation`'s unused
       `ddd-domain-primitives` runtime dep; acl's `reflect-metadata` situation
       per AC2.
10. [x] Export/api-surface snapshot tests updated; every removal listed in
        CHANGELOG; downstream-consumer import check performed before each
        deletion of an exported symbol.

**AC3 status:** explicitly deferred to VF-032, not skipped. See D-6 in the
analysis: VF-032 AC1 (`project-orchestration/tasks/VF-032-nestjs-fluency.md`,
status backlog) requires deciding the shape of `forRootAsync` first, and that
decision determines whether the ghost `nestjs/src/types/index.ts` is wired up or
deleted. Neither task can resolve this independently — it is a circular
dependency between the two tasks, not an oversight. The file is confirmed
orphaned (`nestjs/src/index.ts` imports from `./types`, not `./types/index.ts`)
so leaving it untouched does not block anything else in this task; `nestjs/` was
correctly left entirely untouched in this pass.

## Out of scope

- VF-024's own ACs (explicit barrel exports, name collisions, `internalLogger`,
  `EntityIdFactory`) — this is the sibling **deletion** pass, VF-024 is the
  **curation** pass; run them in the same pre-publish window.
- Behavioral bug fixes in surviving code — VF-029 (events), VF-030 (di), VF-033
  (validation).
- Registry duplicate/overwrite semantics — deferred `/analyze-ddd` decision
  (SA-H4/M10/L4).

## Activity / Notes

### 2026-07-11 — implemented on `refactor/VF-031-prepublish-surface-diet`, merged to develop (status: done)

9 of 10 ACs done as DELETE/keep-and-document per the analysis's per-item
decision table (D-1 through D-14 in
`project-orchestration/analysis/VF-031.analysis.md`). AC3 (nestjs ghost
`types/index.ts`) explicitly deferred to VF-032 per D-6 — a genuine circular
task dependency, not scope creep or an oversight; `packages/nestjs/` was left
completely untouched in this pass (confirmed via diff review before merge).

Two open questions from the analysis were resolved by explicit user decision
before implementation began:

- **OQ-1 (validation):** `RulesRegistry` (+ `ValidationFacade`,
  `SpecificationValidator`) and `BaseValidationAdapter`/`AdapterUtils` are
  **both** permanent, first-class paths — the built-in zero-dependency engine
  and the official "bring your own zod" extension point, respectively. Neither
  is legacy. LLMGUIDE/README updated to present both as equally supported.
- **OQ-2 (events/integration):** `IntegrationEventProcessor`,
  `DomainToIntegrationTransformer`, `ContextRouter`, and the transformer
  registry are **KEEP**, not DELETE, despite zero real logic consumers in this
  repo — confirmed re-exported from `packages/enterprise/src/index.ts` (the
  actual `@vytches/ddd` public barrel), so it is real, compiling, public surface
  rather than a dead file. Kept conservatively per the synthesis recommendation,
  with scope-narrowing JSDoc added instead of removal.

Net removals: `packages/events/src/audit/` (entire subsystem, 5 files),
`packages/events/src/generic-event-persistence-handler.ts`,
`subscribeToContext`, `EventHandlerOptions.priority`,
`packages/acl/src/di-integration/acl-discovery-plugin.ts` (+ its decorators),
`packages/domain-services/src/di-types.ts`'s `DIDomainServiceMetadataRegistry`,
the duplicate capability-interface block and several speculative unimplemented
interfaces in `packages/aggregates/src/aggregate-interfaces.ts`, and the
exported `IAggregateBuilder` (BREAKING — shape-incompatible with the real
`AggregateBuilder`, no drop-in replacement). Net addition: `resilience`'s
correctly-named `getResilienceConfig()`, with `getResilienceMetrics()` now
`@deprecated` in its favor (non-breaking, delegates through).

Verification before merge: fresh test + typecheck run, 8/8 directly-touched
packages green (`@vytches/ddd-events`, `@vytches/ddd-acl`,
`@vytches/ddd-aggregates`, `@vytches/ddd-domain-services`,
`@vytches/ddd-enterprise`, `@vytches/ddd-policies`, `@vytches/ddd-resilience`,
`@vytches/ddd-validation`). CHANGELOG.md carries 4 separate VF-031 entries
(BREAKING CHANGES, Added, and two internal-cleanup notes) cross-referencing this
task file. `packages/nestjs/` confirmed untouched (`git diff --stat` shows no
nestjs files) — AC3/D-6 correctly deferred rather than silently dropped. No
stray or unexpected files in the final diff (35 files changed, matching the
per-package decision table).

Pre-commit caught only a commit-message formatting issue (commitlint
`body-max-line-length`/`footer-max-line-length`, 100-char limit) on the first
commit attempt — no code or test regressions. Rewrapped the commit message and
re-committed clean; all 16 cached/fresh `nx` test projects green on the second
attempt.

## References

- Analysis: `project-orchestration/analysis/VF-031.analysis.md` (D-1 through
  D-14, OQ-1, OQ-2 — full per-item decision table and rationale)
- VF-024 (pre-publish API surface curation) — sibling task, same release window.
- VF-032 (nestjs fluency, status backlog) — owns the deferred AC3/D-6 decision
  on `forRootAsync` shape and the ghost `types/index.ts` file.
