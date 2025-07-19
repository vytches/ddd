# Basic Event Publishing Implementation

**Focus**: Basic event publishing through repository pattern with automatic event handling  
**Domain**: E-commerce  
**Complexity**: Basic  
**Dependencies**: @vytches-ddd/events, @vytches-ddd/repositories, @vytches-ddd/utils

## Business Context

This example demonstrates the unified event system's core feature - automatic event publishing through repository pattern:
- Order aggregate raises domain events when business operations occur
- Repository automatically publishes events when aggregate is saved
- Event handlers react to domain events for side effects
- Clean separation between business logic and event handling

## Implementation

```typescript
// order-aggregate.ts
import { AggregateRoot } from '@vytches-ddd/aggregates';
import { DomainEvent } from '@vytches-ddd/events';
import { Order, OrderItem, Customer } from '../types'; // ALWAYS import from app

// Domain events for order lifecycle
export class OrderCreatedEvent extends DomainEvent {
  constructor(
    public readonly orderId: string,
    public readonly customerId: string,
    public readonly totalAmount: number,
    public readonly items: OrderItem[]
  ) {
    super('OrderCreated', { orderId, customerId, totalAmount, items });
  }
}

export class OrderStatusChangedEvent extends DomainEvent {
  constructor(
    public readonly orderId: string,
    public readonly previousStatus: string,
    public readonly newStatus: string,
    public readonly reason?: string
  ) {
    super('OrderStatusChanged', { orderId, previousStatus, newStatus, reason });
  }
}

export class OrderCancelledEvent extends DomainEvent {
  constructor(
    public readonly orderId: string,
    public readonly reason: string,
    public readonly refundAmount: number
  ) {
    super('OrderCancelled', { orderId, reason, refundAmount });
  }
}

// ⭐ Order Aggregate with Domain Events
export class OrderAggregate extends AggregateRoot {
  private _id: string;
  private _customerId: string;
  private _status: string;
  private _items: OrderItem[];
  private _totalAmount: number;
  private _createdAt: Date;
  private _updatedAt: Date;

  constructor(id: string, customerId: string, items: OrderItem[]) {
    super();
    this._id = id;
    this._customerId = customerId;
    this._items = items;
    this._status = 'pending';
    this._totalAmount = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    this._createdAt = new Date();
    this._updatedAt = new Date();
  }

  // Factory method for creating new orders
  static create(customerId: string, items: OrderItem[]): OrderAggregate {
    const orderId = `order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const order = new OrderAggregate(orderId, customerId, items);
    
    // ⭐ Raise domain event when order is created
    order.addDomainEvent(new OrderCreatedEvent(
      orderId,
      customerId,
      order._totalAmount,
      items
    ));
    
    return order;
  }

  // Business operations that raise events
  confirm(): void {
    if (this._status !== 'pending') {
      throw new Error('Order can only be confirmed when in pending status');
    }
    
    const previousStatus = this._status;
    this._status = 'confirmed';
    this._updatedAt = new Date();
    
    // ⭐ Raise domain event when status changes
    this.addDomainEvent(new OrderStatusChangedEvent(
      this._id,
      previousStatus,
      this._status,
      'Order confirmed by customer'
    ));
  }

  ship(): void {
    if (this._status !== 'confirmed') {
      throw new Error('Order can only be shipped when confirmed');
    }
    
    const previousStatus = this._status;
    this._status = 'shipped';
    this._updatedAt = new Date();
    
    this.addDomainEvent(new OrderStatusChangedEvent(
      this._id,
      previousStatus,
      this._status,
      'Order shipped to customer'
    ));
  }

  cancel(reason: string): void {
    if (this._status === 'shipped' || this._status === 'delivered') {
      throw new Error('Cannot cancel shipped or delivered orders');
    }
    
    const previousStatus = this._status;
    this._status = 'cancelled';
    this._updatedAt = new Date();
    
    // ⭐ Raise multiple events for cancellation
    this.addDomainEvent(new OrderStatusChangedEvent(
      this._id,
      previousStatus,
      this._status,
      reason
    ));
    
    this.addDomainEvent(new OrderCancelledEvent(
      this._id,
      reason,
      this._totalAmount
    ));
  }

  // Getters
  get id(): string { return this._id; }
  get customerId(): string { return this._customerId; }
  get status(): string { return this._status; }
  get items(): OrderItem[] { return [...this._items]; }
  get totalAmount(): number { return this._totalAmount; }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }
}

