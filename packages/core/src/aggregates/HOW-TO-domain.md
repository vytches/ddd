# Aggregates in DomainTS - LLM-Optimized Guide

## Document Metadata

- **Pattern Name**: Aggregate Root
- **Category**: Domain-Driven Design (DDD) Pattern
- **Purpose**: Maintain consistency boundaries and coordinate domain object changes
- **Library**: DomainTS
- **Language**: TypeScript
- **Version**: 1.0.0

## Pattern Overview

### What are Aggregates?

Aggregates are clusters of domain objects that are treated as a single unit for data changes. The Aggregate Root is the gateway to the aggregate, ensuring consistency and invariants.

**Core Concept**:
```typescript
class Order extends AggregateRoot<string> {
  constructor(id: EntityId<string>) {
    super({ id });
  }
  
  // Apply domain events to change state
  placeOrder(customerId: string) {
    this.apply('OrderPlaced', { customerId });
  }
  
  // Handle events to update state
  protected onOrderPlaced(payload: { customerId: string }) {
    this.customerId = payload.customerId;
  }
}
```

## Core Components

### 1. IAggregateRoot Interface

Base interface for all aggregate roots:

```typescript
interface IAggregateRoot<TId = string> {
  getVersion(): number;
  getInitialVersion(): number;
  hasChanges(): boolean;
  commit(): void;
  getId(): EntityId<TId>;
  getDomainEvents(): ReadonlyArray<IExtendedDomainEvent>;
}
```

### 2. AggregateRoot Class

Complete implementation with optional capabilities:

```typescript
class AggregateRoot<TId = string, TState = any, TMeta = object>
  implements IAggregateRoot<TId>, ISnapshotable<TState, TMeta>, IVersioned {
  
  constructor({ id, version = 0 }: IAggregateConstructorParams<TId>);
  
  // Core functionality
  protected apply(eventType: string, payload: any, metadata?: Partial<IEventMetadata>): void;
  protected apply(domainEvent: IDomainEvent, metadata?: Partial<IEventMetadata>): void;
  
  // Optional features
  enableSnapshots(): this;
  enableVersioning(): this;
}
```

### 3. Optional Capabilities

**Snapshots** (ISnapshotable):
- Save aggregate state at a point in time
- Restore from saved state
- Optimize event replay

**Versioning** (IVersioned):
- Support for event schema evolution
- Register upcasters for event transformation
- Handle multiple event versions

### 4. Aggregate-Specific Errors

```typescript
class AggregateError extends IDomainError {
  static invalidArguments(message: string): AggregateError;
  static versionConflict(...): AggregateError;
  static featureNotEnabled(feature: string): AggregateError;
  static methodNotImplemented(methodName: string): AggregateError;
  static invalidSnapshot(aggregateType: string): AggregateError;
  static idMismatch(snapshotId: any, aggregateId: any): AggregateError;
  static typeMismatch(snapshotType: string, aggregateType: string): AggregateError;
  static duplicateUpcaster(eventType: string, version: number): AggregateError;
  static missingUpcaster(eventType: string, fromVersion: number, toVersion: number): AggregateError;
}
```

## Key Features

### 1. Event-Based State Changes

Aggregates change state by applying domain events:

```typescript
class Customer extends AggregateRoot<string> {
  private email: string;
  
  changeEmail(newEmail: string) {
    // Validation
    if (!isValidEmail(newEmail)) {
      throw new Error('Invalid email');
    }
    
    // Apply event
    this.apply('EmailChanged', { email: newEmail });
  }
  
  protected onEmailChanged(payload: { email: string }) {
    this.email = payload.email;
  }
}
```

### 2. Version Control

Built-in optimistic concurrency control:

```typescript
// Check version before saving
aggregate.checkVersion(expectedVersion); // Throws on mismatch

// Track versions
aggregate.getVersion();      // Current version
aggregate.getInitialVersion(); // Version when loaded
```

### 3. Domain Event Collection

Aggregates collect domain events until committed:

```typescript
const order = new Order(id);
order.placeOrder(customerId);
order.addItem(productId, quantity);

// Events are collected but not dispatched
order.getDomainEvents(); // Returns 2 events
order.hasChanges(); // true

// Clear events after persistence
order.commit();
order.hasChanges(); // false
```

