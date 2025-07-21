# Basic Event Publishing with Repository Pattern

**Version**: 1.0.0  
**Package**: @vytches-ddd/events  
**Complexity**: beginner  
**Domain**: Order Management  
**Patterns**: repository-pattern, domain-events, automatic-publishing  
**Dependencies**: @vytches-ddd/events, @vytches-ddd/repositories, @vytches-ddd/aggregates

## Description

Demonstrates the core event publishing pattern where domain events are automatically published when aggregates are saved through repositories. This is the foundational pattern that makes event-driven architecture transparent and reliable.

## Business Context

When an order is created in an e-commerce system, multiple downstream processes need to be triggered: inventory reservation, payment processing, and customer notifications. The repository pattern with automatic event publishing ensures these events are reliably emitted without manual intervention.

## Code Example

```typescript
// order-aggregate.ts
import { AggregateRoot } from '@vytches-ddd/aggregates';
import { DomainEvent } from '@vytches-ddd/events';
import { Order, CreateOrderCommand, OrderCreatedEventData } from '../types';

/**
 * @llm-summary Order aggregate that demonstrates automatic event publishing
 * @llm-domain Order Management
 * @llm-complexity Simple
 * 
 * @description
 * Order aggregate that emits domain events when business operations occur.
 * Events are automatically published when the aggregate is saved through repository.
 * 
 * @example
 * ```typescript
 * const order = OrderAggregate.create(createOrderCommand);
 * await orderRepository.save(order); // Events published automatically
 * ```
 * 
 * @since 1.0.0
 * @public
 */
export class OrderAggregate extends AggregateRoot {
  private order: Order;

  private constructor(order: Order) {
    super(order.id);
    this.order = order;
  }

  /**
   * @llm-summary Creates new order and emits OrderCreated domain event
   * @llm-domain Order Management  
   * @llm-complexity Simple
   *
   * @description
   * Factory method that creates a new order aggregate and automatically
   * adds the OrderCreated domain event for publishing.
   *
   * @param command - Order creation command with user and item data
   * @returns New OrderAggregate instance with pending events
   *
   * @example
   * ```typescript
   * const command: CreateOrderCommand = {
   *   userId: 'user-123',
   *   items: [{ productId: 'prod-1', quantity: 2, price: 29.99 }],
   *   shippingAddress: { street: '123 Main St', city: 'Boston', ... },
   *   paymentMethod: 'credit_card'
   * };
   * 
   * const orderAggregate = OrderAggregate.create(command);
   * ```
   *
   * @since 1.0.0
   * @public
   */
  public static create(command: CreateOrderCommand): OrderAggregate {
    const orderId = `order-${Date.now()}`;
    const total = command.items.reduce((sum, item) => sum + (item.quantity * item.price), 0);

    const order: Order = {
      id: orderId,
      userId: command.userId,
      items: command.items.map(item => ({
        ...item,
        total: item.quantity * item.price
      })),
      status: 'pending',
      total,
      shippingAddress: command.shippingAddress,
      paymentMethod: command.paymentMethod,
      notes: command.notes,
      createdAt: new Date()
    };

    const aggregate = new OrderAggregate(order);

    // Add domain event - will be published automatically when saved
    const eventData: OrderCreatedEventData = {
      orderId: order.id,
      userId: order.userId,
      total: order.total,
      items: order.items,
      createdAt: order.createdAt
    };

    aggregate.addDomainEvent(new OrderCreatedEvent(eventData));
    
    return aggregate;
  }

  /**
   * @llm-summary Confirms order and emits OrderConfirmed event
   * @llm-domain Order Management
   * @llm-complexity Simple
   *
   * @description
   * Business method that transitions order to confirmed status
   * and emits corresponding domain event.
   *
   * @example
   * ```typescript
   * orderAggregate.confirm();
   * await orderRepository.save(orderAggregate); // Publishes events
   * ```
   *
   * @since 1.0.0
   * @public
   */
  public confirm(): void {
    if (this.order.status !== 'pending') {
      throw new Error(`Cannot confirm order in status: ${this.order.status}`);
    }

    this.order.status = 'confirmed';
    this.order.updatedAt = new Date();

    this.addDomainEvent(new OrderConfirmedEvent({
      orderId: this.order.id,
      confirmedAt: new Date()
    }));
  }

  public getOrder(): Order {
    return { ...this.order };
  }
}

/**
 * @llm-summary Domain event emitted when order is created
 * @llm-domain Order Management
 * @llm-complexity Simple
 *
 * @description
 * Domain event that represents the business fact that an order
 * has been created in the system.
 *
 * @since 1.0.0
 * @public
 */
export class OrderCreatedEvent extends DomainEvent<OrderCreatedEventData> {
  constructor(data: OrderCreatedEventData) {
    super('OrderCreated', data);
  }
}

export class OrderConfirmedEvent extends DomainEvent<{ orderId: string; confirmedAt: Date }> {
  constructor(data: { orderId: string; confirmedAt: Date }) {
    super('OrderConfirmed', data);
  }
}
```

