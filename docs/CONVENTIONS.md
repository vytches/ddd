# VytchesDDD Conventions Guide

This document defines the coding conventions and patterns used throughout the VytchesDDD library.

## Factory Method Naming Convention

### Overview

Factory methods must follow a consistent naming convention across all packages for API predictability.

### Conventions

| Pattern | Purpose | Example |
|---------|---------|---------|
| `create()` | Primary factory for new instances with generated values | `EntityId.create()` - creates with random UUID |
| `from*(source)` | Conversion/reconstitution from external data | `EntityId.fromUUID(uuid)`, `fromText(text)` |
| `of(value)` | Simple wrapping of a primitive value | `Money.of(100)` |
| `empty()` | Creates a null/empty instance | `Optional.empty()` |
| `reconstitute(props)` | Rebuild from stored state (no validation) | `Order.reconstitute(dbRecord)` |

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

The following methods are deprecated and will be removed in the next major version:

| Deprecated | Use Instead |
|------------|-------------|
| `createWithRandomUUID()` | `create()` |
| `createUuid(value)` | `fromUUID(value)` |
| `createText(value)` | `fromText(value)` |
| `createInteger(value)` | `fromInteger(value)` |
| `createBigInt(value)` | `fromBigInt(value)` |

### Best Practices

1. **Use `create()` for new entities** - When creating a new domain object, use the primary `create()` method
2. **Use `from*()` for external data** - When loading from APIs, databases, or user input
3. **Use `reconstitute()` for event sourcing** - When rebuilding aggregates from event history
4. **Avoid direct constructor access** - Prefer factory methods for consistency and validation

## Constructor Patterns

### Standard Pattern

```typescript
class Order extends AggregateRoot {
  // Private constructor - prevents direct instantiation
  private constructor(props: OrderProps) {
    super(props);
  }

  // Primary factory - validates and creates new instance
  static create(data: CreateOrderData): Result<Order, ValidationError> {
    const validation = this.validate(data);
    if (validation.isFailure) {
      return Result.fail(validation.error);
    }
    return Result.ok(new Order(validated));
  }

  // Reconstitution - no validation, used for persistence/event sourcing
  static reconstitute(props: OrderProps): Order {
    return new Order(props);
  }
}
```

### Guidelines

1. **Private constructors** - Aggregates and entities should have private constructors
2. **`create()` validates** - The `create()` factory performs all validation
3. **`reconstitute()` trusts data** - Used only for known-good data from storage
4. **Return Result** - Factory methods that can fail should return `Result<T, Error>`

## Error Handling

### Result Pattern

All fallible operations should return `Result<T, Error>`:

```typescript
// Good - returns Result
static create(data: CreateOrderData): Result<Order, ValidationError> {
  if (!data.customerId) {
    return Result.fail(new ValidationError('Customer ID required'));
  }
  return Result.ok(new Order(data));
}

// Avoid - throws exceptions
static create(data: CreateOrderData): Order {
  if (!data.customerId) {
    throw new ValidationError('Customer ID required');  // Avoid this
  }
  return new Order(data);
}
```

### Exception Guidelines

Use exceptions only for:
- Programming errors (null checks on required params)
- Unrecoverable infrastructure failures
- Framework integration requirements

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

*Last updated: 2026-01-30*
