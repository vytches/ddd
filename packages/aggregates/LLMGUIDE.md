# @vytches/ddd-aggregates - LLM Guide

## Purpose

Provides the `AggregateRoot` base class and a capability system for composing
event sourcing, snapshots, audit logging, and versioning into aggregates without
inheritance chains.

## Quick Start

```typescript
import { AggregateRoot, AggregateBuilder } from '@vytches/ddd-aggregates';
import { EntityId } from '@vytches/ddd-value-objects';
import type { IAggregateConstructorParams } from '@vytches/ddd-aggregates';

interface OrderCreatedPayload {
  customerId: string;
  amount: number;
}

class Order extends AggregateRoot<string> {
  private customerId = '';
  private amount = 0;

  constructor(params: IAggregateConstructorParams<string>) {
    super(params);
    this.registerEventHandler<OrderCreatedPayload>('OrderCreated', payload => {
      this.customerId = payload!.customerId;
      this.amount = payload!.amount;
    });
  }

  static create(customerId: string, amount: number): Order {
    const id = EntityId.create();
    const order = new Order({ id, version: 0 });
    order.apply('OrderCreated', { customerId, amount });
    return order;
  }
}

// Usage
const order = Order.create('c-1', 500);
const events = order.getDomainEvents(); // [{ eventName: 'OrderCreated', ... }]
order.commit(); // clear pending events after saving
```

## Key API

| Export                                 | Kind           | Description                                                                                                                                               |
| -------------------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AggregateRoot<TId>`                   | class          | Base aggregate root; manages version, events, capabilities — the _transactional_ root                                                                     |
| `Entity<TId>`                          | abstract class | Base for **non-root** domain entities (VF-CANON-001) — identity-based equality, no version/event machinery. Use for `OrderLine`, inner aggregate entities |
| `AggregateBuilder<TId>`                | class          | Fluent builder for constructing aggregates with capabilities                                                                                              |
| `aggregateBuilder(params)`             | function       | Shorthand factory for `AggregateBuilder.create(params)`                                                                                                   |
| `AggregateError`                       | class          | Domain error for aggregate-level failures                                                                                                                 |
| `SnapshotCapability`                   | class          | Enables snapshot creation and restoration                                                                                                                 |
| `AuditCapability`                      | class          | Attaches an audit log to every event applied                                                                                                              |
| `VersioningCapability`                 | class          | Registers event upcasters for schema evolution                                                                                                            |
| `EventSourcingCapability`              | class          | Integrates with `IEventStore` for persistence                                                                                                             |
| `asSnapshotAggregate(agg)`             | function       | Casts aggregate, throws if no `SnapshotCapability`                                                                                                        |
| `asAuditAggregate(agg)`                | function       | Casts aggregate, throws if no `AuditCapability`                                                                                                           |
| `hasAllCapabilities(agg, [...])`       | function       | Returns `true` if aggregate has every listed capability                                                                                                   |
| `getAggregateCapabilities(agg)`        | function       | Returns string array of capability type names                                                                                                             |
| `AggregateWithSnapshotCapability<TId>` | type           | Type-safe alias for snapshot-capable aggregates                                                                                                           |
| `IAggregateRoot<TId>`                  | interface      | Full contract for aggregates                                                                                                                              |

### `AggregateRoot` method reference

| Method                                  | Description                                                               |
| --------------------------------------- | ------------------------------------------------------------------------- |
| `apply(eventType, payload?, metadata?)` | Record a domain event, increment version, call handler                    |
| `loadFromHistory(events)`               | Replay historical events to restore state without accumulating new events |
| `getDomainEvents()`                     | Return readonly array of uncommitted events since last `commit()`         |
| `commit()`                              | Clear uncommitted events; call after persisting to storage                |
| `hasChanges()`                          | `true` if there are uncommitted events                                    |
| `getVersion()`                          | Current version after all applied events                                  |
| `getInitialVersion()`                   | Version when last loaded from storage (for optimistic locking)            |
| `addCapability(cap)`                    | Attach a capability; calls `cap.attach(this)`                             |
| `getCapability(CapClass)`               | Retrieve capability by constructor, returns `undefined` if absent         |
| `hasCapability(CapClass)`               | Type-safe capability presence check                                       |
| `registerEventHandler(type, fn)`        | Protected; wire event name to state mutation function                     |

## Patterns

### Event sourcing reconstitution

```typescript
// In your repository, after loading events from the store:
const order = new Order({ id: EntityId.fromUUID(rawId), version: 0 });
order['loadFromHistory'](storedEvents); // protected; call from within the class or a static factory
// If loadFromHistory must be called externally, expose a static fromEvents():
class Order extends AggregateRoot<string> {
  static fromEvents(id: EntityId<string>, events: IDomainEvent[]): Order {
    const order = new Order({ id, version: 0 });
    order.loadFromHistory(events);
    return order;
  }
}
```

### Using the builder with capabilities

```typescript
import {
  AggregateBuilder,
  SnapshotCapability,
  AuditCapability,
} from '@vytches/ddd-aggregates';
import { EntityId } from '@vytches/ddd-value-objects';

