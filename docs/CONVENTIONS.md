# VytchesDDD Conventions Guide

This document defines the coding conventions and patterns used throughout the
VytchesDDD library.

## Factory Method Naming Convention

### Overview

Factory methods must follow a consistent naming convention across all packages
for API predictability.

### Conventions

| Pattern               | Purpose                                                 | Example                                        |
| --------------------- | ------------------------------------------------------- | ---------------------------------------------- |
| `create()`            | Primary factory for new instances with generated values | `EntityId.create()` - creates with random UUID |
| `from*(source)`       | Conversion/reconstitution from external data            | `EntityId.fromUUID(uuid)`, `fromText(text)`    |
| `of(value)`           | Simple wrapping of a primitive value                    | `Money.of(100)`                                |
| `empty()`             | Creates a null/empty instance                           | `Optional.empty()`                             |
| `reconstitute(props)` | Rebuild from stored state (no validation)               | `Order.reconstitute(dbRecord)`                 |

### EntityId Factory Methods

```typescript
// Primary creation - generates new UUID
const id = EntityId.create();

// Conversion from specific formats (with validation)
const uuidId = EntityId.fromUUID('550e8400-e29b-41d4-a716-446655440000');
const textId = EntityId.fromText('user-123');
const intId = EntityId.fromInteger(42);
const bigId = EntityId.fromBigInt('9007199254740993');
```

### Deprecated Methods

The following methods are deprecated and will be removed in the next major
version:

| Deprecated               | Use Instead          |
| ------------------------ | -------------------- |
| `createWithRandomUUID()` | `create()`           |
| `createUuid(value)`      | `fromUUID(value)`    |
| `createText(value)`      | `fromText(value)`    |
| `createInteger(value)`   | `fromInteger(value)` |
| `createBigInt(value)`    | `fromBigInt(value)`  |

### Best Practices

1. **Use `create()` for new entities** - When creating a new domain object, use
   the primary `create()` method
2. **Use `from*()` for external data** - When loading from APIs, databases, or
   user input
3. **Use `reconstitute()` for event sourcing** - When rebuilding aggregates from
   event history
4. **Avoid direct constructor access** - Prefer factory methods for consistency
   and validation

## Constructor Patterns

### Overview

Different classes require different constructor patterns based on their role in
the architecture.

### Pattern Matrix

| Class Type                       | Constructor              | Factory Methods              | Example                             |
| -------------------------------- | ------------------------ | ---------------------------- | ----------------------------------- |
| **Abstract base classes**        | `public` or `protected`  | None (subclasses provide)    | `AggregateRoot`, `BaseValueObject`  |
| **Concrete aggregates/entities** | `private`                | `create()`, `reconstitute()` | `Order`, `User`                     |
| **Value objects**                | `private` or `protected` | `create()`, `from*()`        | `EntityId`, `Money`                 |
| **Builders**                     | `private`                | `create()`                   | `AggregateBuilder`, `PolicyBuilder` |
| **Services/utilities**           | `public`                 | Optional                     | `Logger`, `DataMasker`              |

### Base Classes (Library-Provided)

Base classes must have public/protected constructors to allow inheritance:

```typescript
// Library provides base class with public constructor
export class AggregateRoot<TId = string> {
  constructor(params: IAggregateConstructorParams<TId>) {
    this._id = params.id;
    this._version = params.version || 0;
  }
}

// Library provides abstract value object
export abstract class BaseValueObject<T> {
  protected readonly value: T;

  constructor(value: T) {
    this.value = value;
  }

  abstract validate(value: unknown): boolean;
}
```

### Concrete Domain Objects (User-Implemented)

User-implemented aggregates and entities should use private constructors with
factory methods:

```typescript
class Order extends AggregateRoot {
  private readonly items: OrderItem[] = [];
  private status: OrderStatus;

  // Private constructor - prevents direct instantiation
  private constructor(props: OrderProps) {
    super(props);
    this.status = props.status;
  }

  // Primary factory - validates and creates new instance
  static create(data: CreateOrderData): Result<Order, ValidationError> {
    // Validate input
    if (!data.customerId) {
      return Result.fail(new ValidationError('Customer ID required'));
    }
    if (data.items.length === 0) {
      return Result.fail(new ValidationError('Order must have items'));
    }

    const order = new Order({
      id: EntityId.create(),
      version: 0,
      status: OrderStatus.Draft,
    });

    // Apply domain events
    order.apply('OrderCreated', { customerId: data.customerId });

    return Result.ok(order);
  }

  // Reconstitution - no validation, for persistence/event sourcing
  static reconstitute(props: OrderProps): Order {
    return new Order(props);
  }
}
```

### Value Objects

Value objects use static factory methods for creation:

```typescript
class Money extends BaseValueObject<number> {
  private readonly currency: string;

  private constructor(amount: number, currency: string) {
    super(amount);
    this.currency = currency;
  }

  // Primary factory
  static create(
    amount: number,
    currency: string
  ): Result<Money, ValidationError> {
    if (amount < 0) {
      return Result.fail(new ValidationError('Amount cannot be negative'));
    }
    return Result.ok(new Money(amount, currency));
  }

  // Simple wrapper (no validation needed)
  static of(amount: number, currency: string = 'USD'): Money {
    return new Money(amount, currency);
  }

  // Reconstitute from storage
  static fromPersistence(data: { amount: number; currency: string }): Money {
    return new Money(data.amount, data.currency);
  }

  validate(value: unknown): boolean {
    return typeof value === 'number' && value >= 0;
  }
}
```

### Builder Pattern

Builders use private constructors with static `create()`:

