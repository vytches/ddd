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

| Export                                    | Kind           | Description                                                                                                                                                                                                                                                                                   |
| ----------------------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PlainDomainService`                      | abstract class | **Bare baseline** (VF-CANON-001) — only `serviceId`, no logger, no event bus, no UoW. Use for stateless operations without DI infrastructure                                                                                                                                                  |
| `IBaseDomainService`                      | abstract class | Infrastructure-aware base (logger + serviceId)                                                                                                                                                                                                                                                |
| `AsyncDomainService`                      | abstract class | Base for services with async lifecycle (`initialize`/`dispose`)                                                                                                                                                                                                                               |
| `EventAwareDomainService`                 | abstract class | Adds protected `publish(event)` for emitting domain events                                                                                                                                                                                                                                    |
| `UnitOfWorkAwareDomainService`            | abstract class | Adds protected `executeInTransaction(fn)` for atomic ops                                                                                                                                                                                                                                      |
| `DomainService(nameOrOpts)`               | decorator      | Marks a class for DI auto-discovery                                                                                                                                                                                                                                                           |
| `getDomainServiceMetadata(target)`        | function       | Read decorator metadata                                                                                                                                                                                                                                                                       |
| `getDIDomainServiceMetadata(target)`      | function       | Read DI-specific metadata for auto-registration                                                                                                                                                                                                                                               |
| `isDomainServicePendingDIRegistration(t)` | function       | Check if class is registered but not yet wired                                                                                                                                                                                                                                                |
| `DomainServiceOptions`                    | interface      | Options accepted by `@DomainService()` — `serviceId` (required) plus optional `dependencies`, `transactional`, `async`, `publishesEvents`, `caching`; also the return type of `getDomainServiceMetadata()`                                                                                    |
| `EnhancedDomainServiceOptions`            | interface      | `DomainServiceOptions` extended with DI-registration fields (`lifetime`, `context`, `autoRegister`, `dependencies`, `tags`, `contextResolver`, `fallbackToGlobal`) — pass this shape to `@DomainService()` (instead of a plain string/`DomainServiceOptions`) to trigger DI auto-registration |
| `DIServiceMetadata`                       | interface      | `EnhancedDomainServiceOptions` plus `serviceType`, `isRegistered`, `createdAt` — the return type of `getDIDomainServiceMetadata()`                                                                                                                                                            |
| `IDomainService`                          | interface      | Sync domain service contract                                                                                                                                                                                                                                                                  |
| `IAsyncDomainService`                     | interface      | Async domain service contract                                                                                                                                                                                                                                                                 |
| `IEventBusAware`                          | interface      | Marks services that publish events                                                                                                                                                                                                                                                            |
| `IUnitOfWorkAware`                        | interface      | Marks services that coordinate transactions                                                                                                                                                                                                                                                   |
| `ServiceNotFoundError`                    | error class    | `ServiceNotFoundError.withServiceId(id)` — thrown when a service lookup by id fails (`DomainErrorCode.NotFound`)                                                                                                                                                                              |
| `ServiceDuplicateError`                   | error class    | `ServiceDuplicateError.withServiceId(id)` — thrown when a service with that id is already registered (`DomainErrorCode.DuplicateEntry`)                                                                                                                                                       |
| `ServiceCircularError`                    | error class    | `ServiceCircularError.withServices([...ids])` — thrown when a circular dependency is detected among the listed service ids                                                                                                                                                                    |

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

### DI auto-registered, transactional, event-publishing service

Combine `@DomainService()` + `EnhancedDomainServiceOptions` (DI
auto-registration) with `UnitOfWorkAwareDomainService` (which is transitively
`IEventBusAware` + `IUnitOfWorkAware`, since
`UnitOfWorkAwareDomainService extends EventAwareDomainService`). The decorator's
DI-specific fields (`lifetime`, `context`, `autoRegister`, `tags`, ...) are
picked up because the options object contains at least one of `lifetime` /
`context` / `autoRegister` / `tags` — that's what makes `DomainService()` build
`DIServiceMetadata` instead of the plain legacy `DomainServiceOptions`:

```typescript
import {
  DomainService,
  UnitOfWorkAwareDomainService,
  getDIDomainServiceMetadata,
} from '@vytches/ddd-domain-services';
import type { EnhancedDomainServiceOptions } from '@vytches/ddd-domain-services';
import { ServiceLifetime } from '@vytches/ddd-di';

