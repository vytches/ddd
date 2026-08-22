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

| Export                         | Kind      | Description                                                                                                                                                                                                                                           |
| ------------------------------ | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BaseValueObject<T>`           | class     | Abstract base for value objects; deep-freezes internal value; implements `equals()` via structural comparison, with an opt-in [`getIdentityComponents()`](#partial-identity-equality-with-getidentitycomponents) hook for partial-identity comparison |
| `ValueObjectValidator<T>`      | interface | `validate(value: T): boolean` — implement to add invariant checking                                                                                                                                                                                   |
| `EntityId<T>`                  | class     | Enhanced entity identifier extending the contracts `EntityId`; adds UUID/integer/text validation, `create()`, `fromString()`, `fromNumber()`                                                                                                          |
| `EntityIdFactory`              | class     | **Deprecated** — will be removed in v1.0.0; use `EntityId.create()` directly                                                                                                                                                                          |
| `BrandedId<Tag>`               | type      | Compile-time branded `EntityId<string>` — prevents mixing IDs across aggregate types                                                                                                                                                                  |
| `createBrandedId<Tag>(id)`     | function  | Casts an `EntityId` to `BrandedId<Tag>`                                                                                                                                                                                                               |
| `newBrandedId<Tag>()`          | function  | Creates a new UUID-based `BrandedId<Tag>`                                                                                                                                                                                                             |
| `brandedIdFromUUID<Tag>(uuid)` | function  | Creates a `BrandedId<Tag>` from an existing UUID string                                                                                                                                                                                               |
| `brandedIdFromText<Tag>(text)` | function  | Creates a `BrandedId<Tag>` from a text string                                                                                                                                                                                                         |
| `IEntityId<T>`                 | interface | Re-exported from `@vytches/ddd-contracts`                                                                                                                                                                                                             |
| `IEntityIdFactory`             | interface | Re-exported from `@vytches/ddd-contracts`                                                                                                                                                                                                             |
| `IdType`                       | type      | Re-exported from `@vytches/ddd-contracts` — `'uuid' \| 'integer' \| 'text'`                                                                                                                                                                           |

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

## Partial-identity equality with `getIdentityComponents()`

_Since VF-036 — additive minor, see [`CHANGELOG.md`](./CHANGELOG.md)._

By default, `equals()` compares the **entire** stored value: `===` for
primitives, `LibUtils.deepEqual` for objects. Override the protected
`getIdentityComponents()` hook when only a subset of a value object's state
should participate in equality — for example, a `Money` value object that
carries a display-formatting flag that must not affect equality, or a value
object that should compare a derived/normalized projection of its state rather
than the raw stored shape.

```ts compile-check
import { BaseValueObject } from '@vytches/ddd-value-objects';

interface MoneyProps {
  amount: number;
  currency: string;
  displayFormat: 'symbol' | 'code';
}

class Money extends BaseValueObject<MoneyProps> {
  constructor(props: MoneyProps) {
    super(props);
  }

  validate(value: MoneyProps): boolean {
    return (
      typeof value === 'object' &&
      value !== null &&
      value.amount >= 0 &&
      value.currency.length === 3
    );
  }

  // 'Money' is a type-scoped discriminator (see below); displayFormat is
  // intentionally excluded from identity.
  protected override getIdentityComponents(): readonly unknown[] {
    return ['Money', this.value.amount, this.value.currency];
  }
}

const a = new Money({ amount: 10, currency: 'USD', displayFormat: 'symbol' });
const b = new Money({ amount: 10, currency: 'USD', displayFormat: 'code' });

a.equals(b); // true — displayFormat is not an identity component
```

### When to reach for this instead of full-value equality

Use `getIdentityComponents()` when a value object's raw stored value carries
fields that are _incidental_ to identity — audit metadata, cache keys,
presentation flags — while the _value_ the domain actually cares about is
narrower. If every field of `value` matters for equality, leave the hook
unimplemented; the default `undefined` return keeps the unmodified raw
comparison.

### The asymmetric fallback — and why it breaks transitivity in mixed populations

`equals()` calls `getIdentityComponents()` on **both** sides being compared.
Component comparison only runs if **both** sides return a defined array; if
**either** side returns `undefined`, `equals()` falls back to the unchanged raw
comparison. This fallback is symmetric — `a.equals(b)` and `b.equals(a)` always
agree, since both directions see the same two results — but it is deliberately
**not transitive** once a raw-comparison instance and a component-override
instance coexist in the same population:

- `A` — no override, raw comparison.
- `B` — component override, whose raw `value` happens to equal `A`'s.
- `C` — component override, whose components match `B`'s.

`A.equals(B)` can be `true` (raw fallback matches), `B.equals(C)` can be `true`
(components match), yet `A.equals(C)` can be `false` (raw fallback, different
`value`). This is an accepted, test-pinned limitation — it is not "fixed" with
`instanceof`/type gating.

**Collection-level consequence:** code such as `list.some(x => x.equals(y))` or
de-duplication by `.equals()` implicitly assumes equality is an equivalence
relation — reflexive, symmetric, and **transitive**. Mixing component-identity
subclasses with raw-comparison subclasses of the same base type inside one
collection breaks that assumption silently. Migrate a whole class hierarchy to
`getIdentityComponents()` together, or not at all — see the root
[`MIGRATION.md`](../../MIGRATION.md) for the atomic-codemod guidance.

### The empty-array footgun

Returning `[]` is **defined-and-empty**, not "opt out." Two value objects that
both return `[]` are equal to each other regardless of what their `value` holds
(same length — zero — so the element-wise comparison is vacuously true for
both). To opt out of component comparison, return `undefined` (the base
default); never return `[]` to mean "not applicable."

### The fixed-arity rule

A class must **always return the same number of components**, in the same order.
Comparison starts with a length check, so a conditional push —
`if (this.scope) parts.push(this.scope)` — makes two instances of the same class
unequal purely because one had an optional field set. That reads as a data
difference when it is actually an arity difference. Push a stable placeholder
instead:

```ts compile-check
import { BaseValueObject } from '@vytches/ddd-value-objects';

