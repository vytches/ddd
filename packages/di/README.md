# @vytches/ddd-di

[![npm version](https://badge.fury.io/js/%40vytches%2Fddd-di.svg)](https://badge.fury.io/js/%40vytches%2Fddd-di)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Framework-agnostic dependency injection with global service locator and
> plugin-based handler discovery**

## Installation

```bash
pnpm add @vytches/ddd-di
```

## What's included

### Core types

| Export                       | Kind      | Description                             |
| ---------------------------- | --------- | --------------------------------------- |
| `ServiceLifetime`            | enum      | `Transient \| Singleton \| Scoped`      |
| `IDependencyContainer`       | interface | Framework-agnostic container contract   |
| `IContainerBuilder`          | interface | Fluent builder contract                 |
| `ServiceToken<T>`            | type      | Token used to register/resolve services |
| `Constructor<T>`             | type      | `new (...args: any[]) => T`             |
| `ServiceDescriptor`          | interface | Registered service metadata             |
| `ServiceFactory<T>`          | type      | Factory function signature              |
| `ServiceRegistrationOptions` | interface | Options for `register()` calls          |
| `ResolutionContext`          | interface | Context object passed during resolution |

### Errors

| Export                          | Kind  | Description                                 |
| ------------------------------- | ----- | ------------------------------------------- |
| `DIError`                       | class | Base DI error                               |
| `ServiceNotFoundError`          | class | No service registered under the given token |
| `CircularDependencyError`       | class | Circular dependency detected                |
| `ServiceAlreadyRegisteredError` | class | Token already has a registration            |
| `InvalidRegistrationError`      | class | Invalid registration arguments              |
| `ContainerConfigurationError`   | class | Container misconfiguration                  |
| `ContainerDisposedError`        | class | Operation called on a disposed container    |

### Service locator

| Export            | Kind      | Description                                                           |
| ----------------- | --------- | --------------------------------------------------------------------- |
| `VytchesDDD`      | class     | Global service locator facade — `configure()`, `resolve()`, `reset()` |
| `ServiceLocator`  | class     | Lower-level locator implementation                                    |
| `IServiceLocator` | interface | Contract for service locators                                         |

### Containers

| Export             | Kind  | Description                                                  |
| ------------------ | ----- | ------------------------------------------------------------ |
| `SimpleContainer`  | class | Built-in container for testing and simple apps               |
| `ContainerBuilder` | class | Fluent API for registering multiple services before building |

### Adapter

| Export                 | Kind  | Description                                                           |
| ---------------------- | ----- | --------------------------------------------------------------------- |
| `BaseContainerAdapter` | class | Base class for adapting external DI frameworks (NestJS, InversifyJS…) |

### Handler discovery

| Export                      | Kind      | Description                                                        |
| --------------------------- | --------- | ------------------------------------------------------------------ |
| `HandlerDiscoveryRegistry`  | class     | Manages `IHandlerDiscoveryPlugin` instances                        |
| `IHandlerDiscoveryPlugin`   | interface | Plugin contract: `discoverHandlers()`                              |
| `IHandlerDiscoveryRegistry` | interface | Registry contract                                                  |
| `HandlerInfo`               | interface | Discovered handler metadata (`type`, `messageType`, `handlerType`) |

## Quick start

```typescript
import { VytchesDDD, SimpleContainer, ServiceLifetime } from '@vytches/ddd-di';

const container = new SimpleContainer();

// Register services
container.register('EmailService', EmailService, {
  lifetime: ServiceLifetime.Singleton,
});
container.registerFactory('Database', c => {
  const config = c.resolve<Config>('Config');
  return new Database(config.url);
});
container.registerInstance('Config', { url: 'postgres://localhost/mydb' });

// Configure the global locator
VytchesDDD.configure(container);

// Resolve anywhere in your app
const email = VytchesDDD.resolve<EmailService>('EmailService');
```

## ContainerBuilder (fluent API)

```typescript
import { ContainerBuilder, ServiceLifetime } from '@vytches/ddd-di';

const container = new ContainerBuilder()
  .register('UserRepository', UserRepository, {
    lifetime: ServiceLifetime.Singleton,
  })
  .register('EmailService', EmailService, {
    lifetime: ServiceLifetime.Singleton,
  })
  .registerFactory('UserService', c => {
    return new UserService(
      c.resolve<UserRepository>('UserRepository'),
      c.resolve<EmailService>('EmailService')
    );
  })
  .build();
```

## Handler discovery with CQRSDiscoveryPlugin

The DI package provides the plugin interface; `@vytches/ddd-cqrs` ships the
`CQRSDiscoveryPlugin` implementation:

```typescript
import { VytchesDDD } from '@vytches/ddd-di';
import { CQRSDiscoveryPlugin } from '@vytches/ddd-cqrs';

VytchesDDD.registerDiscoveryPlugin(new CQRSDiscoveryPlugin());
await VytchesDDD.discoverAndRegisterHandlers();
```

## Error handling

```typescript
import { ServiceNotFoundError, CircularDependencyError } from '@vytches/ddd-di';

try {
  VytchesDDD.resolve<unknown>('UnknownService');
} catch (error) {
  if (error instanceof ServiceNotFoundError) {
    console.error('Service missing:', error.message);
  }
}
```

## Testing

```typescript
import { VytchesDDD, SimpleContainer } from '@vytches/ddd-di';

describe('UserService', () => {
  let container: SimpleContainer;

  beforeEach(() => {
    container = new SimpleContainer();
    container.registerInstance('UserRepository', { findById: vi.fn() });
    VytchesDDD.configure(container);
  });

  afterEach(() => {
    VytchesDDD.reset(); // clean global state between tests
    container.dispose?.();
  });
});
```

## Package boundaries

`@vytches/ddd-di` has **zero** dependencies on other `@vytches/ddd-*` packages.
It is the foundation layer; all other packages may optionally depend on it.

## License

MIT