const transferServiceOptions: EnhancedDomainServiceOptions = {
  serviceId: 'TransferService',
  lifetime: ServiceLifetime.Singleton,
  context: 'banking',
  autoRegister: true,
  dependencies: [],
  tags: ['financial', 'transactional'],
  transactional: true,
  async: false,
  publishesEvents: true,
  caching: { enabled: false },
};

@DomainService(transferServiceOptions)
export class TransferService extends UnitOfWorkAwareDomainService {
  async transfer(fromId: string, toId: string, amount: number): Promise<void> {
    // executeInTransaction (from UnitOfWorkAwareDomainService) requires
    // setUnitOfWork() to have been called first. The `@DomainService()`
    // decorator only *records* the `transactional: true` / `lifetime` /
    // `context` metadata (readable via getDIDomainServiceMetadata below) —
    // it does not itself call setUnitOfWork(). Bootstrap/container wiring
    // that consumes this metadata is responsible for calling
    // `instance.setUnitOfWork(uow)` before the service is used.
    await this.executeInTransaction(async () => {
      const accounts = this.getRepository<AccountRepository>('accounts');
      const from = await accounts.findById(fromId);
      const to = await accounts.findById(toId);
      from.debit(amount);
      to.credit(amount);
      await accounts.save(from);
      await accounts.save(to);

      // publishEvent (inherited from EventAwareDomainService) uses the event
      // bus that setUnitOfWork() set from uow.getEventBus() (setUnitOfWork
      // always assigns `this.eventBus = unitOfWork.getEventBus()` as a
      // side effect) — no separate setEventBus() call is needed here.
      this.publishEvent(new FundsTransferredEvent({ fromId, toId, amount }));
    });
  }
}

// Bootstrap/container-integration code reads the DI metadata back out of
// reflect-metadata to know how to register and wire the service — this
// package stores the metadata (and mirrors it into
// DIDomainServiceMetadataRegistry) but ships no container that acts on it.
const metadata = getDIDomainServiceMetadata(TransferService);
// metadata?.lifetime === ServiceLifetime.Singleton
// metadata?.context === 'banking'
// metadata?.transactional === true

// Manual wiring, since nothing auto-calls setUnitOfWork():
const service = new TransferService(transferServiceOptions.serviceId);
service.setUnitOfWork(unitOfWork); // sets eventBus too, from unitOfWork.getEventBus()
await service.transfer('acc-1', 'acc-2', 100);
```

### Handling registry errors (`ServiceNotFoundError` / `ServiceDuplicateError` / `ServiceCircularError`)

These are `IDomainError` subclasses (so plain `Error`s under the hood) built via
factory methods — `withServiceId(id)` for not-found/duplicate,
`withServices([...ids])` for circular dependency chains. A DI/service-locator
integration built on top of this package throws them from
registration/lookup/resolution paths; callers branch on `instanceof`:

```typescript
import {
  ServiceCircularError,
  ServiceDuplicateError,
  ServiceNotFoundError,
} from '@vytches/ddd-domain-services';

class InMemoryDomainServiceRegistry {
  private readonly services = new Map<string, unknown>();
  private readonly resolving = new Set<string>();

  register(serviceId: string, instance: unknown): void {
    if (this.services.has(serviceId)) {
      throw ServiceDuplicateError.withServiceId(serviceId);
    }
    this.services.set(serviceId, instance);
  }

  resolve<T>(serviceId: string, chain: string[] = []): T {
    if (this.resolving.has(serviceId)) {
      throw ServiceCircularError.withServices([...chain, serviceId]);
    }
    const instance = this.services.get(serviceId);
    if (!instance) {
      throw ServiceNotFoundError.withServiceId(serviceId);
    }
    return instance as T;
  }
}

// Caller branches on the concrete error type:
try {
  registry.register('PricingService', pricingService);
  const pricing = registry.resolve<PricingService>('PricingService');
} catch (error) {
  if (error instanceof ServiceDuplicateError) {
    // idempotent bootstrap: log and reuse the existing registration
  } else if (error instanceof ServiceCircularError) {
    // fatal wiring bug — surface immediately, don't retry
    throw error;
  } else if (error instanceof ServiceNotFoundError) {
    // missing registration — fail the request, don't silently continue
    throw error;
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
