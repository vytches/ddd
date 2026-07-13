# @vytches/ddd-validation - LLM Guide

## Purpose

Specification pattern for domain validation with composable sync and async
predicates. Provides `BusinessRuleValidator` for fluent rule chains and the
`Specification` factory for inline lambda specs without class boilerplate.

### Two validation engines — both first-class, both permanent

This package ships two independent, equally supported ways to define validation
rules. Neither is a legacy path or a stepping stone to the other — pick per
project/team preference, and mixing both across a codebase (or even within one)
is fine:

- **`RulesRegistry`** (Pattern 6) — the built-in default engine. Named,
  composable rule builders (`required`, `email`, `range`, ...) attached to
  `BusinessRuleValidator`. No external dependency; use this when you want
  validation expressed directly in this library's own rule vocabulary.
- **`BaseValidationAdapter`** (Pattern 7) — the external-validator path. Wraps a
  third-party schema library (Zod, class-validator, etc.) so it implements
  `IValidator<T>` and plugs into the same `Result<T, ValidationErrors>` contract
  as everything else in this package. Use this when your team already
  standardizes on a schema library elsewhere.

Both produce the same `IValidator<T>` contract and the same
`Result<T, ValidationErrors>` shape, so application code that consumes a
validator never needs to know or care which engine produced it.

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

| Export                                                                                              | Description                                                                                                                                                                                                                                  |
| --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Specification.create<T>(predicate)`                                                                | Create inline spec from lambda — primary pattern                                                                                                                                                                                             |
| `Specification.and<T>(...specs)`                                                                    | Combine multiple specs with AND (static, variadic)                                                                                                                                                                                           |
| `Specification.or<T>(...specs)`                                                                     | Combine multiple specs with OR (static, variadic)                                                                                                                                                                                            |
| `Specification.not<T>(spec)`                                                                        | Negate a spec                                                                                                                                                                                                                                |
| `Specification.propertyEquals<T>(key, value)`                                                       | Property equality spec                                                                                                                                                                                                                       |
| `Specification.propertyIn<T>(key, values[])`                                                        | Property membership spec                                                                                                                                                                                                                     |
| `Specification.propertyBetween<T>(key, min, max)`                                                   | Numeric range spec                                                                                                                                                                                                                           |
| `Specification.alwaysTrue<T>()`                                                                     | Unconditionally satisfied                                                                                                                                                                                                                    |
| `Specification.alwaysFalse<T>()`                                                                    | Never satisfied                                                                                                                                                                                                                              |
| `CompositeSpecification<T>`                                                                         | Base class for class-based specs; exposes `.and()`, `.or()`, `.not()`                                                                                                                                                                        |
| `MemoizedSpecification<T>`                                                                          | **Per-candidate caching** (VP-002) — wrap any spec; `WeakMap<T, boolean>` cache means repeated `isSatisfiedBy(sameCandidate)` runs the inner spec exactly once. `invalidate(c)` evicts manually. Use only for pure specs (no external state) |
| `AsyncCompositeSpecification<T>`                                                                    | Async base class with optional `name`, `description`, and `explainFailureAsync`                                                                                                                                                              |
| `AsyncCompositeSpecification.create<T>(predicate, name?, desc?)`                                    | Inline async spec                                                                                                                                                                                                                            |
| `BusinessRuleValidator<T>`                                                                          | Fluent validator; returns `Result<T, ValidationErrors>`                                                                                                                                                                                      |
| `BusinessRuleValidator.fromSpecification<T>(spec, message)`                                         | Validator from a single spec                                                                                                                                                                                                                 |
| `ValidationError` / `ValidationErrors`                                                              | Error types with `property`, `message`, `context`                                                                                                                                                                                            |
| `AndSpecification<T>` / `OrSpecification<T>` / `NotSpecification<T>`                                | Classes backing `.and()` / `.or()` / `.not()` on `CompositeSpecification` and the static `Specification.and()` / `.or()` / `.not()` — not usually constructed directly                                                                       |
| `AndAsyncSpecification<T>` / `OrAsyncSpecification<T>` / `NotAsyncSpecification<T>`                 | Async counterparts backing `.and()` / `.or()` / `.not()` on `AsyncCompositeSpecification` (see Hidden Features for `AndAsyncSpecification`'s parallel `Promise.all` behavior) — not usually constructed directly                             |
| `AlwaysTrueSpecification<T>` / `AlwaysFalseSpecification<T>`                                        | Classes backing `Specification.alwaysTrue()` / `Specification.alwaysFalse()`                                                                                                                                                                 |
| `PredicateSpecification<T>`                                                                         | Class backing `Specification.create()` (the inline lambda spec, see Quick Start)                                                                                                                                                             |
| `PropertyEqualsSpecification<T>` / `PropertyInSpecification<T>` / `PropertyBetweenSpecification<T>` | Classes backing `Specification.propertyEquals()` / `.propertyIn()` / `.propertyBetween()`                                                                                                                                                    |
| `SpecificationValidator<T>`                                                                         | Lower-level validator built purely from specs; `addRule(spec, message, property?)` attaches a spec, `addPropertyRule(property, spec, message, getValue)` validates a projected sub-value. See Pattern 4                                      |
| `ValidationFacade`                                                                                  | Utility object (`Validation` internally) with validator/spec conversion helpers: `combine()`, `validateWithSpecification()`, `validateWithRules()`, `forNestedPath()`, `validatePath()`, `useExternal()`. See Pattern 5                      |
| `RulesRegistry`                                                                                     | Static registry of reusable named rule functions — built-in `Rules` (required, minLength, maxLength, pattern, range, email, satisfies, ...) plus `register()` / `forDomain()` for custom rule providers. See Pattern 6                       |
| `BaseValidationAdapter<T, TSchema>`                                                                 | Abstract base class for wrapping external validation libraries (zod, class-validator, etc.) as `IValidator<T>`. See Pattern 7                                                                                                                |
| `AdapterUtils`                                                                                      | Static helpers to build adapters without a class: `create()`, `combine()`, `withErrorMapping()`. See Pattern 7                                                                                                                               |

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

### Pattern 4: `SpecificationValidator` for property-projected specs

Use `SpecificationValidator` (instead of `BusinessRuleValidator`) when a rule is
really "run this spec against a _projected_ value" — `addPropertyRule` takes a
`getValue` extractor and validates the projection, tagging errors with the
original property name.

```typescript
import { SpecificationValidator, Specification } from '@vytches/ddd-validation';

