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

| Export                       | Kind             | Description                                                                 |
| ---------------------------- | ---------------- | --------------------------------------------------------------------------- |
| `BaseValueObject<T>`         | abstract class   | Immutable value holder; provides `equals`, `getValue`, `toString`, `toJSON` |
| `EntityId<T>`                | class            | Validated aggregate identifier; extends contracts `EntityId`                |
| `EntityId.create()`          | static method    | Creates a new random-UUID `EntityId<string>`                                |
| `EntityId.fromUUID(v)`       | static method    | Parses and validates a UUID string                                          |
| `EntityId.fromInteger(v)`    | static method    | Validates non-negative integer, stores as string                            |
| `EntityId.fromBigInt(v)`     | static method    | Validates bigint string/bigint, stores as string                            |
| `EntityId.fromText(v)`       | static method    | Validates non-empty text with safe characters                               |
| `EntityId.tryFromUUID(v)`    | static method    | Like `fromUUID` but returns `Result<EntityId, Error>` instead of throwing   |
| `EntityId.tryFromInteger(v)` | static method    | Like `fromInteger` but returns `Result<EntityId, Error>`                    |
| `EntityId.tryFromBigInt(v)`  | static method    | Like `fromBigInt` but returns `Result<EntityId, Error>`                     |
| `EntityId.tryFromText(v)`    | static method    | Like `fromText` but returns `Result<EntityId, Error>`                       |
| `EntityIdFactory`            | class            | **Deprecated.** Use `EntityId` static methods instead                       |
| `IEntityId<T>`               | re-exported type | From `@vytches/ddd-contracts` — the interface                               |
| `IEntityIdFactory`           | re-exported type | From `@vytches/ddd-contracts` — the factory interface                       |
| `IdType`                     | re-exported type | `'uuid' \| 'integer' \| 'text' \| 'bigint'`                                 |

### `BaseValueObject<T>` method reference

| Method                                                     | Description                                                                                                                                                                                                                                                        |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `getValue(): T`                                            | Returns the raw wrapped value                                                                                                                                                                                                                                      |
| `equals(other): boolean`                                   | `===` for primitives, `LibUtils.deepEqual` for objects — unless `getIdentityComponents()` is overridden on both sides, in which case identity components decide equality instead (VF-036)                                                                          |
| `toString(): string`                                       | `String(value)`                                                                                                                                                                                                                                                    |
| `toJSON(): unknown`                                        | Returns the raw value (not a JSON string)                                                                                                                                                                                                                          |
| `abstract validate(value): boolean`                        | Must be implemented; called in subclass `create()`                                                                                                                                                                                                                 |
| `getIdentityComponents(): readonly unknown[] \| undefined` | Protected opt-in hook (VF-036). Default returns `undefined` (raw comparison, unchanged). Override to compare by a subset/projection of fields instead of the full raw value; if either side returns `undefined`, `equals()` falls back to the raw comparison above |

## Partial-identity equality: `getIdentityComponents()` (VF-036)

**When to use it:** override this protected hook when only a subset of a value
object's `value` should participate in equality (e.g. exclude a display flag,
audit timestamp, or cache key from identity). Leave it unimplemented (default
returns `undefined`) when the full raw `value` should decide equality — that is
the common case.

```ts compile-check
import { BaseValueObject } from '@vytches/ddd-value-objects';

interface MoneyProps {
  amount: number;
  currency: string;
  displayFormat: 'symbol' | 'code';
}

class Money extends BaseValueObject<MoneyProps> {
  validate(value: unknown): boolean {
    const v = value as MoneyProps;
    return v.amount >= 0 && v.currency.length === 3;
  }

  // string-literal discriminator ('Money') scopes equality to this type —
  // see "Type-scoped equality" below; displayFormat is excluded on purpose.
  protected override getIdentityComponents(): readonly unknown[] {
    return ['Money', this.value.amount, this.value.currency];
  }
}
```

**Dispatch rule:** `equals()` calls the hook on both sides. Both defined →
compare components (same length, then element-wise, dispatching to nested
`.equals()` for value objects, `LibUtils.deepEqual` otherwise). Either side
`undefined` → unchanged raw comparison (`===` / `LibUtils.deepEqual`).

**Non-transitivity in mixed populations (collection hazard).** The fallback is
symmetric but not transitive: with A (no override), B (override, same raw
`value` as A), C (override, same components as B), `A.equals(B)` and
`B.equals(C)` can both be `true` while `A.equals(C)` is `false`. Code that
assumes an equivalence relation — `list.some(x => x.equals(y))`, de-duplication
by `.equals()` — breaks silently when raw-comparison and component-override
instances of the same base type are mixed. Migrate a whole hierarchy together
(see MIGRATION.md), never partially.

**`[]` footgun.** `[]` is defined-and-empty, not "opt out" — two `[]`- returning
instances are always equal to each other. Return `undefined` to opt out, never
`[]`.

**Undefined-because-uninitialized is a different trap than it sounds.** Only a
literal `undefined` returned _by the hook itself_ triggers the raw fallback; an
`undefined` _component value_ inside a defined array does not. The real trap is
a _conditional_ override that sometimes returns `undefined` — that silently and
intermittently downgrades the same class to raw comparison. Always return an
array once a class opts in.

**Throw propagation.** A throwing override propagates out of `equals()` uncaught
— no try/catch, by design (`equals()` is a hot path; the library logger is
diagnostics-only). `equals()` is no longer a total function for a subclass whose
override can throw.

**Frozen/readonly state only.** The constructor deep-freezes `value`, not any
subclass field assigned after `super(value)`. Components must derive only from
`value` or from subclass fields the subclass itself keeps immutable — deriving
from mutable state breaks equality stability over the instance's lifetime.

**Type-scoped equality idiom.** No type/`instanceof` check is performed —
cross-subclass equality with matching components stays `true`, same as raw
comparison today. To scope equality to one type, add a string literal as the
first component (`['Money', ...]`), never `this.constructor.name`
(minification-unsafe) or the class object itself (unsafe across duplicate
package copies).

**`toString()`/`toJSON()` stay value-based** regardless of this hook — both
always serialize the raw `value`. An override that narrows equality can desync
serialization from equality; keeping that coherent is the consumer's
responsibility.

> **Permanent note:** `getEqualityComponents()` — a similarly-named hook from an
> early (2025) documentation draft — was **never implemented** in any released
> version and will not be added as an alias/shim/fallback.
> `getIdentityComponents()` is the real hook, under a deliberately new name. Any
> existing `getEqualityComponents()` override has always been dead code; see
> root `MIGRATION.md` to migrate it.

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

## Result-Returning Factories (since 0.24.0)

Prefer `tryFromX()` over `fromX()` — returns `Result<EntityId, Error>` instead
of throwing, enabling functional error handling.

```typescript
import { EntityId } from '@vytches/ddd-value-objects';

// Returns Result — never throws
const result = EntityId.tryFromUUID(userInput);

if (result.isFailure) {
  console.log('Invalid ID:', result.error.message);
  return;
}

const id = result.value; // EntityId<string>

// Chain with Result.map/flatMap
const idString = EntityId.tryFromUUID(userInput).map(id => id.value);
```

Available: `tryFromUUID`, `tryFromInteger`, `tryFromBigInt`, `tryFromText`. The
`fromX()` throwing variants still work for backward compatibility.

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
