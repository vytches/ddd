# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [Unreleased]

### BREAKING CHANGES

#### Already shipped in 0.31.0-alpha.0 — documented here for the first time

**`VytchesExplorerService` resolves the CQRS buses through Symbol tokens, not
the class tokens** (VP-009 Bug #3, commit `02adf265`, released in 0.31.0-alpha.0
with no changelog entry).

The explorer injects `@Optional() @Inject(COMMAND_BUS_TOKEN)` /
`@Inject(QUERY_BUS_TOKEN)` — `Symbol.for('vytches:cqrs:command-bus')` and
`Symbol.for('vytches:cqrs:query-bus')` — instead of the `ICommandBus` /
`IQueryBus` class references. Symbols survive a dual-package load, where the
same module reached once as ESM and once as CJS yields two different classes but
one symbol. That is what the change was for.

Because the injection is `@Optional()`, a mismatch does not fail at boot. It
degrades silently: `discoverHandlers()` still reports success, no handler is
ever registered, and every `commandBus.execute()` / `queryBus.execute()` throws
`No handler registered for ...` at runtime. A consumer lost CQRS dispatch
application-wide to this and spent real time tracing it back.

_You are affected if_ your application provides the buses without going through
one of the `VytchesDDDModule` factories — for example a hand-rolled `@Global()`
module doing `{ provide: ICommandBus, useValue: new EnhancedCommandBus(...) }`.

_Migration._ Preferred: wire through `VytchesDDDModule.forRoot()` (or
`forContext()` / `forContexts()` / `forFeature()`), which bridges the class
tokens onto the Symbol tokens for you and provides the explorer in the first
place. If you cannot move yet, alias the tokens:

```ts
import { COMMAND_BUS_TOKEN, QUERY_BUS_TOKEN } from '@vytches/ddd-nestjs';
import { ICommandBus, IQueryBus } from '@vytches/ddd-cqrs';

providers: [
  { provide: ICommandBus, useValue: myCommandBus },
  { provide: IQueryBus, useValue: myQueryBus },
  { provide: COMMAND_BUS_TOKEN, useExisting: ICommandBus },
  { provide: QUERY_BUS_TOKEN, useExisting: IQueryBus },
];
```

Use `useExisting` only where the class-token provider is guaranteed present —
NestJS raises a DI error for `useExisting` against an absent token even under
`@Optional()`. Where it may be missing, mirror what the factories do:

```ts
{
  provide: COMMAND_BUS_TOKEN,
  useFactory: (bus?: ICommandBus) => bus,
  inject: [{ token: ICommandBus, optional: true }],
}
```

_Self-audit._ `grep -rn "provide: ICommandBus\|provide: IQueryBus" src/`, then
check each hit sits inside a `VytchesDDDModule` factory call or is accompanied
by a Symbol-token alias. As of this release the library also warns at bootstrap
when handlers are discovered but no bus resolved, so an upgrade surfaces the
problem in the logs rather than in production traffic.

### Added

- **contracts:** `enrichEvent(event, { payload?, metadata? })` — copy an event
  with a replaced payload and/or merged metadata while keeping its identity
  (`eventId`, `occurredOn`), its prototype and `instanceof`. The event's
  constructor is never called, so event classes with their own constructor
  signature are safe, and the returned copy is unfrozen.

  This is the supported way for infrastructure to stamp an event on its way to
  the store — a crypto-shredding key id resolved at persistence time, a
  correlation id assigned at dispatch, an encrypted payload. Previously there
  was none, and `getDomainEvents()` hands out deep-frozen events.

- **aggregates:** `AggregateRoot.transformDomainEvents(transform)` — rewrite the
  payload and/or metadata of the uncommitted domain events in place. An
  infrastructure-boundary API in the same family as `commit()`: call it from a
  repository just before persisting, never from the domain or application layer.

  ```ts
  // inside a repository's save(), before persisting:
  aggregate.transformDomainEvents(event => ({
    payload: encryptPII(event.payload, key),
    metadata: { userSpecificKeyId: key.id },
  }));
  ```

  Only `payload` and `metadata` are replaceable. `eventName`, event identity,
  and the number and order of events stay fixed — rewriting those would desync
  handlers on replay or break the version invariant. Return nothing from the
  transform to leave an event untouched.

  This has to land on the aggregate rather than on a local copy inside `save()`:
  the event dispatcher re-reads the aggregate's events after persistence, so a
  local copy would still publish the untransformed originals to the in-process
  event bus.

- **nestjs:** `COMMAND_BUS_TOKEN` and `QUERY_BUS_TOKEN` are re-exported from
  `@vytches/ddd-nestjs`, so wiring a NestJS application no longer requires a
  direct import from `@vytches/ddd-cqrs`.

- **examples:** `examples/nestjs` — a compiled, CI-run NestJS wiring example.
  The NestJS setup previously existed only as prose in three documents that
  nothing compiled or executed.

### Fixed

- **nestjs:** the CQRS Symbol→class token bridge is now registered by every
  module factory. It previously existed only in `forRoot()` and `forTesting()`,
  so an explorer created by `forContext()` or `forContexts()` silently received
  no bus and registered nothing. `forFeature()` aliases the tokens onto its own
  per-context buses, so `@Inject(COMMAND_BUS_TOKEN)` and `@Inject(ICommandBus)`
  no longer disagree inside a feature module. `GLOBAL_COMMAND_BUS` /
  `GLOBAL_QUERY_BUS` remain deliberately absent from `forFeature()` — reaching
  past the feature scope to the root bus is their purpose.

  ADR-0034 claimed `forRoot()` and `forFeature()` both carried this bridge;
  neither half was accurate, and it has been corrected.

- **nestjs:** a discovered handler with no bus to register on is now reported at
  `warn` level, naming the handler, its type and its message type. It was
  previously skipped without any signal.

- **nestjs:** when handlers are discovered and none could be registered,
  bootstrap emits one summary warning with discovered/registered counts, which
  buses resolved, and the tokens to check. This is the fastest route from
  symptom (`No handler registered for ...` on every request) to cause.

- **contracts:** `createDomainEvent()` now sets `eventId` and `occurredOn` at
  the top level as well as inside `metadata`, and `IDomainEvent` declares both
  as optional. Events created through the string form of `AggregateRoot.apply()`
  previously carried their id only in `metadata.eventId`, while class-based
  events exposed it directly — an asymmetry that forced consumers to write their
  own event reconstruction helpers. `instanceof DomainEvent` still does not hold
  for string-form events; those are plain objects by construction.

### Changed

- **events:** `DomainEvent.withMetadata()` is unchanged but now documents what
  it does to event identity: it rebuilds the event through the base
  three-argument constructor, so the copy gets a **new** `eventId` and
  `occurredOn`, and subclasses with their own constructor signature do not
  survive the round trip. For identity-preserving enrichment use `enrichEvent()`
  or `transformDomainEvents()`. The behaviour was deliberately not "fixed" —
  changing it would be a silent runtime change with no compile error to catch
  it.

- **docs:** the root README, the `@vytches/ddd-nestjs` README and its LLM guide
  now state up front that handler auto-discovery exists only inside
  `VytchesDDDModule`, and `EnhancedCommandBus`, `EnhancedQueryBus` and
  `VytchesDDD.getGlobalContainer()` carry `@remarks` that surface in the IDE.
  These remain public API — outside NestJS they are the only route.

# [0.31.0-alpha.0](https://github.com/vytches/ddd/compare/v0.27.0...v0.31.0-alpha.0) (2026-07-19)

### Bug Fixes

