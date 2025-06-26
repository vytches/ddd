# Value Objects in DomainTS - LLM-Optimized Guide

## Document Metadata

- **Pattern Name**: Value Objects
- **Category**: Domain-Driven Design (DDD) Pattern
- **Purpose**: Represent immutable, self-validating domain concepts without identity
- **Library**: DomainTS
- **Language**: TypeScript
- **Version**: 1.0.0

## Pattern Overview

### What are Value Objects?

Value Objects represent descriptive aspects of the domain with no conceptual identity. They are defined by their attributes rather than a unique identifier. Examples include Money, Email, Address, or DateRange.

**Key Characteristics**:
- Immutable (cannot be changed after creation)
- Equality based on value, not identity
- Self-validating
- Side-effect free

### Primary Use Cases

1. **Domain Concepts**: Model concepts like Money, Email, PhoneNumber
2. **Type Safety**: Prevent primitive obsession
3. **Business Rules**: Encapsulate validation and constraints
4. **Composition**: Build complex value objects from simpler ones

## Core Components

### 1. BaseValueObject

Abstract base class for all value objects:

```typescript
abstract class BaseValueObject<T> implements ValueObjectValidator<T> {
  protected readonly value: T;

  constructor(value: T);
  
  // Equality comparison
  equals(valueObject: BaseValueObject<T>): boolean;
  
  // String representation
  toString(): string;
  
  // JSON serialization
  toJSON(): string;
  
  // Get raw value
  getValue(): T;
  
  // Validation - must be implemented
  abstract validate(value: any): boolean;
}
```

### 2. ValueObjectValidator Interface

```typescript
interface ValueObjectValidator<T> {
  validate(value: T): boolean;
}
```

### 3. EntityId Value Object

Specialized value object for entity identifiers:

```typescript
class EntityId<T = string> extends BaseValueObject<T> {
  private readonly type: IdType;

  constructor(value: T, type: IdType);
  
  // Factory methods
  static createWithRandomUUID(): EntityId;
  static fromUUID(value: string): EntityId;
  static fromInteger(value: number): EntityId;
  static fromBigInt(value: string | bigint): EntityId;
  static fromText(value: string): EntityId;
  
  // Type checking
  getType(): IdType;
  isType(type: IdType): boolean;
}
```

### 4. Supported ID Types

```typescript
type IdType = 'uuid' | 'integer' | 'text' | 'bigint';
```

## Implementation Pattern

### Creating Custom Value Objects

```typescript
class Email extends BaseValueObject<string> {
  constructor(value: string) {
    super(value);
    if (!this.validate(value)) {
      throw new InvalidParameterError('Invalid email format');
    }
  }
  
  validate(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }
  
  getDomain(): string {
    return this.value.split('@')[1];
  }
}
```

### Using EntityId

```typescript
// Create new UUID
const id1 = EntityId.createWithRandomUUID();

// From existing UUID
const id2 = EntityId.fromUUID('550e8400-e29b-41d4-a716-446655440000');

// From integer
const id3 = EntityId.fromInteger(12345);

// From text
const id4 = EntityId.fromText('order-2024-001');

// From BigInt
const id5 = EntityId.fromBigInt('9007199254740991');
```

## Key Concepts

### Immutability

Value objects are immutable. To "change" a value object, create a new instance:

```typescript
class Money extends BaseValueObject<{ amount: number; currency: string }> {
  add(other: Money): Money {
    // Returns new instance instead of modifying current one
    return new Money({
      amount: this.value.amount + other.value.amount,
      currency: this.value.currency
    });
  }
}
```

### Equality

Value objects are compared by value, not reference:

```typescript
const email1 = new Email('user@example.com');
const email2 = new Email('user@example.com');

email1.equals(email2); // true - same value
email1 === email2;     // false - different instances
```

### Validation

Validation happens at construction time:

