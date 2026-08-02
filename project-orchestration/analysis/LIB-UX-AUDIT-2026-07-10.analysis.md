# Library Usability & Integration Audit — 2026-07-10

**Scope:** events, messaging, di, aggregates, acl, resilience, policies,
validation, cqrs, nestjs, enterprise — usability, DX, cross-package integration,
correctness, API-surface health. **Method:** 6 parallel per-area code audits +
backlog cross-reference (16 active tasks). Every finding verified against source
with file:line evidence. **Status:** draft — for human review and task-spawning
decisions.

---

## Executive verdict

The library has a genuinely strong core: the `AggregateRoot.apply()` pipeline,
capability composition via `AggregateBuilder`, per-context CQRS bus isolation
(`forFeature`, F-C4 fix with real e2e coverage), `OutboxProcessor`, and the
Specification/`BusinessRuleValidator`/`Result<T>` combo. But the audit found one
**systemic disease repeated in every audited package**: a large fraction of the
public API surface is speculative scaffolding with **zero internal consumers**,
some of it outright broken, and the first-contact documentation frequently does
not compile. The library is not yet "natural, fluent, efficient" — it is
powerful, correctness-hardened in places, and overgrown.

**Strategic window:** the library is unpublished. Removing dead surface today
costs nothing; after first publish every removal is a breaking change. API
slimming should be bundled with the VF-024 pre-publish pass.

---

## Cross-cutting themes

### T1. Dead / aspirational scaffolding shipped as (or compiled into) public API

| Package         | Dead surface                                                                                                                                                                                                                                                                                                   | Evidence                                                                                                                       |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| events          | DI resolution stub: `VytchesDDD.resolve` hardcoded to return `null`, comment "Temporarily disabled for testing", yet `useDI = true` **by default**; `registerHandlerFactory` then calls `.handle()` on `null` → TypeError                                                                                      | `packages/events/src/base-event-bus.ts:10-21,392-410`                                                                          |
| events          | Entire `audit/` subsystem, entire `integration/` pipeline (`IntegrationEventProcessor`, `DomainToIntegrationTransformer`, `ContextRouter`, transformer registry), `subscribeToContext`, `GenericEventPersistenceHandler` (not even exported), `EventHandlerOptions.priority` (never read — no ordering effect) | `packages/events/src/audit/*`, `integration/*`, `unified-event-bus.ts:278-289`, `decorators/di-types.ts:48-49`                 |
| di              | `DiscoveryRegistry` unexported; `DiscoveryRegistryFactory.createStandard()` registers a plugin list that is entirely commented out                                                                                                                                                                             | `packages/di/src/discovery/discovery-registry.ts:378-387`                                                                      |
| domain-services | `DIDomainServiceMetadataRegistry` is write-only (decorator writes, nothing reads in production); the promised `DomainServiceDiscoveryPlugin` does not exist anywhere                                                                                                                                           | `packages/domain-services/src/domain-service.decorator.ts:126`, `di-types.ts:140`                                              |
| acl             | `ACLDiscoveryPlugin` + `@ACLAdapter`/`@ACLConfig`/`@ACLContext` decorators: dead, referenced only by a commented-out line in di, and `import 'reflect-metadata'` with **no declared dependency** — throws on import unless a framework happens to polyfill it                                                  | `packages/acl/src/di-integration/acl-discovery-plugin.ts:1-286`, `packages/acl/package.json`                                   |
| nestjs          | Ghost type system: `src/types/index.ts` (250 lines: `forRootAsync` options-factory API, `VytchesDDDAsyncOptions`, etc.) has **zero importers**; the real module uses sibling `src/types.ts`                                                                                                                    | `packages/nestjs/src/types/index.ts` vs `types.ts`                                                                             |
| validation      | ~60% of exported symbols have zero consumers: `RulesRegistry`/`CoreRules`, `ValidationFacade`, `SpecificationValidator`, `BaseValidationAdapter`/`AdapterUtils`                                                                                                                                                | grep across packages/\*, examples/, tools/                                                                                     |
| aggregates      | Speculative unimplemented interfaces (`ICachingCapability`, `IMetricsCapability`, `ISecurityCapability`, `IAggregateFactory`, …); `IAggregateBuilder` exported publicly but implemented by nothing (shape incompatible with the real `AggregateBuilder`)                                                       | `packages/aggregates/src/aggregate-interfaces.ts:216-561,247-277`, `index.ts:23`                                               |
| policies        | The entire package has **zero real consumers** in the monorepo (only enterprise re-export + build tooling); `.group()`, `.when().then()`, `.thenMust()` throw "not yet implemented" (VT-006 knows); `getResilienceMetrics()` returns config, not metrics — its own comment admits it's a stub                  | `packages/policies/src/base-business-policy.ts:267-369`, `packages/resilience/src/decorators/resilience-decorators.ts:202-225` |
| resilience      | No `Fallback` pattern at all (retry/CB/timeout/bulkhead exist); decorator metrics aspirational (above)                                                                                                                                                                                                         | `packages/resilience/src/patterns/`                                                                                            |

