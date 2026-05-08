# @vytches/ddd-di - LLM Guide

## Purpose

Framework-agnostic dependency injection abstraction. Provides a global service
locator with optional context isolation, container builder + simple in-memory
container, and a base adapter for plugging in external DI frameworks (NestJS,
InversifyJS, tsyringe, etc.).

Use this package when you want to author code that compiles against
`@vytches/ddd-*` without locking into a specific DI host.

## Quick Start

```typescript
import { ContainerBuilder, SimpleContainer } from '@vytches/ddd-di';

// 1. Build a container
const container = new ContainerBuilder()
  .register('Logger', () => new DefaultLogger())
  .register('UserRepository', c => new UserRepository(c.resolve('Logger')))
  .build();

// 2. Resolve services
const userRepo = container.resolve<UserRepository>('UserRepository');
```

## Key API

| Export                    | Kind      | Description                                                    |
| ------------------------- | --------- | -------------------------------------------------------------- |
| `ContainerBuilder`        | class     | Fluent builder for assembling a `SimpleContainer`              |
| `SimpleContainer`         | class     | In-memory container; `register`, `resolve`, `has`              |
| `BaseContainerAdapter`    | abstract  | Extend to wrap an external DI framework as a vytches container |
| `IContainer`              | interface | Container public contract                                      |
| `IServiceLocator`         | interface | Global service-locator contract (optional context isolation)   |
| `ServiceToken<T>`         | type      | Symbol/string identifier for a registration                    |
| `ServiceFactory<T>`       | type      | `(container) => T` factory function                            |
| `Lifetime`                | enum      | `Transient`, `Scoped`, `Singleton`                             |
| `ContainerError`          | class     | Base error for container failures                              |
| `ServiceNotFoundError`    | class     | Thrown when `resolve(token)` finds no registration             |
| `CircularDependencyError` | class     | Thrown when factory chain re-enters itself                     |

## Patterns

### Adapting NestJS DI

```typescript
import { BaseContainerAdapter } from '@vytches/ddd-di';
import type { ModuleRef } from '@nestjs/core';

class NestjsAdapter extends BaseContainerAdapter {
  constructor(private readonly moduleRef: ModuleRef) {
    super();
  }

  resolve<T>(token: string | symbol): T {
    return this.moduleRef.get<T>(token as never, { strict: false });
  }

  has(token: string | symbol): boolean {
    try {
      this.moduleRef.get(token as never, { strict: false });
      return true;
    } catch {
      return false;
    }
  }
}
```

### Singleton vs scoped lifetime

```typescript
container.register(
  'OrderRepository',
  c => new OrderRepository(c.resolve('Db')),
  {
    lifetime: 'Singleton', // shared instance
  }
);

container.register('RequestContext', () => new RequestContext(), {
  lifetime: 'Scoped', // new per logical scope
});
```

## Anti-Patterns

- **Do not use the global service locator inside aggregates or value objects** —
  pass dependencies through constructor parameters. Service locator is for
  application/infrastructure layer, not domain.
- **Do not register infrastructure adapters as `Transient`** — DB clients,
  loggers, and HTTP clients should be `Singleton`.
- **Do not import `@vytches/ddd-di` from a domain layer file** — domain packages
  have no DI dependencies. DI lives at the composition root.
