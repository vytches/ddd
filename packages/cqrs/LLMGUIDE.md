# @vytches/ddd-cqrs - LLM Guide

## Purpose

Provides command/query separation with `CommandBus`, `QueryBus`, decorator-based
handler registration, middleware pipeline, and an optional
`EnhancedCommandBus`/`EnhancedQueryBus` with resilience patterns.

## Quick Start

```typescript
import {
  CommandBus,
  QueryBus,
  CommandHandler,
  QueryHandler,
  CQRSDiscoveryPlugin,
} from '@vytches/ddd-cqrs';
import type {
  ICommand,
  IQuery,
  ICommandHandler,
  IQueryHandler,
} from '@vytches/ddd-cqrs';

// 1. Define a command
class PlaceOrderCommand implements ICommand {
  constructor(
    public readonly customerId: string,
    public readonly amount: number
  ) {}
}

// 2. Implement a handler
@CommandHandler(PlaceOrderCommand)
class PlaceOrderHandler implements ICommandHandler<PlaceOrderCommand, string> {
  async execute(command: PlaceOrderCommand): Promise<string> {
    // domain logic here
    return 'order-id-123';
  }
}

// 3. Wire up the bus (using a DI container)
const bus = new CommandBus(container);
bus.register(PlaceOrderCommand, new PlaceOrderHandler());

const orderId = await bus.execute(new PlaceOrderCommand('c-1', 500));
```

## Key API

| Export                           | Kind           | Description                                                                                   |
| -------------------------------- | -------------- | --------------------------------------------------------------------------------------------- |
| `ICommand`                       | interface      | Empty marker interface; all commands implement this                                           |
| `IQuery<TResult>`                | interface      | Marker with result type parameter                                                             |
| `ICommandHandler<TCmd, TResult>` | interface      | Contract: `execute(command): Promise<TResult>`                                                |
| `IQueryHandler<TQuery, TResult>` | interface      | Contract: `execute(query): Promise<TResult>`                                                  |
| `CommandBus`                     | class          | Routes commands to registered handlers with middleware                                        |
| `QueryBus`                       | class          | Routes queries to registered handlers with middleware                                         |
| `ICommandBus`                    | abstract class | Abstract base / DI token for command bus                                                      |
| `IQueryBus`                      | abstract class | Abstract base / DI token for query bus                                                        |
| `EnhancedCommandBus`             | class          | `CommandBus` + circuit breaker, retry, timeout, bulkhead (requires `@vytches/ddd-resilience`) |
| `EnhancedQueryBus`               | class          | `QueryBus` + resilience patterns                                                              |
| `CommandHandler(CmdClass)`       | decorator      | Marks a class as a command handler and stores metadata                                        |
| `QueryHandler(QueryClass)`       | decorator      | Marks a class as a query handler and stores metadata                                          |
| `CQRSExecutionContext`           | class          | Carries command/query, handler, type, and a metadata map through middleware                   |
| `LoggingMiddleware`              | class          | Built-in middleware that logs execution time                                                  |
| `ICQRSMiddleware`                | interface      | Contract: `execute(ctx, next): Promise<void>`                                                 |
| `CQRSDiscoveryPlugin`            | class          | Auto-discovers and registers decorated handlers from a DI container                           |
| `HandlerNotFoundError`           | error          | Thrown when no handler is registered for a command/query                                      |
| `CQRSModule`                     | class          | Optional configuration entry point                                                            |

## Patterns

### Query with typed result

```typescript
import type { IQuery, IQueryHandler } from '@vytches/ddd-cqrs';
import { QueryBus, QueryHandler } from '@vytches/ddd-cqrs';

interface OrderDto {
  id: string;
  amount: number;
}

class GetOrderQuery implements IQuery<OrderDto> {
  constructor(public readonly orderId: string) {}
}

@QueryHandler(GetOrderQuery)
class GetOrderHandler implements IQueryHandler<GetOrderQuery, OrderDto> {
  async execute(query: GetOrderQuery): Promise<OrderDto> {
    return { id: query.orderId, amount: 100 };
  }
}

const bus = new QueryBus(container);
bus.register(GetOrderQuery, new GetOrderHandler());
const order = await bus.execute(new GetOrderQuery('order-1')); // typed as OrderDto
```

### Custom middleware

```typescript
import type { ICQRSMiddleware, ExecutionContext } from '@vytches/ddd-cqrs';
import { CommandBus } from '@vytches/ddd-cqrs';

class ValidationMiddleware implements ICQRSMiddleware {
  async execute(
    context: ExecutionContext,
    next: () => Promise<void>
  ): Promise<void> {
    const cmd = context.commandOrQuery;
    if ('validate' in cmd && typeof (cmd as any).validate === 'function') {
      (cmd as any).validate();
    }
    await next();
  }
}

const bus = new CommandBus(container);
bus.use(new ValidationMiddleware());
bus.use(new LoggingMiddleware());
```

### EnhancedCommandBus with resilience

```typescript
import { EnhancedCommandBus } from '@vytches/ddd-cqrs';

const bus = new EnhancedCommandBus(container, {
  resilience: {
    circuitBreaker: { enabled: true, failureThreshold: 5 },
    retry: { enabled: true, maxAttempts: 3, baseDelay: 200 },
    timeout: { enabled: true, timeoutMs: 5000 },
  },
});
```

## Anti-Patterns

**Mixing commands and queries.** A command should change state and return
minimal data (an ID at most). A query must be read-only and free of side
effects. Returning a full aggregate from a command handler, or modifying state
in a query handler, defeats the CQRS separation.

**Not returning `Promise` from handlers.** Both `ICommandHandler.execute` and
`IQueryHandler.execute` are typed as `Promise<TResult>`. Returning a synchronous
value without wrapping in a Promise breaks the middleware pipeline and error
propagation.

**Registering the same command class under multiple handlers.** `CommandBus`
uses the class name as the key. Registering a second handler silently replaces
the first. Use distinct command classes for distinct operations.

**Throwing raw `Error` instead of a domain error.** Handlers should throw typed
errors or return a `Result` type so that middleware can distinguish business
failures from infrastructure failures. Raw `Error` throws propagate as
`CommandExecutionError` wrapping the original, losing type information.

**Expecting `CQRSDiscoveryPlugin` to work without `reflect-metadata` imported.**
The decorator-based auto-discovery relies on `Reflect.defineMetadata`. Import
`reflect-metadata` once at the application entry point before any handler files
are loaded.

## Hidden Features

`CommandBus.registerFactory(CmdClass, () => handler)` registers a lazy factory
instead of an eager instance — useful for handlers that have heavyweight
dependencies and should only be instantiated on first use.

`CQRSExecutionContext.setMetadata(key, value)` / `getMetadata<T>(key)` lets
middleware pass typed data to downstream middleware without polluting the
command object itself.

`EnhancedCommandBus` supports `enableBatching` and `maxBatchSize` options to
automatically group commands into micro-batches for throughput optimization.

`CQRSModule` (from `'./configuration'`) provides a static
`configure(options: CQRSOptions)` entry point for setting global defaults that
apply to all bus instances.

## Package Dependencies

**Depends on:** `@vytches/ddd-contracts`, `@vytches/ddd-di`,
`@vytches/ddd-logging`, `@vytches/ddd-utils`;
`EnhancedCommandBus`/`EnhancedQueryBus` additionally require
`@vytches/ddd-resilience`.

**Depended on by:** `@vytches/ddd-enterprise`, `@vytches/ddd-nestjs`.