### 4. Snapshot Support

Optional capability for state persistence:

```typescript
class Account extends AggregateRoot<string, AccountState> {
  constructor(id: EntityId<string>) {
    super({ id });
    this.enableSnapshots();
  }
  
  serializeState(): AccountState {
    return { balance: this.balance, status: this.status };
  }
  
  deserializeState(state: AccountState): void {
    this.balance = state.balance;
    this.status = state.status;
  }
}

// Create snapshot
const snapshot = account.createSnapshot();

// Restore from snapshot
const newAccount = new Account(id);
newAccount.enableSnapshots();
newAccount.restoreFromSnapshot(snapshot);
```

### 5. Event Versioning

Support for event schema evolution:

```typescript
class Product extends AggregateRoot<string> {
  constructor(id: EntityId<string>) {
    super({ id });
    this.enableVersioning();
    
    // Register upcaster from v1 to v2
    this.registerUpcaster('PriceChanged', 1, {
      upcast(payload: { price: number }) {
        return { price: payload.price, currency: 'USD' };
      }
    });
  }
  
  // Version-specific handlers
  protected onPriceChanged_v1(payload: { price: number }) {
    this.price = payload.price;
  }
  
  protected onPriceChanged_v2(payload: { price: number; currency: string }) {
    this.price = payload.price;
    this.currency = payload.currency;
  }
}
```

## Usage Patterns

### Basic Aggregate

```typescript
class Order extends AggregateRoot<string> {
  private customerId: string;
  private items: OrderItem[] = [];
  private status: OrderStatus = 'pending';
  
  constructor(id: EntityId<string>) {
    super({ id });
  }
  
  place(customerId: string) {
    this.apply('OrderPlaced', { customerId });
  }
  
  addItem(productId: string, quantity: number, price: number) {
    this.apply('ItemAdded', { productId, quantity, price });
  }
  
  protected onOrderPlaced(payload: { customerId: string }) {
    this.customerId = payload.customerId;
  }
  
  protected onItemAdded(payload: { productId: string; quantity: number; price: number }) {
    this.items.push(new OrderItem(payload.productId, payload.quantity, payload.price));
  }
}
```

### Event Sourced Aggregate

```typescript
class BankAccount extends AggregateRoot<string> {
  private balance: number = 0;
  
  static fromHistory(id: EntityId<string>, events: IExtendedDomainEvent[]): BankAccount {
    const account = new BankAccount(id);
    (account as any).loadFromHistory(events);
    return account;
  }
  
  deposit(amount: number) {
    if (amount <= 0) throw new Error('Amount must be positive');
    this.apply('MoneyDeposited', { amount });
  }
  
  withdraw(amount: number) {
    if (amount > this.balance) throw new Error('Insufficient funds');
    this.apply('MoneyWithdrawn', { amount });
  }
  
  protected onMoneyDeposited(payload: { amount: number }) {
    this.balance += payload.amount;
  }
  
  protected onMoneyWithdrawn(payload: { amount: number }) {
    this.balance -= payload.amount;
  }
}
```

## Best Practices

1. **Keep Aggregates Small**: Focus on consistency boundaries
2. **Use Domain Events**: All state changes through events
3. **Validate in Methods**: Check invariants before applying events
4. **Name Events Clearly**: Use past tense (OrderPlaced, ItemAdded)
5. **Version from Start**: Enable versioning early if events might evolve

## Integration with DomainTS

Aggregates integrate with:
- **Repositories**: Persist and retrieve aggregates
- **Unit of Work**: Manage transactions and event dispatch
- **Event Bus**: Publish collected domain events
- **Value Objects**: Use as aggregate properties

## Error Handling

The system provides specific errors for aggregate operations:
- Version conflicts for concurrency control
- Feature not enabled for optional capabilities
- Invalid snapshots or mismatched IDs
- Missing event handlers or upcasters

## Conclusion

DomainTS Aggregates provide:
- **Consistency Boundaries**: Enforce business invariants
- **Event Sourcing Ready**: Built-in event collection and replay
- **Version Control**: Optimistic concurrency handling
- **Optional Features**: Snapshots and versioning when needed
- **Type Safety**: Full TypeScript support with generics

The pattern ensures domain consistency while providing flexibility for different persistence strategies and event sourcing implementations.