- adding configuration to claude
  ([eecfd38](https://github.com/vytches/ddd/commit/eecfd38de9cca24e92900fde9f0a9a767fe3b3f4))
- **config:** fix ddd-lint no-throw-in-domain path matching, wire CI, triage
  findings
  ([a5ac3e9](https://github.com/vytches/ddd/commit/a5ac3e9e101b4eb8b32e56edb4272e8498f2d8c4))
- **config:** include benchmarks/ in nestjs and di tsconfig for type-check
  coverage
  ([b0d6884](https://github.com/vytches/ddd/commit/b0d6884e24947c6d83fcc40fdf61879c03cdf4e5))
- **contracts:** replace Math.random UUID/id generation with crypto.randomUUID
  ([3798355](https://github.com/vytches/ddd/commit/37983557fa99edde6f60b7662a874b2ae683e078))
- **core:** enforce structural invariants in BaseValueObject and AggregateRoot
  (VF-023)
  ([90d393a](https://github.com/vytches/ddd/commit/90d393a877a437915cc0196822c9591898b93698))
- **core:** stop errors from leaking data through JSON.stringify
  ([870b012](https://github.com/vytches/ddd/commit/870b01245f614735588ecd99a032ba4cc03a357e))
- **cqrs:** evict stale handler factories and add bus reset (VS-003)
  ([550f865](https://github.com/vytches/ddd/commit/550f8654472260140d67a2f15876691f1f1f6348))
- **cqrs:** make CQRS execution logging opt-in, sanitize logged errors
  ([5f58796](https://github.com/vytches/ddd/commit/5f587964c1aa2b00adaf662742b18fda7dbd9315))
- **cqrs:** unref cache timers and align command enableCache default to false
  (vp-010)
  ([56068b7](https://github.com/vytches/ddd/commit/56068b73a39a20d8c18aa7be6cd676639ea1cce5))
- **deps:** bump vulnerable transitive dependencies (22 advisories)
  ([f397bb4](https://github.com/vytches/ddd/commit/f397bb4cfdb54da2283d44414a8fa1b2259ad228))
- **di:** key DI tokens by reference identity, fix adapter lifetime and errors
  (VF-030)
  ([3f7fcff](https://github.com/vytches/ddd/commit/3f7fcff28162db78b4e70334e0079549f751b476))
- **events:** unify bus error semantics, registries, unsubscribe identity,
  handler cap
  ([b77e510](https://github.com/vytches/ddd/commit/b77e5102e0cb9ca9cb9e159549329f17eca2e106))
- **logging:** DataMasker isSensitiveKey — mask plural-form keys (passwords,
  apiTokens)
  ([69e7ead](https://github.com/vytches/ddd/commit/69e7ead1904ec4f9d2b25856dd45156f5adcc2d2))
- **logging:** VS-001 — automatic PII masking for CQRS payload decorators
  ([31a25d2](https://github.com/vytches/ddd/commit/31a25d2636d83ebaa2a6c61b0ff6dc4d208b92fd))
- **logging:** VS-002 — PII masking for ConsoleProvider and DefaultLogger
  defaults
  ([93191a3](https://github.com/vytches/ddd/commit/93191a329120db48e1135e0d818cf6c7387a61ff))
- **logging:** VS-004 — DataMasker regex pattern validation (ReDoS protection)
  ([981fd66](https://github.com/vytches/ddd/commit/981fd66db5095d3e6a59a25f937038ab63b6dc9c))
- **messaging,resilience:** outbox atomic-claim contract + timer/listener leak
  fixes (VB-004)
  ([463beb2](https://github.com/vytches/ddd/commit/463beb23e32c8ead6b70e12612261ff473442238))
- **messaging:** preserve outbox stack trace + widen LoggingMiddleware logger
  type (VS-015)
  ([f11f6f9](https://github.com/vytches/ddd/commit/f11f6f96427a9b41910a5c5249fbc1c541201055))
- **messaging:** warn when OutboxProcessor default handler is replaced (VS-007,
  SEC-MESSAGING-001)
  ([54ac0fe](https://github.com/vytches/ddd/commit/54ac0fef5e1350110dd56063db560895dc810f93))
- **nestjs:** repair forFeature() DI wiring so bounded-context handlers stay
  local (VB-003)
  ([ddbedb6](https://github.com/vytches/ddd/commit/ddbedb6c17e60f8266bf561011df245454db77af))
- **nestjs:** resolve importing consumer module in feature handler registrar
  ([efda71f](https://github.com/vytches/ddd/commit/efda71f44c3f056fe06080c0895aa321d6d6af38)),
  closes [#1](https://github.com/vytches/ddd/issues/1)
- **nestjs:** surface failed handler registrations and reset buses on destroy
  (VS-003)
  ([7460d72](https://github.com/vytches/ddd/commit/7460d729eb1be7d0ceb831bee60dc00cdf56dc06))
- **nestjs:** switch VytchesExplorerService injection to Symbol.for DI tokens
  (VP-009 Bug [#3](https://github.com/vytches/ddd/issues/3))
  ([02adf26](https://github.com/vytches/ddd/commit/02adf2653c19cedba7d3963bd38901381e3c5c57))
- **policies:** cover all step-type union members in policy evaluators (VF-035)
  ([a880b32](https://github.com/vytches/ddd/commit/a880b32b384b99fc07109532a4e5dba8262fec6b))
- **policies:** replace 32-bit djb2 cache key hash with sha-256 (VS-005)
  ([689738b](https://github.com/vytches/ddd/commit/689738b396c06bc695ca75fbc4671231fb8f5529))
- **release:** repair broken npm publish artifacts across all packages (VB-002)
  ([82d92fd](https://github.com/vytches/ddd/commit/82d92fdc39194d2e5398593dde27f9d9c126a527))
- **resilience:** block CSV formula injection in CsvMetricExporter (VS-006)
  ([46fd54e](https://github.com/vytches/ddd/commit/46fd54e2955a7df671eebe03e42c6f7dadfa40f8))

### Code Refactoring

- **config:** curate public API surface ahead of first publish (VF-024)
  ([3f8758d](https://github.com/vytches/ddd/commit/3f8758d0d0e07b73bace4ed9609e3f60b6bd8eea))
- **config:** trim dead and aspirational public API surface (VF-031)
  ([27e0055](https://github.com/vytches/ddd/commit/27e005513894b0b0a17d966a1051b9746df21461))

### Features

- **cli:** add example-matrix coverage generator + CI enforcement (VD-006a)
  ([ff985aa](https://github.com/vytches/ddd/commit/ff985aa9176075b4faf28a10799ebf705359a420))
- **config:** add ddd-005 deep-import-instead-of-barrel lint rule
  ([ee6c817](https://github.com/vytches/ddd/commit/ee6c8170e4700351e9d2ae4b4ccbb36af054c454))
- **contracts:** add configureDiagnostics public control API (VS-014)
  ([68d90f6](https://github.com/vytches/ddd/commit/68d90f605697e740c6773ee5c3b352ecd080df34))
- **cqrs:** add IDisposableBus interface and export from package
  ([00ada97](https://github.com/vytches/ddd/commit/00ada97a1d6f104e972de1a3a33a511520ba6f48))
- **cqrs:** export Symbol.for DI tokens to fix dual-package hazard (VP-009 Bug
  [#3](https://github.com/vytches/ddd/issues/3))
  ([a985fa8](https://github.com/vytches/ddd/commit/a985fa8301c711d063820c72f55aab76f1ba1331))
- env-var suppression for EntityIdFactory deprecation warn (VS-008)
  ([6428850](https://github.com/vytches/ddd/commit/6428850dc6cc21de166fe54e394310cb1591cd3b))
- **nestjs:** add GLOBAL_COMMAND_BUS / GLOBAL_QUERY_BUS tokens for cross-context
  ACL (VP-009 Bug [#2](https://github.com/vytches/ddd/issues/2))
  ([0b47e4d](https://github.com/vytches/ddd/commit/0b47e4d16b54dc696194a25860d81d9c1f02070f))
- **nestjs:** opt-in strict handler registration (fail-fast on bootstrap)
  ([bd320b5](https://github.com/vytches/ddd/commit/bd320b57b7641a82755d714bea0f6399e50026f3))
- **nestjs:** warn when injected bus does not implement reset()
  ([747c87b](https://github.com/vytches/ddd/commit/747c87b510b5f03e453b75dafb328e36a0efdc7a)),
  closes [#3](https://github.com/vytches/ddd/issues/3)
- **policies:** shouldSatisfyAny returns IPolicyStepBuilder (VF-035 AC7)
  ([63a0759](https://github.com/vytches/ddd/commit/63a075939e1640c36c3b05ab55128ad6325068ac))

### Performance Improvements

- **di:** internal resolve/memory optimizations + dev-only bench (VP-006)
  ([38f7f54](https://github.com/vytches/ddd/commit/38f7f5431d4f9613491ea4c3014e9f60809b8516))
- **nestjs:** registry-first resolve, lazy paramtypes cache, COW scopes
  (VP-006b)
  ([9b56a71](https://github.com/vytches/ddd/commit/9b56a71ad7779f6626c35192d60c4eea3a51b8c3))

### Reverts

- drop unrelated statusline config accidentally auto-committed
  ([735be17](https://github.com/vytches/ddd/commit/735be1715735c7c80ae168240c6cff34c21dd422))

### BREAKING CHANGES

- **config:** AggregateRoot's IAggregateBuilder interface removed (was exported
  but shape-incompatible with the real builder). Several other
  technically-exported- but-unreachable symbols removed (events/audit,
  subscribeToContext, ACLDiscoveryPlugin, DIDomainServiceMetadataRegistry,
  duplicate/speculative aggregate interfaces) - see CHANGELOG.md for full list
  and migration notes.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

- **core:** BaseValueObject constructor now throws on invalid values (previously
  silent); VO/event freeze is now deep, not shallow; equals() semantics changed;
  AggregateRoot.\_internal_setState requires a token parameter. See CHANGELOG.md
  for full migration notes.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

- **config:** ServiceNotFoundError, EntityIdFactory, internalLogger barrel
  export, BaseEntityId, and globalPolicyEventBus all removed/renamed — see
  CHANGELOG.md for migration notes.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

- **events:** BaseEventBus DI machinery removed - the useDI constructor
  parameter, registerHandlerFactory() and discoverHandlers() are gone; default
  error semantics now runs all handlers and throws AggregatedEventHandlerError
  instead of rethrowing the first failure mid-loop.

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [Unreleased]

### BREAKING CHANGES

VF-023 — DDD foundation guarantees: value-object validation-during-construction,
deep immutability, and aggregate event-application atomicity (pre-1.0 BC window;
see `project-orchestration/tasks/VF-023-ddd-foundation-guarantees.md` and
`docs/security/threat-models/TM-VF-023.md`):

- **value-objects (AC1):** `BaseValueObject`'s constructor now calls
  `this.validate(value)` and throws synchronously on failure, instead of relying
  on every subclass to repeat that check after `super(value)`. Subclasses whose
  `validate()` override reads other instance fields (rather than only the
  `value` parameter) will now see `undefined` for those fields, because
  `validate()` runs before the subclass constructor body executes (the
  "undefined-during-`super()`" trap). Override the new
  `protected getInvalidValueMessage(value: T): string` hook to customize the
  thrown message; a subclass's own post-`super(value)` `throw` is no longer
  reachable.
- **value-objects (AC2, AC3, AC11):** `BaseValueObject` values are now
  **deep**-frozen (`LibUtils.deepFreeze`), not shallow-frozen — nested
  objects/arrays inside a VO's value are no longer mutable. `equals()` now uses
  `LibUtils.deepEqual` instead of `JSON.stringify` comparison, fixing false
  positives/negatives for `undefined`, `Date`, `Map`, `Set`, and `NaN` inside
  nested structures.
- **aggregates (AC11):** `AggregateRoot.getDomainEvents()` now returns
  deep-frozen events (`LibUtils.deepFreeze`), matching the value-objects
  immutability guarantee. Code that previously mutated events returned from
  `getDomainEvents()` (a bug even before this change) will now throw in strict
  mode instead of silently corrupting aggregate state.
- **aggregates (AC4, F-C6 fix):** `apply()`'s `maxEvents` (REL-007) guard now
  runs _before_ any state mutation. Previously the guard fired after `_version`
  had already been incremented, so a caught `maxEvents` error left the
  aggregate's version and event log permanently out of sync, and a subsequent
  valid `apply()` call would skip a version number. Guard ordering is now
  identical between `apply()` (live) and `loadFromHistory()` (replay).
- **aggregates (AC5, CRITICAL F-H4):** `AggregateRoot._internal_setState` —
  previously a plain method reachable via any `as unknown as {...}` cast — now
  requires a module-private `unique symbol` token (`INTERNAL_STATE_TOKEN`,
  exported only from `./core/aggregate-root`, never from the package's public
  barrel) as its first parameter, and throws `TypeError` if the token doesn't
  match. `SnapshotCapability` (the only legitimate caller) has been updated to
  pass the token. Consumers cannot obtain this token and therefore cannot call
  `_internal_setState` at all.

#### Consumer Impact Checklist (VF-023)

Before upgrading, run these greps against your codebase to self-audit for the
behaviors above:

- `grep -rn "\.getValue()\." src/` — find code that reads a nested field off a
  VO's `getValue()` result and then assigns into it (or into an array method
  like `.push()`/`.splice()`). These now throw `TypeError` under deep freeze
  instead of silently mutating shared state.
- `grep -rn "getDomainEvents()" src/` — find code (projectors, test helpers,
  outbox processors) that mutates an event or its `payload` after reading it
  from `getDomainEvents()`. Same deep-freeze consequence as above.
- `grep -rn "_internal_setState" src/` — find any direct calls to this method.
  Only `SnapshotCapability` inside `@vytches/ddd-aggregates` itself is a
  legitimate caller; any application-level call will now fail to compile/throw
  `TypeError`, since the required `INTERNAL_STATE_TOKEN` is not exported from
  the public barrel.
- Review every `BaseValueObject` subclass's `validate()` override: if it
  previously returned `true`/no-op for values it should have rejected (a silent
  bug pre-VF-023, since nothing enforced the subclass calling `validate()` at
  all), construction will now throw at `new Xyz(...)` time instead of allowing
  an invalid object to exist. Search with
  `grep -rn "extends BaseValueObject" src/` and manually review each
  `validate()` body.
- Review any `validate()` override that reads `this.<otherField>` instead of
  only its `value` parameter — it will now see `undefined` for fields set up in
  the subclass constructor body, because `validate()` now runs during `super()`,
  before that body executes.

VF-031 — prepublish surface diet, second pass (pre-1.0 BC window; see
`project-orchestration/tasks/VF-031-prepublish-surface-diet.md`):

- **aggregates:** `IAggregateBuilder` removed. The interface's shape was
  incompatible with the concrete builder implementations shipped in this
  package, so it could not be implemented as declared; there is no drop-in
  replacement export, since nothing in this library could have satisfied the old
  contract. Consumers depending on `IAggregateBuilder` should type against the
  concrete builder class(es) they actually construct instead.

VF-030 — DI token identity by reference (pre-1.0 BC window; see
`docs/adr/0038-di-token-identity-by-reference.md` and
`docs/security/threat-models/TM-VF-030.md`):

- **di, nestjs:** container adapters' internal maps are now keyed by the
  `ServiceToken` itself (reference identity for class/function and symbol
  tokens, value identity for strings) instead of a string derived from the
  token. No public signature changed, and **string-token behavior is unchanged**
  — but two registrations that previously collided through their string
  rendering (two classes sharing a `.name` across bounded contexts, or two
  separate `Symbol('X')` calls both rendering as `"Symbol(X)"`) are now distinct
  registrations. Code that accidentally relied on such collisions — registering
  under one class/symbol and resolving with a different same-named one — will
  now throw `ContainerServiceNotFoundError` instead of silently resolving the
  wrong service. There is deliberately no `.name` fallback; for tokens shared
  across bounded contexts or across dual ESM/CJS module graphs, declare them
  with `Symbol.for('namespaced:key')` (see `packages/di/FRAMEWORK-ADAPTERS.md`).
- **nestjs:** `NestJSContainerAdapter` now honors `ServiceLifetime.Scoped` — a
  Scoped service resolves to the same instance within one scope (`createScope()`
  starts a fresh scoped cache; materialized singletons are shared). Previously
  Scoped was silently treated as Transient, producing a new instance on every
  `resolve()`. Consumers that registered services as Scoped but depended on the
  accidental fresh-instance-per-resolve behavior should register them as
  Transient.
- **nestjs:** failed constructor-dependency resolution in
  `NestJSContainerAdapter` now throws `ContainerServiceNotFoundError` (naming
  the owning service), and a constructor-dependency cycle throws
  `CircularDependencyError` with the full resolution chain. Previously an
  unresolvable dependency fell back to silently constructing it with zero
  arguments (`new paramType()`), producing an uninitialized instance that failed
  later and far from the cause.
- **di:** `BaseContainerAdapter.getTokenKey()` is `@deprecated` and now a
  display-only helper for error messages and logs — its string output is
  intentionally lossy and must not be used as a lookup key. The `protected`
  method remains available to adapter subclasses with an unchanged signature;
  custom adapters keying their own maps with it should switch to keying by the
  token itself (migration guide in `packages/di/FRAMEWORK-ADAPTERS.md`).

### Added

- **aggregates (AC6):**
  `IAggregateConstructorParams.onMissingHandler?: 'warn' | 'throw'` — new
  optional constructor parameter controlling what happens when
  `apply()`/`loadFromHistory()` encounters an event with no registered handler.
  Defaults to `'warn'` (previous behavior, unchanged — a message is logged and
  the event is recorded but state is not updated). Pass `'throw'` for tests or
  strict environments where a missing handler should fail fast instead.
  Non-breaking, additive.
- **aggregates (AC10):** `AggregateRoot.equals(other)` — identity-based
  equality, mirroring `Entity.equals()`. Compares by id
  (`this.getId().equals(other.getId())`); attribute/version differences are
  ignored. `AggregateRoot` does not extend `Entity`, so this was previously
  unavailable on aggregates. Non-breaking, additive.

VF-024 — public API surface curation ahead of the first public publish (pre-1.0
BC window; see `project-orchestration/tasks/VF-024-prepublish-api-surface.md`):

- **di:** `ServiceNotFoundError` renamed to `ContainerServiceNotFoundError` to
  resolve a silent name collision with `@vytches/ddd-domain-services`'
  `ServiceNotFoundError` (the two used to be indistinguishable via `instanceof`
  when both were in scope). Update any `instanceof ServiceNotFoundError` checks
  against DI container errors to `ContainerServiceNotFoundError`.
- **value-objects:** `EntityIdFactory` (deprecated, runtime-warned) removed. Use
  `EntityId.create()` / `EntityId.createWithRandomUUID()` /
  `EntityId.fromUUID()` / `EntityId.fromInteger()` / `EntityId.fromBigInt()` /
  `EntityId.fromText()` instead, depending on the identifier shape.
- **contracts, events:** `internalLogger`, `EVENT_HANDLER_METADATA`,
  `EVENT_HANDLER_OPTIONS` (contracts) and `CUSTOM_MIDDLEWARE_SYMBOL` (events)
  removed from the public `.` barrel — they were never meant to be public API.
  They remain available to sibling `@vytches/ddd-*` packages only, via the
  `@vytches/ddd-contracts/internal` and `@vytches/ddd-events/internal` subpaths,
  which carry no semver stability guarantee for external consumers.
- **enterprise:** `BaseEntityId` (the `@vytches/ddd-contracts` `EntityId`
  re-exported under an alias to avoid colliding with the
  `@vytches/ddd-value-objects` `EntityId`) renamed to `ContractsEntityId` for
  clarity.
- **policies:** `globalPolicyEventBus` (a process-global, un-partitioned
  singleton instantiated at import time) removed from the public barrel
  (SA-M11). Construct your own instance instead: `new PolicyEventBus()`.

VF-031 — prepublish surface diet, second pass (pre-1.0 BC window; see
`project-orchestration/tasks/VF-031-prepublish-surface-diet.md`):

- **resilience:** `getResilienceConfig(instance, methodName)` — new function
  that reads back the decorator configuration attached to a
  `@Resilience`/`@Timeout`/etc-decorated method. `getResilienceMetrics()` is now
  `@deprecated` in favor of this accurately-named equivalent and simply
  delegates to it; behavior is unchanged and both remain exported. Non-breaking,
  additive.

Internal cleanup (technically exported but with no known real consumers; removed
as part of the same surface diet, not user-facing deprecations):

- **events:** the audit subsystem (`Audible`, `AuditEvent`,
  `AuditEventProcessor`, `CaptureState`, and the package's
  `generic-event-persistence-handler.ts`) removed.
- **events:** `subscribeToContext` and `EventHandlerOptions.priority` removed.
- **acl:** `ACLDiscoveryPlugin` and its associated decorators removed. Use the
  `@ACLAdapterFor` decorator from `@vytches/ddd-nestjs` instead.
- **domain-services:** `DIDomainServiceMetadataRegistry` removed.
- **aggregates:** duplicate capability interfaces and speculative
  never-implemented capability interfaces (e.g. `ICachingCapability`) removed.

### Changed

VP-006b — `NestJSContainerAdapter` resolve / cold-start / scope performance
(MINOR-worthy; see
`project-orchestration/tasks/VP-006b-nestjs-adapter-performance.md`):

- **nestjs:** **BEHAVIOR CHANGE**: `NestJSContainerAdapter.resolve()` now checks
  the internal VytchesDDD registry before falling back to `ModuleRef` (aligns
  with ADR-0014, VytchesDDD as primary container). Only affects tokens
  registered in BOTH places with DIVERGENT instances — the internal instance now
  wins where NestJS's previously did. If you dual-register, either drop the
  internal registration or call `moduleRef.get()` directly for the NestJS
  instance. In non-production environments the adapter logs a one-time warning
  when it detects such a divergent dual registration.

### Performance Improvements

- **nestjs:** `NestJSContainerAdapter` caches `design:paramtypes` lazily, once
  per constructor, on first instantiation (module-level
  `WeakMap<Constructor, readonly Constructor[]>`; empty results cached too).
  After a constructor's first materialization no further `Reflect.getMetadata`
  calls occur for it. No behavior change — `registerFactory`/`registerInstance`
  paths are unaffected.
- **nestjs:** constructor-dependency resolution is now a SINGLE pass
  (`resolveDependency` override replacing the base `isRegistered()` +
  `resolve()` double lookup — previously up to two `ModuleRef.get` calls per
  NestJS-side constructor parameter plus one swallowed throw per internal
  parameter). Error contract unchanged: `ContainerServiceNotFoundError` naming
  the owning service, `CircularDependencyError` with the full resolution chain,
  `InvalidRegistrationError` — same types, messages, and timing.
- **nestjs:** `createScope()` is now O(1) copy-on-write instead of eagerly
  copying the full descriptor + singleton maps per scope. Measurement (AC4,
  GC-hinted heap deltas, 1000 live scopes): the eager copy retained 56.62 KB per
  live scope at N=1000 registered services — above the 50 KB materiality
  threshold — hence copy-on-write; snapshot semantics (VF-030 D5) are preserved
  exactly, and `dispose()` of a scope never clears the parent's maps (covered by
  new tests).
- **nestjs:** dev-only benchmarks added (`benchmarks/`,
  `vitest.bench.config.ts`, `pnpm --filter @vytches/ddd-nestjs bench`) with
  count-based SLOs (`benchmarks/baseline.json`: zero `ModuleRef.get` calls /
  throws on the production hot path for internally-owned tokens, one
  `Reflect.getMetadata` per constructor) plus heap/timing metrics. Not part of
  the published package (`files` whitelist).

# [0.30.0](https://github.com/vytches/ddd/compare/v0.27.0...v0.30.0) (2026-05-26)

### Bug Fixes

- **build:** externalize workspace deps to prevent absolute paths in dist
  ([f95d97b](https://github.com/vytches/ddd/commit/f95d97b61d5db4f35016561c6a8e84a60e4b0f37))

### Features

- **messaging:** add OutboxProcessor.registerDefaultHandler + comparePriority
  helper (VP-008)
  ([ac59b0a](https://github.com/vytches/ddd/commit/ac59b0ae4067bb42b4a339fc767be1ffc0d89edc))

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [0.29.3](https://github.com/vytches/ddd/compare/v0.27.0...v0.29.3) (2026-05-25)

**Note:** Version bump only for package @vytches/ddd

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [0.29.2](https://github.com/vytches/ddd/compare/v0.27.0...v0.29.2) (2026-05-25)

### Bug Fixes

- **nestjs:** add .js extension to modules-container import for vite-node ESM
  compat
  ([674eba5](https://github.com/vytches/ddd/commit/674eba5c43cbbdffce460a9dce206612e893004c))

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [0.29.1](https://github.com/vytches/ddd/compare/v0.27.0...v0.29.1) (2026-05-24)

### Bug Fixes

- **nestjs:** replace @nestjs/core/injector directory import with
  modules-container
  ([4132a28](https://github.com/vytches/ddd/commit/4132a28feb83d586e012a334709d94905cc291ba))

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [0.28.0](https://github.com/vytches/ddd/compare/v0.27.0...v0.28.0) (2026-05-23)

### Bug Fixes

- **cli:** simplify npx commands and add 'ddd' binary alias for reliable npx
  resolution
  ([26011af](https://github.com/vytches/ddd/commit/26011afcd4291a971e6e93ee9f8719d2d27b4b52))
- **messaging:** add constructor validation to OutboxProcessor (TM-VP-003 D1)
  ([d4757fa](https://github.com/vytches/ddd/commit/d4757faef212aae0d73bb11ab210cbf613d83a4a))
- **messaging:** reset to PENDING before scheduleRetry to prevent PROCESSING
  lock
  ([8ae2fd1](https://github.com/vytches/ddd/commit/8ae2fd15ca1ef11b9e6d75d5157dbfe84ffeee21))
- **messaging:** resolve TS errors in outbox tests (TS4114, TS2379, TS2741)
  ([7ca10c1](https://github.com/vytches/ddd/commit/7ca10c12614539e4867e4a2420de715945f6c68b))
- **messaging:** upgrade vitest to ^4.0.0 to fix Vite 7 SSR transform compat
  ([3e1ce37](https://github.com/vytches/ddd/commit/3e1ce37d52f5ed040e97df939fbb21f6af8b89cb))
- **security:** patch 4 moderate vulnerabilities via pnpm overrides
  ([e466cfa](https://github.com/vytches/ddd/commit/e466cfa8d055ede41b92ed875fcb39eeb65bc670))
- **tests:** resolve Vitest 4 type errors in value-objects and policies
  ([9295171](https://github.com/vytches/ddd/commit/92951711a8fefa385ecb65da0c1146ec8fbef35b))

### Features

- **messaging:** add exponential backoff for outbox retry (VP-003 Part 1)
  ([04613e6](https://github.com/vytches/ddd/commit/04613e6844245e592aaf946ee234be209238876d))

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# 0.27.0 (2026-05-17)

### Bug Fixes

- adjusted vars in workflows in release.yaml
  ([#16](https://github.com/vytches/ddd/issues/16))
  ([520361c](https://github.com/vytches/ddd/commit/520361c04bd6de675cdc25a5bb161e58d1127fe1))
- **ci:** add publish-only option to release workflow
  ([#58](https://github.com/vytches/ddd/issues/58))
  ([a9c4f61](https://github.com/vytches/ddd/commit/a9c4f619435789358ce1b5aaecc2d78389e25d9f))
- **deps:** downgrade lerna to 7.4.2 (fixes packDirectory bug)
  ([#64](https://github.com/vytches/ddd/issues/64))
  ([46b46a2](https://github.com/vytches/ddd/commit/46b46a2ac3eed1f47d9b841572a8cc779ec7d740))
- fixing failing release ([#65](https://github.com/vytches/ddd/issues/65))
  ([f9e0cad](https://github.com/vytches/ddd/commit/f9e0cada01f603268fbe13a7b8acd1b886440f4c))
- fixing release.yaml adding no-git-checks flag
  ([#67](https://github.com/vytches/ddd/issues/67))
  ([9bf906f](https://github.com/vytches/ddd/commit/9bf906f522bee59dad02dac05a5c66b1a185032b))
- **nestjs:** implement configuration methods and reduce any type usage
  ([#42](https://github.com/vytches/ddd/issues/42))
  ([2ed336d](https://github.com/vytches/ddd/commit/2ed336d9c32b7f086fe951ab651b2c5cb9a8dcde))
- **nestjs:** resolve all linter errors and finalize package for release
  ([#46](https://github.com/vytches/ddd/issues/46))
  ([625150a](https://github.com/vytches/ddd/commit/625150af1eef1e39c8a304ab3684d4702d366cc5))
- **release:** add packages:write permission and use GITHUB_TOKEN for publishing
  ([#66](https://github.com/vytches/ddd/issues/66))
  ([68f1103](https://github.com/vytches/ddd/commit/68f1103fcf46948d5eda7df853dca0b68ff4c209))
- **release:** prevent changelog regeneration and add publish-only mode
  ([#59](https://github.com/vytches/ddd/issues/59))
  ([9b82753](https://github.com/vytches/ddd/commit/9b82753d3be0e225d722d9896845aeb874ad770c))
- rename variable ([#63](https://github.com/vytches/ddd/issues/63))
  ([161bda3](https://github.com/vytches/ddd/commit/161bda317346ed8ae02a4823c4b88b45950fa1dd))
- **scripts:** remove references to non-existent packages
  ([#54](https://github.com/vytches/ddd/issues/54))
  ([251c2d6](https://github.com/vytches/ddd/commit/251c2d6e8759461bbfa1644f71eb00d80f5de6c1))

- Release/2025 08 12 1 (#33)
  ([23d7e6f](https://github.com/vytches/ddd/commit/23d7e6fbc703270da37dd81ed36f12bdec2a1648)),
  closes [#33](https://github.com/vytches/ddd/issues/33)
- Release/2025 08 11 2 (#32)
  ([c71ebd6](https://github.com/vytches/ddd/commit/c71ebd6b33ae0c211b8cbe74e57ce4e2a753c344)),
  closes [#32](https://github.com/vytches/ddd/issues/32)
- Release/2025 07 28 1 (#24)
  ([4d6f93a](https://github.com/vytches/ddd/commit/4d6f93ac80407ce7cc7106869bb12b756bc0c72c)),
  closes [#24](https://github.com/vytches/ddd/issues/24)

### Features

- add GitHub App authentication for releases
  ([#15](https://github.com/vytches/ddd/issues/15))
  ([b85df7e](https://github.com/vytches/ddd/commit/b85df7edd75ccdc8ec1588a88a340faf49136a8f))

### BREAKING CHANGES

- **nestjs:** None - all changes maintain backward compatibility

- chore: publish releases

* @vytches/ddd-acl@0.11.0
* @vytches/ddd-aggregates@0.11.0
* @vytches/ddd-cli@0.12.0
* @vytches/ddd-contracts@0.13.0
* @vytches/ddd-core@0.11.0
* @vytches/ddd-cqrs@0.11.0
* @vytches/ddd-di@0.11.0
* @vytches/ddd-domain-primitives@0.11.0
* @vytches/ddd-domain-services@0.11.0
* @vytches/ddd@0.12.0
* @vytches/ddd-event-scheduling@0.11.0
* @vytches/ddd-event-store@0.11.0
* @vytches/ddd-events@0.11.0
* @vytches/ddd-logging@0.11.0
* @vytches/ddd-messaging@0.11.0
* @vytches/ddd-nestjs@2.0.0
* @vytches/ddd-policies@0.12.0
* @vytches/ddd-process-managers@0.9.0
* @vytches/ddd-projections@0.11.0
* @vytches/ddd-repositories@0.11.0
* @vytches/ddd-resilience@0.11.0
* @vytches/ddd-testing@0.11.0
* @vytches/ddd-utils@0.11.0
* @vytches/ddd-validation@0.12.0
* @vytches/ddd-value-objects@0.11.0

- Enterprise package no longer bundles dependencies. Users must install all
  required @vytches/ddd-\* packages.

This aligns with industry standards (TanStack Query, Zod) where meta-packages
are thin re-export layers, not fat bundles.

- refactor: build refactored

- refactor(contracts): unify domain event interfaces by merging metadata into
  base
- IExtendedDomainEvent interface has been removed. All domain events now use
  IDomainEvent with an optional metadata field. This eliminates 26 dangerous
  type castings and simplifies the event system architecture.

  Migration guide:

  - Replace all imports of IExtendedDomainEvent with IDomainEvent
  - Remove unnecessary type castings to IExtendedDomainEvent
  - The metadata field is now optional on IDomainEvent

  Benefits:

  - Eliminates type casting risks across the codebase
  - Simplifies event interface hierarchy
  - Improves type safety and developer experience
  - Reduces cognitive load when working with events

  Affected packages: contracts, events, aggregates, messaging, projections,
  event-scheduling, event-store, repositories, domain-services

- fix: fix merge conflict issues

- chore: publish releases

* @vytches/ddd-acl@0.6.0
* @vytches/ddd-aggregates@0.6.0
* @vytches/ddd-cli@0.7.0
* @vytches/ddd-contracts@0.8.0
* @vytches/ddd-core@0.6.0
* @vytches/ddd-cqrs@0.6.0
* @vytches/ddd-di@0.6.0
* @vytches/ddd-domain-primitives@0.6.0
* @vytches/ddd-domain-services@0.6.0
* @vytches/ddd@0.7.0
* @vytches/ddd-event-scheduling@0.6.0
* @vytches/ddd-event-store@0.6.0
* @vytches/ddd-events@0.6.0
* @vytches/ddd-logging@0.6.0
* @vytches/ddd-messaging@0.6.0
* @vytches/ddd-policies@0.7.0
* @vytches/ddd-projections@0.6.0
* @vytches/ddd-repositories@0.6.0
* @vytches/ddd-resilience@0.6.0
* @vytches/ddd-testing@0.6.0
* @vytches/ddd-utils@0.6.0
* @vytches/ddd-validation@0.7.0
* @vytches/ddd-value-objects@0.6.0

- None - maintains full API compatibility

  Or if you prefer a shorter version:

  fix(build): bundle types for meta-packages to fix package resolution

  Add bundle-meta-types step to build pipeline to generate inline type
  definitions instead of re-exports. Fixes "Cannot find module '@vytches/ddd'"
  error in published packages on GitHub Packages registry.

  - Modified build script to run bundle-meta-types after fix:dts
  - Generates 292-line index.d.ts with all types bundled inline
  - Fixes @vytches/ddd 0.6.0 package resolution issues

- chore: publish releases

* @vytches/ddd-acl@0.5.1
* @vytches/ddd-aggregates@0.5.1
* @vytches/ddd-cli@0.6.1
* @vytches/ddd-contracts@0.7.1
* @vytches/ddd-core@0.5.1
* @vytches/ddd-cqrs@0.5.1
* @vytches/ddd-di@0.5.1
* @vytches/ddd-domain-primitives@0.5.1
* @vytches/ddd-domain-services@0.5.1
* @vytches/ddd@0.6.1
* @vytches/ddd-event-scheduling@0.5.1
* @vytches/ddd-event-store@0.5.1
* @vytches/ddd-events@0.5.1
* @vytches/ddd-logging@0.5.1
* @vytches/ddd-messaging@0.5.1
* @vytches/ddd-policies@0.6.1
* @vytches/ddd-projections@0.5.1
* @vytches/ddd-repositories@0.5.1
* @vytches/ddd-resilience@0.5.1
* @vytches/ddd-testing@0.5.1
* @vytches/ddd-utils@0.5.1
* @vytches/ddd-validation@0.6.1
* @vytches/ddd-value-objects@0.5.1

- fix: folder removed
- Enterprise package no longer bundles dependencies. Users must install all
  required @vytches/ddd-\* packages.

This aligns with industry standards (TanStack Query, Zod) where meta-packages
are thin re-export layers, not fat bundles.

- refactor: build refactored

- chore: publish releases

* @vytches/ddd-acl@0.3.12
* @vytches/ddd-aggregates@0.3.12
* @vytches/ddd-cli@0.4.12
* @vytches/ddd-contracts@0.4.12
* @vytches/ddd-core@0.3.12
* @vytches/ddd-cqrs@0.3.12
* @vytches/ddd-di@0.3.12
* @vytches/ddd-domain-primitives@0.3.12
* @vytches/ddd-domain-services@0.3.12
* @vytches/ddd@0.4.0
* @vytches/ddd-event-scheduling@0.3.12
* @vytches/ddd-event-store@0.3.12
* @vytches/ddd-events@0.3.12
* @vytches/ddd-logging@0.3.12
* @vytches/ddd-messaging@0.3.12
* @vytches/ddd-policies@0.4.12
* @vytches/ddd-projections@0.3.12
* @vytches/ddd-repositories@0.3.12
* @vytches/ddd-resilience@0.3.12
* @vytches/ddd-testing@0.3.10
* @vytches/ddd-utils@0.3.10
* @vytches/ddd-validation@0.3.12
* @vytches/ddd-value-objects@0.3.12

- refactor: build refactored

- refactor: build refactored

- refactor: build refactored

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# 0.26.0 (2026-05-17)

### Bug Fixes

- **messaging:** repair broken declaration file caused by JSDoc inline block
  comments (`/* ... */`) terminating JSDoc blocks early, causing
  `TS1160: Unterminated template literal` in consumers
  ([#fix-messaging-dts](https://github.com/vytches/ddd/commit/d9638a04))
- **build:** remove deprecated Enhanced Metadata System V2 (YAML JSDoc
  injection) from build pipeline — was the root cause of the `/* ... */`
  injection into `.d.ts` files

### Features

- **aggregates:** add `Entity<TId>` abstract base class — canonical non-root
  domain entity with identity-based equality (Evans/Vernon shape), sibling to
  `AggregateRoot`
- **domain-services:** add `PlainDomainService` abstract class —
  infrastructure-free service base with only `serviceId`, for lightweight domain
  services
- **contracts:** add `IDomainFactory<TAgg, TProps>` and `IAsyncDomainFactory` —
  factory pattern contracts returning `Result<TAgg, Error>`, sibling to
  `IRepository`
- **contracts:** add `IBatchRepository<T>` — N+1 prevention contract, extends
  `IExtendedRepository` with order-preserving `findByIds()` (null for misses)
- **validation:** add `MemoizedSpecification<T>` — per-candidate WeakMap cache
  for repeated `isSatisfiedBy` calls, with `invalidate()` for manual eviction
- **aggregates:** `AggregateRoot.apply()` performance refactor — unified
  one-pass enrichment, eliminates duplicate `Object.create` and double
  `sanitizeMetadata`. Single-event apply +3.9%, 100-event replay +21.7% (~3.9M
  events/s)
- **nestjs:** `AutoDiscoveryService` cold-start optimization — single-pass
  `Reflect.getMetadataKeys` + WeakSet memoization, ~15-30ms savings on
  10-context deployments
- **messaging:** `OutboxProcessor` parallel dispatch documented — contract
  guarantees parallel fan-out on status success vs serial failure-first handling

### Tests

- Global library coverage: 63.98% → **69.29%** (+5.3pp). Foundation tier,
  capabilities, integration layers, DI/CQRS configuration all moved to >80%
  (VT-002..005)

### Chores

- Remove deprecated YAML JSDoc injection system (393 files, 16 scripts, CI
  steps)
- Version unification: all `@vytches/ddd-*` packages aligned via `fixed`
  changeset group

# 0.25.0-beta.2 (2026-05-09)

### Bug Fixes

- adjusted vars in workflows in release.yaml
  ([#16](https://github.com/vytches/ddd/issues/16))
  ([520361c](https://github.com/vytches/ddd/commit/520361c04bd6de675cdc25a5bb161e58d1127fe1))
- **ci:** add publish-only option to release workflow
  ([#58](https://github.com/vytches/ddd/issues/58))
  ([a9c4f61](https://github.com/vytches/ddd/commit/a9c4f619435789358ce1b5aaecc2d78389e25d9f))
- **config:** repair Nx project graph + validate:types script (REL-002)
  ([a10b878](https://github.com/vytches/ddd/commit/a10b87822392a87acf81945f86273c4d461a8f6b))
- **deps:** downgrade lerna to 7.4.2 (fixes packDirectory bug)
  ([#64](https://github.com/vytches/ddd/issues/64))
  ([46b46a2](https://github.com/vytches/ddd/commit/46b46a2ac3eed1f47d9b841572a8cc779ec7d740))
- **enterprise:** unblock verify-llm-context — move inline comments out of
  export block
  ([0bf883d](https://github.com/vytches/ddd/commit/0bf883d353d9cdd6fb6f4f6ca6d8517e2af1b2e1))
- fixing failing release ([#65](https://github.com/vytches/ddd/issues/65))
  ([f9e0cad](https://github.com/vytches/ddd/commit/f9e0cada01f603268fbe13a7b8acd1b886440f4c))
- fixing release.yaml adding no-git-checks flag
  ([#67](https://github.com/vytches/ddd/issues/67))
  ([9bf906f](https://github.com/vytches/ddd/commit/9bf906f522bee59dad02dac05a5c66b1a185032b))
- **nestjs:** implement configuration methods and reduce any type usage
  ([#42](https://github.com/vytches/ddd/issues/42))
  ([2ed336d](https://github.com/vytches/ddd/commit/2ed336d9c32b7f086fe951ab651b2c5cb9a8dcde))
- **nestjs:** resolve all linter errors and finalize package for release
  ([#46](https://github.com/vytches/ddd/issues/46))
  ([625150a](https://github.com/vytches/ddd/commit/625150af1eef1e39c8a304ab3684d4702d366cc5))
- **release:** add packages:write permission and use GITHUB_TOKEN for publishing
  ([#66](https://github.com/vytches/ddd/issues/66))
  ([68f1103](https://github.com/vytches/ddd/commit/68f1103fcf46948d5eda7df853dca0b68ff4c209))
- **release:** patch 18 transitive security vulnerabilities pre-release
  ([0d1ad03](https://github.com/vytches/ddd/commit/0d1ad03f53fadd479423d9b10bb69af37aa55ae1))
- **release:** pattern correctness bugs (REL-009)
  ([e2dd1c6](https://github.com/vytches/ddd/commit/e2dd1c6c871dcc280fffdb6d22d4d072460d3268)),
  closes [#2](https://github.com/vytches/ddd/issues/2)
  [#2](https://github.com/vytches/ddd/issues/2)
  [#3](https://github.com/vytches/ddd/issues/3)
- **release:** prevent changelog regeneration and add publish-only mode
  ([#59](https://github.com/vytches/ddd/issues/59))
  ([9b82753](https://github.com/vytches/ddd/commit/9b82753d3be0e225d722d9896845aeb874ad770c))
- **release:** resolve lint errors blocking GH Packages release
  ([3618f8c](https://github.com/vytches/ddd/commit/3618f8c4814d9837b7fe6b035c1374f143cb09c3))
- **release:** security hardening before public publish (REL-007)
  ([7c5d942](https://github.com/vytches/ddd/commit/7c5d942655b70fe7e68a9f406c9dd949d2f12d9b))
- rename variable ([#63](https://github.com/vytches/ddd/issues/63))
  ([161bda3](https://github.com/vytches/ddd/commit/161bda317346ed8ae02a4823c4b88b45950fa1dd))
- **scripts:** remove references to non-existent packages
  ([#54](https://github.com/vytches/ddd/issues/54))
  ([251c2d6](https://github.com/vytches/ddd/commit/251c2d6e8759461bbfa1644f71eb00d80f5de6c1))
- **utils:** mark @vytches/ddd-contracts as external in utils bundle
  ([faf55be](https://github.com/vytches/ddd/commit/faf55be0050e103d52d6ba011899d5c4640af0c7))

- Release/2025 08 12 1 (#33)
  ([23d7e6f](https://github.com/vytches/ddd/commit/23d7e6fbc703270da37dd81ed36f12bdec2a1648)),
  closes [#33](https://github.com/vytches/ddd/issues/33)
- Release/2025 08 11 2 (#32)
  ([c71ebd6](https://github.com/vytches/ddd/commit/c71ebd6b33ae0c211b8cbe74e57ce4e2a753c344)),
  closes [#32](https://github.com/vytches/ddd/issues/32)
- Release/2025 07 28 1 (#24)
  ([4d6f93a](https://github.com/vytches/ddd/commit/4d6f93ac80407ce7cc7106869bb12b756bc0c72c)),
  closes [#24](https://github.com/vytches/ddd/issues/24)

### Features

- add GitHub App authentication for releases
  ([#15](https://github.com/vytches/ddd/issues/15))
  ([b85df7e](https://github.com/vytches/ddd/commit/b85df7edd75ccdc8ec1588a88a340faf49136a8f))
- **aggregates:** add canonical Entity, PlainDomainService, IDomainFactory
  (VF-CANON-001)
  ([7e54320](https://github.com/vytches/ddd/commit/7e543207ad51264c3c7cb6ebac469c7f2bb65b4c))
- **release:** add ddd-lint MVP with 3 compliance rules (VF-001)
  ([8ff9a9a](https://github.com/vytches/ddd/commit/8ff9a9a23b58bbbb6835d500a8dfde51e236c8bc))
- **release:** add IBatchRepository + MemoizedSpecification (VP-002)
  ([3d06546](https://github.com/vytches/ddd/commit/3d06546eedacd0d35f29ce84bcf364f51832625c))
- **release:** consumer LLM bundle generator + fix ddd-lint test fixture
  ([7d8cf2e](https://github.com/vytches/ddd/commit/7d8cf2e0d7597eac64a4b95733204e7407350d3c))
- **release:** llm-first bundle pipeline (REL-010)
  ([0c2573d](https://github.com/vytches/ddd/commit/0c2573d767c61f76f59a0d88f8d4899efb7a821a))

### Performance Improvements

- **aggregates:** unify apply() Object.create + fast-path sanitizeMetadata
  (VP-NEW-002)
  ([5415547](https://github.com/vytches/ddd/commit/541554706f1614e759c3d14aa76261e24b53a1e3))
- **nestjs:** single-pass reflection + memoized auto-discovery (VP-006)
  ([0749bb7](https://github.com/vytches/ddd/commit/0749bb7234546d11e8e64d6a9a994a44ae81cc26))
- **release:** cleanup wildcard exports in aggregates + testing seeder (VP-005)
  ([24c300d](https://github.com/vytches/ddd/commit/24c300dd2a230fdfad8ce879ee71eff00de9eae2))
- **release:** perf baselines + 3 zero-risk quick wins (VP-NEW-001)
  ([3cb9eb3](https://github.com/vytches/ddd/commit/3cb9eb3b86015472652adcf290b6818fb3825523))

### BREAKING CHANGES

- **nestjs:** None - all changes maintain backward compatibility

- chore: publish releases

* @vytches/ddd-acl@0.11.0
* @vytches/ddd-aggregates@0.11.0
* @vytches/ddd-cli@0.12.0
* @vytches/ddd-contracts@0.13.0
* @vytches/ddd-core@0.11.0
* @vytches/ddd-cqrs@0.11.0
* @vytches/ddd-di@0.11.0
* @vytches/ddd-domain-primitives@0.11.0
* @vytches/ddd-domain-services@0.11.0
* @vytches/ddd@0.12.0
* @vytches/ddd-event-scheduling@0.11.0
* @vytches/ddd-event-store@0.11.0
* @vytches/ddd-events@0.11.0
* @vytches/ddd-logging@0.11.0
* @vytches/ddd-messaging@0.11.0
* @vytches/ddd-nestjs@2.0.0
* @vytches/ddd-policies@0.12.0
* @vytches/ddd-process-managers@0.9.0
* @vytches/ddd-projections@0.11.0
* @vytches/ddd-repositories@0.11.0
* @vytches/ddd-resilience@0.11.0
* @vytches/ddd-testing@0.11.0
* @vytches/ddd-utils@0.11.0
* @vytches/ddd-validation@0.12.0
* @vytches/ddd-value-objects@0.11.0

- Enterprise package no longer bundles dependencies. Users must install all
  required @vytches/ddd-\* packages.

This aligns with industry standards (TanStack Query, Zod) where meta-packages
are thin re-export layers, not fat bundles.

- refactor: build refactored

- refactor(contracts): unify domain event interfaces by merging metadata into
  base
- IExtendedDomainEvent interface has been removed. All domain events now use
  IDomainEvent with an optional metadata field. This eliminates 26 dangerous
  type castings and simplifies the event system architecture.

  Migration guide:

  - Replace all imports of IExtendedDomainEvent with IDomainEvent
  - Remove unnecessary type castings to IExtendedDomainEvent
  - The metadata field is now optional on IDomainEvent

  Benefits:

  - Eliminates type casting risks across the codebase
  - Simplifies event interface hierarchy
  - Improves type safety and developer experience
  - Reduces cognitive load when working with events

  Affected packages: contracts, events, aggregates, messaging, projections,
  event-scheduling, event-store, repositories, domain-services

- fix: fix merge conflict issues

- chore: publish releases

* @vytches/ddd-acl@0.6.0
* @vytches/ddd-aggregates@0.6.0
* @vytches/ddd-cli@0.7.0
* @vytches/ddd-contracts@0.8.0
* @vytches/ddd-core@0.6.0
* @vytches/ddd-cqrs@0.6.0
* @vytches/ddd-di@0.6.0
* @vytches/ddd-domain-primitives@0.6.0
* @vytches/ddd-domain-services@0.6.0
* @vytches/ddd@0.7.0
* @vytches/ddd-event-scheduling@0.6.0
* @vytches/ddd-event-store@0.6.0
* @vytches/ddd-events@0.6.0
* @vytches/ddd-logging@0.6.0
* @vytches/ddd-messaging@0.6.0
* @vytches/ddd-policies@0.7.0
* @vytches/ddd-projections@0.6.0
* @vytches/ddd-repositories@0.6.0
* @vytches/ddd-resilience@0.6.0
* @vytches/ddd-testing@0.6.0
* @vytches/ddd-utils@0.6.0
* @vytches/ddd-validation@0.7.0
* @vytches/ddd-value-objects@0.6.0

- None - maintains full API compatibility

  Or if you prefer a shorter version:

  fix(build): bundle types for meta-packages to fix package resolution

  Add bundle-meta-types step to build pipeline to generate inline type
  definitions instead of re-exports. Fixes "Cannot find module '@vytches/ddd'"
  error in published packages on GitHub Packages registry.

  - Modified build script to run bundle-meta-types after fix:dts
  - Generates 292-line index.d.ts with all types bundled inline
  - Fixes @vytches/ddd 0.6.0 package resolution issues

- chore: publish releases

* @vytches/ddd-acl@0.5.1
* @vytches/ddd-aggregates@0.5.1
* @vytches/ddd-cli@0.6.1
* @vytches/ddd-contracts@0.7.1
* @vytches/ddd-core@0.5.1
* @vytches/ddd-cqrs@0.5.1
* @vytches/ddd-di@0.5.1
* @vytches/ddd-domain-primitives@0.5.1
* @vytches/ddd-domain-services@0.5.1
* @vytches/ddd@0.6.1
* @vytches/ddd-event-scheduling@0.5.1
* @vytches/ddd-event-store@0.5.1
* @vytches/ddd-events@0.5.1
* @vytches/ddd-logging@0.5.1
* @vytches/ddd-messaging@0.5.1
* @vytches/ddd-policies@0.6.1
* @vytches/ddd-projections@0.5.1
* @vytches/ddd-repositories@0.5.1
* @vytches/ddd-resilience@0.5.1
* @vytches/ddd-testing@0.5.1
* @vytches/ddd-utils@0.5.1
* @vytches/ddd-validation@0.6.1
* @vytches/ddd-value-objects@0.5.1

- fix: folder removed
- Enterprise package no longer bundles dependencies. Users must install all
  required @vytches/ddd-\* packages.

This aligns with industry standards (TanStack Query, Zod) where meta-packages
are thin re-export layers, not fat bundles.

- refactor: build refactored

- chore: publish releases

* @vytches/ddd-acl@0.3.12
* @vytches/ddd-aggregates@0.3.12
* @vytches/ddd-cli@0.4.12
* @vytches/ddd-contracts@0.4.12
* @vytches/ddd-core@0.3.12
* @vytches/ddd-cqrs@0.3.12
* @vytches/ddd-di@0.3.12
* @vytches/ddd-domain-primitives@0.3.12
* @vytches/ddd-domain-services@0.3.12
* @vytches/ddd@0.4.0
* @vytches/ddd-event-scheduling@0.3.12
* @vytches/ddd-event-store@0.3.12
* @vytches/ddd-events@0.3.12
* @vytches/ddd-logging@0.3.12
* @vytches/ddd-messaging@0.3.12
* @vytches/ddd-policies@0.4.12
* @vytches/ddd-projections@0.3.12
* @vytches/ddd-repositories@0.3.12
* @vytches/ddd-resilience@0.3.12
* @vytches/ddd-testing@0.3.10
* @vytches/ddd-utils@0.3.10
* @vytches/ddd-validation@0.3.12
* @vytches/ddd-value-objects@0.3.12

- refactor: build refactored

- refactor: build refactored

- refactor: build refactored

# Changelog

All notable changes to `@vytches/ddd` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.25.0-beta.1] — 2026-05-09

**First public release on npmjs.org.** Prior versions (0.22.x – 0.24.x and an
internal "3.0" milestone) shipped on GitHub Packages — they remain available
there but are not maintained going forward.

### 🚨 Breaking changes

- **`EnhancedCommandBus` resilience defaults are now opt-in** (REL-009).
  Previously circuit breaker and retry activated unless explicitly disabled
  (`enabled !== false`). Now both require `enabled: true`. Retrying domain
  commands silently caused potential duplicate-execution bugs (orders created
  twice, double charges). Timeout strategy remains default-on as it does not
  affect idempotency. Migration:

  ```ts
  // Before:
  new EnhancedCommandBus(container); // retry was on
  // After (if you actually want retry):
  new EnhancedCommandBus(container, {
    resilience: { retry: { enabled: true, maxAttempts: 3 } },
  });
  ```

- **`IAggregateSnapshot.aggregateId` is now `string`** (was `unknown`, REL-009).
  Implementation already produced strings; type just made consumers cast. A
  divergent dead-duplicate of the interface was removed from
  `packages/aggregates/src/aggregate-interfaces.ts` — the canonical definition
  lives in `@vytches/ddd-contracts`.

- **`Result<T, E>` has moved to `@vytches/ddd-contracts`** (REL-008). Existing
  `import { Result } from '@vytches/ddd-utils'` continues to work via a
  re-export shim. New code should import from `@vytches/ddd-contracts` directly.

- **`@internal` symbols removed from the curated public surface** (REL-005):
  `EVENT_HANDLER_METADATA`, `EVENT_HANDLER_OPTIONS`, `CUSTOM_MIDDLEWARE_SYMBOL`
  are no longer re-exported by the `@vytches/ddd` meta-package. They remain
  accessible via direct sub-package imports (`@vytches/ddd-contracts`,
  `@vytches/ddd-events`) for framework integrations only.

### ⚠️ Deprecations (will be removed in 1.0.0)

- **`EntityIdFactory`** and all its static methods (`createWithRandomUUID`,
  `fromUUID`, `fromInteger`, `fromBigInt`, `fromText`) now emit a one-time
  runtime `console.warn` per call site. Migrate to `EntityId.create()` /
  `EntityId.fromUUID()` etc. directly. Hard removal targeted for `v1.0.0` after
  community feedback (REL-005).

### 🐛 Bug fixes

- **`BaseRepository.save()` now calls `aggregate.commit()`** after dispatch
  (REL-009). Previously the same events would re-dispatch on every subsequent
  `save()`. Silent because most code paths call `save()` once per command.
- **`OrPolicyComposer` now aggregates all sub-violations** instead of returning
  only the first (REL-009). Failure result includes `details.violations[]` with
  `policyId`, `code`, `message`, `field` per failed branch.
- **`CommandBus.getHandlerToken` now throws `CQRSConfigurationError`** (was
  generic `Error`) for missing decorator metadata, matching `QueryBus` behavior
  (REL-009).

### 🔒 Security

- **`deserializeIntegrationEvent` utility now sanitizes** input — was raw
  `JSON.parse` with no size limit, no prototype-pollution protection, no
  recursion-depth limit (REL-007). Now uses the same `safeParseIntegrationJson`
  helper as the class-based `deserialize()`: 1 MB hard cap, 50-level depth
  limit, and `__proto__/constructor/prototype` key stripping.
- **`sanitizeIntegrationPayload` is now bounded** at 50 levels of recursion
  (REL-007). Previously unbounded — adversarial payloads could cause stack
  overflow.
- **1 MB size cap is enforced on actual UTF-8 byte length** (REL-007), not
  UTF-16 code-unit count. Previously a string of 1M code units could contain up
  to 4 MB of multi-byte content.
- **`AggregateRoot.maxEvents` advisory limit** (optional, default undefined for
  backward compat) — guards against runaway loops or malicious replay (REL-007).
- **AI SDK peer dependencies removed** from `@vytches/ddd-testing`
  (`@anthropic-ai/sdk`, `openai`) — they were declared but never imported in
  source. Removes spurious npm install warnings (REL-007).
- **`validation.rules.pattern` JSDoc** now warns explicitly against ReDoS via
  consumer-controlled RegExp construction (REL-007).
- **`.env.development` removed from git tracking** (REL-007). History audited —
  file was always 0 bytes, no secrets ever committed.

### ⚡ Performance

Three zero-risk runtime optimizations (no API changes, VP-NEW-001):

- **`BaseEventBus.publish()` early shortcircuit** — skips middleware pipeline
  entirely when no handlers are registered.
- **`CQRSDiscoveryPlugin.scanModule()` memoized** via WeakMap — repeat scans of
  the same module reference are O(1).
- **`EnhancedQueryBus.getCacheKey()` uses FNV-1a 32-bit hash** instead of
  `JSON.stringify(query)` — ~5-10× faster on the cache lookup hot path.

Baselines published in `benchmarks/baseline.json` (Node 22, dev hardware): 1.58M
`apply()`/sec, 8.35M `EntityId.create()`/sec, 15.7M `isValidUUID()`/sec.

### 📚 Documentation

- **README rewritten** from 1362 lines to 199 lines (REL-006). Removed
  references to non-existent packages (`@vytches/ddd-event-store`,
  `@vytches/ddd-core`, `@vytches/ddd-cli`) and to the deprecated CLI. Added
  explicit "Design Decisions" section explaining no-sagas / no-adapters /
  dependency-free / framework-agnostic stance.
- **QUICK_START.md** cleaned (REL-006): removed `npx @vytches/ddd init-context`
  reference (CLI was deprecated), added required tsconfig flags, AI-Assisted
  Development section.
- **`LLMGUIDE.md` shipped in all 20 packages** (REL-001) — per-package
  AI-assistant onboarding documents.
- **3 example workspaces** (REL-006 / VD-002 / VD-003):
  - `examples/quickstart/` — full Order domain (16 tests)
  - `examples/policies/` — 8 policy patterns (17 tests)
  - `examples/domain-services/` — 7 service patterns (17 tests)
- **Performance benchmarks** in `benchmarks/` with committed baseline
  (`pnpm bench`).

### 🛠️ Tooling

- **LLM-first DX** (REL-010): three new scripts
  - `pnpm llm:bundle` — generate full library context for AI assistants
  - `pnpm llm:verify` — drift detector for `docs/llm-context.md`
  - `pnpm llm:guides:check` — gate ensuring every package ships `LLMGUIDE.md`.
    Added to `prerelease`.
- **20 API surface snapshot tests** added in REL-005
  (`packages/*/tests/api-surface.test.ts`) — locks public API; future changes
  require explicit `vitest -u` acceptance.
- **Test stabilization** (VT-001 subset):
  - 2 flaky timer tests fixed via `vi.useFakeTimers`
  - 5 `describe.skip` blocks converted to `describe.todo`
  - removed flaky `toBeGreaterThan(0.5ms)` assertions
- **`Nx` project graph repaired** (REL-002) — `.claude/worktrees/` exclusion +
  empty `packages/cli/` cleanup. Fixes `MultipleProjectsWithSameNameError`.
- **Foundation purity restored** (REL-008): `@vytches/ddd-contracts` has zero
  workspace dependencies. `Result<T, E>` moved here from `@vytches/ddd-utils`.

### 📦 Distribution

- Published to **public npmjs.org** (was GitHub Packages, REL-003 / REL-011).
  Old versions remain on GH Packages as legacy archive but receive no updates.
  `npm install @vytches/ddd` no longer requires a `$GITHUB_TOKEN`.
- All 20 packages aligned to `0.25.0-beta.1` (REL-004 — were 0.22.x–0.24.5 with
  `@vytches/ddd-nestjs` incorrectly at `12.1.2`).

### 🧹 Removed

- `@vytches/ddd-cli` package (already deleted by VF-013; this release cleans the
  empty skeleton + dead `cli:*`, `docs:*`, `playground*` scripts from root
  `package.json`). Replaced by AI-assisted scaffolding via `LLMGUIDE.md` files.
- 11 dead/redundant `export *` wildcards across `di`, `domain-services`,
  `aggregates`, `testing/seeder` barrels (REL-005 / VP-005). Surface tests now
  lock the public API; remaining wildcards in `enterprise` and a few sub-paths
  are protected by snapshots.

---

## [3.0.0] - 2026-01-25 (internal — pre-public)

### 🚨 BREAKING CHANGES

#### Event Property Rename: `eventType` → `eventName`

**Motivation:** Improved naming consistency and clarity across the entire event
system.

**What Changed:**

- All event interfaces (`IDomainEvent`, `IIntegrationEvent`, `IAuditEvent`) now
  use `eventName` instead of `eventType`
- All event base classes (`DomainEvent`, `IntegrationEvent`) updated to use
  `eventName`
- All internal event handling logic updated to use `eventName`

**Migration Required:** Yes - Simple search & replace in your codebase

**Migration Guide:** See [MIGRATION_GUIDE_v3.md](./MIGRATION_GUIDE_v3.md)

**Affected Packages:**

- `@vytches/ddd-contracts` - Core event interfaces
- `@vytches/ddd-events` - Event implementations and utilities
- `@vytches/ddd-aggregates` - Aggregate event handling
- `@vytches/ddd-cqrs` - Command/Query event integration
- `@vytches/ddd-messaging` - Saga event processing
- `@vytches/ddd-event-store` - Event persistence
- `@vytches/ddd-projections` - Event projections
- All other packages using events

### Changed

- **contracts**: `IDomainEvent.eventType` → `IDomainEvent.eventName`
- **events**: `DomainEvent.eventType` → `DomainEvent.eventName`
- **events**: `IntegrationEvent.eventType` → `IntegrationEvent.eventName`
- **events**: `IAuditEvent.eventType` → `IAuditEvent.eventName`
- **events**: All event handler methods updated to use `eventName`
- **events**: Event serialization now uses `eventName` field
- **events**: Base event bus methods renamed parameter from `eventType` to
  `eventName`

### Fixed

- **events**: Variable shadowing conflicts in `BaseEventBus` methods resolved
- **events**: Consistent naming across all event types (domain, integration,
  audit)

### Documentation

- **Added**: Comprehensive migration guide (MIGRATION_GUIDE_v3.md)
- **Updated**: All README files to use `eventName`
- **Updated**: All code examples to use `eventName`
- **Updated**: HOW-TO guides to use `eventName`

### Tests

- **Updated**: All test files to use `eventName`
- **Verified**: 49/49 tests passing after migration
- **Added**: Test coverage for new `eventName` property

---

## [2.x] - Previous Releases

For changes in v2.x releases, please refer to individual package CHANGELOG files
or git history.

---

## Migration Support

- **v2.x Support Period:** Until 2026-06-30
- **Migration Guide:** [MIGRATION_GUIDE_v3.md](./MIGRATION_GUIDE_v3.md)
- **Issues:** https://github.com/vytches/ddd/issues
- **Documentation:** https://docs.vytches.com/ddd