// order-repository.ts
import { IBaseRepository, BaseRepository } from '@vytches-ddd/repositories';
import { UnifiedEventBus, UniversalEventDispatcher } from '@vytches-ddd/events';
import { Result } from '@vytches-ddd/utils';
import { OrderAggregate } from './order-aggregate';

// ⭐ Order Repository with Automatic Event Publishing
export class OrderRepository extends BaseRepository<OrderAggregate> {
  constructor() {
    // Set up event system for automatic publishing
    const eventBus = new UnifiedEventBus();
    const dispatcher = new UniversalEventDispatcher(eventBus);
    
    super(dispatcher);
  }

  async save(order: OrderAggregate): Promise<Result<OrderAggregate, Error>> {
    try {
      // ⭐ Repository automatically:
      // 1. Persists the aggregate
      // 2. Publishes all domain events
      // 3. Clears events from aggregate
      // 4. Handles transaction safety
      
      const result = await super.save(order);
      
      if (result.isSuccess()) {
        console.log(`Order ${order.id} saved and events published`);
      }
      
      return result;
    } catch (error) {
      return Result.failure(new Error(`Failed to save order: ${error.message}`));
    }
  }

  async findById(id: string): Promise<Result<OrderAggregate | null, Error>> {
    try {
      // In real implementation, this would query the database
      // For demo purposes, we'll return null
      return Result.success(null);
    } catch (error) {
      return Result.failure(new Error(`Failed to find order: ${error.message}`));
    }
  }

  async findByCustomerId(customerId: string): Promise<Result<OrderAggregate[], Error>> {
    try {
      // In real implementation, this would query the database
      // For demo purposes, we'll return empty array
      return Result.success([]);
    } catch (error) {
      return Result.failure(new Error(`Failed to find orders: ${error.message}`));
    }
  }
}

// event-handlers.ts
import { EventHandler } from '@vytches-ddd/events';
import { 
  OrderCreatedEvent, 
  OrderStatusChangedEvent, 
  OrderCancelledEvent 
} from './order-aggregate';

// ⭐ Event handlers for order events
@EventHandler(OrderCreatedEvent)
export class OrderCreatedHandler {
  async handle(event: OrderCreatedEvent): Promise<void> {
    console.log(`📦 Order Created: ${event.orderId} for customer ${event.customerId}`);
    
    // Side effects for order creation:
    // - Send welcome email to customer
    // - Update inventory
    // - Create shipping label
    // - Notify warehouse
    
    try {
      await this.sendWelcomeEmail(event.customerId, event.orderId);
      await this.updateInventory(event.items);
      await this.notifyWarehouse(event.orderId);
    } catch (error) {
      console.error('Failed to process order creation:', error);
      // In real system, you might want to publish a failure event
    }
  }

  private async sendWelcomeEmail(customerId: string, orderId: string): Promise<void> {
    // Email service integration
    console.log(`📧 Sending welcome email to customer ${customerId} for order ${orderId}`);
  }

  private async updateInventory(items: OrderItem[]): Promise<void> {
    // Inventory service integration
    console.log(`📊 Updating inventory for ${items.length} items`);
  }

  private async notifyWarehouse(orderId: string): Promise<void> {
    // Warehouse notification service
    console.log(`🏭 Notifying warehouse about order ${orderId}`);
  }
}