```typescript
class AggregateBuilder<TId = string> {
  private params: IAggregateConstructorParams<TId>;
  private capabilities: Capability[] = [];

  // Private constructor
  private constructor(params: IAggregateConstructorParams<TId>) {
    this.params = params;
  }

  // Static factory
  static create<TId = string>(params: {
    id: TId | EntityId<TId>;
    version?: number;
  }): AggregateBuilder<TId> {
    return new AggregateBuilder(/* ... */);
  }

  // Fluent methods
  withSnapshots(): this {
    /* ... */
  }
  withVersioning(): this {
    /* ... */
  }

  // Terminal method
  build(): AggregateRoot<TId> {
    /* ... */
  }
}
```

### Guidelines

1. **Base classes need inheritance** - Keep constructors public/protected
2. **Concrete objects control creation** - Use private constructor + factory
3. **`create()` validates** - The `create()` factory performs all validation
4. **`reconstitute()` trusts data** - Used only for known-good data from storage
5. **Return Result for fallible operations** - Factory methods that can fail
   return `Result<T, Error>`
6. **Builders are always private** - Expose only `create()` entry point

## Error Handling

### Overview

VytchesDDD uses a dual error handling approach:

- **Result pattern** for expected failures (validation, business rules)
- **Exceptions** for unexpected/programming errors

### Result Pattern

All fallible domain operations should return `Result<T, Error>`:

```typescript
import { Result } from '@vytches/ddd-utils';

// Good - returns Result for expected failures
static create(data: CreateOrderData): Result<Order, ValidationError> {
  if (!data.customerId) {
    return Result.fail(new ValidationError('Customer ID required'));
  }
  if (data.items.length === 0) {
    return Result.fail(new ValidationError('Order must have items'));
  }
  return Result.ok(new Order(data));
}

// Consuming Result
const result = Order.create(data);
if (result.isSuccess) {
  const order = result.value;
  // Use order
} else {
  const error = result.error;
  // Handle validation error
}
```

### When to Use Result vs Exceptions

| Scenario                      | Use Result | Use Exception |
| ----------------------------- | ---------- | ------------- |
| Validation failures           | ✅         | ❌            |
| Business rule violations      | ✅         | ❌            |
| Expected not-found cases      | ✅         | ❌            |
| Invalid input from users      | ✅         | ❌            |
| Programming errors            | ❌         | ✅            |
| Null/undefined where required | ❌         | ✅            |
| Infrastructure failures       | ❌         | ✅            |
| Framework requirements        | ❌         | ✅            |

### Exception Guidelines

Use exceptions only for:

```typescript
// Programming errors - required parameter is null
function process(order: Order): void {
  if (!order) {
    throw new Error('Order parameter is required'); // Developer mistake
  }
}

// Invalid state - should never happen if code is correct
class EntityId {
  validate(value: T): boolean {
    switch (this.getType()) {
      case 'uuid':
        return LibUtils.isValidUUID(value);
      // ...
      default:
        throw new Error(`Unsupported IdType: ${this.getType()}`); // Bug
    }
  }
}
```

### Test Patterns with safeRun

Always use `safeRun` from `@vytches/ddd-utils` for error testing:

```typescript
import { safeRun } from '@vytches/ddd-utils';
import { describe, it, expect } from 'vitest';

describe('Order', () => {
  it('should return error for invalid data', () => {
    // Test error cases with safeRun
    const result = Order.create({ customerId: '', items: [] });
    expect(result.isFailure).toBe(true);
    expect(result.error).toBeInstanceOf(ValidationError);
  });

  it('should not throw for valid operations', () => {
    // Test that something doesn't throw
    const [error] = safeRun(() => order.addItem(item));
    expect(error).toBeUndefined();
  });

  it('should throw for programming errors', () => {
    // Test that programming errors throw
    const [error] = safeRun(() => new EntityId(null as any, 'text'));
    expect(error).toBeInstanceOf(Error);
    expect(error?.message).toContain('required');
  });

  it('should handle async operations', async () => {
    // Async safeRun
    const [error, result] = await safeRun(async () => {
      return await orderService.process(order);
    });
    expect(error).toBeUndefined();
    expect(result?.status).toBe('processed');
  });
});
```

### Forbidden Test Patterns

```typescript
// ❌ AVOID - Don't use these patterns
expect(() => someFunction()).toThrow(ErrorClass);
expect(() => someFunction()).toThrow('error message');
expect(() => someFunction()).not.toThrow();
await expect(async () => someFunction()).rejects.toThrow(ErrorClass);

// ✅ USE - safeRun pattern instead
const [error] = safeRun(() => someFunction());
expect(error).toBeInstanceOf(ErrorClass);
```

### Error Hierarchy

VytchesDDD provides base error classes in `@vytches/ddd-domain-primitives`:

```typescript
import {
  IDomainError,
  InvalidParameterError,
  MissingValueError,
  ValidationError,
} from '@vytches/ddd-domain-primitives';

// Domain-specific errors extend base classes
class InsufficientFundsError extends IDomainError {
  constructor(available: number, required: number) {
    super(`Insufficient funds: ${available} < ${required}`);
    this.name = 'InsufficientFundsError';
  }
}
```

## Logging

All packages use the `@vytches/ddd-logging` package:

```typescript
import { Logger } from '@vytches/ddd-logging';

class OrderService {
  private readonly logger = Logger.forContext('OrderService');

  async processOrder(order: Order): Promise<void> {
    this.logger.info('Processing order', { orderId: order.id });

    try {
      await this.validateOrder(order);
      this.logger.debug('Order validated', { orderId: order.id });
    } catch (error) {
      this.logger.error('Order processing failed', {
        orderId: order.id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
```

---

_Last updated: 2026-01-30_
