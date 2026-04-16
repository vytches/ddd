# @vytches/ddd-repositories - LLM Guide

## Purpose

Base repository infrastructure with built-in optimistic locking, domain event
dispatching, and unit-of-work coordination. Provides `IBaseRepository` as the
abstract persistence layer that saves aggregates by persisting their domain
events.

## Quick Start

```typescript
import {
  IBaseRepository,
  VersionError,
  type IRepositoryAggregate,
} from '@vytches/ddd-repositories';
import type {
  IEnhancedEventDispatcher,
  IEventPersistenceHandler,
} from '@vytches/ddd-contracts';

// Extend IBaseRepository and implement findById
class OrderRepository extends IBaseRepository {
  constructor(
    dispatcher: IEnhancedEventDispatcher,
    persistenceHandler: IEventPersistenceHandler,
    private readonly db: Db
  ) {
    super(dispatcher, persistenceHandler);
  }

  async findById(id: string): Promise<Order | null> {
    const row = await this.db.orders.findOne({ id });
    return row ? Order.reconstitute(row) : null;
  }
}

// Save an aggregate (dispatches events, checks version)
const repo = new OrderRepository(dispatcher, handler, db);
try {
  await repo.save(order); // throws VersionError on conflict
} catch (err) {
  if (err instanceof VersionError) {
    // reload the aggregate and retry
  }
}
```

## Key API

| Export                            | Description                                                                                            |
| --------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `IBaseRepository`                 | Abstract class — extend this, implement `findById`                                                     |
| `IBaseRepository.save(aggregate)` | Persist events, dispatch them, enforce optimistic lock                                                 |
| `VersionError`                    | Thrown on version mismatch; factory: `VersionError.withEntityIdAndVersions(id, dbVersion, newVersion)` |
| `IRepositoryAggregate`            | Interface aggregates must satisfy: `getId()`, `getInitialVersion()`, `getDomainEvents()`               |
| `IRepository<T>`                  | Generic CRUD interface from `@vytches/ddd-contracts` (re-exported)                                     |
| `IExtendedRepository<T>`          | Extended CRUD interface with additional query methods (re-exported)                                    |
| `IRepositoryProvider`             | Factory interface for creating repository instances (re-exported)                                      |
| `IUnitOfWork`                     | Transaction coordination interface (re-exported from `@vytches/ddd-contracts`)                         |

## Patterns

### Pattern 1: Standard aggregate repository

```typescript
import {
  IBaseRepository,
  VersionError,
  type IRepositoryAggregate,
} from '@vytches/ddd-repositories';

class InvoiceRepository extends IBaseRepository {
  constructor(
    dispatcher: IEnhancedEventDispatcher,
    handler: IEventPersistenceHandler,
    private readonly store: InvoiceStore
  ) {
    super(dispatcher, handler);
  }

  async findById(id: string): Promise<Invoice | null> {
    const data = await this.store.get(id);
    return data ? Invoice.reconstitute(data) : null;
  }
}

// Usage in application layer
const invoice = await repo.findById(invoiceId);
if (!invoice) throw new Error('Invoice not found');

invoice.approve(); // raises InvoiceApprovedEvent internally
await repo.save(invoice); // persists event, dispatches, bumps version
```

### Pattern 2: Optimistic locking with retry

`save()` compares the aggregate's `getInitialVersion()` against the stored
version. If they differ, it throws `VersionError`. Handle conflicts by reloading
and retrying.

```typescript
async function approveWithRetry(id: string, maxAttempts = 3): Promise<void> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const invoice = await repo.findById(id);
    if (!invoice) throw new Error('Not found');

    invoice.approve();

    try {
      await repo.save(invoice);
      return;
    } catch (err) {
      if (err instanceof VersionError && attempt < maxAttempts - 1) continue;
      throw err;
    }
  }
}
```

### Pattern 3: Unit of work coordination

`IUnitOfWork` (re-exported from `@vytches/ddd-contracts`) provides a transaction
boundary across multiple repositories.

```typescript
import type { IUnitOfWork } from '@vytches/ddd-repositories';

class PlaceOrderHandler {
  constructor(
    private readonly uow: IUnitOfWork,
    private readonly orders: OrderRepository,
    private readonly inventory: InventoryRepository,
  ) {}

  async handle(cmd: PlaceOrderCommand): Promise<void> {
    await this.uow.begin();
    try {
      const order = Order.place(cmd);
      const item  = await this.inventory.findById(cmd.itemId);
      item.reserve(cmd.quantity);

      await this.orders.save(order);
      await this.inventory.save(item);
      await this.uow.commit();
    } catch {
      await this.uow.rollback();
      throw;
    }
  }
}
```

## Anti-Patterns

**Not catching `VersionError` on `save()`.** Concurrent modifications will
throw; silently ignoring the exception corrupts the event stream.

**Calling `save()` on an aggregate with no domain events.**
`IBaseRepository.save()` is a no-op when `getDomainEvents()` is empty — it logs
and returns. If your aggregate raised no events, nothing is persisted. Always
check whether the operation actually raised events.

**Querying data inside a write repository.** `IBaseRepository.findById` should
only be used to load the aggregate for mutation. For read models and
projections, use separate query-side repositories or dedicated read models.

**Passing a plain object as `IRepositoryAggregate`.** The aggregate must
implement `getId()`, `getInitialVersion()`, and `getDomainEvents()` — typically
by extending the `AggregateRoot` from `@vytches/ddd-aggregates`.

**Sharing a single `IBaseRepository` instance across unbounded contexts.** Each
bounded context should have its own repository with its own event dispatcher and
persistence handler.

## Hidden Features

**`IBaseRepository` exposes `this.logger`.** The protected `logger` field (from
`@vytches/ddd-logging`) is already wired up with the constructor name.
Subclasses can use `this.logger.debug(...)` directly without additional setup.

**`save()` skips persistence when no events are pending.** Calling `save()` on
an unchanged aggregate is safe — it returns early after logging a debug message.

**`VersionError.withEntityIdAndVersions` is a static factory.** Use it to
construct contextual version errors in custom subclass logic without reaching
into the error internals.

**`IUnitOfWork`, `IRepository`, and `IExtendedRepository` are re-exported** from
`@vytches/ddd-contracts`. Importing them from `@vytches/ddd-repositories` is the
canonical import path for consumers — this avoids them depending on
`@vytches/ddd-contracts` directly.

## Package Dependencies

`@vytches/ddd-repositories` depends on:

- `@vytches/ddd-contracts` — `IEnhancedEventDispatcher`,
  `IEventPersistenceHandler`, `IAggregateWithEvents`, `EntityId`, `IUnitOfWork`,
  `IRepository`, `IExtendedRepository`
- `@vytches/ddd-domain-primitives` — `IDomainError`, `DomainErrorCode`
- `@vytches/ddd-logging` — structured logger
- `@vytches/ddd-utils` — `Result<T, E>`

Packages that depend on `@vytches/ddd-repositories`:

- `@vytches/ddd-enterprise` — re-exports everything
- Consumer application repositories (e.g., `juz-ide-api` bounded context
  repositories)