```typescript
// order-repository.ts
import { IBaseRepository } from '@vytches-ddd/repositories';
import { UniversalEventDispatcher } from '@vytches-ddd/events';
import { OrderAggregate } from '../types';

/**
 * @llm-summary Repository for Order aggregates with automatic event publishing
 * @llm-domain Order Management
 * @llm-complexity Simple
 *
 * @description
 * Repository implementation that demonstrates the automatic event publishing
 * pattern. When save() is called, domain events are automatically published.
 *
 * @example
 * ```typescript
 * const repository = new OrderRepository(eventDispatcher);
 * await repository.save(orderAggregate); // Events published automatically
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class OrderRepository implements IBaseRepository<OrderAggregate> {
  constructor(
    private readonly eventDispatcher: UniversalEventDispatcher,
    private readonly dataStore: Map<string, any> = new Map()
  ) {}

  /**
   * @llm-summary Saves aggregate and automatically publishes domain events
   * @llm-domain Order Management
   * @llm-complexity Simple
   *
   * @description
   * Core repository method that persists the aggregate state and
   * automatically publishes all pending domain events.
   *
   * @param aggregate - Order aggregate to save
   * @returns Promise that resolves when save and event publishing complete
   *
   * @example
   * ```typescript
   * const order = OrderAggregate.create(command);
   * await repository.save(order);
   * // ↳ Order persisted AND OrderCreated event published
   * ```
   *
   * @since 1.0.0
   * @public
   */
  async save(aggregate: OrderAggregate): Promise<void> {
    try {
      // 1. Persist aggregate state
      const order = aggregate.getOrder();
      this.dataStore.set(order.id, order);
      
      // 2. Get domain events before clearing them
      const events = aggregate.getUncommittedEvents();
      
      // 3. Publish events automatically
      if (events.length > 0) {
        await this.eventDispatcher.publishMany(events);
      }
      
      // 4. Mark events as committed
      aggregate.markEventsAsCommitted();
      
      console.log(`Order ${order.id} saved and ${events.length} events published`);
    } catch (error) {
      console.error('Failed to save order:', error);
      throw error;
    }
  }

  async findById(id: string): Promise<OrderAggregate | null> {
    const order = this.dataStore.get(id);
    if (!order) return null;
    
    // In real implementation, reconstruct aggregate from stored state
    return OrderAggregate.create({
      userId: order.userId,
      items: order.items,
      shippingAddress: order.shippingAddress,
      paymentMethod: order.paymentMethod,
      notes: order.notes
    });
  }
}
```

```typescript
// usage-example.ts
import { UnifiedEventBus, UniversalEventDispatcher } from '@vytches-ddd/events';
import { OrderRepository, OrderAggregate, CreateOrderCommand } from '../types';

