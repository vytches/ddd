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
status: backlog
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

1. [ ] **events:** `audit/` + `integration/` subsystems, `subscribeToContext`,
       inert `priority` option, `GenericEventPersistenceHandler` — each deleted
       or `@internal`-marked, decision recorded per item (default: delete; they
       are `@public @stable` by JSDoc only, unpublished).
2. [ ] **acl:** `ACLDiscoveryPlugin` + decorators deleted (default), or wired
       for real with `reflect-metadata` declared as optional peer dependency —
       no phantom import either way.
3. [ ] **nestjs:** ghost `src/types/index.ts` deleted **unless** VF-032 decides
       to wire `forRootAsync` against it — synchronize the decision with VF-032
       AC1 before touching the file.
4. [ ] **di/domain-services:** dead `DiscoveryRegistry` scaffolding and the
       write-only domain-service metadata registry either wired (mirroring how
       events/cqrs discovery plugins actually work) or removed; stop advertising
       auto-discovery for domain services until it exists.
5. [ ] **aggregates:** duplicate capability-interface block deleted in favor of
       `@vytches/ddd-contracts` canonical types (same treatment REL-009 gave
       `IAggregateSnapshot`); `IAggregateBuilder` export dropped or the real
       builder made to implement it; speculative unimplemented interfaces
       removed.
6. [ ] **validation:** documented decision on the zero-consumer 60% —
       keep-and-fix (then VF-033 executes) or deprecate/`@internal`. The "bring
       your own zod" adapter story (`useExternal`/`BaseValidationAdapter`) stays
       either way (it is the honest zero-deps answer).
7. [ ] **policies:** `PolicyEventBus` public status decided (fold into VF-024's
       `globalPolicyEventBus` AC9 review); **resilience:**
       `getResilienceMetrics()` renamed/deprecated or wired to real per-instance
       state (pairs with VF-028 AC2's WeakMap).
8. [ ] **UX-C13/C14:** fate of `VersioningCapability` (fix self-driving
       upcasting vs `@internal` + doc warning) and `AuditCapability`'s
       monkey-patch (replace with a structural `onEventApplied` hook vs document
       the constraint) decided in the same pass — both currently have zero
       non-test consumers, so deletion/demotion is also on the table.
9. [ ] Phantom dependencies removed: `validation`'s unused
       `ddd-domain-primitives` runtime dep; acl's `reflect-metadata` situation
       per AC2.
10. [ ] Export/api-surface snapshot tests updated; every removal listed in
        CHANGELOG; downstream-consumer import check performed before each
        deletion of an exported symbol.

## Out of scope

- VF-024's own ACs (explicit barrel exports, name collisions, `internalLogger`,
  `EntityIdFactory`) — this is the sibling **deletion** pass, VF-024 is the
  **curation** pass; run them in the same pre-publish window.
- Behavioral bug fixes in surviving code — VF-029 (events), VF-030 (di), VF-033
  (validation).
- Registry duplicate/overwrite semantics — deferred `/analyze-ddd` decision
  (SA-H4/M10/L4).

## References

- Analysis: `project-orchestration/analysis/LIB-UX-AUDIT-2026-07-10.analysis.md`
  (theme T1 — full evidence table; UX-C13, UX-C14)
- VF-024 (pre-publish API surface curation) — sibling task, same release window.
