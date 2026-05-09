# @vytches/ddd-domain-services - LLM Guide

## Purpose

Base classes and decorators for **domain services** — operations that naturally
span multiple aggregates and don't belong inside any single one. Async variant
for I/O-bound services, event-aware variant for services that emit, and
unit-of-work-aware variant for transactional coordination.

Domain services live in the domain layer but may be wired through DI; the
`@DomainService()` decorator marks them for auto-discovery.

## Quick Start

```typescript
import {
  AsyncDomainService,
  DomainService,
} from '@vytches/ddd-domain-services';

// 1. Implement a domain service
@DomainService('PricingService')
export class PricingService extends AsyncDomainService {
  async calculateDiscount(order: Order, customer: Customer): Promise<number> {
    if (customer.isLoyal && order.itemCount > 5) {
      return order.subtotal * 0.1;
    }
    return 0;
  }
}

// 2. Use from a command handler
class PlaceOrderHandler {
  constructor(private readonly pricing: PricingService) {}

  async handle(cmd: PlaceOrderCommand): Promise<void> {
    const discount = await this.pricing.calculateDiscount(order, customer);
    order.applyDiscount(discount);
    // ...
  }
}
```

## Key API

| Export                                    | Kind           | Description                                                                                                                                  |
| ----------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `PlainDomainService`                      | abstract class | **Bare baseline** (VF-CANON-001) — only `serviceId`, no logger, no event bus, no UoW. Use for stateless operations without DI infrastructure |
| `IBaseDomainService`                      | abstract class | Infrastructure-aware base (logger + serviceId)                                                                                               |
| `AsyncDomainService`                      | abstract class | Base for services with async lifecycle (`initialize`/`dispose`)                                                                              |
| `EventAwareDomainService`                 | abstract class | Adds protected `publish(event)` for emitting domain events                                                                                   |
| `UnitOfWorkAwareDomainService`            | abstract class | Adds protected `executeInTransaction(fn)` for atomic ops                                                                                     |
| `DomainService(nameOrOpts)`               | decorator      | Marks a class for DI auto-discovery                                                                                                          |
| `getDomainServiceMetadata(target)`        | function       | Read decorator metadata                                                                                                                      |
| `getDIDomainServiceMetadata(target)`      | function       | Read DI-specific metadata for auto-registration                                                                                              |
| `isDomainServicePendingDIRegistration(t)` | function       | Check if class is registered but not yet wired                                                                                               |
| `IDomainService`                          | interface      | Sync domain service contract                                                                                                                 |
| `IAsyncDomainService`                     | interface      | Async domain service contract                                                                                                                |
| `IEventBusAware`                          | interface      | Marks services that publish events                                                                                                           |
| `IUnitOfWorkAware`                        | interface      | Marks services that coordinate transactions                                                                                                  |

## Patterns

### Event-emitting domain service

```typescript
import {
  EventAwareDomainService,
  DomainService,
} from '@vytches/ddd-domain-services';

@DomainService('FraudDetectionService')
export class FraudDetectionService extends EventAwareDomainService {
  async assess(order: Order): Promise<FraudScore> {
    const score = await this.computeScore(order);
    if (score > 0.8) {
      await this.publish(new FraudSuspectedEvent({ orderId: order.id, score }));
    }
    return score;
  }
}
```

### Transactional coordination across aggregates

```typescript
import {
  UnitOfWorkAwareDomainService,
  DomainService,
} from '@vytches/ddd-domain-services';

@DomainService('TransferService')
export class TransferService extends UnitOfWorkAwareDomainService {
  async transfer(fromId: string, toId: string, amount: number): Promise<void> {
    await this.withUnitOfWork(async uow => {
      const from = await uow.repos.accounts.findById(fromId);
      const to = await uow.repos.accounts.findById(toId);
      from.debit(amount);
      to.credit(amount);
      await uow.repos.accounts.save(from);
      await uow.repos.accounts.save(to);
    });
  }
}
```

## Anti-Patterns

- **Do not put logic in a domain service that belongs to one aggregate** — if
  `calculateTotal()` only needs `Order` data, it belongs **inside** `Order`, not
  in a service. Service is for cross-aggregate operations only.
- **Do not let a domain service hold mutable state** — services are stateless.
  State lives in aggregates and value objects.
- **Do not skip the `@DomainService()` decorator** if you rely on auto-discovery
  — without it the DI system cannot find the service.
- **Do not reach into the DI container from inside a service** — declare
  dependencies as constructor parameters; let DI inject them.
