# @vytches/ddd-value-objects - LLM Guide

## Purpose

Provides `BaseValueObject` for immutable domain values and `EntityId` for
strongly-typed aggregate identifiers with built-in validation across four ID
strategies (UUID, integer, bigint, text).

## Quick Start

```typescript
import { BaseValueObject, EntityId } from '@vytches/ddd-value-objects';

// Create a value object
class Money extends BaseValueObject<number> {
  static create(amount: number): Money {
    const vo = new Money(amount);
    if (!vo.validate(amount)) throw new Error('Amount must be non-negative');
    return vo;
  }
  validate(value: unknown): boolean {
    return typeof value === 'number' && value >= 0;
  }
  add(other: Money): Money {
    return Money.create(this.getValue() + other.getValue());
  }
}

// Create entity IDs
const id = EntityId.create(); // random UUID
const fromDb = EntityId.fromUUID('550e8400-e29b-41d4-a716-446655440000');
const intId = EntityId.fromInteger(42);
const textId = EntityId.fromText('order-slug');
```

## Key API

| Export                    | Kind             | Description                                                                 |
| ------------------------- | ---------------- | --------------------------------------------------------------------------- |
| `BaseValueObject<T>`      | abstract class   | Immutable value holder; provides `equals`, `getValue`, `toString`, `toJSON` |
| `EntityId<T>`             | class            | Validated aggregate identifier; extends contracts `EntityId`                |
| `EntityId.create()`       | static method    | Creates a new random-UUID `EntityId<string>`                                |
| `EntityId.fromUUID(v)`    | static method    | Parses and validates a UUID string                                          |
| `EntityId.fromInteger(v)` | static method    | Validates non-negative integer, stores as string                            |
| `EntityId.fromBigInt(v)`  | static method    | Validates bigint string/bigint, stores as string                            |
| `EntityId.fromText(v)`    | static method    | Validates non-empty text with safe characters                               |
| `EntityIdFactory`         | class            | **Deprecated.** Use `EntityId` static methods instead                       |
| `IEntityId<T>`            | re-exported type | From `@vytches/ddd-contracts` — the interface                               |
| `IEntityIdFactory`        | re-exported type | From `@vytches/ddd-contracts` — the factory interface                       |
| `IdType`                  | re-exported type | `'uuid' \| 'integer' \| 'text' \| 'bigint'`                                 |

### `BaseValueObject<T>` method reference

| Method                              | Description                                        |
| ----------------------------------- | -------------------------------------------------- |
| `getValue(): T`                     | Returns the raw wrapped value                      |
| `equals(other): boolean`            | Structural equality by raw value (`===`)           |
| `toString(): string`                | `String(value)`                                    |
| `toJSON(): string`                  | `JSON.stringify(value)`                            |
| `abstract validate(value): boolean` | Must be implemented; called in subclass `create()` |

## Patterns

### Validated value object with factory

```typescript
import { BaseValueObject } from '@vytches/ddd-value-objects';

class EmailAddress extends BaseValueObject<string> {
  static create(raw: string): EmailAddress {
    const vo = new EmailAddress(raw.toLowerCase().trim());
    if (!vo.validate(raw)) {
      throw new Error(`Invalid email: ${raw}`);
    }
    return vo;
  }

  validate(value: unknown): boolean {
    return (
      typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
    );
  }
}

const email = EmailAddress.create('Alice@Example.com');
email.getValue(); // 'alice@example.com'
email.equals(EmailAddress.create('alice@example.com')); // true
```

### Using EntityId as aggregate key

```typescript
import { EntityId } from '@vytches/ddd-value-objects';
import { AggregateRoot } from '@vytches/ddd-aggregates';
import type { IAggregateConstructorParams } from '@vytches/ddd-aggregates';

class Order extends AggregateRoot<string> {
  constructor(params: IAggregateConstructorParams<string>) {
    super(params);
  }

  static create(): Order {
    return new Order({ id: EntityId.create(), version: 0 });
  }
}

const order = Order.create();
order.getId().getValue(); // UUID string
order.getId().getType(); // 'uuid'
order.getId().toString(); // same UUID string
```

### Comparing two IDs

```typescript
import { EntityId } from '@vytches/ddd-value-objects';

const a = EntityId.fromUUID('550e8400-e29b-41d4-a716-446655440000');
const b = EntityId.fromUUID('550e8400-e29b-41d4-a716-446655440000');

a.equals(b); // true
a.getValue() === b.getValue(); // true — same raw string
```

## Anti-Patterns

**Making value objects mutable.** `BaseValueObject.value` is `readonly` — never
expose a setter. All transformations must return a new instance (e.g., `add()`
returns `Money.create(...)`).

**Not implementing `validate()`.** The abstract method must be implemented.
Returning `true` unconditionally defeats the purpose. Call `validate` inside the
static factory and throw or return `Result.fail` there — do not throw inside the
constructor.

**Using primitive types instead of value objects for domain concepts.** Passing
`string` for email or `number` for money loses invariant enforcement at compile
time. Wrap every domain-meaningful primitive in a `BaseValueObject` subclass.

**Using `EntityIdFactory` in new code.** `EntityIdFactory` is deprecated. Use
`EntityId.create()`, `EntityId.fromUUID()`, etc. directly. The factory class
exists only for backward compatibility.

**Calling `new EntityId(value, type)` directly in application code.** The
constructor does not validate the value in the base class. Always use the static
factory methods (`create`, `fromUUID`, etc.) which throw `InvalidParameterError`
or `MissingValueError` on bad input.

## Hidden Features

`EntityId.fromInteger` stores the integer as a string internally (returns
`EntityId<string>` not `EntityId<number>`) — this is intentional for consistent
serialization across all ID types.

`EntityId.fromBigInt` accepts both a native `bigint` and a `string`
representation — useful when reading from databases that return bigints as
strings.

`BaseValueObject.toJSON()` returns a JSON-serialized string of the value, not
the value itself — if you assign a value object to a JSON payload, call
`getValue()` instead of `toJSON()` to avoid double-encoding.

The `validate()` method on `BaseValueObject` receives `unknown` (not `T`) —
implement defensive type checks even though TypeScript narrows the parameter in
practice.

## Branded ID Types (since 0.24.0)

Prevent accidentally passing an OrderId where a CustomerId is expected. Zero
runtime overhead — branding exists only in the type system.

```typescript
import {
  type BrandedId,
  newBrandedId,
  brandedIdFromUUID,
} from '@vytches/ddd-value-objects';

// Define domain-specific ID types
type OrderId = BrandedId<'Order'>;
type CustomerId = BrandedId<'Customer'>;

// Create branded IDs
const orderId: OrderId = newBrandedId<'Order'>();
const customerId: CustomerId = brandedIdFromUUID<'Customer'>('550e8400-...');

// Type-safe function — compile error if wrong ID type passed
function cancelOrder(id: OrderId): void {
  /* ... */
}
cancelOrder(orderId); // OK
// cancelOrder(customerId); // Compile error!
```

Available factories: `createBrandedId<Tag>(entityId)`, `newBrandedId<Tag>()`,
`brandedIdFromUUID<Tag>(uuid)`, `brandedIdFromText<Tag>(text)`.

## Package Dependencies

**Depends on:** `@vytches/ddd-contracts`, `@vytches/ddd-domain-primitives`,
`@vytches/ddd-utils`.

**Depended on by:** `@vytches/ddd-aggregates` (re-exports `EntityId` from
contracts), `@vytches/ddd-enterprise`.
