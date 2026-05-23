# @vytches/ddd-nestjs - LLM Guide

## Purpose

NestJS integration for @vytches/ddd. Provides automatic handler discovery and
registration with CQRS buses via `VytchesDDDModule`. Decorated handlers are
auto-discovered — no manual bus registration needed. ACL registrations still
belong in `onModuleInit()`.

## Quick Start

```typescript
import { Module } from '@nestjs/common';
import { VytchesDDDModule } from '@vytches/ddd-nestjs';
import {
  EnhancedCommandBus,
  EnhancedQueryBus,
  ICommandBus,
  IQueryBus,
} from '@vytches/ddd-cqrs';
import { IEventBus } from '@vytches/ddd-contracts';
import { UnifiedEventBus } from '@vytches/ddd-events';

@Module({
  imports: [VytchesDDDModule.forRoot()],
  providers: [
    { provide: ICommandBus, useValue: new EnhancedCommandBus() },
    { provide: IQueryBus, useValue: new EnhancedQueryBus() },
    { provide: IEventBus, useValue: new UnifiedEventBus() },
    CreateOrderHandler, // @CommandHandler(CreateOrderCommand)
    GetOrderHandler, // @QueryHandler(GetOrderQuery)
    OrdersAuditHandler, // methods annotated with @EventHandler(EventClass)
  ],
})
export class AppModule {}
```

`VytchesExplorerService` discovers handlers during `onApplicationBootstrap`
(after all `onModuleInit()` hooks have run).

## Key API

| Export                   | Kind      | Purpose                                                        |
| ------------------------ | --------- | -------------------------------------------------------------- |
| `VytchesDDDModule`       | class     | Static module with `forRoot()`, `forContext()`, `forTesting()` |
| `VytchesExplorerService` | class     | Auto-discovers decorated handlers in `onApplicationBootstrap`  |
| `NestJSContainerAdapter` | class     | Bridge between NestJS DI and VytchesDDD container              |
| `ACLAdapterFor`          | decorator | Marks ACL adapter for auto-discovery (since 0.24.0)            |
| `ACL_REGISTRY`           | token     | Injection token for ACLRegistry                                |

## Module Configuration Methods

| Method                                      | Use Case                                      |
| ------------------------------------------- | --------------------------------------------- |
| `forRoot()`                                 | Basic setup — global auto-discovery           |
| `forContext('orders')`                      | Single bounded context with isolated handlers |
| `forContexts({ orders: {}, payments: {} })` | Multiple bounded contexts                     |
| `forRootAsync({ useFactory })`              | Async config (e.g., from ConfigService)       |
| `forTesting()`                              | Mock buses for unit tests                     |

## Patterns

### Command Handler

```typescript
import { Injectable, Inject } from '@nestjs/common';
import { CommandHandler } from '@vytches/ddd-cqrs';
import type { ICommandHandler } from '@vytches/ddd-cqrs';
import { Result } from '@vytches/ddd-utils';

@Injectable()
@CommandHandler(CreateOrderCommand)
export class CreateOrderHandler
  implements ICommandHandler<CreateOrderCommand, Result<string, Error>>
{
  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orders: IOrderRepository
  ) {}

  async execute(command: CreateOrderCommand): Promise<Result<string, Error>> {
    const result = Order.create(command.customerId);
    if (result.isFailure) return Result.fail(result.error);
    await this.orders.save(result.value);
    return Result.ok(result.value.id.toString());
  }
}
```

### Query Handler

`IQuery<TResult>` requires the result type — **mandatory type parameter**.

```typescript
// query definition
export class GetOrderQuery implements IQuery<OrderDto> {
  constructor(public readonly orderId: string) {}
}

// handler
@Injectable()
@QueryHandler(GetOrderQuery)
export class GetOrderHandler
  implements IQueryHandler<GetOrderQuery, Result<OrderDto, Error>>
{
  async execute(query: GetOrderQuery): Promise<Result<OrderDto, Error>> {
    const dto = await this.db.orders.findById(query.orderId);
    if (!dto) return Result.fail(new Error('Order not found'));
    return Result.ok(dto);
  }
}
```

### Event Handler — method decorator, one class handles multiple events

