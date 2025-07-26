# Order Aggregate with State Machine

**Version**: 1.0.0 **Package**: @vytches/ddd-aggregates **Complexity**: Basic
**Domain**: E-commerce Order Management **Patterns**: Aggregate Root, State
Machine, Domain Events, Business Rules **Dependencies**:
@vytches/ddd-aggregates, @vytches/ddd-domain-primitives, @vytches/ddd-contracts

## Description

This example demonstrates an order aggregate that uses a state machine pattern
to manage order lifecycle. The aggregate enforces state transitions, calculates
totals, and ensures business consistency throughout the order process.

## Business Context

An e-commerce platform needs to manage orders through various states from
creation to completion. Each state transition has specific rules and
validations. The order aggregate ensures only valid transitions occur and
maintains consistency of order data including items, totals, and addresses.

## Code Example

```typescript
// order.aggregate.ts
import { AggregateRoot } from '@vytches/ddd-aggregates';
import { DomainEvent } from '@vytches/ddd-contracts';
import { BaseError, EntityId } from '@vytches/ddd-domain-primitives';
import {
  OrderData,
  CreateOrderData,
  OrderStatus,
  OrderItem,
  Address,
} from './types'; // From your application

// Domain Events
export class OrderCreatedEvent extends DomainEvent {
  constructor(
    public readonly orderId: string,
    public readonly customerId: string,
    public readonly totalAmount: number
  ) {
    super();
  }
}

export class OrderConfirmedEvent extends DomainEvent {
  constructor(
    public readonly orderId: string,
    public readonly confirmedAt: Date
  ) {
    super();
  }
}

export class OrderShippedEvent extends DomainEvent {
  constructor(
    public readonly orderId: string,
    public readonly trackingNumber: string,
    public readonly shippedAt: Date
  ) {
    super();
  }
}

export class OrderDeliveredEvent extends DomainEvent {
  constructor(
    public readonly orderId: string,
    public readonly deliveredAt: Date
  ) {
    super();
  }
}

export class OrderCancelledEvent extends DomainEvent {
  constructor(
    public readonly orderId: string,
    public readonly reason: string,
    public readonly cancelledAt: Date
  ) {
    super();
  }
}

// Domain Errors
export class InvalidOrderStateTransitionError extends BaseError {
  constructor(currentState: OrderStatus, targetState: OrderStatus) {
    super(
      'INVALID_STATE_TRANSITION',
      `Cannot transition from ${currentState} to ${targetState}`
    );
  }
}

export class EmptyOrderError extends BaseError {
  constructor() {
    super('EMPTY_ORDER', 'Order must contain at least one item');
  }
}

export class InvalidOrderItemError extends BaseError {
  constructor(message: string) {
    super('INVALID_ORDER_ITEM', message);
  }
}

// Order Aggregate Root
export class OrderAggregate extends AggregateRoot {
  private customerId: string;
  private orderNumber: string;
  private status: OrderStatus;
  private items: OrderItem[];
  private totalAmount: number;
  private currency: string;
  private shippingAddress: Address;
  private billingAddress?: Address;
  private createdAt: Date;
  private updatedAt: Date;
  private completedAt?: Date;
  private cancelledAt?: Date;
  private trackingNumber?: string;

  // ⭐ State transition rules
  private static readonly STATE_TRANSITIONS: Record<
    OrderStatus,
    OrderStatus[]
  > = {
    draft: ['pending', 'cancelled'],
    pending: ['confirmed', 'cancelled'],
    confirmed: ['processing', 'cancelled'],
    processing: ['shipped', 'cancelled'],
    shipped: ['delivered', 'cancelled'],
    delivered: ['completed'],
    completed: [],
    cancelled: [],
  };

  private constructor(id: EntityId) {
    super(id);
    this.status = 'draft';
    this.items = [];
    this.totalAmount = 0;
    this.currency = 'USD';
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  // ⭐ Factory method for creating new orders
  static create(data: CreateOrderData): OrderAggregate {
    const order = new OrderAggregate(EntityId.generate());

    // Validate order has items
    if (!data.items || data.items.length === 0) {
      throw new EmptyOrderError();
    }

    // Set customer and addresses
    order.customerId = data.customerId;
    order.orderNumber = order.generateOrderNumber();
    order.shippingAddress = order.validateAddress(data.shippingAddress);
    order.billingAddress = data.billingAddress
      ? order.validateAddress(data.billingAddress)
      : order.shippingAddress;

    // Add items and calculate total
    data.items.forEach(item => order.addItem(item));

    // Transition to pending (ready for payment)
    order.status = 'pending';

    // Emit creation event
    order.addDomainEvent(
      new OrderCreatedEvent(order.id.value, order.customerId, order.totalAmount)
    );

    return order;
  }

  // ⭐ Reconstitute from persistence
  static fromSnapshot(id: EntityId, data: OrderData): OrderAggregate {
    const order = new OrderAggregate(id);

    order.customerId = data.customerId;
    order.orderNumber = data.orderNumber;
    order.status = data.status;
    order.items = data.items;
    order.totalAmount = data.totalAmount;
    order.currency = data.currency;
    order.shippingAddress = data.shippingAddress;
    order.billingAddress = data.billingAddress;
    order.createdAt = data.createdAt;
    order.updatedAt = data.updatedAt;
    order.completedAt = data.completedAt;
    order.cancelledAt = data.cancelledAt;

    order.markAsHydrated();

    return order;
  }

  // ⭐ Business operations with state transitions
  confirm(): void {
    this.transitionTo('confirmed');
    this.updatedAt = new Date();

    this.addDomainEvent(new OrderConfirmedEvent(this.id.value, this.updatedAt));
  }

  startProcessing(): void {
    this.transitionTo('processing');
    this.updatedAt = new Date();
  }

  ship(trackingNumber: string): void {
    if (!trackingNumber || trackingNumber.trim().length === 0) {
      throw new BaseError(
        'INVALID_TRACKING_NUMBER',
        'Tracking number is required'
      );
    }

    this.transitionTo('shipped');
    this.trackingNumber = trackingNumber;
    this.updatedAt = new Date();

    this.addDomainEvent(
      new OrderShippedEvent(this.id.value, trackingNumber, this.updatedAt)
    );
  }

  markAsDelivered(): void {
    this.transitionTo('delivered');
    this.updatedAt = new Date();

    this.addDomainEvent(new OrderDeliveredEvent(this.id.value, this.updatedAt));
  }

  complete(): void {
    this.transitionTo('completed');
    this.completedAt = new Date();
    this.updatedAt = this.completedAt;
  }

  cancel(reason: string): void {
    if (!this.canCancel()) {
      throw new InvalidOrderStateTransitionError(this.status, 'cancelled');
    }

    this.transitionTo('cancelled');
    this.cancelledAt = new Date();
    this.updatedAt = this.cancelledAt;

    this.addDomainEvent(
      new OrderCancelledEvent(this.id.value, reason, this.cancelledAt)
    );
  }

  // ⭐ State machine helpers
  private transitionTo(newStatus: OrderStatus): void {
    const allowedTransitions = OrderAggregate.STATE_TRANSITIONS[this.status];

    if (!allowedTransitions.includes(newStatus)) {
      throw new InvalidOrderStateTransitionError(this.status, newStatus);
    }

    this.status = newStatus;
  }

  private canCancel(): boolean {
    const nonCancellableStates: OrderStatus[] = ['completed', 'cancelled'];
    return !nonCancellableStates.includes(this.status);
  }

  // ⭐ Item management
  private addItem(item: Omit<OrderItem, 'discount' | 'totalPrice'>): void {
    this.validateItem(item);

    const orderItem: OrderItem = {
      ...item,
      discount: 0,
      totalPrice: item.quantity * item.unitPrice,
    };

    this.items.push(orderItem);
    this.recalculateTotal();
  }

  applyDiscount(productId: string, discountPercentage: number): void {
    if (this.status !== 'draft' && this.status !== 'pending') {
      throw new BaseError('INVALID_OPERATION', 'Cannot modify confirmed order');
    }

    const item = this.items.find(i => i.productId === productId);
    if (!item) {
      throw new BaseError(
        'ITEM_NOT_FOUND',
        `Product ${productId} not found in order`
      );
    }

    if (discountPercentage < 0 || discountPercentage > 100) {
      throw new BaseError(
        'INVALID_DISCOUNT',
        'Discount must be between 0 and 100'
      );
    }

    item.discount = discountPercentage;
    item.totalPrice =
      item.quantity * item.unitPrice * (1 - discountPercentage / 100);

    this.recalculateTotal();
    this.updatedAt = new Date();
  }

  // ⭐ Validation methods
  private validateItem(item: Omit<OrderItem, 'discount' | 'totalPrice'>): void {
    if (!item.productId || item.productId.trim().length === 0) {
      throw new InvalidOrderItemError('Product ID is required');
    }

    if (!item.productName || item.productName.trim().length === 0) {
      throw new InvalidOrderItemError('Product name is required');
    }

    if (item.quantity <= 0) {
      throw new InvalidOrderItemError('Quantity must be greater than zero');
    }

    if (item.unitPrice <= 0) {
      throw new InvalidOrderItemError('Unit price must be greater than zero');
    }
  }

  private validateAddress(address: Address): Address {
    const requiredFields = ['street', 'city', 'state', 'postalCode', 'country'];

    for (const field of requiredFields) {
      if (!address[field] || address[field].trim().length === 0) {
        throw new BaseError('INVALID_ADDRESS', `Address ${field} is required`);
      }
    }

    return address;
  }

  private generateOrderNumber(): string {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `ORD-${timestamp}-${random}`;
  }

  private recalculateTotal(): void {
    this.totalAmount = this.items.reduce(
      (sum, item) => sum + item.totalPrice,
      0
    );
  }

  // ⭐ State accessors
  toSnapshot(): OrderData {
    return {
      id: this.id.value,
      customerId: this.customerId,
      orderNumber: this.orderNumber,
      status: this.status,
      items: [...this.items],
      totalAmount: this.totalAmount,
      currency: this.currency,
      shippingAddress: { ...this.shippingAddress },
      billingAddress: this.billingAddress
        ? { ...this.billingAddress }
        : undefined,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      completedAt: this.completedAt,
      cancelledAt: this.cancelledAt,
    };
  }

  get orderStatus(): OrderStatus {
    return this.status;
  }

  get orderTotal(): number {
    return this.totalAmount;
  }

  get itemCount(): number {
    return this.items.reduce((count, item) => count + item.quantity, 0);
  }

  get canBeModified(): boolean {
    return this.status === 'draft' || this.status === 'pending';
  }
}

// Usage example
export function orderLifecycleExample(): void {
  // Create a new order
  const order = OrderAggregate.create({
    customerId: 'customer-123',
    items: [
      {
        productId: 'prod-1',
        productName: 'Laptop',
        quantity: 1,
        unitPrice: 999.99,
      },
      {
        productId: 'prod-2',
        productName: 'Mouse',
        quantity: 2,
        unitPrice: 29.99,
      },
    ],
    shippingAddress: {
      street: '123 Main St',
      city: 'New York',
      state: 'NY',
      postalCode: '10001',
      country: 'USA',
    },
  });

  console.log('Order created:', order.orderNumber);
  console.log('Total amount:', order.orderTotal);
  console.log('Item count:', order.itemCount);

  // Apply discount
  order.applyDiscount('prod-1', 10); // 10% off laptop
  console.log('Total after discount:', order.orderTotal);

  // Confirm order
  order.confirm();
  console.log('Order status:', order.orderStatus);

  // Process order lifecycle
  order.startProcessing();
  order.ship('TRACK-123456');
  order.markAsDelivered();
  order.complete();

  console.log('Final order state:', order.toSnapshot());
  console.log('All events:', order.getUncommittedEvents());

  // Try invalid transition (will throw error)
  try {
    order.confirm(); // Can't confirm completed order
  } catch (error) {
    console.error('Expected error:', error.message);
  }
}
```

