# @vytches/ddd-contracts - LLM Guide

## Purpose

Foundation package that defines all shared interfaces and contracts for the DDD
library. Every other package depends on this — it has zero dependencies itself.

## Quick Start

```typescript
import type {
  IDomainEvent,
  IEventMetadata,
  IRepository,
  ISpecification,
  IEntityId,
} from '@vytches/ddd-contracts';
import {
  EntityId,
  IEventBus,
  Capability,
  CapabilityRegistry,
} from '@vytches/ddd-contracts';

// Create a typed entity ID
const orderId: IEntityId<string> = new EntityId('abc-123', 'text');

// Define a domain event
interface OrderPlacedPayload {
  amount: number;
  customerId: string;
}
const event: IDomainEvent<OrderPlacedPayload> = {
  eventName: 'OrderPlaced',
  payload: { amount: 100, customerId: 'c-1' },
  metadata: { correlationId: 'req-1' },
};
```

## Key API

| Export                   | Kind           | Description                                                                                   |
| ------------------------ | -------------- | --------------------------------------------------------------------------------------------- |
| `IDomainEvent<P>`        | interface      | Base contract for all domain events; has `eventName`, `payload?`, `metadata?`                 |
| `IEventMetadata`         | interface      | Tracing fields: `eventId`, `correlationId`, `causationId`, `aggregateId`, `aggregateVersion`  |
| `IEventBus<TEvent>`      | abstract class | Publish/subscribe contract; `publish`, `subscribe`, `registerHandler`, `publishMany`          |
| `IEntityId<T>`           | interface      | Typed aggregate identifier; `getValue()`, `equals()`, `toString()`, `isType()`                |
| `EntityId<T>`            | class          | Base implementation of `IEntityId`; constructor takes `(value, type)`                         |
| `IEntityIdFactory`       | interface      | Factory contract: `createWithRandomUUID`, `fromUUID`, `fromInteger`, `fromBigInt`, `fromText` |
| `IdType`                 | type           | `'uuid' \| 'integer' \| 'text' \| 'bigint'`                                                   |
| `IRepository<T>`         | interface      | Base persistence contract: `save`, `findById?`, `delete?`                                     |
| `IExtendedRepository<T>` | interface      | Adds `exists`, `findBySpecification?`, `findOneBySpecification?`                              |
| `IUnitOfWork`            | interface      | Transaction management: `begin`, `commit`, `rollback`, `getRepository`, `getEventBus`         |
| `ISpecification<T>`      | interface      | Domain rule: `isSatisfiedBy`, `and`, `or`, `not`, `explainFailure?`                           |
| `IAsyncSpecification<T>` | interface      | Async version with `isSatisfiedByAsync` and context parameter                                 |
| `Capability`             | class          | Base for all aggregate capabilities                                                           |
| `CapabilityRegistry`     | class          | Manages capability instances keyed by constructor                                             |
| `IAggregateCapability`   | interface      | Marks a class as an aggregate-attachable capability                                           |

## Patterns

### Implementing a repository

```typescript
import type {
  IExtendedRepository,
  IRepositoryEntity,
} from '@vytches/ddd-contracts';

interface Order extends IRepositoryEntity {
  getId(): string;
}

class InMemoryOrderRepository implements IExtendedRepository<Order> {
  private store = new Map<string, Order>();

  async save(entity: Order): Promise<void> {
    this.store.set(entity.getId() as string, entity);
  }

  async exists(id: unknown): Promise<boolean> {
    return this.store.has(id as string);
  }
}
```

### Implementing a specification

```typescript
import type { ISpecification } from '@vytches/ddd-contracts';

class ActiveOrderSpec implements ISpecification<Order> {
  isSatisfiedBy(candidate: Order): boolean {
    return candidate.status === 'active';
  }
  and(other: ISpecification<Order>): ISpecification<Order> {
    return {
      isSatisfiedBy: c => this.isSatisfiedBy(c) && other.isSatisfiedBy(c),
      and: () => {
        throw new Error();
      },
      or: () => {
        throw new Error();
      },
      not: () => {
        throw new Error();
      },
    };
  }
  or(other: ISpecification<Order>): ISpecification<Order> {
    /* ... */ return this;
  }
  not(): ISpecification<Order> {
    /* ... */ return this;
  }
}
```

### Using IEventBus with generics

```typescript
import { IEventBus } from '@vytches/ddd-contracts';
import type { IDomainEvent } from '@vytches/ddd-contracts';

// IEventBus is an abstract class used as both type and DI token
class MyEventBus extends IEventBus<IDomainEvent> {
  async publish(event: IDomainEvent): Promise<void> {
    /* ... */
  }
  subscribe<T extends IDomainEvent>(
    eventType: string | (new (...args: any[]) => T),
    handler: (event: T) => Promise<void> | void
  ): void {
    /* ... */
  }
  registerHandler<T extends IDomainEvent>(
    eventType: string | (new (...args: any[]) => T),
    handler: { handle(event: T): Promise<void> | void }
  ): void {
    /* ... */
  }
  unsubscribe(
    eventType: string | (new (...args: any[]) => IDomainEvent),
    handler: any
  ): void {
    /* ... */
  }
  async publishMany(events: IDomainEvent[]): Promise<void> {
    /* ... */
  }
}
```

## Anti-Patterns

**Using `any` instead of generic parameters.** Every interface is generic.
`IDomainEvent` without a type parameter loses payload type safety. Always
specify: `IDomainEvent<MyPayload>`.

**Importing concrete implementations from contracts.** The only concrete class
in contracts is `EntityId` (base) and `CapabilityRegistry`. Do not try to
instantiate `IEventBus` directly — it is abstract. Use implementations from
`@vytches/ddd-events`.

**Implementing `IRepository` without `IRepositoryEntity`.** The `T` constraint
requires `getId(): unknown`. Forgetting this causes a type error that is
difficult to trace.

**Confusing `IRepository` with `ICQRSRepository`.** `IRepository` is for
write-side aggregates. `ICQRSRepository` combines `IQueryRepository` and
`IWriteRepository` for CQRS read/write separation. Do not use `ICQRSRepository`
as the default repository type for aggregates.

**Using `new EntityId(value, type)` without understanding `IdType`.** The base
`EntityId` in contracts does not validate the value — that is done by the
extended `EntityId` in `@vytches/ddd-value-objects`. Always use the
value-objects package's `EntityId` in application code.

## Hidden Features

`IEventMetadata` has an open index signature (`[key: string]: unknown`) — you
can attach arbitrary application-specific data to any event without casting.

`ISpecification<T>` declares `explainFailure?(candidate: T): string | null` —
implement this to get human-readable validation messages from domain rules
without throwing.

`IUnitOfWork.getRepository<T>()` is generic and returns a typed repository,
enabling type-safe multi-aggregate transactions without casting.

`BaseEventBusOptions` (exported from contracts) contains an `onError` callback —
wire this to your structured logger to capture event processing failures without
crashing the bus.

## Package Dependencies

**Depends on:** nothing (zero dependencies — this is the foundation).

**Depended on by:** every package in the monorepo (`@vytches/ddd-aggregates`,
`@vytches/ddd-events`, `@vytches/ddd-cqrs`, `@vytches/ddd-value-objects`,
`@vytches/ddd-domain-primitives`, etc.).
