# @vytches/ddd-aggregates

[![npm version](https://badge.fury.io/js/%40vytches%2Fddd-aggregates.svg)](https://badge.fury.io/js/%40vytches%2Fddd-aggregates)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Enterprise-grade aggregate root implementations for Domain-Driven Design**

Complete aggregate root implementation with built-in event sourcing, capability
system, and automatic event management. Designed for complex domain models with
strong consistency boundaries.

## 📋 Table of Contents

- [Installation](#installation)
- [Key Features](#key-features)
- [Core Concepts](#core-concepts)
- [Quick Start](#quick-start)
- [Advanced Features](#advanced-features)
- [API Reference](#api-reference)
- [Patterns & Best Practices](#patterns--best-practices)
- [Event Sourcing](#event-sourcing)
- [Capabilities](#capabilities)
- [Testing](#testing)
- [Performance](#performance)
- [Contributing](#contributing)

## 🚀 Installation

```bash
# npm
npm install @vytches/ddd-aggregates

# yarn
yarn add @vytches/ddd-aggregates

# pnpm
pnpm add @vytches/ddd-aggregates
```

### Peer Dependencies

```bash
# Required for full functionality
npm install @vytches/ddd-domain-primitives @vytches/ddd-events @vytches/ddd-utils
```

## ✨ Key Features

### Aggregate Root Foundation

- **Event Sourcing**: Built-in event sourcing with automatic event management
- **Capability System**: Extensible capabilities for cross-cutting concerns
- **Concurrency Control**: Optimistic concurrency with version management
- **Snapshot Support**: Automatic snapshots for performance optimization

### Enterprise Features

- **Strong Consistency**: Aggregate consistency boundary enforcement
- **Event Management**: Automatic event collection and publishing
- **State Validation**: Built-in invariant validation
- **Audit Trail**: Complete audit trail with event history

### Developer Experience

- **Type Safety**: Full TypeScript support with generic typing
- **Fluent API**: Intuitive API for domain modeling
- **Testing Support**: Built-in testing utilities and builders
- **Documentation**: Comprehensive documentation and examples

## 🎯 Core Concepts

### Aggregate Root

An aggregate root is the only member of an aggregate that outside objects are
allowed to hold references to. It's the gatekeeper for the aggregate, ensuring
consistency and managing the lifecycle of the aggregate.

```typescript
// Base aggregate root interface
interface IAggregateRoot {
  readonly id: EntityId;
  readonly version: number;

  // Event management
  addDomainEvent(event: IDomainEvent): void;
  getUncommittedEvents(): IDomainEvent[];
  markEventsAsCommitted(): void;

  // Capability system
  addCapability<T extends IAggregateCapability>(capability: T): void;
  getCapability<T extends IAggregateCapability>(type: new () => T): T | null;
  hasCapability<T extends IAggregateCapability>(type: new () => T): boolean;

  // Lifecycle
  toSnapshot(): AggregateSnapshot;
  fromSnapshot(snapshot: AggregateSnapshot): void;
}
```

### Event Sourcing

Event sourcing is a pattern where state changes are stored as a sequence of
events. The current state is derived by replaying these events.

```typescript
// Event sourced aggregate
abstract class EventSourcedAggregate extends AggregateRoot {
  // Apply event to current state
  protected apply(event: IDomainEvent): void;

  // Replay events to rebuild state
  static fromEventStream<T extends EventSourcedAggregate>(
    events: IDomainEvent[]
  ): T;

  // Event handlers (implemented by subclasses)
  protected abstract getEventHandlers(): EventHandlerMap;
}
```

### Capabilities

Capabilities are modular extensions that can be added to aggregates to provide
cross-cutting concerns like auditing, caching, or validation.

```typescript
// Capability interface
interface IAggregateCapability {
  readonly name: string;

  // Lifecycle hooks
  onEventApplied?(event: IDomainEvent): void;
  onSnapshotCreated?(snapshot: AggregateSnapshot): void;
  beforeSave?(): void;
  afterSave?(): void;
}
```

## 🚀 Quick Start

### 1. Basic Aggregate Root

```typescript
import { AggregateRoot, EntityId } from '@vytches/ddd-aggregates';
import { DomainEvent } from '@vytches/ddd-events';
import { Result } from '@vytches/ddd-utils';

// Domain events
class OrderCreatedEvent extends DomainEvent<{
  orderId: string;
  customerId: string;
  totalAmount: number;
  currency: string;
}> {
  constructor(payload: OrderCreatedData) {
    super('OrderCreated', payload);
  }
}

class OrderItemAddedEvent extends DomainEvent<{
  orderId: string;
  productId: string;
  quantity: number;
  price: number;
}> {
  constructor(payload: OrderItemAddedData) {
    super('OrderItemAdded', payload);
  }
}

// Value objects
class OrderStatus {
  static readonly PENDING = new OrderStatus('PENDING');
  static readonly CONFIRMED = new OrderStatus('CONFIRMED');
  static readonly SHIPPED = new OrderStatus('SHIPPED');
  static readonly DELIVERED = new OrderStatus('DELIVERED');
  static readonly CANCELLED = new OrderStatus('CANCELLED');

  private constructor(private readonly value: string) {}

  equals(other: OrderStatus): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}

// Aggregate root implementation
class OrderAggregate extends AggregateRoot {
  private customerId: EntityId;
  private items: OrderItem[] = [];
  private status: OrderStatus = OrderStatus.PENDING;
  private totalAmount: number = 0;
  private currency: string = 'USD';

  private constructor(id: EntityId, customerId: EntityId) {
    super(id);
    this.customerId = customerId;
  }

  // Factory method
  static create(customerId: EntityId): OrderAggregate {
    const order = new OrderAggregate(EntityId.create(), customerId);

    // Add creation event
    order.addDomainEvent(
      new OrderCreatedEvent({
        orderId: order.id.value,
        customerId: customerId.value,
        totalAmount: 0,
        currency: 'USD',
      })
    );

    return order;
  }

  // Business methods
  addItem(
    productId: EntityId,
    quantity: number,
    price: number
  ): Result<void, Error> {
    // Validate business rules
    if (quantity <= 0) {
      return Result.fail(new Error('Quantity must be positive'));
    }

    if (price < 0) {
      return Result.fail(new Error('Price cannot be negative'));
    }

    if (!this.status.equals(OrderStatus.PENDING)) {
      return Result.fail(new Error('Cannot add items to non-pending order'));
    }

    // Apply changes
    const item = new OrderItem(productId, quantity, price);
    this.items.push(item);
    this.totalAmount += quantity * price;

    // Add domain event
    this.addDomainEvent(
      new OrderItemAddedEvent({
        orderId: this.id.value,
        productId: productId.value,
        quantity,
        price,
      })
    );

    return Result.ok();
  }

  confirm(): Result<void, Error> {
    if (!this.status.equals(OrderStatus.PENDING)) {
      return Result.fail(new Error('Order must be pending to confirm'));
    }

    if (this.items.length === 0) {
      return Result.fail(new Error('Cannot confirm empty order'));
    }

    this.status = OrderStatus.CONFIRMED;

    this.addDomainEvent(
      new OrderConfirmedEvent({
        orderId: this.id.value,
        confirmedAt: new Date(),
        totalAmount: this.totalAmount,
      })
    );

    return Result.ok();
  }

  // Getters
  getCustomerId(): EntityId {
    return this.customerId;
  }

  getItems(): ReadonlyArray<OrderItem> {
    return this.items;
  }

  getStatus(): OrderStatus {
    return this.status;
  }

  getTotalAmount(): number {
    return this.totalAmount;
  }

  getCurrency(): string {
    return this.currency;
  }
}

// Usage
const order = OrderAggregate.create(EntityId.from('customer-123'));

const addResult = order.addItem(EntityId.from('product-456'), 2, 29.99);

if (addResult.isSuccess()) {
  const confirmResult = order.confirm();

  if (confirmResult.isSuccess()) {
    console.log('Order confirmed:', order.id.value);
    console.log('Events:', order.getUncommittedEvents());
  }
}
```

### 2. Event-Sourced Aggregate

```typescript
import {
  EventSourcedAggregate,
  EventHandlerMap,
} from '@vytches/ddd-aggregates';

class BankAccountAggregate extends EventSourcedAggregate {
  private balance: number = 0;
  private status: AccountStatus = AccountStatus.ACTIVE;
  private overdraftLimit: number = 0;

  private constructor() {
    super();
  }

  // Factory method
  static create(
    accountId: EntityId,
    initialDeposit: number,
    overdraftLimit: number = 0
  ): BankAccountAggregate {
    const account = new BankAccountAggregate();

    // Apply creation event
    account.apply(
      new AccountOpenedEvent({
        accountId: accountId.value,
        initialDeposit,
        overdraftLimit,
        openedAt: new Date(),
      })
    );

    return account;
  }

  // Business methods
  deposit(amount: number): Result<void, Error> {
    if (amount <= 0) {
      return Result.fail(new Error('Deposit amount must be positive'));
    }

    if (this.status !== AccountStatus.ACTIVE) {
      return Result.fail(new Error('Account is not active'));
    }

    this.apply(
      new MoneyDepositedEvent({
        accountId: this.id.value,
        amount,
        balance: this.balance + amount,
        depositedAt: new Date(),
      })
    );

    return Result.ok();
  }

  withdraw(amount: number): Result<void, Error> {
    if (amount <= 0) {
      return Result.fail(new Error('Withdrawal amount must be positive'));
    }

    if (this.status !== AccountStatus.ACTIVE) {
      return Result.fail(new Error('Account is not active'));
    }

    const newBalance = this.balance - amount;
    if (newBalance < -this.overdraftLimit) {
      return Result.fail(new Error('Insufficient funds'));
    }

    this.apply(
      new MoneyWithdrawnEvent({
        accountId: this.id.value,
        amount,
        balance: newBalance,
        withdrawnAt: new Date(),
      })
    );

    return Result.ok();
  }

  // Event handlers
  protected getEventHandlers(): EventHandlerMap {
    return {
      AccountOpened: this.onAccountOpened.bind(this),
      MoneyDeposited: this.onMoneyDeposited.bind(this),
      MoneyWithdrawn: this.onMoneyWithdrawn.bind(this),
    };
  }

  private onAccountOpened(event: AccountOpenedEvent): void {
    this.id = EntityId.from(event.payload.accountId);
    this.balance = event.payload.initialDeposit;
    this.overdraftLimit = event.payload.overdraftLimit;
    this.status = AccountStatus.ACTIVE;
  }

  private onMoneyDeposited(event: MoneyDepositedEvent): void {
    this.balance = event.payload.balance;
  }

  private onMoneyWithdrawn(event: MoneyWithdrawnEvent): void {
    this.balance = event.payload.balance;
  }

  // Getters
  getBalance(): number {
    return this.balance;
  }

  getStatus(): AccountStatus {
    return this.status;
  }

  getOverdraftLimit(): number {
    return this.overdraftLimit;
  }
}

// Reconstitute from event stream
const events = await eventStore.getEventStream('account-123');
const account = BankAccountAggregate.fromEventStream(events);

console.log('Current balance:', account.getBalance());
```

### 3. Aggregate with Capabilities

```typescript
import {
  AggregateRoot,
  AuditCapability,
  CacheCapability,
  ValidationCapability,
} from '@vytches/ddd-aggregates';

class ProductAggregate extends AggregateRoot {
  private name: string;
  private price: number;
  private stock: number;
  private category: string;

  private constructor(
    id: EntityId,
    name: string,
    price: number,
    stock: number,
    category: string
  ) {
    super(id);
    this.name = name;
    this.price = price;
    this.stock = stock;
    this.category = category;
  }

  static create(
    name: string,
    price: number,
    initialStock: number,
    category: string
  ): ProductAggregate {
    const product = new ProductAggregate(
      EntityId.create(),
      name,
      price,
      initialStock,
      category
    );

    // Add capabilities
    product.addCapability(new AuditCapability());
    product.addCapability(new CacheCapability({ ttl: 300 })); // 5 minutes
    product.addCapability(new ValidationCapability());

    product.addDomainEvent(
      new ProductCreatedEvent({
        productId: product.id.value,
        name,
        price,
        stock: initialStock,
        category,
      })
    );

    return product;
  }

  updatePrice(newPrice: number): Result<void, Error> {
    // Validation capability automatically validates
    if (newPrice < 0) {
      return Result.fail(new Error('Price cannot be negative'));
    }

    const oldPrice = this.price;
    this.price = newPrice;

    // Audit capability automatically logs changes
    this.addDomainEvent(
      new ProductPriceUpdatedEvent({
        productId: this.id.value,
        oldPrice,
        newPrice,
        updatedAt: new Date(),
      })
    );

    return Result.ok();
  }

  adjustStock(quantity: number): Result<void, Error> {
    const newStock = this.stock + quantity;

    if (newStock < 0) {
      return Result.fail(new Error('Insufficient stock'));
    }

    this.stock = newStock;

    this.addDomainEvent(
      new ProductStockAdjustedEvent({
        productId: this.id.value,
        adjustment: quantity,
        newStock,
        adjustedAt: new Date(),
      })
    );

    return Result.ok();
  }

  // Getters
  getName(): string {
    return this.name;
  }

  getPrice(): number {
    return this.price;
  }

  getStock(): number {
    return this.stock;
  }

  getCategory(): string {
    return this.category;
  }
}

// Usage with capabilities
const product = ProductAggregate.create(
  'Gaming Laptop',
  1299.99,
  50,
  'Electronics'
);

// Audit capability tracks all changes
product.updatePrice(1199.99);
product.adjustStock(-5);

// Cache capability optimizes repeated access
const auditCapability = product.getCapability(AuditCapability);
console.log('Audit trail:', auditCapability.getAuditTrail());

// Validation capability ensures data integrity
const validationCapability = product.getCapability(ValidationCapability);
console.log('Validation rules:', validationCapability.getValidationRules());
```

## 🔧 Advanced Features

### Optimistic Concurrency Control

```typescript
class OrderAggregate extends AggregateRoot {
  // Version is automatically managed by base class

  updateShippingAddress(newAddress: Address): Result<void, Error> {
    // Check if aggregate is in correct state
    if (this.status !== OrderStatus.CONFIRMED) {
      return Result.fail(new Error('Cannot update shipping address'));
    }

    // Apply change
    this.shippingAddress = newAddress;

    // Version is automatically incremented
    this.addDomainEvent(
      new OrderShippingAddressUpdatedEvent({
        orderId: this.id.value,
        newAddress: newAddress.toJSON(),
        version: this.version + 1,
      })
    );

    return Result.ok();
  }
}

// Repository handles concurrency conflicts
class OrderRepository {
  async save(order: OrderAggregate): Promise<void> {
    try {
      await this.db.orders.update({
        where: {
          id: order.id.value,
          version: order.version - 1, // Expected version
        },
        data: {
          ...order.toSnapshot(),
          version: order.version,
        },
      });
    } catch (error) {
      if (error.code === 'P2025') {
        // Prisma: Record not found
        throw new OptimisticConcurrencyError(
          `Order ${order.id.value} was modified by another process`
        );
      }
      throw error;
    }
  }
}
```

### Snapshot Support

```typescript
class OrderAggregate extends AggregateRoot {
  // Snapshot creation
  toSnapshot(): AggregateSnapshot {
    return {
      id: this.id.value,
      version: this.version,
      data: {
        customerId: this.customerId.value,
        items: this.items.map(item => item.toJSON()),
        status: this.status.toString(),
        totalAmount: this.totalAmount,
        currency: this.currency,
        createdAt: this.createdAt.toISOString(),
        updatedAt: new Date().toISOString(),
      },
    };
  }

  // Snapshot restoration
  fromSnapshot(snapshot: AggregateSnapshot): void {
    this.id = EntityId.from(snapshot.id);
    this.version = snapshot.version;
    this.customerId = EntityId.from(snapshot.data.customerId);
    this.items = snapshot.data.items.map(item => OrderItem.fromJSON(item));
    this.status = OrderStatus.fromString(snapshot.data.status);
    this.totalAmount = snapshot.data.totalAmount;
    this.currency = snapshot.data.currency;
    this.createdAt = new Date(snapshot.data.createdAt);
    this.updatedAt = new Date(snapshot.data.updatedAt);
  }
}

// Automatic snapshot creation
class OrderRepository {
  async save(order: OrderAggregate): Promise<void> {
    // Save aggregate snapshot
    await this.db.orders.upsert({
      where: { id: order.id.value },
      update: order.toSnapshot(),
      create: order.toSnapshot(),
    });

    // Save events
    const events = order.getUncommittedEvents();
    await this.eventStore.append(order.id.value, events);

    // Create snapshot if threshold reached
    if (events.length >= this.snapshotThreshold) {
      await this.snapshotStore.createSnapshot(
        order.id.value,
        order.toSnapshot()
      );
    }
  }
}
```

### Invariant Validation

```typescript
class OrderAggregate extends AggregateRoot {
  // Invariant validation
  private validateInvariants(): void {
    // Business rules that must always be true
    if (this.totalAmount < 0) {
      throw new InvariantViolationError('Total amount cannot be negative');
    }

    if (this.items.length === 0 && this.status !== OrderStatus.PENDING) {
      throw new InvariantViolationError('Non-pending orders must have items');
    }

    if (this.status === OrderStatus.CONFIRMED && this.totalAmount === 0) {
      throw new InvariantViolationError(
        'Confirmed orders must have positive total'
      );
    }

    // Validate item consistency
    const calculatedTotal = this.items.reduce(
      (sum, item) => sum + item.quantity * item.price,
      0
    );

    if (Math.abs(calculatedTotal - this.totalAmount) > 0.01) {
      throw new InvariantViolationError('Total amount does not match items');
    }
  }

  // Called automatically before events are applied
  protected beforeApplyEvent(event: IDomainEvent): void {
    this.validateInvariants();
  }

  // Called automatically after events are applied
  protected afterApplyEvent(event: IDomainEvent): void {
    this.validateInvariants();
  }
}
```

## 📚 API Reference

### AggregateRoot

**Base Class:**

```typescript
abstract class AggregateRoot {
  protected readonly id: EntityId;
  protected version: number;

  // Event management
  addDomainEvent(event: IDomainEvent): void;
  getUncommittedEvents(): IDomainEvent[];
  markEventsAsCommitted(): void;
  clearEvents(): void;

  // Capability system
  addCapability<T extends IAggregateCapability>(capability: T): void;
  getCapability<T extends IAggregateCapability>(type: new () => T): T | null;
  hasCapability<T extends IAggregateCapability>(type: new () => T): boolean;
  removeCapability<T extends IAggregateCapability>(type: new () => T): void;

  // Snapshot support
  toSnapshot(): AggregateSnapshot;
  fromSnapshot(snapshot: AggregateSnapshot): void;

  // Lifecycle hooks
  protected beforeApplyEvent?(event: IDomainEvent): void;
  protected afterApplyEvent?(event: IDomainEvent): void;
  protected beforeSave?(): void;
  protected afterSave?(): void;
}
```

### EventSourcedAggregate

**Event Sourcing Support:**

```typescript
abstract class EventSourcedAggregate extends AggregateRoot {
  // Event application
  protected apply(event: IDomainEvent): void;

  // Event stream reconstruction
  static fromEventStream<T extends EventSourcedAggregate>(
    events: IDomainEvent[]
  ): T;

  // Event handlers (must be implemented)
  protected abstract getEventHandlers(): EventHandlerMap;

  // Replay events
  protected replayEvents(events: IDomainEvent[]): void;

  // Get aggregate version from events
  protected getVersionFromEvents(events: IDomainEvent[]): number;
}
```

### Built-in Capabilities

**Audit Capability:**

```typescript
class AuditCapability implements IAggregateCapability {
  readonly name = 'audit';

  // Configuration
  constructor(config?: AuditConfig) {}

  // Audit trail
  getAuditTrail(): AuditEntry[];
  clearAuditTrail(): void;

  // Hooks
  onEventApplied(event: IDomainEvent): void;
  onSnapshotCreated(snapshot: AggregateSnapshot): void;
}
```

**Cache Capability:**

```typescript
class CacheCapability implements IAggregateCapability {
  readonly name = 'cache';

  // Configuration
  constructor(config: CacheConfig) {}

  // Cache management
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T): void;
  remove(key: string): void;
  clear(): void;

  // Statistics
  getStats(): CacheStats;
}
```

**Validation Capability:**

```typescript
class ValidationCapability implements IAggregateCapability {
  readonly name = 'validation';

  // Configuration
  constructor(config?: ValidationConfig) {}

  // Validation rules
  addRule(rule: ValidationRule): void;
  removeRule(ruleName: string): void;
  getValidationRules(): ValidationRule[];

  // Validation
  validate(aggregate: AggregateRoot): ValidationResult;

  // Hooks
  beforeApplyEvent(event: IDomainEvent): void;
}
```

## 🎯 Patterns & Best Practices

### Aggregate Design Principles

1. **Keep Aggregates Small**

   ```typescript
   // Good: Small, focused aggregate
   class OrderAggregate extends AggregateRoot {
     private items: OrderItem[] = [];
     private status: OrderStatus;

     // Only essential order operations
     addItem(item: OrderItem): Result<void, Error> {
       /* ... */
     }
     removeItem(itemId: string): Result<void, Error> {
       /* ... */
     }
     confirm(): Result<void, Error> {
       /* ... */
     }
   }

   // Avoid: Large, complex aggregates
   class OrderAggregate extends AggregateRoot {
     private items: OrderItem[] = [];
     private customer: Customer; // Should be separate aggregate
     private inventory: Inventory; // Should be separate aggregate
     private payments: Payment[]; // Should be separate aggregate
   }
   ```

2. **Use Eventual Consistency Between Aggregates**

   ```typescript
   // Good: Eventual consistency via domain events
   class OrderAggregate extends AggregateRoot {
     confirm(): Result<void, Error> {
       this.status = OrderStatus.CONFIRMED;

       // Notify other aggregates via events
       this.addDomainEvent(
         new OrderConfirmedEvent({
           orderId: this.id.value,
           customerId: this.customerId.value,
           items: this.items.map(item => item.toJSON()),
         })
       );

       return Result.ok();
     }
   }

   // Handler in inventory context
   @EventHandler(OrderConfirmedEvent)
   class InventoryHandler {
     async handle(event: OrderConfirmedEvent): Promise<void> {
       await this.inventoryService.reserveItems(event.payload.items);
     }
   }
   ```

3. **Enforce Invariants at Aggregate Boundaries**

   ```typescript
   class OrderAggregate extends AggregateRoot {
     private static readonly MAX_ITEMS = 100;
     private static readonly MIN_TOTAL = 10.0;

     addItem(item: OrderItem): Result<void, Error> {
       // Validate aggregate invariants
       if (this.items.length >= OrderAggregate.MAX_ITEMS) {
         return Result.fail(
           new Error(
             `Order cannot have more than ${OrderAggregate.MAX_ITEMS} items`
           )
         );
       }

       const newTotal = this.calculateTotalWithItem(item);
       if (
         this.status === OrderStatus.PENDING &&
         newTotal < OrderAggregate.MIN_TOTAL
       ) {
         return Result.fail(
           new Error(`Order total must be at least ${OrderAggregate.MIN_TOTAL}`)
         );
       }

       // Apply change
       this.items.push(item);
       this.recalculateTotal();

       return Result.ok();
     }
   }
   ```

### Event Design Guidelines

1. **Use Past Tense for Domain Events**

   ```typescript
   // Good: Past tense, describes what happened
   class OrderCreatedEvent extends DomainEvent<OrderCreatedData> {}
   class OrderConfirmedEvent extends DomainEvent<OrderConfirmedData> {}
   class OrderCancelledEvent extends DomainEvent<OrderCancelledData> {}

   // Avoid: Present tense or imperative
   class CreateOrderEvent extends DomainEvent<OrderData> {}
   class ConfirmOrderEvent extends DomainEvent<OrderData> {}
   ```

2. **Include Sufficient Data in Events**

   ```typescript
   // Good: Rich event data
   class OrderCreatedEvent extends DomainEvent<{
     orderId: string;
     customerId: string;
     items: Array<{
       productId: string;
       quantity: number;
       price: number;
     }>;
     totalAmount: number;
     currency: string;
     createdAt: Date;
     metadata: {
       channel: string;
       promotionCode?: string;
     };
   }> {}

   // Avoid: Minimal event data
   class OrderCreatedEvent extends DomainEvent<{
     orderId: string;
   }> {}
   ```

3. **Version Events for Schema Evolution**

   ```typescript
   // Event versioning
   class OrderCreatedEvent extends DomainEvent<OrderCreatedData> {
     static readonly VERSION = 2;

     constructor(payload: OrderCreatedData) {
       super('OrderCreated', payload);
       this.version = OrderCreatedEvent.VERSION;
     }
   }

   // Event upcasting for version compatibility
   class OrderCreatedEventUpcaster {
     upcast(event: IDomainEvent): IDomainEvent {
       if (event.version === 1) {
         return this.upcastV1ToV2(event);
       }
       return event;
     }

     private upcastV1ToV2(event: IDomainEvent): IDomainEvent {
       // Convert v1 to v2 format
       return new OrderCreatedEvent({
         ...event.payload,
         currency: event.payload.currency || 'USD', // Default currency
       });
     }
   }
   ```

### Testing Strategies

1. **Unit Test Aggregate Behavior**

   ```typescript
   describe('OrderAggregate', () => {
     it('should create order with items', () => {
       // Arrange
       const customerId = EntityId.create();
       const item = new OrderItem(EntityId.create(), 2, 29.99);

       // Act
       const order = OrderAggregate.create(customerId);
       const result = order.addItem(item);

       // Assert
       expect(result.isSuccess()).toBe(true);
       expect(order.getItems()).toHaveLength(1);
       expect(order.getTotalAmount()).toBe(59.98);

       // Verify events
       const events = order.getUncommittedEvents();
       expect(events).toHaveLength(2);
       expect(events[0]).toBeInstanceOf(OrderCreatedEvent);
       expect(events[1]).toBeInstanceOf(OrderItemAddedEvent);
     });

     it('should fail to add item with negative quantity', () => {
       // Arrange
       const order = OrderAggregate.create(EntityId.create());
       const item = new OrderItem(EntityId.create(), -1, 29.99);

       // Act
       const result = order.addItem(item);

       // Assert
       expect(result.isFailure()).toBe(true);
       expect(result.error?.message).toBe('Quantity must be positive');
       expect(order.getItems()).toHaveLength(0);
     });
   });
   ```

2. **Test Event Sourcing**

   ```typescript
   describe('BankAccountAggregate Event Sourcing', () => {
     it('should reconstitute from event stream', () => {
       // Arrange
       const events = [
         new AccountOpenedEvent({
           accountId: 'account-123',
           initialDeposit: 1000,
           overdraftLimit: 500,
         }),
         new MoneyDepositedEvent({
           accountId: 'account-123',
           amount: 250,
           balance: 1250,
         }),
         new MoneyWithdrawnEvent({
           accountId: 'account-123',
           amount: 100,
           balance: 1150,
         }),
       ];

       // Act
       const account = BankAccountAggregate.fromEventStream(events);

       // Assert
       expect(account.getBalance()).toBe(1150);
       expect(account.getOverdraftLimit()).toBe(500);
       expect(account.getStatus()).toBe(AccountStatus.ACTIVE);
     });
   });
   ```

3. **Integration Testing with Repository**

   ```typescript
   describe('OrderRepository Integration', () => {
     it('should save and retrieve aggregate', async () => {
       // Arrange
       const order = OrderAggregate.create(EntityId.create());
       order.addItem(new OrderItem(EntityId.create(), 1, 99.99));

       // Act
       await orderRepository.save(order);
       const retrievedOrder = await orderRepository.findById(order.id);

       // Assert
       expect(retrievedOrder).toBeDefined();
       expect(retrievedOrder?.getTotalAmount()).toBe(99.99);
       expect(retrievedOrder?.getItems()).toHaveLength(1);
     });
   });
   ```

## ⚡ Performance

### Optimization Strategies

1. **Snapshot Strategy**

   ```typescript
   class OrderRepository {
     private readonly snapshotThreshold = 20;

     async save(order: OrderAggregate): Promise<void> {
       // Always save current state
       await this.saveSnapshot(order);

       // Save events
       const events = order.getUncommittedEvents();
       await this.eventStore.append(order.id.value, events);

       // Create snapshot if threshold reached
       const eventCount = await this.eventStore.getEventCount(order.id.value);
       if (eventCount >= this.snapshotThreshold) {
         await this.snapshotStore.createSnapshot(
           order.id.value,
           order.toSnapshot()
         );

         // Optional: Archive old events
         await this.eventStore.archiveEvents(order.id.value, eventCount - 10);
       }
     }
   }
   ```

2. **Lazy Loading**

   ```typescript
   class OrderAggregate extends AggregateRoot {
     private _items: OrderItem[] | null = null;

     getItems(): OrderItem[] {
       if (this._items === null) {
         this._items = this.loadItemsFromSnapshot();
       }
       return this._items;
     }

     private loadItemsFromSnapshot(): OrderItem[] {
       // Load from snapshot or reconstruct from events
       return this.snapshotData.items.map(item => OrderItem.fromJSON(item));
     }
   }
   ```

3. **Batching Operations**

   ```typescript
   class OrderAggregate extends AggregateRoot {
     addItems(items: OrderItem[]): Result<void, Error> {
       // Validate all items first
       for (const item of items) {
         const validation = this.validateItem(item);
         if (validation.isFailure()) {
           return validation;
         }
       }

       // Apply all items in batch
       for (const item of items) {
         this.items.push(item);
         this.totalAmount += item.quantity * item.price;
       }

       // Single event for batch operation
       this.addDomainEvent(
         new OrderItemsBatchAddedEvent({
           orderId: this.id.value,
           items: items.map(item => item.toJSON()),
           newTotal: this.totalAmount,
         })
       );

       return Result.ok();
     }
   }
   ```

### Memory Management

```typescript
class AggregateRoot {
  private eventCache: Map<string, IDomainEvent> = new Map();
  private readonly maxCacheSize = 1000;

  addDomainEvent(event: IDomainEvent): void {
    // Manage cache size
    if (this.eventCache.size >= this.maxCacheSize) {
      // Remove oldest events
      const oldestKey = this.eventCache.keys().next().value;
      this.eventCache.delete(oldestKey);
    }

    this.eventCache.set(event.id, event);
  }

  getUncommittedEvents(): IDomainEvent[] {
    return Array.from(this.eventCache.values());
  }

  markEventsAsCommitted(): void {
    this.eventCache.clear();
  }
}
```

## 🧪 Testing

### Aggregate Testing Utilities

```typescript
import { AggregateTestBuilder } from '@vytches/ddd-aggregates/testing';

// Aggregate builder for tests
const orderBuilder = new AggregateTestBuilder(OrderAggregate)
  .withCustomer('customer-123')
  .withItems([
    { productId: 'product-1', quantity: 2, price: 29.99 },
    { productId: 'product-2', quantity: 1, price: 49.99 },
  ])
  .withStatus(OrderStatus.PENDING)
  .build();

// Event stream testing
const account = new AggregateTestBuilder(BankAccountAggregate)
  .fromEventStream([
    new AccountOpenedEvent({ accountId: 'account-123', initialDeposit: 1000 }),
    new MoneyDepositedEvent({
      accountId: 'account-123',
      amount: 500,
      balance: 1500,
    }),
  ])
  .build();

// Snapshot testing
const order = new AggregateTestBuilder(OrderAggregate)
  .fromSnapshot({
    id: 'order-123',
    version: 5,
    data: {
      /* snapshot data */
    },
  })
  .build();
```

### Event Testing

```typescript
import { EventTestHarness } from '@vytches/ddd-aggregates/testing';

describe('Order Events', () => {
  let eventHarness: EventTestHarness;

  beforeEach(() => {
    eventHarness = new EventTestHarness();
  });

  it('should emit correct events when adding item', () => {
    // Arrange
    const order = OrderAggregate.create(EntityId.create());
    const item = new OrderItem(EntityId.create(), 1, 99.99);

    // Act
    order.addItem(item);

    // Assert
    eventHarness.assertEventEmitted(order, OrderItemAddedEvent, {
      orderId: order.id.value,
      productId: item.productId.value,
      quantity: 1,
      price: 99.99,
    });
  });
});
```

## 🤝 Contributing

We welcome contributions! Please see our
[Contributing Guide](../../CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone repository
git clone https://github.com/vytches/ddd.git
cd ddd

# Install dependencies
pnpm install

# Build aggregates package
pnpm build --filter=@vytches/ddd-aggregates

# Run tests
pnpm test --filter=@vytches/ddd-aggregates

# Run in development mode
pnpm dev --filter=@vytches/ddd-aggregates
```

## 📄 License

This project is licensed under the MIT License - see the
[LICENSE](../../LICENSE) file for details.

---

**Part of the [@vytches/ddd-core](https://github.com/vytches/ddd) ecosystem**

For more information, visit the [main documentation](../../README.md).
