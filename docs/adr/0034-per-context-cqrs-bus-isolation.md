# ADR-0034. Per-context CQRS Bus Isolation via forFeature()

Date: 2026-05-23

## Status

2026-05-23 proposed

## Context

### Discovered Production Bug

A project with multiple bounded contexts using `@vytches/ddd-cqrs` suffered a
critical bug: commands from one bounded context were routed to handlers from a
different bounded context. The bug caused data to be written to the wrong
resource with no exception thrown — the handler completed "successfully" but
operated on incorrect data.

**Bug mechanism:** `CommandBus` registers handlers under the key
`commandType.constructor.name` (string) in a single global `Map`. When multiple
bounded contexts define classes with identical names (e.g.
`UpdateUserReadModelCommand`), each new registration silently overwrites the
previous one. The winning handler is whichever loaded last during NestJS
bootstrap. The result is non-deterministic and depends on module import order.

**Real-world example:**

Five bounded contexts each defined an identically named command class. When
context `catalog` sent a command containing its domain-specific fields, the bus
routed it to context `inventory`'s handler, which was unaware of those fields.
Context `inventory`'s handler wrote `updateInput = {}` — it updated the
`inventory` table with an empty field set, leaving `catalog`'s data as `NULL`.
The bug only surfaced when those `NULL` values were actually consumed, long
after the initiating event.

**Scale of the problem:** In a typical application with 10+ bounded contexts,
many "thematic" command names (`CreateUserReadModelCommand`,
`UpdateStatusCommand`, `DeleteCommand`) appear independently in every context —
a natural consequence of applying Ubiquitous Language per context. Prohibiting
duplicate names would force a shared language across contexts, which is a DDD
anti-pattern.

### Root Cause in the Library Architecture

The current design assumes a single global `CommandBus` and `QueryBus` for the
entire application. `VytchesExplorerService` (package `@vytches/ddd-nestjs`)
discovers handlers from all NestJS modules and registers them into those same
global bus instances. Bounded contexts have no dedicated registration namespace.

This approach is convenient for small single-context applications but violates
the bounded-context autonomy principle described by Evans and Vernon: each
context should own its application layer and command handling, independent of
other contexts.

### Existing Isolation for Events

The library already handles event separation correctly: `DomainEvent` and
`IntegrationEvent` are distinct base classes (`packages/events/`). `CommandBus`
and `QueryBus` had no equivalent isolation mechanism.

---

## Decision

### 1. Fix the Map Key in CommandBus and QueryBus

Change the internal `Map` key from `string` (class name) to `Function`
(constructor reference). Classes from different bounded contexts may share
identical names but are always distinct objects in memory.

```typescript
// BEFORE: collision when two contexts have a class with the same name
private handlers = new Map<string, handler>();
this.handlers.set(commandType.name, handler);  // "UpdateUserReadModelCommand"

// AFTER: class reference — object-unique, no collision
private handlers = new Map<Function | string, handler>();
this.handlers.set(commandType, handler);  // Function ref — always unique
```

String key retained as a fallback for backward-compatible string-based
registration (`bus.register('MyCommand', handler)`).

### 2. `scope` Option in Handler Decorators

Add an optional `scope?: 'context' | 'global'` field to `CommandHandlerOptions`,
`QueryHandlerOptions`, and `EventHandlerOptions`. Default: `'context'`.

- `scope: 'context'` → handler registered in the isolated bus of its bounded
  context
- `scope: 'global'` → handler registered in the global bus (previous behavior)

### 3. `VytchesDDDModule.forFeature(contextName)` — Per-Bounded-Context Isolation

A new module method provides isolated bus instances scoped to the NestJS module:

```typescript
@Module({
  imports: [VytchesDDDModule.forFeature('orders')],
  providers: [CreateOrderHandler, GetOrderQueryHandler],
})
export class OrdersModule {}
```

Each `forFeature()` creates:

- `ICommandBus` — new instance, scoped to this module
- `IQueryBus` — new instance, scoped to this module
- `LOCAL_EVENT_BUS` — new `EventBus` instance, scoped to this module

### 4. Auto-Discovery via `FeatureHandlerRegistrar` (No Explicit List Required)

A new internal service `FeatureHandlerRegistrar` injects `ModulesContainer` from
`@nestjs/core` and in `onModuleInit()` locates its own module via a unique
Symbol token. It iterates only that module's providers — no full-app scan, no
try/catch loops.

It notifies `VytchesExplorerService` of the message types "claimed" by this
context.

### 5. Global Fallback — Unbroken Backward Compatibility

`VytchesExplorerService.onApplicationBootstrap()` (after all `onModuleInit()`):

