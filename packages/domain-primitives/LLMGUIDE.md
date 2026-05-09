# @vytches/ddd-domain-primitives - LLM Guide

## Purpose

Foundational types every domain layer needs: typed error hierarchy (`BaseError`,
`DomainErrorCode`, `NotFoundError`, `DuplicateError`, `InvalidParameterError`,
`MissingValueError`) and the `IActor` contract for audit/security context.

Pure domain concerns — zero infrastructure dependencies, no logging, no DI.

## Quick Start

```typescript
import {
  NotFoundError,
  InvalidParameterError,
  DomainErrorCode,
  type IActor,
} from '@vytches/ddd-domain-primitives';

// Throw a typed domain error
function findUser(id: string): User {
  const user = users.find(u => u.id === id);
  if (!user) throw new NotFoundError(`User ${id} not found`);
  return user;
}

// Validate a parameter
function place(amount: number): void {
  if (amount <= 0) {
    throw new InvalidParameterError('amount', 'must be positive', { amount });
  }
}

// Capture who initiated an action
const actor: IActor = { id: 'user-42', type: 'user', name: 'Alice' };
audit.record({ event: 'OrderPlaced', actor, timestamp: new Date() });
```

## Key API

| Export                  | Kind           | Description                                                                 |
| ----------------------- | -------------- | --------------------------------------------------------------------------- |
| `BaseError`             | abstract class | Root of all DDD-typed errors; carries `code`, `message`, `cause`, `context` |
| `IDomainError`          | interface      | Marker contract for domain-thrown errors                                    |
| `NotFoundError`         | class          | Aggregate/entity lookup failed                                              |
| `DuplicateError`        | class          | Unique-constraint violation                                                 |
| `InvalidParameterError` | class          | Bad argument passed to a domain operation                                   |
| `MissingValueError`     | class          | Required value was null/undefined                                           |
| `DomainErrorCode`       | enum           | `NotFound`, `Duplicate`, `InvalidParameter`, `MissingValue`, ...            |
| `ApplicationErrorCode`  | enum           | Codes for application-layer errors (e.g. `Unauthorized`)                    |
| `FrameworkErrorCode`    | enum           | Codes for framework/library errors                                          |
| `ErrorCode`             | union          | All three code enums combined                                               |
| `ErrorOptions`          | type           | `{ cause?, context? }` constructor opts                                     |
| `DomainErrorOptions`    | type           | `ErrorOptions & { code?: DomainErrorCode }`                                 |
| `IActor`                | interface      | `{ id, type, name?, metadata? }` — who triggered an action                  |
| `DefaultActorType`      | enum           | `'user' \| 'system' \| 'service' \| 'agent'`                                |
| `ActorError`            | class          | Thrown for invalid actor configurations                                     |

## Patterns

### Custom domain error

```typescript
import { BaseError, DomainErrorCode } from '@vytches/ddd-domain-primitives';

class InsufficientStockError extends BaseError {
  constructor(sku: string, requested: number, available: number) {
    super(`Insufficient stock for ${sku}`, {
      code: DomainErrorCode.InvalidParameter,
      context: { sku, requested, available },
    });
  }
}
```

### Composable error context

```typescript
try {
  await placeOrder(orderId);
} catch (cause) {
  throw new InvalidParameterError('order', 'failed to place', {
    cause,
    context: { orderId },
  });
}
```

## Anti-Patterns

- **Do not throw generic `Error`** in the domain layer — use one of the typed
  errors so handlers can switch on `instanceof` or `error.code`.
- **Do not put HTTP/transport context** (status codes, response bodies) into
  domain errors. Map them at the application boundary.
- **Do not catch and swallow `BaseError`** silently — log + re-throw or convert
  to a `Result.fail()` at the boundary.
- **Do not use `IActor` as a security principal** — it is metadata for audit
  trails, not authentication. Authorization happens before the domain runs.