/**
 * @llm-summary Complete usage example showing automatic event publishing
 * @llm-domain Order Management
 * @llm-complexity Simple
 *
 * @description
 * Demonstrates the complete flow of creating an order and automatically
 * publishing domain events through the repository pattern.
 *
 * @example
 * ```typescript
 * const service = new OrderService();
 * await service.createOrder(command);
 * // ↳ Order created AND events published automatically
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class OrderService {
  private readonly orderRepository: OrderRepository;

  constructor() {
    // Setup event infrastructure
    const eventBus = new UnifiedEventBus();
    const eventDispatcher = new UniversalEventDispatcher(eventBus);
    
    // Repository handles automatic event publishing
    this.orderRepository = new OrderRepository(eventDispatcher);
  }

  /**
   * @llm-summary Creates order with automatic event publishing
   * @llm-domain Order Management
   * @llm-complexity Simple
   *
   * @description
   * Business service method that creates an order and demonstrates
   * how events are published automatically without manual intervention.
   *
   * @param command - Order creation command
   * @returns Promise with created order data
   *
   * @example
   * ```typescript
   * const command: CreateOrderCommand = {
   *   userId: 'user-123',
   *   items: [{ productId: 'prod-1', quantity: 2, price: 29.99 }],
   *   shippingAddress: address,
   *   paymentMethod: 'credit_card'
   * };
   * 
   * const order = await orderService.createOrder(command);
   * ```
   *
   * @since 1.0.0
   * @public
   */
  async createOrder(command: CreateOrderCommand): Promise<Order> {
    try {
      // 1. Create aggregate with business logic
      const orderAggregate = OrderAggregate.create(command);
      
      // 2. Save through repository - events published automatically
      await this.orderRepository.save(orderAggregate);
      // ↳ This automatically publishes OrderCreated event
      
      const order = orderAggregate.getOrder();
      console.log(`Order ${order.id} created successfully`);
      
      return order;
    } catch (error) {
      console.error('Failed to create order:', error);
      throw error;
    }
  }

  async confirmOrder(orderId: string): Promise<void> {
    const orderAggregate = await this.orderRepository.findById(orderId);
    if (!orderAggregate) {
      throw new Error(`Order ${orderId} not found`);
    }

    // Business logic + event emission
    orderAggregate.confirm();
    
    // Save automatically publishes OrderConfirmed event
    await this.orderRepository.save(orderAggregate);
  }
}

// Example usage
async function demonstrateBasicEventPublishing(): Promise<void> {
  const orderService = new OrderService();

  const command: CreateOrderCommand = {
    userId: 'user-123',
    items: [
      { productId: 'laptop-pro', name: 'Laptop Pro', quantity: 1, price: 1299.99 },
      { productId: 'mouse-wireless', name: 'Wireless Mouse', quantity: 1, price: 49.99 }
    ],
    shippingAddress: {
      street: '123 Tech Street',
      city: 'San Francisco',
      state: 'CA',
      zipCode: '94105',
      country: 'USA'
    },
    paymentMethod: 'credit_card'
  };

  try {
    // Create order - events published automatically
    const order = await orderService.createOrder(command);
    console.log('Order created:', order.id);

    // Confirm order - more events published automatically  
    await orderService.confirmOrder(order.id);
    console.log('Order confirmed:', order.id);
    
  } catch (error) {
    console.error('Order processing failed:', error);
  }
}
```

## Key Features

- **🔄 Automatic Publishing**: Events published transparently during repository save operations
- **📦 Repository Pattern**: Clean separation between business logic and event publishing  
- **🎯 Domain Events**: Business-focused events that represent meaningful domain occurrences
- **⚡ Transaction Safety**: Events and state changes happen atomically
- **🏗️ Aggregate-Driven**: Events originate from aggregate business methods

## Common Pitfalls

- **❌ Manual Event Publishing**: Don't manually publish events outside the repository pattern
- **❌ Forgetting to Save**: Events are only published when `repository.save()` is called
- **❌ Multiple Saves**: Avoid calling save multiple times for the same operation
- **❌ Event Mutation**: Don't modify event data after adding to aggregate

## Related Examples

- [Example 2: Event Handlers](./example-2.md) - Creating handlers for published events
- [Example 3: Context Filtering](./example-3.md) - Context-aware event processing
- [Intermediate: Batch Publishing](../intermediate/example-1.md) - Publishing multiple events efficiently