```typescript
class Age extends BaseValueObject<number> {
  constructor(value: number) {
    super(value);
    if (!this.validate(value)) {
      throw new InvalidParameterError('Age must be between 0 and 150');
    }
  }
  
  validate(value: number): boolean {
    return value >= 0 && value <= 150;
  }
}
```

## Best Practices

### 1. Fail Fast

Always validate in constructor:

```typescript
// Good
constructor(value: string) {
  super(value);
  if (!this.validate(value)) {
    throw new InvalidParameterError('Invalid value');
  }
}
```

### 2. Meaningful Factory Methods

Provide clear factory methods for different creation scenarios:

```typescript
class DateRange extends BaseValueObject<{ start: Date; end: Date }> {
  static fromDates(start: Date, end: Date): DateRange {
    return new DateRange({ start, end });
  }
  
  static forDays(startDate: Date, days: number): DateRange {
    const end = new Date(startDate);
    end.setDate(end.getDate() + days);
    return new DateRange({ start: startDate, end });
  }
}
```

### 3. Rich Behavior

Add domain-specific methods:

```typescript
class PhoneNumber extends BaseValueObject<string> {
  getCountryCode(): string {
    return this.value.substring(0, 3);
  }
  
  getAreaCode(): string {
    return this.value.substring(3, 6);
  }
  
  format(): string {
    return `(${this.getAreaCode()}) ${this.value.substring(6)}`;
  }
}
```

### 4. Type Safety with EntityId

Use specific ID types to prevent mixing identifiers:

```typescript
class OrderId extends EntityId<string> {
  constructor(value: string) {
    super(value, 'uuid');
  }
}

class CustomerId extends EntityId<string> {
  constructor(value: string) {
    super(value, 'uuid');
  }
}

// Prevents mixing IDs from different entities
function processOrder(orderId: OrderId, customerId: CustomerId) {
  // Type-safe operations
}
```

## Integration with DomainTS

Value Objects integrate seamlessly with other DomainTS components:

### With Entities

```typescript
class Order extends BaseEntity<OrderId> {
  constructor(
    id: OrderId,
    private customerEmail: Email,
    private totalAmount: Money,
    private shippingAddress: Address
  ) {
    super(id);
  }
}
```

### With Domain Events

```typescript
class OrderPlacedEvent extends BaseDomainEvent {
  constructor(
    public readonly orderId: OrderId,
    public readonly customerEmail: Email,
    public readonly totalAmount: Money
  ) {
    super();
  }
}
```

### With Specifications

```typescript
class MinimumOrderAmountSpec extends CompositeSpecification<Order> {
  constructor(private minimumAmount: Money) {
    super();
  }
  
  isSatisfiedBy(order: Order): boolean {
    return order.totalAmount.isGreaterThan(this.minimumAmount);
  }
}
```

## Performance Considerations

1. **Caching**: Consider caching frequently used value objects
2. **Validation Cost**: Keep validation logic efficient
3. **Memory Usage**: Be mindful of creating many small objects
4. **Serialization**: Implement efficient `toJSON()` methods

## Error Handling

DomainTS provides specific errors for value object violations:

- `MissingValueError`: When required value is missing
- `InvalidParameterError`: When validation fails

```typescript
static fromUUID(value: string): EntityId {
  if (!LibUtils.hasValue(value)) {
    throw MissingValueError.withValue('entity identifier');
  }
  
  if (!LibUtils.isValidUUID(value)) {
    throw InvalidParameterError.withParameter('entity identifier');
  }
  
  return new EntityId(value, 'uuid');
}
```

## Conclusion

Value Objects in DomainTS provide:

- **Type Safety**: Prevent primitive obsession
- **Domain Modeling**: Express domain concepts clearly
- **Validation**: Ensure business rules at construction
- **Immutability**: Predictable behavior without side effects
- **Reusability**: Share common domain concepts

The pattern is essential for building a rich domain model that captures business rules and prevents invalid states, while the EntityId implementation provides type-safe identifiers across your domain.
