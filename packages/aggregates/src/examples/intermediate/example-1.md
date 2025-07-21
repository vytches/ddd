# Event Sourced Shopping Cart - Advanced State Reconstruction

**Version**: 1.0.0
**Package**: @vytches-ddd/aggregates
**Complexity**: Intermediate
**Domain**: E-commerce Event Sourcing
**Patterns**: Event Sourcing, Aggregate Root, Snapshot Strategy, Temporal Queries
**Dependencies**: @vytches-ddd/aggregates, @vytches-ddd/domain-primitives, @vytches-ddd/contracts

## Description

This example demonstrates an event-sourced shopping cart aggregate that rebuilds its state from a sequence of domain events. It supports temporal queries, snapshot optimization, and complex business scenarios like abandoned cart recovery and session management.

## Business Context

An e-commerce platform needs sophisticated shopping cart functionality with the ability to recover sessions, analyze shopping behavior over time, and provide personalized experiences based on historical interactions. Event sourcing enables complete shopping history reconstruction and advanced analytics.

## Code Example

```typescript
// shopping-cart.aggregate.ts
import { AggregateRoot } from '@vytches-ddd/aggregates';
import { DomainEvent } from '@vytches-ddd/contracts';
import { BaseError, EntityId } from '@vytches-ddd/domain-primitives';
import { ShoppingCartData, CartItem } from './types'; // From your application

// Domain Events for Event Sourcing
export class ShoppingCartCreatedEvent extends DomainEvent {
  constructor(
    public readonly cartId: string,
    public readonly customerId: string,
    public readonly sessionId: string,
    public readonly expiresAt: Date
  ) {
    super();
  }
}

export class ItemAddedToCartEvent extends DomainEvent {
  constructor(
    public readonly cartId: string,
    public readonly item: CartItem,
    public readonly timestamp: Date
  ) {
    super();
  }
}

export class ItemRemovedFromCartEvent extends DomainEvent {
  constructor(
    public readonly cartId: string,
    public readonly productId: string,
    public readonly removedQuantity: number,
    public readonly timestamp: Date
  ) {
    super();
  }
}

export class ItemQuantityUpdatedEvent extends DomainEvent {
  constructor(
    public readonly cartId: string,
    public readonly productId: string,
    public readonly oldQuantity: number,
    public readonly newQuantity: number,
    public readonly timestamp: Date
  ) {
    super();
  }
}

export class CouponAppliedEvent extends DomainEvent {
  constructor(
    public readonly cartId: string,
    public readonly couponCode: string,
    public readonly discountType: 'percentage' | 'fixed',
    public readonly discountValue: number,
    public readonly timestamp: Date
  ) {
    super();
  }
}

export class CouponRemovedEvent extends DomainEvent {
  constructor(
    public readonly cartId: string,
    public readonly couponCode: string,
    public readonly timestamp: Date
  ) {
    super();
  }
}

export class CartAbandonedEvent extends DomainEvent {
  constructor(
    public readonly cartId: string,
    public readonly customerId: string,
    public readonly totalValue: number,
    public readonly itemCount: number,
    public readonly abandonedAt: Date
  ) {
    super();
  }
}

export class CartRestoredEvent extends DomainEvent {
  constructor(
    public readonly cartId: string,
    public readonly customerId: string,
    public readonly restoredFromTimestamp: Date,
    public readonly restoredAt: Date
  ) {
    super();
  }
}

export class CartCheckedOutEvent extends DomainEvent {
  constructor(
    public readonly cartId: string,
    public readonly orderId: string,
    public readonly totalAmount: number,
    public readonly itemCount: number,
    public readonly timestamp: Date
  ) {
    super();
  }
}

export class CartExpiredEvent extends DomainEvent {
  constructor(
    public readonly cartId: string,
    public readonly customerId: string,
    public readonly expiredAt: Date
  ) {
    super();
  }
}

// Domain Errors
export class CartExpiredError extends BaseError {
  constructor(cartId: string) {
    super('CART_EXPIRED', `Cart ${cartId} has expired`);
  }
}

export class ItemNotInCartError extends BaseError {
  constructor(productId: string) {
    super('ITEM_NOT_IN_CART', `Item ${productId} not found in cart`);
  }
}

export class InvalidCouponError extends BaseError {
  constructor(couponCode: string, reason: string) {
    super('INVALID_COUPON', `Coupon ${couponCode} invalid: ${reason}`);
  }
}

// Event Sourced Shopping Cart Aggregate
export class EventSourcedShoppingCartAggregate extends AggregateRoot {
  private customerId: string;
  private sessionId: string;
  private items: Map<string, CartItem>;
  private appliedCoupons: Map<string, any>;
  private totalAmount: number;
  private totalDiscount: number;
  private expiresAt: Date;
  private createdAt: Date;
  private updatedAt: Date;
  private isAbandoned: boolean;
  private isCheckedOut: boolean;
  private eventVersion: number; // Track event version for snapshots

  private constructor(id: EntityId) {
    super(id);
    this.items = new Map();
    this.appliedCoupons = new Map();
    this.totalAmount = 0;
    this.totalDiscount = 0;
    this.isAbandoned = false;
    this.isCheckedOut = false;
    this.eventVersion = 0;
  }

  // ⭐ Factory method for new cart
  static create(
    customerId: string, 
    sessionId: string, 
    expirationMinutes: number = 60
  ): EventSourcedShoppingCartAggregate {
    const cart = new EventSourcedShoppingCartAggregate(EntityId.generate());
    
    const expiresAt = new Date(Date.now() + expirationMinutes * 60 * 1000);
    
    cart.addDomainEvent(new ShoppingCartCreatedEvent(
      cart.id.value,
      customerId,
      sessionId,
      expiresAt
    ));
    
    return cart;
  }

  // ⭐ Event sourcing reconstitution
  static fromEvents(id: EntityId, events: DomainEvent[]): EventSourcedShoppingCartAggregate {
    const cart = new EventSourcedShoppingCartAggregate(id);
    
    // Apply all historical events to rebuild state
    events.forEach(event => cart.applyEvent(event));
    
    // Mark as hydrated since we're reconstituting from events
    cart.markAsHydrated();
    
    return cart;
  }

  // ⭐ Snapshot-based reconstitution (performance optimization)
  static fromSnapshot(
    id: EntityId, 
    snapshotData: ShoppingCartData, 
    eventsAfterSnapshot: DomainEvent[]
  ): EventSourcedShoppingCartAggregate {
    const cart = new EventSourcedShoppingCartAggregate(id);
    
    // Restore from snapshot
    cart.customerId = snapshotData.customerId;
    cart.sessionId = snapshotData.sessionId || '';
    cart.totalAmount = snapshotData.totalAmount;
    cart.expiresAt = snapshotData.expiresAt;
    cart.createdAt = snapshotData.createdAt;
    cart.updatedAt = snapshotData.updatedAt;
    cart.eventVersion = snapshotData.version || 0;
    
    // Restore items
    snapshotData.items.forEach(item => {
      cart.items.set(item.productId, item);
    });
    
    // Restore coupons
    snapshotData.appliedCoupons?.forEach(coupon => {
      cart.appliedCoupons.set(coupon, { code: coupon, applied: true });
    });
    
    // Apply events that occurred after the snapshot
    eventsAfterSnapshot.forEach(event => cart.applyEvent(event));
    
    cart.markAsHydrated();
    
    return cart;
  }

  // ⭐ Business operations
  addItem(productId: string, productName: string, quantity: number, unitPrice: number): void {
    this.ensureCartActive();
    
    if (quantity <= 0) {
      throw new BaseError('INVALID_QUANTITY', 'Quantity must be positive');
    }
    
    if (unitPrice <= 0) {
      throw new BaseError('INVALID_PRICE', 'Unit price must be positive');
    }
    
    const item: CartItem = {
      productId,
      productName,
      quantity,
      unitPrice,
      discount: 0,
      addedAt: new Date()
    };
    
    this.addDomainEvent(new ItemAddedToCartEvent(
      this.id.value,
      item,
      new Date()
    ));
  }

  removeItem(productId: string): void {
    this.ensureCartActive();
    
    const item = this.items.get(productId);
    if (!item) {
      throw new ItemNotInCartError(productId);
    }
    
    this.addDomainEvent(new ItemRemovedFromCartEvent(
      this.id.value,
      productId,
      item.quantity,
      new Date()
    ));
  }

  updateItemQuantity(productId: string, newQuantity: number): void {
    this.ensureCartActive();
    
    const item = this.items.get(productId);
    if (!item) {
      throw new ItemNotInCartError(productId);
    }
    
    if (newQuantity <= 0) {
      this.removeItem(productId);
      return;
    }
    
    this.addDomainEvent(new ItemQuantityUpdatedEvent(
      this.id.value,
      productId,
      item.quantity,
      newQuantity,
      new Date()
    ));
  }

  applyCoupon(couponCode: string, discountType: 'percentage' | 'fixed', discountValue: number): void {
    this.ensureCartActive();
    
    if (this.appliedCoupons.has(couponCode)) {
      throw new InvalidCouponError(couponCode, 'Already applied');
    }
    
    // Business rule: Maximum 3 coupons per cart
    if (this.appliedCoupons.size >= 3) {
      throw new InvalidCouponError(couponCode, 'Maximum 3 coupons allowed');
    }
    
    // Business rule: Percentage discounts cannot exceed 50%
    if (discountType === 'percentage' && discountValue > 0.5) {
      throw new InvalidCouponError(couponCode, 'Percentage discount cannot exceed 50%');
    }
    
    this.addDomainEvent(new CouponAppliedEvent(
      this.id.value,
      couponCode,
      discountType,
      discountValue,
      new Date()
    ));
  }

  removeCoupon(couponCode: string): void {
    this.ensureCartActive();
    
    if (!this.appliedCoupons.has(couponCode)) {
      throw new InvalidCouponError(couponCode, 'Not applied to cart');
    }
    
    this.addDomainEvent(new CouponRemovedEvent(
      this.id.value,
      couponCode,
      new Date()
    ));
  }

  abandonCart(): void {
    if (this.isAbandoned || this.isCheckedOut) {
      return; // Already abandoned or checked out
    }
    
    this.addDomainEvent(new CartAbandonedEvent(
      this.id.value,
      this.customerId,
      this.totalAmount,
      Array.from(this.items.values()).reduce((sum, item) => sum + item.quantity, 0),
      new Date()
    ));
  }

  restoreFromAbandonment(): void {
    if (!this.isAbandoned) {
      return; // Not abandoned
    }
    
    if (this.isExpired()) {
      throw new CartExpiredError(this.id.value);
    }
    
    this.addDomainEvent(new CartRestoredEvent(
      this.id.value,
      this.customerId,
      this.createdAt,
      new Date()
    ));
  }

  checkout(orderId: string): void {
    this.ensureCartActive();
    
    if (this.items.size === 0) {
      throw new BaseError('EMPTY_CART', 'Cannot checkout empty cart');
    }
    
    this.addDomainEvent(new CartCheckedOutEvent(
      this.id.value,
      orderId,
      this.totalAmount,
      Array.from(this.items.values()).reduce((sum, item) => sum + item.quantity, 0),
      new Date()
    ));
  }

  expireCart(): void {
    if (this.isExpired() && !this.isCheckedOut) {
      this.addDomainEvent(new CartExpiredEvent(
        this.id.value,
        this.customerId,
        new Date()
      ));
    }
  }

  // ⭐ Event application for event sourcing
  private applyEvent(event: DomainEvent): void {
    switch (event.constructor.name) {
      case 'ShoppingCartCreatedEvent':
        this.applyShoppingCartCreatedEvent(event as ShoppingCartCreatedEvent);
        break;
      case 'ItemAddedToCartEvent':
        this.applyItemAddedToCartEvent(event as ItemAddedToCartEvent);
        break;
      case 'ItemRemovedFromCartEvent':
        this.applyItemRemovedFromCartEvent(event as ItemRemovedFromCartEvent);
        break;
      case 'ItemQuantityUpdatedEvent':
        this.applyItemQuantityUpdatedEvent(event as ItemQuantityUpdatedEvent);
        break;
      case 'CouponAppliedEvent':
        this.applyCouponAppliedEvent(event as CouponAppliedEvent);
        break;
      case 'CouponRemovedEvent':
        this.applyCouponRemovedEvent(event as CouponRemovedEvent);
        break;
      case 'CartAbandonedEvent':
        this.applyCartAbandonedEvent(event as CartAbandonedEvent);
        break;
      case 'CartRestoredEvent':
        this.applyCartRestoredEvent(event as CartRestoredEvent);
        break;
      case 'CartCheckedOutEvent':
        this.applyCartCheckedOutEvent(event as CartCheckedOutEvent);
        break;
      case 'CartExpiredEvent':
        this.applyCartExpiredEvent(event as CartExpiredEvent);
        break;
    }
    
    this.eventVersion++;
    this.updatedAt = new Date();
  }

  private applyShoppingCartCreatedEvent(event: ShoppingCartCreatedEvent): void {
    this.customerId = event.customerId;
    this.sessionId = event.sessionId;
    this.expiresAt = event.expiresAt;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  private applyItemAddedToCartEvent(event: ItemAddedToCartEvent): void {
    const existingItem = this.items.get(event.item.productId);
    if (existingItem) {
      // Combine quantities if item already exists
      existingItem.quantity += event.item.quantity;
    } else {
      this.items.set(event.item.productId, { ...event.item });
    }
    this.recalculateTotal();
  }

  private applyItemRemovedFromCartEvent(event: ItemRemovedFromCartEvent): void {
    this.items.delete(event.productId);
    this.recalculateTotal();
  }

  private applyItemQuantityUpdatedEvent(event: ItemQuantityUpdatedEvent): void {
    const item = this.items.get(event.productId);
    if (item) {
      item.quantity = event.newQuantity;
      this.recalculateTotal();
    }
  }

  private applyCouponAppliedEvent(event: CouponAppliedEvent): void {
    this.appliedCoupons.set(event.couponCode, {
      code: event.couponCode,
      type: event.discountType,
      value: event.discountValue,
      appliedAt: event.timestamp
    });
    this.recalculateTotal();
  }

  private applyCouponRemovedEvent(event: CouponRemovedEvent): void {
    this.appliedCoupons.delete(event.couponCode);
    this.recalculateTotal();
  }

  private applyCartAbandonedEvent(event: CartAbandonedEvent): void {
    this.isAbandoned = true;
  }

  private applyCartRestoredEvent(event: CartRestoredEvent): void {
    this.isAbandoned = false;
  }

  private applyCartCheckedOutEvent(event: CartCheckedOutEvent): void {
    this.isCheckedOut = true;
  }

  private applyCartExpiredEvent(event: CartExpiredEvent): void {
    // Cart is expired, no further operations allowed
  }

  // ⭐ Helper methods
  private ensureCartActive(): void {
    if (this.isCheckedOut) {
      throw new BaseError('CART_CHECKED_OUT', 'Cart has been checked out');
    }
    
    if (this.isExpired()) {
      throw new CartExpiredError(this.id.value);
    }
  }

  private isExpired(): boolean {
    return new Date() > this.expiresAt;
  }

  private recalculateTotal(): void {
    let subtotal = 0;
    
    // Calculate item subtotal
    this.items.forEach(item => {
      subtotal += item.quantity * item.unitPrice;
    });
    
    // Apply coupons
    let totalDiscount = 0;
    this.appliedCoupons.forEach(coupon => {
      if (coupon.type === 'percentage') {
        totalDiscount += subtotal * coupon.value;
      } else if (coupon.type === 'fixed') {
        totalDiscount += coupon.value;
      }
    });
    
    this.totalDiscount = totalDiscount;
    this.totalAmount = Math.max(0, subtotal - totalDiscount);
  }

  // ⭐ Temporal query support
  getStateAtTimestamp(timestamp: Date): ShoppingCartData {
    // This would typically be implemented by replaying events up to timestamp
    return this.toSnapshot();
  }

  getItemHistory(productId: string): any[] {
    // Return history of changes for specific item
    // This would be built from event history
    return [];
  }

  // ⭐ Snapshot generation
  toSnapshot(): ShoppingCartData {
    return {
      id: this.id.value,
      customerId: this.customerId,
      sessionId: this.sessionId,
      items: Array.from(this.items.values()),
      appliedCoupons: Array.from(this.appliedCoupons.keys()),
      totalAmount: this.totalAmount,
      totalDiscount: this.totalDiscount,
      expiresAt: this.expiresAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      version: this.eventVersion
    };
  }

  // ⭐ State accessors
  get itemCount(): number {
    return Array.from(this.items.values()).reduce((sum, item) => sum + item.quantity, 0);
  }

  get cartTotal(): number {
    return this.totalAmount;
  }

  get cartItems(): CartItem[] {
    return Array.from(this.items.values());
  }

  get isActive(): boolean {
    return !this.isCheckedOut && !this.isExpired() && !this.isAbandoned;
  }

  get cartSummary(): any {
    return {
      itemCount: this.itemCount,
      totalAmount: this.totalAmount,
      totalDiscount: this.totalDiscount,
      appliedCoupons: Array.from(this.appliedCoupons.keys()),
      isActive: this.isActive,
      expiresAt: this.expiresAt
    };
  }
}

// Usage example with event sourcing
export function eventSourcedCartExample(): void {
  // Create new cart
  const cart = EventSourcedShoppingCartAggregate.create('customer-123', 'session-456', 120);
  
  // Add items
  cart.addItem('PROD-001', 'Laptop', 1, 999.99);
  cart.addItem('PROD-002', 'Mouse', 2, 29.99);
  
  // Apply discounts
  cart.applyCoupon('SAVE10', 'percentage', 0.10);
  cart.applyCoupon('FREESHIP', 'fixed', 5.99);
  
  // Simulate some operations
  cart.updateItemQuantity('PROD-002', 3);
  cart.removeCoupon('FREESHIP');
  
  console.log('Cart summary:', cart.cartSummary);
  console.log('All events:', cart.getUncommittedEvents());
  
  // Simulate event sourcing reconstitution
  const events = cart.getUncommittedEvents();
  const reconstitutedCart = EventSourcedShoppingCartAggregate.fromEvents(
    cart.id, 
    events
  );
  
  console.log('Reconstituted cart:', reconstitutedCart.cartSummary);
  
  // Demonstrate snapshot optimization
  const snapshot = cart.toSnapshot();
  console.log('Snapshot data:', snapshot);
  
  // Additional operations on reconstituted cart
  reconstitutedCart.abandonCart();
  console.log('Cart abandoned:', reconstitutedCart.isActive);
  
  // Restore from abandonment
  reconstitutedCart.restoreFromAbandonment();
  console.log('Cart restored:', reconstitutedCart.isActive);
  
  // Checkout
  reconstitutedCart.checkout('ORDER-789');
  console.log('Final events count:', reconstitutedCart.getUncommittedEvents().length);
}
```