**Recommendation:** a dedicated pre-publish "surface diet" — delete or
`@internal`-mark everything above (fold into VF-024 or a sibling task). Zero BC
risk today; enormous BC cost after publish.

### T2. Duplicated mechanisms evolving independently

1. **`getTokenKey()` ×3** — `SimpleContainer` (has the anonymous-token fix),
   `BaseContainerAdapter` and `NestJSContainerAdapter` (both unfixed copies).
   `packages/di/src/containers/simple-container.ts:355-390`,
   `adapters/base-adapter.ts:75-83`,
   `packages/nestjs/src/adapters/nestjs-container.adapter.ts:33-41`.
2. **Two event dispatchers** — `UniversalEventDispatcher` (events) vs
   `ContextAwareEventDispatcher` (nestjs), overlapping semantics, consumer must
   relearn per stack.
3. **Two retry engines** — `resilience.RetryPolicy` (AbortSignal-aware) vs
   `policies.PolicyRetryBehavior` (`retry-policy.ts:311-313`, bare `setTimeout`,
   **no cancellation at all**), near-identical backoff math maintained twice.
4. **Two handler-discovery scanners** — `CQRSDiscoveryPlugin` (cqrs) vs
   `VytchesExplorerService`/`FeatureHandlerRegistrar` (nestjs) reimplementing
   the same `di:handler-type` reflection scan; a metadata-shape change must be
   applied twice by luck.
5. **Duplicate capability interfaces** —
   `aggregates/src/aggregate-interfaces.ts:141-238` redefines 5 capability
   interfaces that diverge from the canonical
   `contracts/src/capabilities/capability-types.ts` the concrete classes
   actually implement (local `IEventSourcingCapability.replayEvents()`
   implemented nowhere). Same bug class REL-009 fixed once for
   `IAggregateSnapshot`.
6. **`PolicyEventBus`** (~380 LOC) duplicates the `UnifiedEventBus` concept
   inside policies; `globalPolicyEventBus` singleton already flagged in VF-024.
7. **Name collision** — `packages/testing/src/seeder/value-object-builder.ts:13`
   declares a local type literally named `BusinessRuleValidator` structurally
   incompatible with validation's class of the same name; also re-implements the
   email regex independently (line 662).

### T3. First-contact docs that do not compile (trust killer)

