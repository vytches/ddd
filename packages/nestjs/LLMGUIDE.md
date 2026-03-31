# @vytches/ddd-nestjs - LLM Guide

## Purpose

NestJS integration for @vytches/ddd. Provides automatic handler discovery and
registration with CQRS buses. Import `VytchesDDDModule.forRoot()` and decorated
handlers are auto-registered — zero manual `onModuleInit()` boilerplate.

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
    CreateOrderHandler, // Auto-discovered via @CommandHandler decorator
    GetOrderHandler, // Auto-discovered via @QueryHandler decorator
    OrderPlacedHandler, // Auto-discovered via @EventHandler decorator
  ],
})
export class OrderModule {}
```

Handlers are auto-discovered and registered with buses on module init. No manual
`onModuleInit()` registration needed.

## Key API

| Export                   | Kind  | Purpose                                                        |
| ------------------------ | ----- | -------------------------------------------------------------- |
| `VytchesDDDModule`       | class | Static module with `forRoot()`, `forContext()`, `forTesting()` |
| `VytchesExplorerService` | class | Auto-discovers decorated handlers on module init               |
| `NestJSContainerAdapter` | class | Bridge between NestJS DI and VytchesDDD container              |

## Module Configuration Methods

| Method                                      | Use Case                                      |
| ------------------------------------------- | --------------------------------------------- |
| `forRoot()`                                 | Basic setup — global auto-discovery           |
| `forContext('orders')`                      | Single bounded context with isolated handlers |
| `forContexts({ orders: {}, payments: {} })` | Multiple bounded contexts                     |
| `forRootAsync({ useFactory })`              | Async config (e.g., from ConfigService)       |
| `forTesting()`                              | Mock buses for unit tests                     |

## Patterns

### Auto-Discovery (Preferred — Zero Boilerplate)

```typescript
// 1. Decorate handlers (in @vytches/ddd-cqrs and @vytches/ddd-events)
@CommandHandler(CreateOrderCommand)
@Injectable()
class CreateOrderHandler implements ICommandHandler<CreateOrderCommand> {
  async execute(command: CreateOrderCommand): Promise<Result<void>> { ... }
}

@EventHandler('OrderPlaced')
@Injectable()
class OrderPlacedHandler implements IEventHandler<OrderPlaced> {
  async handle(event: OrderPlaced): Promise<void> { ... }
}

// 2. Add to module providers — that's it!
@Module({
  imports: [VytchesDDDModule.forRoot()],
  providers: [CreateOrderHandler, OrderPlacedHandler],
})
export class OrderModule {}
// VytchesExplorerService auto-discovers and registers with buses
```

### Bounded Context Isolation

```typescript
@Module({
  imports: [VytchesDDDModule.forContext('payments')],
  providers: [ProcessPaymentHandler, RefundHandler],
})
export class PaymentsModule {}

// Only handlers in this module are registered for 'payments' context
```

### Testing with Mock Buses

```typescript
const module = await Test.createTestingModule({
  imports: [VytchesDDDModule.forTesting()],
  providers: [CreateOrderHandler],
}).compile();

// Mock ICommandBus, IQueryBus, IEventBus auto-provided
```

## Anti-Patterns

**Manually registering handlers in `onModuleInit()`.** This was required before
auto-discovery existed. With `VytchesDDDModule.forRoot()`, handlers decorated
with `@CommandHandler`, `@QueryHandler`, `@EventHandler` are registered
automatically. Remove manual registration code.

```typescript
// WRONG: Legacy manual registration (remove this)
async onModuleInit() {
  this.commandBus.register(CreateOrderCommand, this.createOrderHandler);
  this.queryBus.register(GetOrderQuery, this.getOrderHandler);
  // ... 100+ lines of manual registration
}

// CORRECT: Just add to providers, auto-discovered
@Module({
  imports: [VytchesDDDModule.forRoot()],
  providers: [CreateOrderHandler, GetOrderHandler],
})
export class OrderModule {} // zero onModuleInit
```

**Forgetting `@Injectable()` on handlers.** NestJS requires `@Injectable()`
alongside `@CommandHandler`/`@EventHandler` for DI to work.

**Creating separate `VytchesDDDModule.forRoot()` per bounded context.** Use
`forContext('name')` instead — it provides handler isolation without multiple
global modules.

**Not providing bus instances.** `VytchesDDDModule` does not create bus
instances. You must provide `ICommandBus`, `IQueryBus`, `IEventBus` in your
module or a parent module.

## Hidden Features

`VytchesDDDModule.forTesting()` provides pre-configured mock buses that accept
all operations without side effects — ideal for isolated handler tests.

`VytchesExplorerService` checks both class-level and method-level
`@EventHandler` decorators. Method-level handlers are bound to the instance
automatically.

`forContext()` creates a context-specific `VytchesExplorerService` instance that
only registers handlers matching that context name.

## Package Dependencies

**Peer dependencies:** `@nestjs/common ^10`, `@nestjs/core ^10`, `rxjs ^7`,
`reflect-metadata`.

**Library dependencies:** `@vytches/ddd-contracts`, `@vytches/ddd-cqrs`,
`@vytches/ddd-events`, `@vytches/ddd-di`, `@vytches/ddd-logging`.
