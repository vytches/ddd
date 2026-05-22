# @vytches/ddd-domain-primitives

> Core domain error types and actor primitives for the VytchesDDD ecosystem.

[![npm version](https://badge.fury.io/js/%40vytches%2Fddd-domain-primitives.svg)](https://badge.fury.io/js/%40vytches%2Fddd-domain-primitives)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Installation

```bash
pnpm add @vytches/ddd-domain-primitives
```

## What's included

- **Error hierarchy** — `BaseError` and concrete error types for common domain failures
- **Error codes** — `DomainErrorCode`, `ApplicationErrorCode`, `FrameworkErrorCode` enums
- **Actor system** — `IActor` interface and `DefaultActorType` for representing who performed an action

## Usage

```typescript
import {
  BaseError,
  DomainErrorCode,
  NotFoundError,
  InvalidParameterError,
  MissingValueError,
  DuplicateError,
} from '@vytches/ddd-domain-primitives';

// Use built-in domain errors
function findOrder(id: string): Order {
  if (!id) throw new MissingValueError('order id');
  const order = repository.find(id);
  if (!order) throw new NotFoundError(`Order ${id} not found`);
  return order;
}

// Extend BaseError for custom domain errors
class InsufficientFundsError extends BaseError {
  constructor(required: number, available: number) {
    super(
      `Insufficient funds: required ${required}, available ${available}`,
      DomainErrorCode.BUSINESS_RULE_VIOLATION
    );
  }
}
```

```typescript
import type { IActor } from '@vytches/ddd-domain-primitives';
import { DefaultActorType, ActorError } from '@vytches/ddd-domain-primitives';

// Represent who is performing an action
const actor: IActor = {
  id: 'user-123',
  type: DefaultActorType.USER,
};
```

## API Reference

### Errors

| Export | Kind | Description |
|--------|------|-------------|
| `BaseError` | class | Abstract base for all domain errors; extends `Error` |
| `NotFoundError` | class | Entity or resource not found |
| `InvalidParameterError` | class | A parameter has an invalid value |
| `MissingValueError` | class | A required value is absent |
| `DuplicateError` | class | An entity already exists with the same identity |
| `IDomainError` | class | Marker base for domain errors (for `instanceof` checks) |
| `DomainErrorOptions` | interface | Options passed to `BaseError` and subclasses |
| `ErrorCode` | type | Union of all error code string literals |
| `ErrorOptions` | interface | Generic error construction options |

### Error Codes

| Export | Kind | Description |
|--------|------|-------------|
| `DomainErrorCode` | enum | Error codes for domain-layer errors (e.g. `NOT_FOUND`, `DUPLICATE`, `BUSINESS_RULE_VIOLATION`) |
| `ApplicationErrorCode` | enum | Error codes for application-layer errors |
| `FrameworkErrorCode` | enum | Error codes for framework/infrastructure errors |

### Actor

| Export | Kind | Description |
|--------|------|-------------|
| `IActor` | interface | Represents the entity performing an action (id, type) |
| `DefaultActorType` | enum | Built-in actor types: `USER`, `SYSTEM`, `SERVICE`, `ANONYMOUS` |
| `ActorError` | class | Error thrown for actor-related failures |

## Package boundaries

`@vytches/ddd-domain-primitives` depends on `@vytches/ddd-contracts` for shared type definitions. It has no other runtime dependencies.

## License

MIT
