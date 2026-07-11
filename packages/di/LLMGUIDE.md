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

| Export                          | Kind      | Description                                                                                                    |
| ------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------- |
| `ContainerBuilder`              | class     | Fluent builder for assembling a `SimpleContainer`                                                              |
| `IContainerBuilder`             | interface | Contract implemented by `ContainerBuilder`: `register`/`registerFactory`/`registerInstance`/`build`            |
| `SimpleContainer`               | class     | In-memory container; `register`, `resolve`, `has`                                                              |
| `BaseContainerAdapter`          | abstract  | Extend to wrap an external DI framework as a vytches container                                                 |
| `IDependencyContainer`          | interface | Container public contract implemented by `SimpleContainer` and adapters                                        |
| `IServiceLocator`               | interface | Contract implemented by `ServiceLocator` (see Patterns below)                                                  |
| `ServiceLocator`                | class     | Singleton global service locator with optional per-context containers; obtain via `getInstance()`              |
| `VytchesDDD`                    | class     | Static facade over `ServiceLocator.getInstance()` — configure/resolve/discover via static methods              |
| `ServiceToken<T>`               | type      | Symbol/string/`Constructor<T>` identifier for a registration                                                   |
| `ServiceFactory<T>`             | type      | `(container) => T` factory function                                                                            |
| `Constructor<T>`                | type      | `new (...args: unknown[]) => T` — shape used by `ServiceToken`, `HandlerInfo`, `implementation` params         |
| `ServiceRegistrationOptions`    | interface | `{ lifetime?, context?, tags? }` — options param of `register`/`registerFactory`/`registerInstance`            |
| `ServiceDescriptor<T>`          | interface | Return type of `IDependencyContainer.getServices()` / `getServicesByTag()`                                     |
| `ResolutionContext`             | interface | Diagnostic record of an in-flight resolution: `token`, `resolutionChain`, `context`, `timestamp`               |
| `ServiceLifetime`               | enum      | `Transient`, `Singleton`, `Scoped`                                                                             |
| `DIError`                       | class     | Base error for container failures                                                                              |
| `ContainerServiceNotFoundError` | class     | Thrown when `resolve(token)` finds no registration                                                             |
| `CircularDependencyError`       | class     | Thrown when factory chain re-enters itself                                                                     |
| `ServiceAlreadyRegisteredError` | class     | Thrown when registering a token that already exists in a given context                                         |
| `InvalidRegistrationError`      | class     | Thrown when a registration call is malformed (e.g. bad token/implementation combination)                       |
| `ContainerConfigurationError`   | class     | Thrown by `ServiceLocator`/`VytchesDDD` when `configure()` was never called or given a null container          |
| `ContainerDisposedError`        | class     | Thrown when a `ServiceLocator`/`VytchesDDD` method is called after `dispose()`                                 |
| `HandlerDiscoveryRegistry`      | class     | Registry of `IHandlerDiscoveryPlugin`s used to auto-discover command/query/event handlers (see Patterns below) |
| `IHandlerDiscoveryRegistry`     | interface | Contract implemented by `HandlerDiscoveryRegistry`                                                             |
| `IHandlerDiscoveryPlugin`       | interface | Contract a consumer implements to plug a framework's handler scanning into discovery                           |
| `HandlerInfo`                   | interface | `{ type, messageType, handlerType, metadata }` — element returned by handler discovery                         |

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

### Global service locator with context isolation

`VytchesDDD` is a static facade over the `ServiceLocator` singleton
(`ServiceLocator.getInstance()`); use whichever call style fits — both share the
same underlying state.

```typescript
import { VytchesDDD, ContainerBuilder } from '@vytches/ddd-di';

// Configure the global (default) container
VytchesDDD.configure(
  new ContainerBuilder().register('Logger', () => new DefaultLogger()).build()
);

// Configure a context-isolated container, e.g. per bounded context
VytchesDDD.configureContext(
  'billing',
  new ContainerBuilder().register('Logger', () => new BillingLogger()).build()
);

// Context-aware resolution: tries 'billing' first, falls back to global
const logger = VytchesDDD.resolve<Logger>('Logger', 'billing');

// Equivalent using the singleton instance directly
import { ServiceLocator } from '@vytches/ddd-di';
const locator = ServiceLocator.getInstance();
locator.isRegistered('Logger', 'billing'); // true

// Reset all state between tests (singleton persists across test files)
VytchesDDD.reset();
```

### Custom handler discovery plugin

`HandlerDiscoveryRegistry` (used internally by
`VytchesDDD.discoverAndRegisterHandlers`) collects `HandlerInfo` entries from
one or more `IHandlerDiscoveryPlugin`s — implement the interface to teach
discovery about a new scanning source (e.g. a decorator-based registry or a
framework's module graph).

```typescript
import type { IHandlerDiscoveryPlugin, HandlerInfo } from '@vytches/ddd-di';
import { HandlerDiscoveryRegistry, VytchesDDD } from '@vytches/ddd-di';

class DecoratorScanPlugin implements IHandlerDiscoveryPlugin {
  readonly name = 'decorator-scan';

  isAvailable(): boolean {
    return true;
  }

  discoverHandlers(): HandlerInfo[] {
    return [
      {
        type: 'command',
        messageType: CreateOrderCommand,
        handlerType: CreateOrderHandler,
        metadata: undefined,
      },
    ];
  }
}

// Register directly on a registry instance...
const registry = new HandlerDiscoveryRegistry();
registry.registerPlugin(new DecoratorScanPlugin());
const handlers = await registry.discoverAllHandlers();

// ...or through the service locator, which registers discovered
// handlers into the currently configured global container.
VytchesDDD.registerDiscoveryPlugin(new DecoratorScanPlugin());
await VytchesDDD.discoverAndRegisterHandlers();
```

## Anti-Patterns

- **Do not use the global service locator inside aggregates or value objects** —
  pass dependencies through constructor parameters. Service locator is for
  application/infrastructure layer, not domain.
- **Do not register infrastructure adapters as `Transient`** — DB clients,
  loggers, and HTTP clients should be `Singleton`.
- **Do not import `@vytches/ddd-di` from a domain layer file** — domain packages
  have no DI dependencies. DI lives at the composition root.
- **Do not forget `VytchesDDD.reset()` / `ServiceLocator.getInstance().reset()`
  between tests** — the service locator is a process-wide singleton, so state
  configured in one test file leaks into the next unless explicitly reset.