| Doc                                                       | Defect                                                                                                                                                                                                                                       |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/events/README.md:74,112`                        | `super('OrderPlaced', payload, meta)` — real constructor is payload-first (`DomainEvent(payload?, metadata?, eventName?)`); copy-paste silently mis-assigns all three args, **no compile error**                                             |
| `packages/validation/README.md:44,106-109`                | Quick-start calls `.must(...)` — method does not exist; `LLMGUIDE.md` shows the correct `.addRule()` API (docs disagree with each other)                                                                                                     |
| `packages/resilience/LLMGUIDE.md:35-40,126-139`           | 4 broken snippets: `baseDelayMs` (real: `baseDelay` + 3 more required fields), `maxConcurrent/maxQueue` (real: `maxConcurrency/queueCapacity`), `timeout: { ms }` (real: number), `getResilienceMetrics` per-method metrics that don't exist |
| `packages/nestjs/README_SIMPLE_INTEGRATION.md:30`         | Documents `forRoot({ autoRegister: true })` — option does not exist in `VytchesDDDModuleOptions`                                                                                                                                             |
| `examples/quickstart/src/domain/order.aggregate.ts:74-95` | The flagship example throws raw `Error` for every invariant — violating the library's own "domain is pure, Result<T>, no throw" rule; uncaught because the `ddd-002` lint gate is a no-op (VF-026/SA-M1)                                     |
| `packages/validation/LLMGUIDE.md:358`                     | Claims dependency on nonexistent `@vytches/ddd-logging`; also phantom `ddd-domain-primitives` runtime dep in package.json                                                                                                                    |

Extends the 2026-07-03 examples-coverage audit (resilience is an 8th
README↔code drift instance). Fold into VD-005 + add a CI check that README code
fences type-check.

### T4. New correctness bugs (NOT covered by existing tasks)

| #   | Bug                                                                                                                                                                                                                                                                                                                        | Location                                                                          | Severity                             |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------ |
| C1  | `UnifiedEventBus` split registries: inherited `registerHandlerFactory`/`getHandlers`/`getRegisteredEventTypes`/`clearHandlers` operate on `BaseEventBus.handlers`, a map `publish()` never reads → registered handler silently never fires                                                                                 | `packages/events/src/unified-event-bus.ts:109` vs `base-event-bus.ts:83`          | HIGH                                 |
| C2  | `BaseEventBus` sync-handler throw aborts the rest of the fan-out (default `onError` re-throws inside the loop); `UnifiedEventBus` behaves differently (runs all) — undocumented divergence                                                                                                                                 | `base-event-bus.ts:164-193,288-295`                                               | HIGH                                 |
| C3  | DI stub with `useDI = true` default (see T1) — `registerHandlerFactory` guaranteed TypeError                                                                                                                                                                                                                               | `base-event-bus.ts:10-21`                                                         | HIGH                                 |
| C4  | `SimpleContainer` named-class token collision: `getTokenKey` uses `fn.name` for named classes → two `UserRepository` classes from different contexts silently resolve to each other's instances. **Identical bug class ADR-0034 fixed in CommandBus after production data corruption — never propagated to the container** | `packages/di/src/containers/simple-container.ts:355-390`                          | HIGH                                 |
| C5  | `NestJSContainerAdapter` silently degrades `Scoped` → Transient (only `'singleton'` checked); throws raw `Error` instead of the DI error hierarchy                                                                                                                                                                         | `packages/nestjs/src/adapters/nestjs-container.adapter.ts:76,72,89`               | HIGH                                 |
| C6  | Bulkhead: forked timeout context never disposed (third site of the VF-027 SA-M12 leak class — audit missed it) + abort listener leak on the happy queue path (accumulates under contention with a long-lived context)                                                                                                      | `packages/resilience/src/patterns/bulkhead.ts:86,117-127`                         | MED-HIGH                             |
| C7  | `PolicyEventBus.executeHandler` timeout timer never cleared on the fast path — fires on every publish×handler by default (5000ms default)                                                                                                                                                                                  | `packages/policies/src/events/policy-event-bus.ts:230-239`                        | MED                                  |
| C8  | `UnifiedEventBus.unsubscribe` matches class handlers by `toString()` — indistinguishable wrappers, can remove the **wrong** handler                                                                                                                                                                                        | `unified-event-bus.ts:307-340`                                                    | MED                                  |
| C9  | `UnifiedEventBus` bypasses `MAX_HANDLERS_PER_EVENT` entirely (cap only in the base class the docs steer you away from); note VF-025 plans cap enforcement — verify it covers this specific bypass                                                                                                                          | `unified-event-bus.ts:383-391`                                                    | MED                                  |
| C10 | `publishMany` fires all events via `Promise.all` — no cross-event ordering for a single aggregate's batch; silent projection-corruption trap, undocumented                                                                                                                                                                 | `base-event-bus.ts:122-136`                                                       | MED                                  |
| C11 | `CoreRules.minLength` passes on missing fields (`String(undefined)` = `"undefined"`, 9 chars); `CoreRules.range` accepts `null` (`Number(null)===0`) — no typeof guards                                                                                                                                                    | `packages/validation/src/rules-registry.ts:71-78,94-104`                          | HIGH (within an unused API — see T1) |
| C12 | `BusinessRuleValidator.and()` collapses the other validator's per-field errors into one generic `''`-property error; inconsistent with `Validation.combine()` which flattens correctly                                                                                                                                     | `business-rule-validator.ts:242-249`                                              | MED                                  |
| C13 | `VersioningCapability` upcasting activates only when `metadata.targetVersion` is set — nothing in the library ever sets it; feature non-functional as documented                                                                                                                                                           | `packages/aggregates/src/capabilities/versioning-capability.ts:96-104`            | MED                                  |
| C14 | `AuditCapability.attach()` monkey-patches `aggregate.apply` via instance-property reassignment — unique among capabilities, fragile under stacking/super-calls                                                                                                                                                             | `audit-capability.ts:57-98`                                                       | MED                                  |
| C15 | `AggregateRoot` has no `equals()` despite its own JSDoc claiming it; `Entity` has one                                                                                                                                                                                                                                      | `aggregate-root.ts:32-35` (claim)                                                 | LOW-MED                              |
| C16 | `BaseACLRegistry.register()` silently overwrites duplicate context registrations; `getRequired()`/versioned registry throw raw `Error` breaking the package's own Result discipline                                                                                                                                        | `packages/acl/src/base-acl-registry.ts:16-41`, `versioned-acl-registry.ts:31-151` | LOW-MED                              |
| C17 | Async spec combinators always `Promise.all` both branches — no short-circuit; side-effecting/metered right branch always runs                                                                                                                                                                                              | `packages/validation/src/specifications/async-composite-specification.ts:100-157` | MED                                  |
| C18 | `getDomainEvents()` shallow-copies the array only — payload mutation reaches internal pending-event state (sibling of VF-023 F-H5 but out of its scope)                                                                                                                                                                    | `aggregate-root.ts:175-177`                                                       | LOW                                  |

### T5. Integration & DX gaps (the "natural, fluent" axis)

1. **Concept count too high for the golden path**: 4 module factories
   (`forRoot`/`forContext`/`forContexts`/`forFeature`, no guidance which is
   current), ~6 DI tokens (`IEventBus`, `LOCAL_EVENT_BUS`, `GLOBAL_COMMAND_BUS`,
   `GLOBAL_QUERY_BUS`, `ACL_REGISTRY`, dispatcher), 3 decorator source packages
   (`@CommandHandler` from cqrs, `@EventHandler` from events, `@ACLAdapterFor`
   from nestjs), mixed `@Inject()` ergonomics (abstract-class tokens work bare,
   Symbol tokens don't — unexplained).
2. **No `forRootAsync`** on `VytchesDDDModule` while `OutboxProcessorModule` has
   _only_ `forRootAsync` — two incompatible conventions in one package. The
   ghost `types/index.ts` (T1) is the never-wired design for exactly this.
3. **`forFeature()` bypasses `CQRSConfiguration`** — manually
   `new CommandBus(...)`: no way to pass middleware, never uses Enhanced buses,
   so per-context resilience/metrics require undocumented provider overrides.
4. **resilience and policies are islands** — resilience consumed only by the 2
   CQRS bus files (with the known jitter bug), policies consumed by nothing;
   neither has an example. No `Result<T>` integration in resilience
   (throw-only), so composing with the library's own conventions requires
   wrap/unwrap.
5. **No aggregates/repositories wiring in Nest** — zero references to
   `AggregateRoot`/`IBaseRepository` in packages/nestjs; no provider factory, no
   example.
6. **No end-to-end example of the core event flow** (aggregate →
   repository.save() → bus → handler) anywhere in examples/; the only event-bus
   example uses `PolicyEventBus`. No shipped `IEventPersistenceHandler`
   reference implementation (candidate: in-memory one in packages/testing).
7. **Three parallel validation stories** with no decision tree: contracts
   `IValidator` (Result) vs `BaseValueObject.validate(): boolean` (declared,
   never called by anything — not even its own constructor, pending VF-023 F-C1)
   vs ad-hoc `LibUtils` + throw in `EntityId`. A consumer cannot answer "where
   do I validate what".
8. **`FeatureHandlerRegistrar.findOwnModule()`** depends on non-public NestJS
   internals (`Module._imports`) — acknowledged in code, load-bearing for
   context isolation, tracked nowhere.

---

## Backlog cross-reference

**Confirmed accurate & already covered (do not duplicate):** VF-023 (VO
validate, apply atomicity, `_internal_setState`, silent handler skip, shallow
freeze, equals-via-JSON), VF-024 (10× `export *`, `ServiceNotFoundError`
collision, `internalLogger`, `globalPolicyEventBus`), VF-025 (UnifiedEventBus
cap/dedup/aggregated errors, projections retry/checkpoints), VF-026 (broken
`isDomainFile()` lint gate), VF-027 (context fork/AbortSignal, retry dispose
leak), VF-028 (jitter:false, per-class decorator state, HALF_OPEN gate,
`isSatisfiedBy` swallow), VP-006b (Nest adapter hot path), VP-012,
VS-016/017/018, VT-006 (policy stubs, coverage), VD-005 (docs truth).

**Not covered anywhere — proposed new tasks:**

| Proposed                                         | Contents                                                                                                                                                                                                                                          | Effort guess |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| **Events integrity** (or extend VF-025)          | C1 split registries, C2 fan-out abort divergence, C3 DI stub, C8 unsubscribe, C9 cap bypass (verify vs VF-025), C10 publishMany ordering docs/option                                                                                              | ~10h         |
| **DI token identity**                            | C4 constructor-identity keying in `SimpleContainer` (port the ADR-0034 fix down), extract single `getTokenKey` util shared by all 3 copies, C5 Scoped degradation + typed errors in Nest adapter                                                  | ~6h          |
| **Pre-publish surface diet** (sibling of VF-024) | Everything in T1: delete/`@internal` dead subsystems (events audit+integration, ACLDiscoveryPlugin, ghost types/index.ts, speculative aggregate interfaces, unused 60% of validation, decide policies' `PolicyEventBus`), remove phantom deps     | ~8h          |
| **NestJS fluency**                               | `forRootAsync` (wire or delete ghost types), route `forFeature` through `CQRSConfiguration` (middleware + Enhanced opt-in), deprecate `forContext`/`forContexts` or document, consolidate handler discovery, typed error hierarchy for nestjs pkg | ~12h         |
| **Resilience leak sweep** (extend VF-027)        | C6 bulkhead ×2, C7 PolicyEventBus timer; add Fallback pattern decision; consolidate the two retry engines (or add cancellation to policies')                                                                                                      | ~4h + design |
| **Validation hardening or slimming**             | C11 CoreRules guards (or delete CoreRules per diet), C12 `.and()` semantics, C17 short-circuit, `code` field on `ValidationError` for i18n, VALIDATION-STRATEGY decision tree, testing-pkg name collision rename                                  | ~6h          |
| **Docs compile gate** (extend VD-005)            | Fix all T3 snippets; CI check type-checking README/LLMGUIDE code fences; rewrite quickstart to Result<T> (pairs with VF-026 lint fix)                                                                                                             | ~6h          |

**Priority recommendation:** (1) surface diet + docs compile gate before first
publish — cheapest moment ever; (2) events integrity + DI token identity —
silent-wrong-behavior class; (3) NestJS fluency — the single biggest lever for
the "natural integration" aspiration; (4) the rest ride along with their
existing sibling tasks.

---

## What is genuinely good (keep and build on)

- `AggregateRoot.apply()` single-pass enrichment + prototype-pollution guards +
  `maxEvents` guard (REL-007).
- Capability composition (`AggregateBuilder`) — better than inheritance-heavy
  competitors.
- `forFeature()` cross-context isolation with real-container e2e regression
  tests (VB-003) — model for future module work.
- `BusRegistrationLedger` (WeakMap-scoped, idempotent-vs-conflict semantics).
- `OutboxProcessor` batch isolation + backoff + observability hooks.
- ACL adapter/registry core: Result-first end-to-end (the one place the no-throw
  spirit fully holds).
- Specification pattern + `MemoizedSpecification` +
  `AsyncCompositeSpecification` observability.
- `Validation.combine()`, `addNested` path propagation; proactive ReDoS
  documentation in `rules-registry.ts`.
- Inline rationale comments on the trickiest Nest bridging code — better than
  the external docs.