## Key Features

- **State Machine Pattern**: Explicit state transitions with validation
- **Business Rule Enforcement**: Order validation, item constraints
- **Automatic Calculations**: Total amount updated on item changes
- **Immutable State Transitions**: Can only move to allowed states
- **Rich Domain Events**: Detailed events for each significant change
- **Address Validation**: Ensures complete shipping/billing information

## State Transition Rules

```
draft → pending → confirmed → processing → shipped → delivered → completed
         ↓          ↓            ↓           ↓          ↓
      cancelled  cancelled   cancelled  cancelled  cancelled
```

## Business Rules Enforced

1. **Non-empty Orders**: Must have at least one item
2. **Valid Items**: Positive quantities and prices
3. **State Transitions**: Only allowed transitions permitted
4. **Cancellation Rules**: Cannot cancel completed orders
5. **Modification Rules**: Can only modify draft/pending orders
6. **Address Completeness**: All address fields required

## Common Pitfalls

- **Skipping state validations**: Always use transition methods
- **Direct state manipulation**: Use business methods, not setters
- **Missing total recalculation**: Update totals when items change
- **Allowing invalid states**: Enforce state machine rules strictly

## Related Examples

- [User Aggregate](./example-1.md)
- [Product Inventory Aggregate](./example-3.md)
- [Order Saga Coordination](../intermediate/example-2.md)
