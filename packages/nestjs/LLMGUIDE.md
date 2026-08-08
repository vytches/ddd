# @vytches/ddd-nestjs - LLM Guide

## Purpose

NestJS integration for @vytches/ddd. Provides automatic handler discovery and
registration with CQRS buses via `VytchesDDDModule`. Decorated handlers are
auto-discovered — no manual bus registration needed. ACL registrations still
belong in `onModuleInit()`.

**Auto-discovery only happens inside `VytchesDDDModule`.**
`VytchesExplorerService` is provided by `forRoot()` / `forContext()` /
`forContexts()` / `forFeature()` / `forTesting()`, and injects the buses via
`COMMAND_BUS_TOKEN` / `QUERY_BUS_TOKEN` (Symbol tokens, stable across a
dual-package ESM+CJS load). Those factories bridge your `ICommandBus` /
`IQueryBus` providers onto the Symbol tokens. An application that builds its own
module around `new EnhancedCommandBus(...)` and never imports one of them ends
up with no explorer, or an explorer with no bus — discovery succeeds, nothing
registers, and every dispatch throws `No handler registered for ...`. See
"Manual wiring" in README.md for the aliases to add if you cannot use the
factories yet.

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

| Export                              | Kind      | Purpose                                                                                                                                                                                                                                          |
| ----------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `VytchesDDDModule`                  | class     | Static module with `forRoot()`, `forContext()`, `forTesting()`                                                                                                                                                                                   |
| `VytchesExplorerService`            | class     | Auto-discovers decorated handlers in `onApplicationBootstrap`                                                                                                                                                                                    |
| `NestJSContainerAdapter`            | class     | Bridge between NestJS DI and VytchesDDD container                                                                                                                                                                                                |
| `ACLAdapterFor`                     | decorator | Marks ACL adapter for auto-discovery (since 0.24.0)                                                                                                                                                                                              |
| `ACL_REGISTRY`                      | token     | Injection token for ACLRegistry                                                                                                                                                                                                                  |
| `VytchesDDDFeatureModule`           | class     | Static module with `forFeature(contextName)` — isolated `ICommandBus`/`IQueryBus`/`LOCAL_EVENT_BUS` per bounded context; see [Feature-Scoped Bounded Context](#feature-scoped-bounded-context-with-forfeature-global-buses--local-event-routing) |
| `ContextAwareEventDispatcher`       | class     | Routes `IntegrationEvent` → global `IEventBus`, other domain events → `LOCAL_EVENT_BUS`; provide in a `forFeature()` module (since 0.28.0)                                                                                                       |
| `LOCAL_EVENT_BUS`                   | token     | Injection token for the per-context event bus; provided by `forFeature()`, injected via `@Inject(LOCAL_EVENT_BUS)`                                                                                                                               |
| `GLOBAL_QUERY_BUS`                  | token     | Injection token resolving to the root `IQueryBus`, bypassing any `forFeature()` shadowing — for cross-context ACL services                                                                                                                       |
| `GLOBAL_COMMAND_BUS`                | token     | Injection token resolving to the root `ICommandBus`, bypassing any `forFeature()` shadowing — for cross-context ACL services                                                                                                                     |
| `OutboxProcessorModule`             | class     | Static module with `forRootAsync()` — wires one or more `OutboxProcessorService` instances from DI-resolved repository/handler tokens                                                                                                            |
| `OutboxProcessorService`            | class     | NestJS lifecycle wrapper around `OutboxProcessor` (starts/stops on module init/destroy); created internally by `OutboxProcessorModule.forRootAsync()`, not instantiated directly                                                                 |
| `ACLAdapterMetadata`                | type      | Metadata shape stored by `@ACLAdapterFor` (see row above)                                                                                                                                                                                        |
| `HandlerInfo`                       | type      | Return type of `VytchesExplorerService.discoverHandlers()` / `getHandlers()`                                                                                                                                                                     |
| `VytchesDDDModuleOptions`           | type      | Options parameter for `VytchesDDDModule.forRoot()` / `forContext()` / `forTesting()`                                                                                                                                                             |
| `OutboxProcessorEntry`              | type      | One processor config entry in `OutboxProcessorModuleAsyncOptions.processors`                                                                                                                                                                     |
| `OutboxProcessorModuleAsyncOptions` | type      | Options parameter for `OutboxProcessorModule.forRootAsync()`                                                                                                                                                                                     |

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

### Feature-Scoped Bounded Context with `forFeature()` (Global Buses + Local Event Routing)

`VytchesDDDModule.forFeature(contextName)` creates an isolated `ICommandBus` /
`IQueryBus` / `LOCAL_EVENT_BUS` for one bounded-context module and exports them
plus `ContextAwareEventDispatcher`. Combine `ContextAwareEventDispatcher` to
route domain events locally and integration events globally, and
`GLOBAL_QUERY_BUS` / `GLOBAL_COMMAND_BUS` when an ACL service in this context
must reach the **root** buses instead of the feature-scoped ones that
`forFeature()` shadows `ICommandBus`/`IQueryBus` with.

```typescript
import { Module, Injectable, Inject, OnModuleInit } from '@nestjs/common';
import {
  VytchesDDDModule,
  ContextAwareEventDispatcher,
  GLOBAL_QUERY_BUS,
  GLOBAL_COMMAND_BUS,
  ACL_REGISTRY,
} from '@vytches/ddd-nestjs';
import type { IQueryBus, ICommandBus } from '@vytches/ddd-cqrs';
import type { ACLRegistry } from '@vytches/ddd-acl';

// Repository dispatches domain events to the *local* bus, integration events globally
@Injectable()
class OrderRepository {
  constructor(private readonly dispatcher: ContextAwareEventDispatcher) {}

  async save(order: Order): Promise<void> {
    await this.db.save(order);
    await this.dispatcher.dispatchEventsForAggregate(order);
    // DomainEvents      → LOCAL_EVENT_BUS (this context only)
    // IntegrationEvents → IEventBus       (global, outbox-compatible)
  }
}

// ACL service in this context must query the ROOT bus, not the feature-scoped
// one forFeature() shadows ICommandBus/IQueryBus with for this module
@Injectable()
class OrdersAclService implements OnModuleInit {
  constructor(
    @Inject(GLOBAL_QUERY_BUS) private readonly rootQuery: IQueryBus,
    @Inject(GLOBAL_COMMAND_BUS) private readonly rootCommand: ICommandBus,
    @Inject(ACL_REGISTRY) private readonly aclRegistry: ACLRegistry
  ) {}

  onModuleInit(): void {
    this.aclRegistry.registerGlobal('orders', this);
  }
}

@Module({
  imports: [VytchesDDDModule.forFeature('orders')],
  providers: [
    CreateOrderHandler,
    GetOrderQueryHandler,
    OrderRepository,
    OrdersAclService,
  ],
})
export class OrdersModule {}
```

`forFeature('orders')` exports `ICommandBus`, `IQueryBus`, `LOCAL_EVENT_BUS`,
and `ContextAwareEventDispatcher` — all scoped to this module only.
`GLOBAL_QUERY_BUS` / `GLOBAL_COMMAND_BUS` are provided separately by
`VytchesDDDModule.forRoot()` at the application root and always resolve to the
root buses, regardless of any `forFeature()` shadowing in the importing module.

### Outbox Processor Module

```typescript
import { OutboxProcessorModule } from '@vytches/ddd-nestjs';

@Module({
  imports: [
    OutboxProcessorModule.forRootAsync({
      processors: [
        {
          repositoryToken: OUTBOX_REPOSITORY,
          options: { batchSize: 200, adaptiveRepoll: true },
        },
        {
          repositoryToken: OUTBOX_REPOSITORY,
          options: { messageTypes: ['GdprAuditChainAppend'], batchSize: 50 },
          handlerToken: GDPR_OUTBOX_HANDLERS,
          processorToken: GDPR_OUTBOX_PROCESSOR,
        },
      ],
    }),
  ],
})
export class AppModule {}
```

Each entry in `processors` yields its own `OutboxProcessorService` instance
(started on `onModuleInit`, stopped on `onModuleDestroy`) — run a broad
processor alongside specialized ones, e.g. a GDPR-only processor filtered via
`options.messageTypes`. `OutboxProcessorService` is a thin lifecycle wrapper; it
is not registered as a provider directly, only created internally by
`forRootAsync()`'s per-entry factory.

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

**Deep-importing another package's internals instead of its public barrel.**
Enforced by `ddd-005` in `@vytches/ddd-lint` (grep `tools/ddd-lint` for the
rule) — reaching past a package's `index.ts` into its `src/` or `dist/`
internals, or via a relative path that escapes into another package's directory
tree, turns an internal implementation detail into a de facto public API
contract and breaks the acyclic package-boundary guarantee.

```typescript
// WRONG: deep subpath import bypasses the public barrel
import { InternalHelper } from '@vytches/ddd-contracts/src/internal/helper';

// WRONG: relative import escapes this package into another one
import { InternalHelper } from '../../../contracts/src/internal/helper';

// CORRECT: import from the package's public barrel
import { ExportedThing } from '@vytches/ddd-contracts';
```

**Keeping a dead parallel implementation of a responsibility another class
already owns.** This is a judgment-call anti-pattern — no static tool in this
repo enforces it today (see VF-034 for a proposed knip/ts-prune-based check for
this class of issue). Concrete historical example (VB-003):
`auto-discovery.service.ts` was a stub whose `discover()` unconditionally
returned `[]`, duplicating the real auto-discovery responsibility that
`VytchesExplorerService` already owned and correctly implemented. It was dead
code masquerading as a working alternative — not wired up, never exercised, but
present and readable enough to look like a legitimate second option. It was
removed entirely in VB-003. When two classes appear to solve the same problem,
prefer deleting the non-functional one over leaving it "just in case" — a stub
that silently does nothing is more dangerous than no implementation at all,
because it can be picked up by mistake.

## Discovery Timing

```
NestJS lifecycle order:
  1. onModuleInit()         — All modules init (ACL registration happens here)
  2. onApplicationBootstrap() — VytchesExplorerService discovers + registers handlers
```

Handlers must be in `providers` of their module to be injectable and
discoverable. They are auto-registered with the appropriate bus (command, query,
event) based on their decorator.

## Known Caveats

### ERR_UNSUPPORTED_DIR_IMPORT / vite-node resolver in Vitest

**Symptom:** Tests fail with `ERR_UNSUPPORTED_DIR_IMPORT` or
`Cannot find module '@nestjs/core/injector/...'` when running Vitest with
`pool: 'forks'` or `pool: 'threads'`.

**Root cause:** `@nestjs/core` has no `exports` field, so Node.js native ESM
falls back to CJS-style `LOAD_AS_FILE` resolution (auto-appends `.js`). Vitest
uses vite-node as its module resolver, which applies a stricter ESM resolution
algorithm that does **not** perform this fallback. The library code is correct
for native Node.js ESM — the mismatch is in vite-node.

**Workaround (consumer side):** Add a resolve alias in your Vitest integration
config to force the CJS build of this package:

```typescript
// vitest-integration.config.ts
import { resolve } from 'path';

export default {
  resolve: {
    alias: [
      {
        find: '@vytches/ddd-nestjs',
        replacement: resolve(
          __dirname,
          'node_modules/@vytches/ddd-nestjs/dist/index.cjs'
        ),
      },
    ],
  },
};
```

The CJS build uses `require()` which handles directory resolution correctly.
This alias is only needed for the Vitest test environment — production runtime
(native Node.js ESM) works without it.

## Package Dependencies

**Peer dependencies:** `@nestjs/common ^10`, `@nestjs/core ^10`, `rxjs ^7`,
`reflect-metadata`.

**Library dependencies:** `@vytches/ddd-contracts`, `@vytches/ddd-cqrs`,
`@vytches/ddd-events`, `@vytches/ddd-di`, `@vytches/ddd-logging`.
