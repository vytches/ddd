# @vytches/ddd-value-objects

[![npm version](https://badge.fury.io/js/%40vytches%2Fddd-value-objects.svg)](https://badge.fury.io/js/%40vytches%2Fddd-value-objects)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Base value object class, EntityId, and branded ID types**

Provides the foundation for value objects in DDD — immutability, structural
equality, and type-safe entity identifiers.

## Installation

```bash
pnpm add @vytches/ddd-value-objects
```

## What's included

| Export                         | Kind      | Description                                                                                                                                  |
| ------------------------------ | --------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `BaseValueObject<T>`           | class     | Abstract base for value objects; deep-freezes internal value; implements `equals()` via structural comparison                                |
| `ValueObjectValidator<T>`      | interface | `validate(value: T): boolean` — implement to add invariant checking                                                                          |
| `EntityId<T>`                  | class     | Enhanced entity identifier extending the contracts `EntityId`; adds UUID/integer/text validation, `create()`, `fromString()`, `fromNumber()` |
| `EntityIdFactory`              | class     | **Deprecated** — will be removed in v1.0.0; use `EntityId.create()` directly                                                                 |
| `BrandedId<Tag>`               | type      | Compile-time branded `EntityId<string>` — prevents mixing IDs across aggregate types                                                         |
| `createBrandedId<Tag>(id)`     | function  | Casts an `EntityId` to `BrandedId<Tag>`                                                                                                      |
| `newBrandedId<Tag>()`          | function  | Creates a new UUID-based `BrandedId<Tag>`                                                                                                    |
| `brandedIdFromUUID<Tag>(uuid)` | function  | Creates a `BrandedId<Tag>` from an existing UUID string                                                                                      |
| `brandedIdFromText<Tag>(text)` | function  | Creates a `BrandedId<Tag>` from a text string                                                                                                |
| `IEntityId<T>`                 | interface | Re-exported from `@vytches/ddd-contracts`                                                                                                    |
| `IEntityIdFactory`             | interface | Re-exported from `@vytches/ddd-contracts`                                                                                                    |
| `IdType`                       | type      | Re-exported from `@vytches/ddd-contracts` — `'uuid' \| 'integer' \| 'text'`                                                                  |

## Note on bundled domain examples

This package does **not** export `Email`, `Money`, `Address`, `PhoneNumber`,
`DateRange`, or other concrete domain value objects. Those are application-level
types — implement them in your own domain layer using `BaseValueObject` as the
base class.

## Quick start

### Custom value object

```typescript
import { BaseValueObject } from '@vytches/ddd-value-objects';

interface MoneyProps {
  amount: number;
  currency: string;
}

class Money extends BaseValueObject<MoneyProps> {
  constructor(amount: number, currency: string) {
    super({ amount, currency });
  }

  validate(value: MoneyProps): boolean {
    return value.amount >= 0 && value.currency.length === 3;
  }

  get amount(): number {
    return this.value.amount;
  }
  get currency(): string {
    return this.value.currency;
  }

  add(other: Money): Money {
    if (this.currency !== other.currency) throw new Error('Currency mismatch');
    return new Money(this.amount + other.amount, this.currency);
  }
}

const price = new Money(10, 'USD');
const tax = new Money(1.5, 'USD');
const total = price.add(tax);

console.log(total.equals(new Money(11.5, 'USD'))); // true
```

### EntityId

```typescript
import { EntityId } from '@vytches/ddd-value-objects';

// Generate a new UUID-based ID
const id = EntityId.create(); // EntityId<string> with UUID

// From an existing UUID string
const fromString = EntityId.fromString('550e8400-e29b-41d4-a716-446655440000');

// From an integer
const fromNumber = EntityId.fromNumber(42);

console.log(id.getValue()); // '550e8400-...'
console.log(id.equals(EntityId.fromString(id.getValue()))); // true
```

### Branded IDs

```typescript
import {
  BrandedId,
  newBrandedId,
  brandedIdFromUUID,
} from '@vytches/ddd-value-objects';

type OrderId = BrandedId<'Order'>;
type CustomerId = BrandedId<'Customer'>;

const orderId: OrderId = newBrandedId<'Order'>();
const customerId: CustomerId = newBrandedId<'Customer'>();

function shipOrder(id: OrderId): void {
  /* ... */
}

shipOrder(orderId); // OK
shipOrder(customerId); // TypeScript compile error!
```

## Package boundaries

`@vytches/ddd-value-objects` depends on:

- `@vytches/ddd-contracts` — `EntityId` base class, `IEntityId`, `IdType`
- `@vytches/ddd-domain-primitives` — error types
- `@vytches/ddd-utils` — `LibUtils`, `Result`

## License

MIT
