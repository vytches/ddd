# Basic Aggregate Implementation Overview

**Version**: 1.0.0 **Package**: @vytches/ddd-aggregates **Complexity**: Basic
**Domain**: Core Domain-Driven Design Patterns

## Overview

This document provides implementation guidance for basic aggregate root patterns
using @vytches/ddd-aggregates. These patterns form the foundation of
domain-driven design and ensure proper encapsulation, consistency, and event
handling.

## Core Implementation Patterns

### 1. Factory Method Pattern

**Purpose**: Ensure valid aggregate creation with proper validation

```typescript
// ✅ CORRECT: Factory method with validation
static create(data: CreateUserData): UserAggregate {
  const user = new UserAggregate(EntityId.generate());

  // Validate business rules before setting state
  user.validateEmail(data.email);
  user.validateUsername(data.username);

  // Set initial state
  user.email = data.email.toLowerCase();
  user.username = data.username.toLowerCase();

  // Emit domain event
  user.addDomainEvent(new UserCreatedEvent(
    user.id.value,
    user.email,
    user.username
  ));

  return user;
}

// ❌ WRONG: Public constructor allows invalid state
constructor(email: string, username: string) {
  super(EntityId.generate());
  this.email = email; // No validation
  this.username = username; // No validation
}
```

### 2. Invariant Protection

**Purpose**: Maintain business rules and data consistency

```typescript
// ✅ CORRECT: Validate before state changes
updateProfile(data: UpdateUserData): void {
  this.ensureActive(); // Check preconditions

  if (data.email && data.email !== this.email) {
    this.validateEmail(data.email); // Validate before change
    this.email = data.email.toLowerCase();
  }

  this.updatedAt = new Date();
  this.addDomainEvent(new UserUpdatedEvent(this.id.value, data));
}

// ❌ WRONG: Direct property access without validation
updateEmail(email: string): void {
  this.email = email; // No validation or business rules
}
```

### 3. Domain Event Handling

**Purpose**: Communicate state changes to other parts of the system

```typescript
// ✅ CORRECT: Emit events for significant changes
confirm(): void {
  this.transitionTo('confirmed');
  this.updatedAt = new Date();

  // Always emit domain events for state changes
  this.addDomainEvent(new OrderConfirmedEvent(
    this.id.value,
    this.updatedAt
  ));
}

// ❌ WRONG: State change without events
confirm(): void {
  this.status = 'confirmed'; // Silent state change
  this.updatedAt = new Date();
}
```

### 4. Snapshot Pattern

**Purpose**: Serialize/deserialize aggregate state for persistence

```typescript
// ✅ CORRECT: Complete state capture with reconstitution
toSnapshot(): UserData {
  return {
    id: this.id.value,
    email: this.email,
    username: this.username,
    firstName: this.firstName,
    lastName: this.lastName,
    phoneNumber: this.phoneNumber,
    isActive: this.isActive,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
}

static fromSnapshot(id: EntityId, data: UserData): UserAggregate {
  const user = new UserAggregate(id);

  // Restore state without validation (already validated)
  user.email = data.email;
  user.username = data.username;
  // ... restore all properties

  // IMPORTANT: Mark as hydrated to prevent event emission
  user.markAsHydrated();

  return user;
}

// ❌ WRONG: Incomplete state or missing reconstitution
toSnapshot(): Partial<UserData> {
  return { email: this.email }; // Missing critical data
}
```

## Essential Implementation Guidelines

### State Management

```typescript
// ✅ CORRECT: Private fields with controlled access
export class OrderAggregate extends AggregateRoot {
  private customerId: string;
  private status: OrderStatus;
  private items: OrderItem[];

  // Controlled state access through methods
  addItem(item: OrderItem): void {
    this.validateItem(item);
    this.items.push(item);
    this.recalculateTotal();
  }

  // Read-only state access
  get orderTotal(): number {
    return this.totalAmount;
  }
}

// ❌ WRONG: Public fields allow direct manipulation
export class OrderAggregate extends AggregateRoot {
  public customerId: string; // Can be modified externally
  public status: OrderStatus; // Bypasses business rules
  public items: OrderItem[]; // Direct access breaks encapsulation
}
```

### Business Rule Validation

```typescript
// ✅ CORRECT: Comprehensive validation with clear error messages
private validateEmail(email: string): void {
  if (!email) {
    throw new InvalidUserDataError('Email is required');
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new InvalidUserDataError('Invalid email format');
  }

  if (email.length > 254) {
    throw new InvalidUserDataError('Email exceeds maximum length');
  }
}

// ❌ WRONG: Weak or missing validation
private validateEmail(email: string): void {
  if (!email.includes('@')) {
    throw new Error('Bad email'); // Vague error
  }
}
```

### Event Emission Strategy

```typescript
// ✅ CORRECT: Emit events for all business-significant changes
class InventoryAggregate extends AggregateRoot {
  reserveStock(quantity: number, orderId: string): string {
    // Validate business rules
    if (this.availableStock < quantity) {
      throw new InsufficientStockError(this.availableStock, quantity);
    }

    // Update state
    this.availableStock -= quantity;
    this.reservedStock += quantity;

    // Record reservation
    const reservation = { id: generateId(), quantity, orderId };
    this.reservations.set(reservation.id, reservation);

    // Emit domain event
    this.addDomainEvent(
      new StockReservedEvent(this.id.value, reservation.id, quantity, orderId)
    );

    // Check for additional business events
    this.checkLowStock();

    return reservation.id;
  }
}
```