- Skips message types reported by `FeatureHandlerRegistrar`
- Registers the rest in the global bus

Modules without `forFeature()` behave identically to before the change.
Migration is incremental — `forFeature()` can be added context by context
without regression risk.

### 6. EventBus — Routing via instanceof, Not Flags

`IEventDispatcher` (NestJS adapter) routes by base class type:

```typescript
if (event instanceof IntegrationEvent) {
  await this.integrationEventBus.publish(event); // cross-context, outbox
} else {
  await this.localEventBus.publish(event); // per-context, sync
}
```

The alternative of `static scope = 'global'` on event classes was rejected —
such a field injects infrastructure knowledge (routing) into the domain model,
violating layer isolation. The library already has `DomainEvent` /
`IntegrationEvent` as semantically correct distinct types — we leverage that.

---

## Considered Alternatives

### A. Require Globally Unique Command Class Names

**Rejected.** Enforcing name uniqueness across contexts means imposing a shared
Ubiquitous Language, which is a fundamental violation of the bounded-context
principle (Evans, Chapter 14). `UpdateUserReadModelCommand` has a different
semantic meaning in each context and should be able to exist independently.

### B. Context Prefix in Class Name as Convention

**Rejected as a library solution.** The convention
`OrdersUpdateUserReadModelCommand` is a workaround, not a fix. The library
should provide isolation architecturally, not through naming conventions that
can be accidentally violated. The convention remains acceptable as an additional
practice but cannot be the sole safeguard.

### C. Single Bus with Namespaced Keys

**Rejected.** `"orders:UpdateUserReadModelCommand"` as a key requires changing
the registration API (`bus.register('orders:...', handler)`) and is incompatible
with existing `@CommandHandler` decorators. It does not eliminate the problem
with auto-discovery.

### D. DomainEvent / IntegrationEvent Base Classes for Events (Already Exists)

**Accepted — already implemented.** The library has this split. It only required
wiring into the routing mechanism in the dispatchers.

---

## Consequences

### Positive

- **Elimination of a production bug class.** Identical command class names in
  different contexts are no longer an architectural problem.
- **Canonical DDD compliance.** Each bounded context owns its command-handling
  layer, independent of other contexts (Evans/Vernon).
- **Incremental migration.** No breaking change. Existing applications work
  without modification. `forFeature()` can be added context by context.
- **Auto-discovery works.** Consumers do not need to list handlers explicitly —
  the library detects them automatically via `ModulesContainer`.
- **Better DX on errors.** Missing `forFeature()` produces a clear startup error
  instead of silent routing to the wrong handler.

### Negative

- **One line of boilerplate per bounded context module.**
  `imports: [VytchesDDDModule.forFeature('orders')]` is required for isolation.
  Modules without this import continue to work globally (not a breaking change).
- **More bus instances in memory.** Each `forFeature()` creates separate
  `CommandBus`, `QueryBus`, `EventBus` instances. For 10 contexts = 30 instances
  instead of 3. For typical use (handlers as NestJS singletons, no intensive
  caching) the overhead is negligible. The cache in `EnhancedCommandBus` should
  be disabled for per-context instances (`enableCache: false`).
- **Dependency on `ModulesContainer` (@nestjs/core internals).**
  `FeatureHandlerRegistrar` uses `ModulesContainer` to locate its own module.
  The API is exported by `@nestjs/core` and used by official NestJS libraries
  (`@nestjs/cqrs`), but is not documented as stable. Risk assessed as low.

### Neutral

- **Version bump: minor for both packages.** All changes are additive or concern
  internal implementation. No change is breaking for existing consumers.
- **`Symbol.for()` instead of `Symbol()` for DI tokens.** Guarantees the same
  symbol across hot-reloads and in test environments with repeated module
  imports.

---

## Implications for Consumers

Consumers with an existing global setup:

**Step 1 (optional, recommended):** Add `forFeature('name')` to each bounded
context module. Handlers from that module will start using the isolated bus.

**Step 2 (if needed):** Check whether any commands/queries have name collisions.
If so — `forFeature()` isolates them without renaming the classes.

Skipping Steps 1 and 2 = behavior identical to before the change.

---

## Related Decisions

- ADR-0014: DI Integration Bridge Pattern — established the
  `IDependencyContainer` abstraction keeping CQRS framework-agnostic
- ADR-0031: NestJS Handler Auto-Discovery — original `VytchesExplorerService`
  design that this ADR extends with per-context scoping
- ADR-0007: Event System Consolidation — established `DomainEvent` /
  `IntegrationEvent` split that this ADR leverages for EventBus routing
- Task VP-007: implementation details