interface Order {
  shipping: { country: string };
}

const isEuCountry = Specification.create<string>(country =>
  ['PL', 'DE', 'FR'].includes(country)
);

const validator = SpecificationValidator.create<Order>().addPropertyRule(
  'shipping',
  isEuCountry,
  'Shipping country must be in the EU',
  order => order.shipping.country
);

const result = validator.validate(order); // Result<Order, ValidationErrors>

// Shortcut for a single whole-object rule
const single = SpecificationValidator.fromSpecification(
  isEuCountry,
  'Country must be in the EU'
);
```

### Pattern 5: `ValidationFacade` conversion helpers

`ValidationFacade` bundles standalone helpers for combining validators and
converting between validators and specifications — reach for it instead of
hand-rolling `combine`/nested-path glue.

```typescript
import { ValidationFacade } from '@vytches/ddd-validation';

// Combine several independent validators; errors from all of them are merged
const combined = ValidationFacade.combine(
  nameValidator,
  ageValidator,
  emailValidator
);
const result = combined.validate(user);

// Build a validator for a deeply nested path without hand-writing addNested() chains
const zipValidator = ValidationFacade.forNestedPath(
  ['shipping', 'address'],
  zipCodeValidator
);
```

Other helpers on the same object: `validateWithSpecification()` /
`validateWithRules()` (one-shot validation without pre-building a validator),
`validatePath()` (validate a value at an arbitrary object path, prefixing error
properties with that path), `specificationToValidator()` /
`validatorToSpecification()` (convert between the two abstractions), and
`useExternal()` (typed passthrough for a validator that already implements
`IValidator<T>`, e.g. a hand-written zod/class-validator wrapper).

### Pattern 6: `RulesRegistry` for reusable named rules

`RulesRegistry.Rules` exposes core rule builders (`required`, `minLength`,
`maxLength`, `pattern`, `range`, `email`, `satisfies`, `propertySatisfies`,
`when`, `whenSatisfies`, `otherwise`) as `RuleFunction<T>` factories — each
returns a function that takes a `BusinessRuleValidator<T>` and returns it with
the rule attached.

```typescript
import { RulesRegistry, BusinessRuleValidator } from '@vytches/ddd-validation';

const validator = BusinessRuleValidator.create<User>();
RulesRegistry.Rules.required<User>('email')(validator);
RulesRegistry.Rules.email<User>('email')(validator);

// Register a domain-specific rule provider once (throws if the name is
// already taken), then reuse it anywhere via forDomain()
const orderRules = {
  name: 'order',
  minTotal:
    (min: number, message?: string) => (v: BusinessRuleValidator<Order>) =>
      v.addRule(
        'total',
        (o: Order) => o.total >= min,
        message ?? `Total must be >= ${min}`
      ),
};

RulesRegistry.register(orderRules);
RulesRegistry.forDomain<typeof orderRules>('order').minTotal(100)(
  validator as never
);
```

**Security note:** `Rules.pattern(property, regex, message)` runs `regex`
against input data — never build the `RegExp` from user-controlled strings
(`new RegExp(userInput)`), that opens a ReDoS vector. Use only literal,
review-able patterns.

### Pattern 7: Adapting external validation libraries

Two ways to wrap an external validator (zod, class-validator, ...) as an
`IValidator<T>`: a reusable class via `BaseValidationAdapter`, or a one-off
function via `AdapterUtils.create`.

```typescript
import { BaseValidationAdapter, AdapterUtils } from '@vytches/ddd-validation';

// Class-based: reusable, schema stored on the instance
class ZodAdapter<T> extends BaseValidationAdapter<
  T,
  { safeParse: (v: T) => any }
> {
  validate(value: T) {
    const parsed = this.schema.safeParse(value);
    if (!parsed.success) {
      const errors = parsed.error.issues.map((issue: any) =>
        this.createValidationError(issue.path.join('.'), issue.message)
      );
      return this.failWithErrors(errors);
    }
    return this.success(value);
  }
}

const userValidator = new ZodAdapter(userSchema);

// Function-based: no class needed for a one-off adapter
const quickValidator = AdapterUtils.create<User>(user => ({
  success: user.age >= 18,
  errors: user.age >= 18 ? undefined : ['Must be an adult'],
}));

// Combine several adapters into one IValidator<T>
const combinedValidator = AdapterUtils.combine(userValidator, quickValidator);
```

`AdapterUtils.withErrorMapping(validateFn, errorMapper)` is a third option when
the external library's error shape needs a custom `TError -> ValidationError`
mapping instead of the plain `string[]` shape `create()` expects.

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

Packages that depend on `@vytches/ddd-validation`:

- `@vytches/ddd-policies` — `BusinessRuleValidatorAdapter`,
  `BusinessRuleValidatorPolicy`
- `@vytches/ddd-enterprise` — re-exports everything