## Common Anti-Patterns to Avoid

### 1. Anemic Domain Model

```typescript
// ❌ WRONG: Anemic aggregate with no behavior
class UserAggregate extends AggregateRoot {
  public email: string;
  public firstName: string;
  public isActive: boolean;

  // Only getters and setters, no business logic
}

// External service handles business logic
class UserService {
  deactivateUser(user: UserAggregate, reason: string): void {
    user.isActive = false; // Business logic outside aggregate
    // Missing domain events, validation, etc.
  }
}

// ✅ CORRECT: Rich domain model
class UserAggregate extends AggregateRoot {
  private email: string;
  private isActive: boolean;

  // Business behavior within aggregate
  deactivate(reason: string): void {
    if (!this.isActive) {
      throw new UserAlreadyDeactivatedError(this.id.value);
    }

    this.isActive = false;
    this.addDomainEvent(new UserDeactivatedEvent(this.id.value, reason));
  }
}
```

### 2. Missing Invariant Protection

```typescript
// ❌ WRONG: Allow invalid state transitions
class OrderAggregate extends AggregateRoot {
  setStatus(newStatus: OrderStatus): void {
    this.status = newStatus; // Any transition allowed
  }
}

// ✅ CORRECT: Enforce valid transitions
class OrderAggregate extends AggregateRoot {
  private static readonly VALID_TRANSITIONS: Record<
    OrderStatus,
    OrderStatus[]
  > = {
    draft: ['pending', 'cancelled'],
    pending: ['confirmed', 'cancelled'],
    confirmed: ['processing', 'cancelled'],
  };

  private transitionTo(newStatus: OrderStatus): void {
    const allowedTransitions = OrderAggregate.VALID_TRANSITIONS[this.status];
    if (!allowedTransitions.includes(newStatus)) {
      throw new InvalidOrderStateTransitionError(this.status, newStatus);
    }
    this.status = newStatus;
  }
}
```

### 3. Event Emission on Reconstitution

```typescript
// ❌ WRONG: Emit events when loading from storage
static fromSnapshot(id: EntityId, data: UserData): UserAggregate {
  const user = new UserAggregate(id);
  user.email = data.email;

  // This will emit events during reconstitution!
  user.addDomainEvent(new UserRestoredEvent(user.id.value));

  return user;
}

// ✅ CORRECT: No events during reconstitution
static fromSnapshot(id: EntityId, data: UserData): UserAggregate {
  const user = new UserAggregate(id);
  user.email = data.email;

  // Mark as hydrated to prevent event emission
  user.markAsHydrated();

  return user;
}
```

## Testing Strategies

### Basic Aggregate Testing

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { safeRun } from '@vytches/ddd-utils';
import { UserAggregate } from '../src/user.aggregate';

describe('UserAggregate', () => {
  describe('create', () => {
    it('should create user with valid data', () => {
      const [error, user] = safeRun(() =>
        UserAggregate.create({
          email: 'john@example.com',
          username: 'johndoe',
          firstName: 'John',
          lastName: 'Doe',
        })
      );

      expect(error).toBeUndefined();
      expect(user.userEmail).toBe('john@example.com');
      expect(user.getUncommittedEvents()).toHaveLength(1);
    });

    it('should validate email format', () => {
      const [error] = safeRun(() =>
        UserAggregate.create({
          email: 'invalid-email',
          username: 'johndoe',
          firstName: 'John',
          lastName: 'Doe',
        })
      );

      expect(error).toBeInstanceOf(InvalidUserDataError);
      expect(error?.message).toContain('Invalid email format');
    });
  });
});
```

## Performance Considerations

### Memory Management

```typescript
// ✅ CORRECT: Limit collections to reasonable sizes
class InventoryAggregate extends AggregateRoot {
  private movements: StockMovement[];

  private recordMovement(movement: StockMovement): void {
    this.movements.push(movement);

    // Keep only last 100 movements to prevent memory leaks
    if (this.movements.length > 100) {
      this.movements = this.movements.slice(-100);
    }
  }
}

// ❌ WRONG: Unbounded collections
class InventoryAggregate extends AggregateRoot {
  private movements: StockMovement[];

  private recordMovement(movement: StockMovement): void {
    this.movements.push(movement); // Grows indefinitely
  }
}
```

### Event Management

```typescript
// ✅ CORRECT: Regular event commits
class OrderProcessor {
  async processOrder(orderId: string): Promise<void> {
    const order = await this.orderRepository.findById(orderId);

    order.confirm();
    order.startProcessing();

    // Save and commit events regularly
    await this.orderRepository.save(order);
    order.markEventsAsCommitted();
  }
}
```

## Key Takeaways

1. **Factory Methods**: Always use factory methods for aggregate creation
2. **Invariant Protection**: Validate business rules before state changes
3. **Domain Events**: Emit events for all significant state changes
4. **Encapsulation**: Keep aggregate state private with controlled access
5. **No Events on Reconstitution**: Mark as hydrated when loading from storage
6. **Complete Snapshots**: Capture full aggregate state for persistence
7. **Business Logic**: Keep domain behavior within the aggregate
8. **Testing**: Use safeRun for error testing, validate events and state

These patterns ensure your aggregates properly encapsulate business logic,
maintain consistency, and integrate well with the broader domain-driven design
architecture.