interface GrantProps {
  tenant: string;
  scope?: string;
  key: string;
}

class GrantRef extends BaseValueObject<GrantProps> {
  validate(value: GrantProps): boolean {
    return typeof value === 'object' && value !== null;
  }

  protected override getIdentityComponents(): readonly unknown[] {
    // Always three slots, whatever is populated. Never push conditionally.
    return [this.value.tenant, this.value.scope ?? null, this.value.key];
  }
}
```

The same applies across a hierarchy: if a subclass adds a component, it has
changed the arity of every comparison against its parent — a design decision to
make deliberately rather than discover.

### The "sometimes undefined" downgrade trap

Only a **literal `undefined`/omitted return from the hook itself** triggers the
raw-comparison fallback — a component _value_ inside a returned array being
`undefined` (e.g. an unset optional field) does not; the array is still
"defined" and comparison proceeds element-wise. The trap is the reverse case: a
_conditional_ override — "return components once some field is set, otherwise
return `undefined`" — will silently and intermittently downgrade the very same
class to raw comparison across different instances or different points in an
instance's lifecycle. Prefer an override that always returns an array once a
class opts in.

### Throw propagation — `equals()` is no longer total

A `getIdentityComponents()` override that throws propagates straight out of
`equals()`, uncaught. This is deliberate: `equals()` is a hot path, and this
library's internal logger is diagnostics-only and not meant to intercept
consumer logic (see the logging-removal note in the root `MIGRATION.md`), so
silently swallowing the throw into a wrong-but-quiet `false`/`true` would hide a
real bug in the override. Once a subclass overrides this hook with logic that
can throw, `equals()` is no longer a total function for that subclass.

### Components must come from frozen or readonly state

The base constructor deep-freezes the `value` passed to `super()` — but it does
**not** freeze any additional fields a subclass declares and assigns after
`super(value)`; those remain ordinary mutable class fields unless the subclass
itself keeps them readonly/frozen. Derive components only from state that cannot
change after construction (the frozen `value`, or subclass fields the subclass
itself keeps immutable). Deriving a component from mutable state breaks the
invariant that a value object's equality is stable for its lifetime.

### Type-scoped equality: the sanctioned idiom

`getIdentityComponents()` performs no type or `instanceof` check — two different
subclasses returning matching components are still considered equal, exactly as
cross-subclass raw comparison behaves today. If equality should be scoped to a
specific type, add a **string-literal discriminator** as the first component (as
in the `Money` example above):

```ts compile-check
import { BaseValueObject } from '@vytches/ddd-value-objects';

class OrderNumber extends BaseValueObject<string> {
  validate(value: unknown): boolean {
    return typeof value === 'string' && value.length > 0;
  }

  protected override getIdentityComponents(): readonly unknown[] {
    return ['OrderNumber', this.value];
  }
}
```

Do **not** use `this.constructor.name` (unsafe under minification, which can
rename classes inconsistently) and do **not** use the class object itself
(unsafe across duplicate package copies — the same hazard `instanceof` has).

### `toString()`/`toJSON()` stay value-based

Overriding `getIdentityComponents()` does not change `toString()` or `toJSON()`
— both continue to serialize the raw `value`, unfiltered. If your override
narrows equality to a subset of fields, serialization may now surface
information that equality ignores (or the reverse). Keeping any resulting
equals/serialization desync coherent is the consumer's responsibility.

> **A permanent note: `getEqualityComponents` was never real.** An early (2025)
> documentation draft described a similarly-named `getEqualityComponents()`
> hook. It was **never implemented** in any released version of this library —
> every `equals()` call has always used the raw `value`-based comparison
> described above. The name was removed from docs in a later accuracy pass, but
> some consumers had already written overrides against it, which were (and
> always had been) dead code. `getIdentityComponents()` is the real, supported
> hook, under a deliberately different name. `getEqualityComponents` will
> **not** be added as an alias, shim, or runtime-detected fallback — doing so
> would silently activate every dormant consumer override on upgrade, which is
> exactly the behavioral break this design avoids. If you are holding a dead
> `getEqualityComponents` override, see the root
> [`MIGRATION.md`](../../MIGRATION.md).

## Package boundaries

`@vytches/ddd-value-objects` depends on:

- `@vytches/ddd-contracts` — `EntityId` base class, `IEntityId`, `IdType`
- `@vytches/ddd-domain-primitives` — error types
- `@vytches/ddd-utils` — `LibUtils`, `Result`

## License

MIT
