# @vytches/ddd-domain-services

[![npm version](https://badge.fury.io/js/%40vytches%2Fddd-domain-services.svg)](https://badge.fury.io/js/%40vytches%2Fddd-domain-services)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Base classes and decorators for Domain Services**

Domain Services encapsulate business operations that don't belong naturally on a
single aggregate or value object.

## Installation

```bash
pnpm add @vytches/ddd-domain-services
```

## What's included

### Base classes

| Export                         | Kind  | Description                                                                   |
| ------------------------------ | ----- | ----------------------------------------------------------------------------- |
| `PlainDomainService`           | class | Minimal base — no logger, no DI, no event bus. For pure stateless operations. |
| `IBaseDomainService`           | class | Base with a built-in `Logger` via `Logger.forContext()`                       |
| `AsyncDomainService`           | class | `IBaseDomainService` with async lifecycle hooks                               |
| `EventAwareDomainService`      | class | `IBaseDomainService` + `setEventBus(bus)` for domain event publishing         |
| `UnitOfWorkAwareDomainService` | class | `IBaseDomainService` + `setUnitOfWork(uow)` for transactional coordination    |

### Decorator

| Export                                      | Kind      | Description                                                           |
| ------------------------------------------- | --------- | --------------------------------------------------------------------- |
| `DomainService`                             | decorator | Marks a class for DI auto-discovery; stores service metadata          |
| `getDomainServiceMetadata(cls)`             | function  | Reads metadata set by `@DomainService`                                |
| `getDIDomainServiceMetadata(cls)`           | function  | Reads DI-specific metadata                                            |
| `isDomainServicePendingDIRegistration(cls)` | function  | Returns `true` if the class has been decorated but not yet registered |

### Interfaces

| Export                         | Kind      | Description                                   |
| ------------------------------ | --------- | --------------------------------------------- |
| `IDomainService`               | interface | Core service contract (has `serviceId`)       |
| `IAsyncDomainService`          | interface | Adds `initialize()` / `dispose()`             |
| `IEventBusAware`               | interface | `setEventBus(bus)` contract                   |
| `IUnitOfWorkAware`             | interface | `setUnitOfWork(uow)` contract                 |
| `DomainServiceOptions`         | interface | Options accepted by `@DomainService`          |
| `DIServiceMetadata`            | interface | DI metadata shape                             |
| `EnhancedDomainServiceOptions` | interface | Extended options with DI lifetime and context |

### Errors

| Export                  | Kind  | Description                          |
| ----------------------- | ----- | ------------------------------------ |
| `ServiceCircularError`  | class | Circular service dependency detected |
| `ServiceDuplicateError` | class | Service registered more than once    |
| `ServiceNotFoundError`  | class | Requested service not in registry    |

## Usage

### PlainDomainService — infrastructure-free

```typescript
import { PlainDomainService } from '@vytches/ddd-domain-services';

class TaxCalculator extends PlainDomainService {
  constructor() {
    super('TaxCalculator');
  }

  calculate(amount: number, rate: number): number {
    return amount * rate;
  }
}
```

### IBaseDomainService — with logging

```typescript
import { IBaseDomainService } from '@vytches/ddd-domain-services';

class PricingService extends IBaseDomainService {
  constructor() {
    super('PricingService');
  }

  applyDiscount(price: number, pct: number): number {
    this.logger.debug('Applying discount', { price, pct });
    return price * (1 - pct / 100);
  }
}
```

### EventAwareDomainService — publish domain events

```typescript
import {
  EventAwareDomainService,
  DomainService,
} from '@vytches/ddd-domain-services';
import { DomainEvent } from '@vytches/ddd-events';

@DomainService('OrderFulfillmentService', { context: 'Orders' })
class OrderFulfillmentService extends EventAwareDomainService {
  constructor() {
    super('OrderFulfillmentService');
  }

  async fulfill(orderId: string): Promise<void> {
    // ... business logic ...
    await this.eventBus?.publish(
      new DomainEvent('OrderFulfilled', { orderId })
    );
  }
}
```

### UnitOfWorkAwareDomainService — transactional coordination

```typescript
import { UnitOfWorkAwareDomainService } from '@vytches/ddd-domain-services';

class TransferService extends UnitOfWorkAwareDomainService {
  constructor() { super('TransferService'); }

  async transfer(fromId: string, toId: string, amount: number): Promise<void> {
    await this.unitOfWork?.begin();
    try {
      // ... operations ...
      await this.unitOfWork?.commit();
    } catch {
      await this.unitOfWork?.rollback();
      throw;
    }
  }
}
```

## Package boundaries

`@vytches/ddd-domain-services` depends on:

- `@vytches/ddd-contracts` — `IEventBus`
- `@vytches/ddd-logging` — `Logger`
- `@vytches/ddd-repositories` — `IUnitOfWork`

## License

MIT
