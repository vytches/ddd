# @vytches/ddd-validation

[![npm version](https://badge.fury.io/js/%40vytches%2Fddd-validation.svg)](https://badge.fury.io/js/%40vytches%2Fddd-validation)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Specification pattern, business rule validators, and validation error
> types**

## Installation

```bash
pnpm add @vytches/ddd-validation
```

## What's included

### Specification pattern

| Export                            | Kind  | Description                                                                                 |
| --------------------------------- | ----- | ------------------------------------------------------------------------------------------- |
| `Specification`                   | class | Alias for `CompositeSpecification` — abstract base with `and()`, `or()`, `not()`            |
| `CompositeSpecification<T>`       | class | Abstract specification with composition methods and `PredicateSpecification` static factory |
| `AsyncCompositeSpecification<T>`  | class | Async variant with `andAsync()`, `orAsync()`, `notAsync()`                                  |
| `MemoizedSpecification<T>`        | class | Wraps another specification and caches the result                                           |
| `NotSpecification<T>`             | class | Negates another specification                                                               |
| `AndSpecification<T>`             | class | Conjunction of two specifications                                                           |
| `OrSpecification<T>`              | class | Disjunction of two specifications                                                           |
| `AndAsyncSpecification<T>`        | class | Async conjunction                                                                           |
| `OrAsyncSpecification<T>`         | class | Async disjunction                                                                           |
| `NotAsyncSpecification<T>`        | class | Async negation                                                                              |
| `AlwaysTrueSpecification<T>`      | class | Always returns `true`                                                                       |
| `AlwaysFalseSpecification<T>`     | class | Always returns `false`                                                                      |
| `PredicateSpecification<T>`       | class | Wraps a predicate function as a specification                                               |
| `PropertyBetweenSpecification<T>` | class | Checks that a property value is between two bounds                                          |
| `PropertyInSpecification<T>`      | class | Checks that a property value is in an allowed set                                           |
| `PropertyEqualsSpecification<T>`  | class | Checks that a property value equals an expected value                                       |
| `SpecificationValidator<T>`       | class | Validates an object against a specification and returns errors                              |

### Business rules

| Export                     | Kind  | Description                                                         |
| -------------------------- | ----- | ------------------------------------------------------------------- |
| `BusinessRuleValidator<T>` | class | Fluent validator builder — chain `must()`, `ensure()`, `validate()` |

### Validation errors

| Export             | Kind  | Description                                            |
| ------------------ | ----- | ------------------------------------------------------ |
| `ValidationError`  | class | Single validation error with property path and message |
| `ValidationErrors` | class | Collection of `ValidationError` instances              |

### Facade

| Export             | Kind                             | Description                                                        |
| ------------------ | -------------------------------- | ------------------------------------------------------------------ |
| `ValidationFacade` | object (aliased as `Validation`) | Factory methods: `create<T>()`, `fromSpecification()`, `combine()` |

### Rules registry

| Export          | Kind  | Description                  |
| --------------- | ----- | ---------------------------- |
| `RulesRegistry` | class | Registry for named rule sets |

### Adapters

| Export                  | Kind  | Description                                              |
| ----------------------- | ----- | -------------------------------------------------------- |
| `BaseValidationAdapter` | class | Base class for integrating external validation libraries |
| `AdapterUtils`          | class | Helper utilities for adapter implementations             |

## Quick start

### Specification pattern

```typescript
import { Specification } from '@vytches/ddd-validation';

class AgeAtLeast18 extends Specification<{ age: number }> {
  isSatisfiedBy(candidate: { age: number }): boolean {
    return candidate.age >= 18;
  }
}

class HasValidEmail extends Specification<{ email: string }> {
  isSatisfiedBy(candidate: { email: string }): boolean {
    return candidate.email.includes('@');
  }
}

const rule = new AgeAtLeast18().and(new HasValidEmail());
const isValid = rule.isSatisfiedBy({ age: 20, email: 'alice@example.com' }); // true
```

### BusinessRuleValidator

```typescript
import { BusinessRuleValidator } from '@vytches/ddd-validation';

interface CreateUser {
  name: string;
  email: string;
  age: number;
}

const validator = BusinessRuleValidator.create<CreateUser>()
  .must(u => u.name.length > 0, 'name', 'Name is required')
  .must(u => u.email.includes('@'), 'email', 'Invalid email')
  .must(u => u.age >= 18, 'age', 'Must be 18 or older');

const result = validator.validate({
  name: 'Alice',
  email: 'alice@example.com',
  age: 20,
});
if (!result.isSuccess) {
  console.error(result.error); // ValidationErrors
}
```

### ValidationFacade

```typescript
import { ValidationFacade as Validation } from '@vytches/ddd-validation';

const validator = Validation.fromSpecification(
  new AgeAtLeast18(),
  'Must be at least 18 years old',
  'age'
);

const result = validator.validate(user);
```

### PredicateSpecification (inline)

```typescript
import { CompositeSpecification } from '@vytches/ddd-validation';

const isActive = CompositeSpecification.create<User>(u => u.active === true);
const isAdmin = CompositeSpecification.create<User>(u => u.role === 'admin');

const isActiveAdmin = isActive.and(isAdmin);
```

## Package boundaries

`@vytches/ddd-validation` depends on:

- `@vytches/ddd-contracts` — `ISpecification`, `IAsyncSpecification`,
  `IValidator`, `IValidationErrors`
- `@vytches/ddd-utils` — `Result`

## License

MIT
