# @vytches/ddd-aggregates

> Aggregate root implementation with event sourcing, optimistic concurrency, and
> opt-in capabilities.

[![npm version](https://badge.fury.io/js/%40vytches%2Fddd-aggregates.svg)](https://badge.fury.io/js/%40vytches%2Fddd-aggregates)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Installation

```bash
pnpm add @vytches/ddd-aggregates
```

## What's included

- **`AggregateRoot`** — base class for aggregate roots with identity,
  versioning, and domain events
- **`Entity`** — base class for non-root domain entities (identity-based
  equality, no event machinery)
- **`AggregateBuilder` / `aggregateBuilder`** — fluent builder for constructing
  aggregates with capabilities
- **Capabilities** — `AuditCapability`, `EventSourcingCapability`,
  `SnapshotCapability`, `VersioningCapability`
- **Utility functions** — type-safe capability casting and introspection
- **`AggregateError`** — error class for aggregate-specific failures

## Usage

```typescript
import { AggregateRoot } from '@vytches/ddd-aggregates';
import type { IAggregateConstructorParams } from '@vytches/ddd-aggregates';
import { EntityId } from '@vytches/ddd-contracts';

class Order extends AggregateRoot<string> {
  private customerId = '';
  private status: 'pending' | 'confirmed' = 'pending';

  constructor(params: IAggregateConstructorParams<string>) {
    super(params);
    this.registerEventHandler<{ customerId: string }>(
      'OrderCreated',
      payload => {
        this.customerId = payload!.customerId;
      }
    );
    this.registerEventHandler<void>('OrderConfirmed', () => {
      this.status = 'confirmed';
    });
  }

  static create(customerId: string): Order {
    const order = new Order({ id: EntityId.create(), version: 0 });
    order.apply('OrderCreated', { customerId });
    return order;
  }

  confirm(): void {
    if (this.status !== 'pending') throw new Error('Order is not pending');
    this.apply('OrderConfirmed', undefined);
  }

  getCustomerId(): string {
    return this.customerId;
  }
  getStatus(): string {
    return this.status;
  }
}

// Create an order
const order = Order.create('customer-123');
order.confirm();

// Domain events are collected until committed
const events = order.getDomainEvents(); // [OrderCreated, OrderConfirmed]
order.commit(); // clears collected events
```

### With capabilities

```typescript
import {
  aggregateBuilder,
  AuditCapability,
  SnapshotCapability,
} from '@vytches/ddd-aggregates';

const order = aggregateBuilder(Order)
  .withCapability(AuditCapability)
  .withCapability(SnapshotCapability)
  .build({ id: EntityId.create(), version: 0 });
```

### Utility functions

```typescript
import {
  asSnapshotAggregate,
  tryAsSnapshotAggregate,
  hasAllCapabilities,
  getAggregateCapabilities,
} from '@vytches/ddd-aggregates';
import { SnapshotCapability, AuditCapability } from '@vytches/ddd-aggregates';

// Type-safe capability access
const snapshotable = asSnapshotAggregate(order); // throws if missing
const maybeSnapshot = tryAsSnapshotAggregate(order); // returns null if missing

// Introspection
const hasAll = hasAllCapabilities(order, [SnapshotCapability, AuditCapability]);
const capabilities = getAggregateCapabilities(order);
```

### Non-root entities

```typescript
import { Entity } from '@vytches/ddd-aggregates';
import { EntityId } from '@vytches/ddd-contracts';

// Use Entity for inner aggregate objects like OrderLine, Address
class OrderLine extends Entity<string> {
  constructor(
    id: EntityId<string>,
    private sku: string,
    private quantity: number
  ) {
    super({ id });
  }
  getSku(): string {
    return this.sku;
  }
  getQuantity(): number {
    return this.quantity;
  }
}
```

## API Reference

### Core Classes

| Export               | Kind     | Description                                                                                            |
| -------------------- | -------- | ------------------------------------------------------------------------------------------------------ |
| `AggregateRoot<TId>` | class    | Base aggregate root; provides identity, versioning, event collection and event sourcing reconstitution |
| `Entity<TId>`        | class    | Base class for non-root domain entities; identity-based equality, no events                            |
| `AggregateBuilder`   | class    | Fluent builder for aggregates with capabilities                                                        |
| `aggregateBuilder`   | function | Factory function shorthand for `AggregateBuilder`                                                      |
| `AggregateError`     | class    | Error thrown for aggregate-specific failures                                                           |

### Capabilities

| Export                    | Kind  | Description                                              |
| ------------------------- | ----- | -------------------------------------------------------- |
| `AuditCapability`         | class | Records who created/modified the aggregate and when      |
| `EventSourcingCapability` | class | Enables event sourcing reconstitution from stored events |
| `SnapshotCapability`      | class | Enables taking and restoring state snapshots             |
| `VersioningCapability`    | class | Manages optimistic concurrency version tracking          |

### Capability Utilities

| Export                             | Kind     | Description                                                   |
| ---------------------------------- | -------- | ------------------------------------------------------------- |
| `asSnapshotAggregate(agg)`         | function | Cast to snapshot-capable aggregate; throws if missing         |
| `tryAsSnapshotAggregate(agg)`      | function | Cast to snapshot-capable aggregate; returns `null` if missing |
| `asVersioningAggregate(agg)`       | function | Cast to versioning-capable aggregate; throws if missing       |
| `tryAsVersioningAggregate(agg)`    | function | Returns `null` if versioning capability absent                |
| `asAuditAggregate(agg)`            | function | Cast to audit-capable aggregate; throws if missing            |
| `tryAsAuditAggregate(agg)`         | function | Returns `null` if audit capability absent                     |
| `asEventSourcingAggregate(agg)`    | function | Cast to event-sourcing aggregate; throws if missing           |
| `tryAsEventSourcingAggregate(agg)` | function | Returns `null` if event sourcing capability absent            |
| `getAggregateCapabilities(agg)`    | function | Returns all capabilities attached to an aggregate             |
| `hasAllCapabilities(agg, caps)`    | function | Returns `true` if aggregate has all listed capabilities       |

### Interfaces

| Export                             | Kind      | Description                                |
| ---------------------------------- | --------- | ------------------------------------------ |
| `IAggregateRoot`                   | interface | Full contract for aggregate roots          |
| `IAggregateCapability`             | interface | Base capability contract                   |
| `IAggregateConstructorParams<TId>` | interface | Constructor parameter shape for aggregates |
| `IAggregateEventHandler`           | interface | Event handler registration contract        |
| `IAggregateBuilder`                | interface | Builder contract                           |

### Utility Types

| Export                                 | Kind | Description                                    |
| -------------------------------------- | ---- | ---------------------------------------------- |
| `AggregateWithSnapshotCapability`      | type | Aggregate narrowed to snapshot-capable shape   |
| `AggregateWithVersioningCapability`    | type | Aggregate narrowed to versioning-capable shape |
| `AggregateWithAuditCapability`         | type | Aggregate narrowed to audit-capable shape      |
| `AggregateWithEventSourcingCapability` | type | Aggregate narrowed to event-sourcing shape     |

## Package boundaries

`@vytches/ddd-aggregates` depends on:

- `@vytches/ddd-contracts` — base interfaces and `EntityId`
- `@vytches/ddd-domain-primitives` — error types
- `@vytches/ddd-value-objects` — enhanced `EntityId`
- `@vytches/ddd-logging` — internal logging

## License

MIT