`@EventHandler` is a **method decorator**, not a class decorator. One class can
handle many events. Pass the event **class** (not a string).

```typescript
import { Injectable } from '@nestjs/common';
import { EventHandler } from '@vytches/ddd-events';
import { OrderCreated, ItemAdded } from '../domain/order.events';

@Injectable()
export class OrdersAuditHandler {
  @EventHandler(OrderCreated)
  async onOrderCreated(event: OrderCreated): Promise<void> {
    // audit log, projections
  }

  @EventHandler(ItemAdded)
  async onItemAdded(event: ItemAdded): Promise<void> {
    // ...
  }
}
```

### Bounded Context Module with ACL Registration

ACL registration belongs in `onModuleInit()` — buses are not yet ready in
`onModuleInit()`, but DI container is fully resolved.

```typescript
import { Module, OnModuleInit, Inject } from '@nestjs/common';
import { ACL_REGISTRY } from '@vytches/ddd-nestjs';
import type { ACLRegistry } from '@vytches/ddd-acl';

@Module({
  providers: [
    CreateOrderHandler,
    GetOrderHandler,
    OrdersAuditHandler,
    { provide: ORDER_REPOSITORY, useClass: OrderKyselyRepository },
    OrdersContextApi,
  ],
})
export class OrdersModule implements OnModuleInit {
  constructor(
    @Inject(ACL_REGISTRY) private readonly aclRegistry: ACLRegistry,
    @Inject(OrdersContextApi) private readonly ordersApi: OrdersContextApi
  ) {}

  onModuleInit(): void {
    this.aclRegistry.registerGlobal(
      'orders',
      this.ordersApi,
      'Orders context public API'
    );
  }
}
```

### Cross-Context Calls via ACL

```typescript
@Injectable()
@QueryHandler(GetOrderQuery)
export class GetOrderHandler ... {
  constructor(
    @Inject(ORDER_QUERY_REPOSITORY) private readonly db: IOrderQueryRepository,
    @Inject(ACL_REGISTRY)           private readonly aclRegistry: ACLRegistry,
  ) {}

  async execute(query: GetOrderQuery): Promise<Result<OrderDto, Error>> {
    // Call another bounded context — no direct import
    const paymentsApi = this.aclRegistry.getGlobalRequired<IPaymentsApi>('payments');
    const status = await paymentsApi.getStatusForOrder(query.orderId);
    const dto = await this.db.findById(query.orderId);
    if (!dto) return Result.fail(new Error('Order not found'));
    return Result.ok({ ...dto, paymentStatus: status });
  }
}
```

### Global DDD Module (full wiring)

```typescript
import { Global, Module, OnApplicationBootstrap, Inject } from '@nestjs/common';
import {
  VytchesDDDModule,
  VytchesExplorerService,
  NestJSContainerAdapter,
} from '@vytches/ddd-nestjs';
import {
  EnhancedCommandBus,
  EnhancedQueryBus,
  ICommandBus,
  IQueryBus,
} from '@vytches/ddd-cqrs';
import { UnifiedEventBus } from '@vytches/ddd-events';
import { IEventBus } from '@vytches/ddd-contracts';
import { SimpleContainer } from '@vytches/ddd-di';

const container = new SimpleContainer();

@Global()
@Module({
  imports: [VytchesDDDModule.forRoot()],
  providers: [
    {
      provide: ICommandBus,
      useValue: new EnhancedCommandBus(new NestJSContainerAdapter(container)),
    },
    {
      provide: IQueryBus,
      useValue: new EnhancedQueryBus(new NestJSContainerAdapter(container)),
    },
    { provide: IEventBus, useClass: UnifiedEventBus },
  ],
  exports: [VytchesExplorerService, ICommandBus, IQueryBus, IEventBus],
})
export class DDDModule implements OnApplicationBootstrap {
  constructor(
    @Inject(VytchesExplorerService)
    private readonly explorer: VytchesExplorerService
  ) {}

  // Runs AFTER all onModuleInit() hooks — all providers guaranteed available
  async onApplicationBootstrap(): Promise<void> {
    const handlers = await this.explorer.discoverHandlers();
    for (const handler of handlers) {
      await this.explorer.registerHandler(handler);
    }
  }
}
```