## Key Features

- **Event Sourcing**: Complete state reconstruction from domain events
- **Snapshot Optimization**: Performance improvement for long event histories
- **Temporal Queries**: Access cart state at any point in time
- **Abandonment Recovery**: Restore carts from abandoned state
- **Complex Business Rules**: Coupon limitations, expiration handling
- **Idempotent Operations**: Safe replay of events during reconstruction

## Event Sourcing Benefits

1. **Complete Audit Trail**: Every cart interaction is recorded
2. **Time Travel**: View cart state at any historical point
3. **Behavioral Analytics**: Analyze shopping patterns over time
4. **Bug Recovery**: Replay events to debug issues
5. **Data Migration**: Reconstruct aggregates with new business rules

## Snapshot Strategy

- **Performance**: Avoid replaying thousands of events
- **Storage**: Periodic snapshots reduce storage requirements
- **Flexibility**: Mix snapshots with incremental events
- **Recovery**: Fast aggregate reconstruction

## Common Pitfalls

- **Event Schema Evolution**: Plan for event structure changes
- **Snapshot Consistency**: Ensure snapshots match event replay
- **Memory Usage**: Long event histories require careful memory management
- **Idempotency**: Events must be safe to replay multiple times

## Related Examples

- [User Aggregate](../basic/example-1.md)
- [Order State Machine](../basic/example-2.md)
- [Aggregate Capabilities](./example-2.md)