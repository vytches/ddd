# @vytches/ddd-cqrs

[![npm version](https://badge.fury.io/js/%40vytches%2Fddd-cqrs.svg)](https://badge.fury.io/js/%40vytches%2Fddd-cqrs)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Command Query Responsibility Segregation (CQRS) with decorator-based handler registration**

## Installation

```bash
pnpm add @vytches/ddd-cqrs
```

## What's included

### Buses — abstract tokens (use as injection tokens)

| Export | Kind | Description |
|--------|------|-------------|
| `ICommandBus` | abstract class | Injection token + interface for command buses |
| `IQueryBus` | abstract class | Injection token + interface for query buses |

### Buses — concrete implementations

| Export | Kind | Description |
|--------|------|-------------|
| `CommandBus` | class | Default command bus; resolves handlers via a `IDependencyContainer` |
| `QueryBus` | class | Default query bus |
| `EnhancedCommandBus` | class | CommandBus with middleware pipeline and resilience (requires `@vytches/ddd-resilience`) |
| `EnhancedQueryBus` | class | QueryBus with middleware pipeline and resilience |

### Decorators

| Export | Kind | Description |
|--------|------|-------------|
| `CommandHandler` | decorator | Marks a class as the handler for a specific command type |
| `QueryHandler` | decorator | Marks a class as the handler for a specific query type |

### Middleware

| Export | Kind | Description |
|--------|------|-------------|
| `CQRSExecutionContext` | class | Builds and carries per-execution context (correlationId, userId…) |
| `LoggingMiddleware` | class | Pre-built logging middleware for commands and queries |
| `ExecutionContext` | interface | Shape of the context object passed through the pipeline |
| `ICQRSMiddleware` | interface | Middleware contract |

### Configuration

| Export | Kind | Description |
|--------|------|-------------|
| `CQRSModule` | class | Standalone setup helper (framework-agnostic) |
| `CQRSConfiguration` | class | Global bus configuration |
| `CQRSOptions` | interface | Configuration shape |

### DI integration

| Export | Kind | Description |
|--------|------|-------------|
| `CQRSDiscoveryPlugin` | class | `IHandlerDiscoveryPlugin` that auto-registers `@CommandHandler` / `@QueryHandler` decorated classes into a `VytchesDDD` container |

### Validation

| Export | Kind | Description |
|--------|------|-------------|
| `CqrsValidationError` | class | Thrown when a command/query fails validation |
| `ICqrsValidatable` | interface | Opt-in interface for validatable commands/queries |

### Errors

| Export | Kind | Description |
|--------|------|-------------|
| `CommandExecutionError` | class | Wraps handler errors during command execution |
| `QueryExecutionError` | class | Wraps handler errors during query execution |
| `HandlerNotFoundError` | class | No handler registered for the command/query type |
| `CQRSConfigurationError` | class | Misconfigured bus or missing dependency |

### Core interfaces

| Export | Kind | Description |
|--------|------|-------------|
| `ICommand` | interface | Marker interface for command objects |
| `ICommandHandler<TCommand>` | interface | Handler contract: `handle(command, context): Promise<void>` |
| `IQuery<TResult>` | interface | Marker interface for query objects |
| `IQueryHandler<TQuery, TResult>` | interface | Handler contract: `handle(query, context): Promise<TResult>` |

## Quick start

```typescript
import {
  CommandBus,
  QueryBus,
  CommandHandler,
  QueryHandler,
} from '@vytches/ddd-cqrs';
import type { ICommand, IQuery, ICommandHandler, IQueryHandler, ExecutionContext } from '@vytches/ddd-cqrs';
import { SimpleContainer, VytchesDDD } from '@vytches/ddd-di';
import { CQRSDiscoveryPlugin } from '@vytches/ddd-cqrs';

// --- Define a command ---
class CreateUserCommand implements ICommand {
  constructor(public readonly name: string, public readonly email: string) {}
}

// --- Implement a handler ---
@CommandHandler(CreateUserCommand)
class CreateUserCommandHandler implements ICommandHandler<CreateUserCommand> {
  async handle(command: CreateUserCommand, context: ExecutionContext): Promise<void> {
    // business logic
  }
}

// --- Define a query ---
class GetUserQuery implements IQuery<{ name: string }> {
  constructor(public readonly id: string) {}
}

@QueryHandler(GetUserQuery)
class GetUserQueryHandler implements IQueryHandler<GetUserQuery, { name: string }> {
  async handle(query: GetUserQuery, context: ExecutionContext) {
    return { name: 'Alice' };
  }
}

// --- Wire up ---
const container = new SimpleContainer();
VytchesDDD.configure(container);
VytchesDDD.registerDiscoveryPlugin(new CQRSDiscoveryPlugin());
await VytchesDDD.discoverAndRegisterHandlers();

const commandBus = new CommandBus(container);
const queryBus   = new QueryBus(container);

await commandBus.execute(new CreateUserCommand('Alice', 'alice@example.com'));
const user = await queryBus.execute(new GetUserQuery('user-1'));
```

## Middleware

```typescript
import type { ICQRSMiddleware, ExecutionContext } from '@vytches/ddd-cqrs';

class AuditMiddleware implements ICQRSMiddleware {
  async handle(message: unknown, context: ExecutionContext, next: () => Promise<unknown>) {
    const start = Date.now();
    const result = await next();
    console.log(`Executed in ${Date.now() - start}ms`);
    return result;
  }
}

// Pass to EnhancedCommandBus
const bus = new EnhancedCommandBus(container, { middleware: [new AuditMiddleware()] });
```

## LoggingMiddleware

The built-in `LoggingMiddleware` logs start, completion, and errors of every
command and query using `@vytches/ddd-logging`:

```typescript
import { LoggingMiddleware, EnhancedCommandBus } from '@vytches/ddd-cqrs';

const bus = new EnhancedCommandBus(container, {
  middleware: [new LoggingMiddleware()],
});
```

## Package boundaries

`@vytches/ddd-cqrs` depends on:
- `@vytches/ddd-di` — `IDependencyContainer`, `IHandlerDiscoveryPlugin`
- `@vytches/ddd-logging` — internal logging
- `@vytches/ddd-resilience` — only used by `EnhancedCommandBus` / `EnhancedQueryBus`

## License

MIT
