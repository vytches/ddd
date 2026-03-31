# @vytches/ddd-validation - LLM Guide

## Purpose

Specification pattern for domain validation with composable sync and async
predicates. Provides `BusinessRuleValidator` for fluent rule chains and the
`Specification` factory for inline lambda specs without class boilerplate.

## Quick Start

```typescript
import { Specification, BusinessRuleValidator } from '@vytches/ddd-validation';

interface Order {
  total: number;
  status: 'pending' | 'paid' | 'cancelled';
}

// Inline spec — the primary pattern, no class needed
const isPositive = Specification.create<Order>(o => o.total > 0);
const isPending = Specification.create<Order>(o => o.status === 'pending');

// Compose specs
const isPayable = isPositive.and(isPending);

// Validate
const order: Order = { total: 100, status: 'pending' };
const ok = isPayable.isSatisfiedBy(order); // true

// Fluent validator (returns Result<T, ValidationErrors>)
const validator = BusinessRuleValidator.create<Order>()
  .addRule('total', o => o.total > 0, 'Total must be positive')
  .addRule(
    'status',
    o => o.status !== 'cancelled',
    'Cannot process cancelled order'
  );

const result = validator.validate(order);
if (result.isFailure) {
  result.error.errors.forEach(e => console.error(e.property, e.message));
}
```

## Key API

| Export                                                           | Description                                                                     |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `Specification.create<T>(predicate)`                             | Create inline spec from lambda — primary pattern                                |
| `Specification.and<T>(...specs)`                                 | Combine multiple specs with AND (static, variadic)                              |
| `Specification.or<T>(...specs)`                                  | Combine multiple specs with OR (static, variadic)                               |
| `Specification.not<T>(spec)`                                     | Negate a spec                                                                   |
| `Specification.propertyEquals<T>(key, value)`                    | Property equality spec                                                          |
| `Specification.propertyIn<T>(key, values[])`                     | Property membership spec                                                        |
| `Specification.propertyBetween<T>(key, min, max)`                | Numeric range spec                                                              |
| `Specification.alwaysTrue<T>()`                                  | Unconditionally satisfied                                                       |
| `Specification.alwaysFalse<T>()`                                 | Never satisfied                                                                 |
| `CompositeSpecification<T>`                                      | Base class for class-based specs; exposes `.and()`, `.or()`, `.not()`           |
| `AsyncCompositeSpecification<T>`                                 | Async base class with optional `name`, `description`, and `explainFailureAsync` |
| `AsyncCompositeSpecification.create<T>(predicate, name?, desc?)` | Inline async spec                                                               |
| `BusinessRuleValidator<T>`                                       | Fluent validator; returns `Result<T, ValidationErrors>`                         |
| `BusinessRuleValidator.fromSpecification<T>(spec, message)`      | Validator from a single spec                                                    |
| `ValidationError` / `ValidationErrors`                           | Error types with `property`, `message`, `context`                               |

## Patterns

### Pattern 1: Inline specs (preferred)

Use `Specification.create` instead of classes for one-off or module-local specs.
This covers the vast majority of real-world cases.

```typescript
import { Specification } from '@vytches/ddd-validation';

interface Product {
  price: number;
  stock: number;
  active: boolean;
}

const canPurchase = Specification.and(
  Specification.create<Product>(p => p.active),
  Specification.create<Product>(p => p.stock > 0),
  Specification.create<Product>(p => p.price > 0)
);

canPurchase.isSatisfiedBy(product); // boolean
```

### Pattern 2: Class-based specs (reusable, named)

Use `CompositeSpecification` only when the spec is complex, reused across
multiple places, or needs an explicit name for error messages.

```typescript
import { CompositeSpecification } from '@vytches/ddd-validation';

class MinimumOrderSpec extends CompositeSpecification<Order> {
  constructor(private readonly minimum: number) {
    super();
  }

  isSatisfiedBy(order: Order): boolean {
    return order.total >= this.minimum;
  }
}

// Composition still works on class instances
const policy = new MinimumOrderSpec(50).and(isPending);
```

### Pattern 3: Async specs for I/O-dependent rules

```typescript
import { AsyncCompositeSpecification } from '@vytches/ddd-validation';

const isUniqueEmail = AsyncCompositeSpecification.create<User>(
  async (user, ctx) => {
    const exists = await (ctx?.db as Db).users.findOne({ email: user.email });
    return exists === null;
  },
  'UniqueEmailSpec',
  'Email must be unique in the system'
);

const combined = isUniqueEmail.and(anotherAsyncSpec);
const ok = await combined.isSatisfiedByAsync(user, { db });
```

## Anti-Patterns

**Creating a class for a one-off validation.** Use `Specification.create`
instead. Class-based specs make sense only when the spec is exported and reused
in several modules.

```typescript
// Wrong: unnecessary class
class IsActiveSpec extends CompositeSpecification<User> {
  isSatisfiedBy(u: User) {
    return u.isActive;
  }
}

// Correct: inline
const isActive = Specification.create<User>(u => u.isActive);
```

**Using `AsyncCompositeSpecification` when no I/O is involved.** Async execution
is slower and complicates composition. Prefer sync specs and convert to async
only at the point that actually needs awaiting.

**Ignoring `BusinessRuleValidator.validate()` return value.** The method returns
`Result<T, ValidationErrors>`, not a boolean. Always check `result.isFailure`
before proceeding.

**Calling `Specification.and()` or `Specification.or()` with zero arguments.**
Both return `AlwaysTrue` and `AlwaysFalse` respectively for the empty case —
which may be surprising.

**Using `when().otherwise()` without a preceding `when()` call.**
`BusinessRuleValidator.otherwise()` throws at runtime if `when()` was not called
immediately before it.

## Hidden Features

**`Specification.and<T>(...specs)` accepts variadic arguments.** Unlike the
instance `.and()` method (which takes one argument), the static
`Specification.and` accepts an arbitrary number of specs and chains them all.

**`AsyncCompositeSpecification` runs `.and()` children in parallel.**
`AndAsyncSpecification.isSatisfiedByAsync` uses `Promise.all`, so two async
specs are evaluated concurrently, not sequentially.

**`BusinessRuleValidator.when()` supports spec-based conditions via
`whenSatisfies`.** You can pass a `ISpecification<T>` directly instead of a
plain predicate function.

```typescript
const validator = BusinessRuleValidator.create<Order>().whenSatisfies(
  Specification.create<Order>(o => o.type === 'international'),
  v =>
    v.addRule(
      'country',
      o => !!o.country,
      'Country required for international orders'
    )
);
```

**`BusinessRuleValidator.addNested()` propagates dot-notation paths.** Nested
validators prefix error property paths automatically (e.g., `address.zip`).

## Package Dependencies

`@vytches/ddd-validation` depends on:

- `@vytches/ddd-contracts` — `ISpecification`, `IAsyncSpecification`,
  `IValidator`, `IValidationRule`
- `@vytches/ddd-utils` — `Result<T, E>`
- `@vytches/ddd-logging` — structured logger

Packages that depend on `@vytches/ddd-validation`:

- `@vytches/ddd-policies` — `BusinessRuleValidatorAdapter`,
  `BusinessRuleValidatorPolicy`
- `@vytches/ddd-enterprise` — re-exports everything