### Bounded Context Isolation

```typescript
@Module({
  imports: [VytchesDDDModule.forContext('payments')],
  providers: [ProcessPaymentHandler, RefundHandler],
})
export class PaymentsModule {}
// Only handlers in this module are registered for the 'payments' context
```

### Testing with Mock Buses

```typescript
const module = await Test.createTestingModule({
  imports: [VytchesDDDModule.forTesting()],
  providers: [
    CreateOrderHandler,
    { provide: ORDER_REPOSITORY, useValue: { save: jest.fn() } },
  ],
}).compile();

const handler = module.get(CreateOrderHandler);
const result = await handler.execute(new CreateOrderCommand('c-1'));
expect(result.isSuccess).toBe(true);
```

## Anti-Patterns

**Using a string in `@EventHandler`.** The decorator accepts an event **class**,
not a string event name.

```typescript
// WRONG: string reference
@EventHandler('OrderPlaced')
async onOrderPlaced(event: OrderPlaced): Promise<void> { ... }

// CORRECT: class reference
@EventHandler(OrderPlaced)
async onOrderPlaced(event: OrderPlaced): Promise<void> { ... }
```

**Applying `@EventHandler` at class level.** It is a method decorator only.

```typescript
// WRONG: class-level
@EventHandler(OrderPlaced)
@Injectable()
class OrderPlacedHandler { ... }

// CORRECT: method-level, one class for multiple events
@Injectable()
class OrdersAuditHandler {
  @EventHandler(OrderPlaced)
  async onOrderPlaced(event: OrderPlaced): Promise<void> { ... }
}
```

**Manually registering handlers with buses in `onModuleInit()`.** Handler
registration with command/query buses is handled by `VytchesExplorerService` in
`onApplicationBootstrap()`. Do not duplicate this.

```typescript
// WRONG: manual bus registration
async onModuleInit() {
  this.commandBus.register(CreateOrderCommand, this.createOrderHandler);
}

// CORRECT: just list handler in providers — auto-discovered
@Module({ providers: [CreateOrderHandler] })
export class OrdersModule {}
```

**Removing `onModuleInit()` from bounded context modules entirely.** ACL
registration must still happen in `onModuleInit()`.

```typescript
// WRONG: skipping ACL registration
export class OrdersModule {} // nothing — ACL context unreachable

// CORRECT: register ACL in onModuleInit, handler registration is automatic
export class OrdersModule implements OnModuleInit {
  onModuleInit(): void {
    this.aclRegistry.registerGlobal('orders', this.ordersApi);
  }
}
```

**Forgetting `@Injectable()` on handlers.** NestJS requires `@Injectable()`
alongside `@CommandHandler`/`@QueryHandler` for DI to work.

**Creating separate `VytchesDDDModule.forRoot()` per bounded context.** Use
`forContext('name')` instead — it provides handler isolation without multiple
global modules.

**Not providing bus instances.** `VytchesDDDModule` does not create bus
instances. You must provide `ICommandBus`, `IQueryBus`, `IEventBus`.

**Omitting the type parameter from `IQuery<TResult>`.** Every query class must
declare its result type.

```typescript
// WRONG: missing type param
class GetOrderQuery implements IQuery { ... }

// CORRECT: result type is mandatory
class GetOrderQuery implements IQuery<OrderDto> { ... }
```

## Discovery Timing

```
NestJS lifecycle order:
  1. onModuleInit()         — All modules init (ACL registration happens here)
  2. onApplicationBootstrap() — VytchesExplorerService discovers + registers handlers
```

Handlers must be in `providers` of their module to be injectable and
discoverable. They are auto-registered with the appropriate bus (command, query,
event) based on their decorator.

## Package Dependencies

**Peer dependencies:** `@nestjs/common ^10`, `@nestjs/core ^10`, `rxjs ^7`,
`reflect-metadata`.

**Library dependencies:** `@vytches/ddd-contracts`, `@vytches/ddd-cqrs`,
`@vytches/ddd-events`, `@vytches/ddd-di`, `@vytches/ddd-logging`.