@EventHandler(OrderStatusChangedEvent)
export class OrderStatusChangedHandler {
  async handle(event: OrderStatusChangedEvent): Promise<void> {
    console.log(`🔄 Order Status Changed: ${event.orderId} from ${event.previousStatus} to ${event.newStatus}`);
    
    // Side effects based on status change:
    if (event.newStatus === 'confirmed') {
      await this.processPayment(event.orderId);
    } else if (event.newStatus === 'shipped') {
      await this.sendShippingNotification(event.orderId);
    }
  }

  private async processPayment(orderId: string): Promise<void> {
    console.log(`💳 Processing payment for order ${orderId}`);
  }

  private async sendShippingNotification(orderId: string): Promise<void> {
    console.log(`📦 Sending shipping notification for order ${orderId}`);
  }
}

@EventHandler(OrderCancelledEvent)
export class OrderCancelledHandler {
  async handle(event: OrderCancelledEvent): Promise<void> {
    console.log(`❌ Order Cancelled: ${event.orderId} - ${event.reason}`);
    
    // Side effects for order cancellation:
    await this.processRefund(event.orderId, event.refundAmount);
    await this.restoreInventory(event.orderId);
    await this.sendCancellationEmail(event.orderId);
  }

  private async processRefund(orderId: string, amount: number): Promise<void> {
    console.log(`💰 Processing refund of $${amount} for order ${orderId}`);
  }

  private async restoreInventory(orderId: string): Promise<void> {
    console.log(`📊 Restoring inventory for cancelled order ${orderId}`);
  }

  private async sendCancellationEmail(orderId: string): Promise<void> {
    console.log(`📧 Sending cancellation email for order ${orderId}`);
  }
}
```

## Key Features

- **Automatic Event Publishing**: Repository pattern handles event publishing automatically
- **Domain Event Pattern**: Aggregates raise events for business operations
- **Event Handlers**: Decorators for handling domain events with side effects
- **Transaction Safety**: Events are published only after successful persistence
- **Clean Architecture**: Clear separation between business logic and event handling

## Usage Example

```typescript
// Usage in application service
export class OrderService {
  constructor(private orderRepository: OrderRepository) {}

  async createOrder(customerId: string, items: OrderItem[]): Promise<Result<OrderAggregate, Error>> {
    try {
      // Create order aggregate (raises OrderCreatedEvent)
      const order = OrderAggregate.create(customerId, items);
      
      // Save order (automatically publishes events)
      const saveResult = await this.orderRepository.save(order);
      
      if (saveResult.isFailure()) {
        return Result.failure(saveResult.error);
      }

      // Event handlers automatically process the events:
      // - OrderCreatedHandler sends emails, updates inventory
      // - All happens automatically after repository.save()
      
      return Result.success(saveResult.value);
    } catch (error) {
      return Result.failure(new Error(`Failed to create order: ${error.message}`));
    }
  }

  async confirmOrder(orderId: string): Promise<Result<OrderAggregate, Error>> {
    try {
      const orderResult = await this.orderRepository.findById(orderId);
      
      if (orderResult.isFailure() || !orderResult.value) {
        return Result.failure(new Error('Order not found'));
      }

      const order = orderResult.value;
      
      // Confirm order (raises OrderStatusChangedEvent)
      order.confirm();
      
      // Save order (automatically publishes events)
      const saveResult = await this.orderRepository.save(order);
      
      if (saveResult.isFailure()) {
        return Result.failure(saveResult.error);
      }

      // OrderStatusChangedHandler automatically processes payment
      
      return Result.success(saveResult.value);
    } catch (error) {
      return Result.failure(new Error(`Failed to confirm order: ${error.message}`));
    }
  }
}
```

## Common Pitfalls

- **Event Ordering**: Be aware that events are processed asynchronously
- **Error Handling**: Handle failures in event handlers gracefully
- **Transaction Boundaries**: Events are published after successful persistence
- **Event Payload**: Keep event payloads focused and immutable
- **Handler Dependencies**: Avoid circular dependencies between handlers