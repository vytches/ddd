# @vytches/ddd-repositories

[![npm version](https://badge.fury.io/js/%40vytches%2Fddd-repositories.svg)](https://badge.fury.io/js/%40vytches%2Fddd-repositories)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Repository pattern base classes and interfaces for aggregate persistence**

## Installation

```bash
pnpm add @vytches/ddd-repositories
```

## What's included

### Base repository

| Export                 | Kind           | Description                                                                                                                                                                      |
| ---------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `IBaseRepository`      | abstract class | Abstract base — extend this for your concrete repositories. Handles event persistence via `IEnhancedEventDispatcher` and `IEventPersistenceHandler`. Provides `save(aggregate)`. |
| `VersionError`         | class          | Thrown on optimistic concurrency conflicts; use `VersionError.withEntityIdAndVersions(id, dbVersion, newVersion)`                                                                |
| `IRepositoryAggregate` | interface      | Shape required by `IBaseRepository.save()` — must have `getId()`, `getInitialVersion()`, `getDomainEvents()`                                                                     |

### Repository interfaces (from `@vytches/ddd-contracts`)

| Export                   | Kind      | Description                                 |
| ------------------------ | --------- | ------------------------------------------- |
| `IRepository<T>`         | interface | Standard CRUD contract                      |
| `IExtendedRepository<T>` | interface | `IRepository` plus additional query methods |
| `IRepositoryProvider`    | interface | Factory/registry for repositories           |

### Unit of Work

| Export        | Kind      | Description                                                         |
| ------------- | --------- | ------------------------------------------------------------------- |
| `IUnitOfWork` | interface | Transaction boundary contract — `begin()`, `commit()`, `rollback()` |

## Quick start

```typescript
import { IBaseRepository, VersionError } from '@vytches/ddd-repositories';
import type {
  IEnhancedEventDispatcher,
  IEventPersistenceHandler,
} from '@vytches/ddd-contracts';

class OrderRepository extends IBaseRepository {
  constructor(
    dispatcher: IEnhancedEventDispatcher,
    persistenceHandler: IEventPersistenceHandler,
    private readonly db: Database
  ) {
    super(dispatcher, persistenceHandler);
  }

  async findById(id: string): Promise<Order | null> {
    const row = await this.db.orders.findById(id);
    if (!row) return null;
    return Order.reconstitute(row);
  }

  // save() is inherited — it persists domain events automatically
}
```

## Optimistic concurrency

`IBaseRepository.save()` calls `aggregate.getInitialVersion()` to detect stale
writes. If the stored version differs from the aggregate's initial version, a
`VersionError` is thrown:

```typescript
try {
  await orderRepository.save(order);
} catch (err) {
  if (err instanceof VersionError) {
    // Another process modified the aggregate — reload and retry
  }
  throw err;
}
```

## Unit of Work

Use `IUnitOfWork` to coordinate multiple repository operations in a single
transaction:

```typescript
import type { IUnitOfWork } from '@vytches/ddd-repositories';

class PlaceOrderService {
  constructor(
    private readonly uow: IUnitOfWork,
    private readonly orderRepo: OrderRepository,
    private readonly inventoryRepo: InventoryRepository,
  ) {}

  async placeOrder(data: PlaceOrderData): Promise<void> {
    await this.uow.begin();
    try {
      await this.orderRepo.save(Order.create(data));
      await this.inventoryRepo.reserve(data.items);
      await this.uow.commit();
    } catch {
      await this.uow.rollback();
      throw;
    }
  }
}
```

## Package boundaries

`@vytches/ddd-repositories` depends on:

- `@vytches/ddd-contracts` — `IEnhancedEventDispatcher`,
  `IEventPersistenceHandler`, `EntityId`, aggregate interfaces
- `@vytches/ddd-domain-primitives` — `DomainErrorCode`, `IDomainError`
- `@vytches/ddd-logging` — internal logging
- `@vytches/ddd-utils` — `Result`

## License

MIT
