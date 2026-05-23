# @vytches/ddd-acl

[![npm version](https://badge.fury.io/js/%40vytches%2Fddd-acl.svg)](https://badge.fury.io/js/%40vytches%2Fddd-acl)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Anti-Corruption Layer for external system integration**

Provides adapters, translators, registries, and middleware to protect your
domain model from external system changes.

## Installation

```bash
pnpm add @vytches/ddd-acl
```

## What's included

### Application layer

| Export                   | Kind      | Description                               |
| ------------------------ | --------- | ----------------------------------------- |
| `ApplicationError`       | class     | Base error for application-layer failures |
| `BaseApplicationService` | class     | Base class for application services       |
| `IApplicationService`    | interface | Contract for application services         |

### Errors

| Export                 | Kind  | Description                             |
| ---------------------- | ----- | --------------------------------------- |
| `ACLError`             | class | General ACL operation failure           |
| `AdapterNotFoundError` | class | No adapter registered for given context |
| `TranslationError`     | class | Model translation failure               |

### Middleware

| Export              | Kind  | Description                                                           |
| ------------------- | ----- | --------------------------------------------------------------------- |
| `BaseACLMiddleware` | class | Base class for ACL middleware (extend to add cross-cutting behaviour) |

### Registries

| Export                    | Kind      | Description                                                                          |
| ------------------------- | --------- | ------------------------------------------------------------------------------------ |
| `ACLRegistry`             | class     | Global registry of ACL adapters; supports `fromDefinitions()`, `importFromContext()` |
| `BaseACLRegistry`         | class     | Foundation class for custom registries                                               |
| `ContextACLRegistry`      | class     | Bounded-context-scoped registry                                                      |
| `VersionedACLRegistry`    | class     | Registry that supports multiple adapter versions                                     |
| `VersionedACLAdapter`     | class     | Adapter with version tracking                                                        |
| `ACLRegistrationMetadata` | interface | Metadata stored alongside a registered adapter                                       |
| `ImportOptions`           | interface | Options for `ACLRegistry.importFromContext()`                                        |

### Adapters

| Export               | Kind      | Description                                             |
| -------------------- | --------- | ------------------------------------------------------- |
| `BaseACLAdapter`     | class     | Abstract base — extend and implement `performOperation` |
| `SimpleACLAdapter`   | class     | Concrete adapter for straightforward integrations       |
| `EnhancedACLAdapter` | class     | Adapter with built-in middleware pipeline support       |
| `defineACLAdapter`   | function  | Factory helper to create `AdapterDefinition` objects    |
| `AdapterDefinition`  | interface | Shape used by `defineACLAdapter` and `fromDefinitions`  |

### Translator

| Export                | Kind  | Description                                                   |
| --------------------- | ----- | ------------------------------------------------------------- |
| `BaseModelTranslator` | class | Abstract translator — implement `toExternal` / `fromExternal` |

### Typed operations

| Export           | Kind  | Description                                             |
| ---------------- | ----- | ------------------------------------------------------- |
| `TypedOperation` | class | Wraps an operation name with input/output generic types |

### Interfaces

| Export                | Kind      | Description                                         |
| --------------------- | --------- | --------------------------------------------------- |
| `IACLAdapter`         | interface | Core adapter contract                               |
| `IEnhancedACLAdapter` | interface | Adapter with middleware support                     |
| `IExternalAPI`        | interface | External system communication contract              |
| `IModelTranslator`    | interface | Bidirectional translation contract                  |
| `ACLMiddleware`       | interface | Middleware function signature                       |
| `ACLContextInfo`      | interface | Metadata about the external system context          |
| `ExecuteOptions`      | interface | Per-call options (version, timeout, correlationId…) |

## Quick start

```typescript
import {
  SimpleACLAdapter,
  BaseModelTranslator,
  ACLRegistry,
  defineACLAdapter,
} from '@vytches/ddd-acl';

interface Order {
  id: string;
  total: number;
}
interface ExternalOrder {
  order_id: string;
  amount: number;
}

class OrderTranslator extends BaseModelTranslator<Order, ExternalOrder> {
  toExternal(o: Order): ExternalOrder {
    return { order_id: o.id, amount: o.total };
  }
  fromExternal(e: ExternalOrder): Order {
    return { id: e.order_id, total: e.amount };
  }
}

const adapter = new SimpleACLAdapter(
  { contextName: 'Payments', externalSystem: 'PaymentsAPI' },
  new OrderTranslator(),
  paymentsApiClient,
  ['create', 'refund']
);

// Declarative registration
const registry = ACLRegistry.fromDefinitions([
  defineACLAdapter({ context: 'Payments', adapter }),
]);

const resolved = registry.resolve('Payments');
const result = await resolved.execute('create', order);
```

## Middleware

```typescript
import { BaseACLMiddleware } from '@vytches/ddd-acl';

class LoggingMiddleware extends BaseACLMiddleware {
  async execute(operation, model, options, next) {
    console.log(`ACL ${operation} started`);
    const result = await next();
    console.log(`ACL ${operation} done`);
    return result;
  }
}

// Attach to EnhancedACLAdapter
enhancedAdapter.use(new LoggingMiddleware());
```

## Model translation with validation

```typescript
import { BaseModelTranslator } from '@vytches/ddd-acl';
import { Result } from '@vytches/ddd-utils';

class ValidatedOrderTranslator extends BaseModelTranslator<
  Order,
  ExternalOrder
> {
  toExternal(o: Order): ExternalOrder {
    /* ... */
  }
  fromExternal(e: ExternalOrder): Order {
    /* ... */
  }

  validateDomain(o: Order): Result<void, Error> {
    if (!o.id) return Result.fail(new Error('Order ID required'));
    return Result.ok();
  }
}
```

## Package boundaries

`@vytches/ddd-acl` has no runtime dependencies on other `@vytches/ddd-*`
packages (uses only native TypeScript). Consumers typically also install
`@vytches/ddd-utils` for the `Result` type.

## License

MIT