const order = AggregateBuilder.create({ id: EntityId.create() })
  .withSnapshots()
  .withAudit()
  .build(Order);

// Now safe to cast:
import { asSnapshotAggregate } from '@vytches/ddd-aggregates';
const snapshotOrder = asSnapshotAggregate(order);
const snap = snapshotOrder
  .getCapability(SnapshotCapability)!
  .createSnapshot(() => ({ amount: order.getAmount() }));
```

### Capability type guard before use

```typescript
import {
  hasAllCapabilities,
  asAuditAggregate,
  AuditCapability,
} from '@vytches/ddd-aggregates';

if (hasAllCapabilities(order, [AuditCapability])) {
  const auditable = asAuditAggregate(order);
  const log = auditable.getCapability(AuditCapability)!.getAuditLog();
}
```

## Anti-Patterns

**Mutating state directly instead of using `apply()`.** Assigning
`this.status = 'paid'` bypasses event recording and version tracking. All state
changes must go through `apply()` so they are captured as events.

**Not registering event handlers before calling `apply()`.**
`registerEventHandler` must be called in the constructor before any `apply()`
calls. If handlers are missing, events are recorded but state is not updated —
no error is thrown.

**Forgetting to call `super(params)` in subclass constructor.** Without the
super call, `_id`, `_version`, and internal maps are never initialized.
TypeScript will not always catch this at compile time.

**Using `loadFromHistory` on a live aggregate that already has uncommitted
events.** `loadFromHistory` resets `_domainEvents` to an empty array and replays
from `_initialVersion`. Calling it after `apply()` discards pending events
silently.

**Adding capabilities after `apply()` calls.** Capabilities like
`AuditCapability` only audit events applied after they are attached. Add all
capabilities in the constructor or builder before any business methods are
called.

## Hidden Features

`apply()` accepts either a plain string event type or a full `IDomainEvent`
object — pass a class-based event instance and the prototype chain is preserved,
enabling `instanceof` checks on events after enrichment.

`getAggregateInfo(aggregate)` (from utilities) returns a single diagnostic
object with `id`, `type`, `version`, `hasChanges`, `capabilities`, and `events`
count — useful for logging without exposing internals.

`aggregateBuilder(...).buildWithAllCapabilities(MyClass)` attaches all four
built-in capabilities (snapshot, versioning, audit, event sourcing) in one call.

`_internal_setState` exists on `AggregateRoot` and is intended only for
capability implementations — never call it from domain code.

## Package Dependencies

**Depends on:** `@vytches/ddd-contracts`, `@vytches/ddd-logging`.

**Depended on by:** `@vytches/ddd-enterprise` (re-exports), consumer domain
packages.
