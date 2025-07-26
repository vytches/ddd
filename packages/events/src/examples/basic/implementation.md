# Events - Implementation Overview

**Version**: 1.0.0  
**Package**: @vytches/ddd-events  
**Complexity**: beginner  
**Domain**: Order Management  
**Patterns**: repository-pattern, domain-events, automatic-publishing

## Overview

This implementation overview demonstrates the foundational patterns of the
Unified Event System. The package provides automatic event publishing through
the repository pattern, eliminating manual event management while ensuring
consistency.

## Core Implementation Pattern

The Events package follows the **Repository Pattern with Automatic Event
Publishing** where domain events are automatically published when aggregates are
saved:

```typescript
// 1. Create aggregate with business logic
const orderAggregate = OrderAggregate.create(orderData);

// 2. Save through repository - events published automatically
await orderRepository.save(orderAggregate);
// ↳ Automatically publishes OrderCreated and related events
```

## Basic Event Publishing

```typescript
import { UnifiedEventBus, UniversalEventDispatcher } from '@vytches/ddd-events';
import { AggregateRoot, DomainEvent } from '@vytches/ddd-aggregates';

// Domain Event
class OrderCreatedEvent extends DomainEvent<{
  orderId: string;
  total: number;
}> {
  constructor(data: { orderId: string; total: number }) {
    super('OrderCreated', data);
  }
}

// Aggregate with Events
class OrderAggregate extends AggregateRoot {
  private orderId: string;
  private total: number;

  constructor(orderId: string, total: number) {
    super(orderId);
    this.orderId = orderId;
    this.total = total;
  }

  static create(orderId: string, total: number): OrderAggregate {
    const aggregate = new OrderAggregate(orderId, total);
    // Events automatically added to aggregate
    aggregate.addDomainEvent(new OrderCreatedEvent({ orderId, total }));
    return aggregate;
  }
}

// Repository with Auto-Publishing
class OrderRepository {
  constructor(private eventDispatcher: UniversalEventDispatcher) {}

  async save(aggregate: OrderAggregate): Promise<void> {
    // 1. Persist aggregate state
    console.log('Saving aggregate...');

    // 2. Publish events automatically
    const events = aggregate.getUncommittedEvents();
    await this.eventDispatcher.publishMany(events);

    // 3. Mark events as committed
    aggregate.markEventsAsCommitted();

    console.log(`${events.length} events published automatically`);
  }
}

// Usage
async function basicExample(): Promise<void> {
  const eventBus = new UnifiedEventBus();
  const dispatcher = new UniversalEventDispatcher(eventBus);
  const repository = new OrderRepository(dispatcher);

  // Create and save - events published automatically
  const order = OrderAggregate.create('order-123', 99.99);
  await repository.save(order); // OrderCreated event published
}
```

## Event Handlers

```typescript
import { EventHandler } from '@vytches/ddd-events';

@EventHandler(OrderCreatedEvent, {
  autoRegister: true,
  eventContext: 'order-management',
})
class OrderNotificationHandler {
  async handle(event: OrderCreatedEvent): Promise<void> {
    const { orderId, total } = event.payload;
    console.log(`📧 Sending notification for order ${orderId} ($${total})`);

    // Business logic for notifications
    await this.sendOrderConfirmation(orderId, total);
  }

  private async sendOrderConfirmation(
    orderId: string,
    total: number
  ): Promise<void> {
    // Simulate notification sending
    console.log(`✅ Order confirmation sent for ${orderId}`);
  }
}
```

## Complete System Setup

```typescript
import { VytchesDDD } from '@vytches/ddd-di';

// Initialize event system with dependency injection
async function setupEventSystem(): Promise<void> {
  const eventBus = new UnifiedEventBus();
  const dispatcher = new UniversalEventDispatcher(eventBus);

  // Register with DI container
  VytchesDDD.registerInstance('eventBus', eventBus);
  VytchesDDD.registerInstance('eventDispatcher', dispatcher);

  // Auto-discover event handlers
  await VytchesDDD.configure();

  console.log(
    '✅ Event system initialized with automatic handler registration'
  );
}
```

## Key Implementation Features

- **🔄 Automatic Publishing**: Events published transparently during repository
  save operations
- **📦 Repository Pattern**: Clean separation between business logic and event
  publishing
- **🎯 Domain Events**: Business-focused events representing meaningful domain
  occurrences
- **⚡ Transaction Safety**: Events and state changes happen atomically
- **🏗️ Aggregate-Driven**: Events originate from aggregate business methods
- **🎨 Handler Auto-Discovery**: Event handlers automatically registered through
  DI

## Architecture Benefits

1. **Simplified Event Management**: No manual event publishing code required
2. **Consistency Guarantee**: Events always published when state changes are
   persisted
3. **Loose Coupling**: Event handlers can be added without modifying core
   business logic
4. **Scalability**: Multiple handlers can process the same event concurrently
5. **Testability**: Business logic and event publishing can be tested
   independently

## Implementation Examples

For detailed implementation examples, see:

- **[Example 1: Repository Pattern](./example-1.md)** - Complete
  repository-based event publishing
- **[Example 2: Event Handlers](./example-2.md)** - Creating and registering
  event handlers
- **[Example 3: Context Filtering](./example-3.md)** - Multi-tenant and
  context-aware processing
- **[Use Cases](./use-case.md)** - Real-world business scenarios and
  implementations

This foundational pattern forms the basis for all advanced event-driven
architecture features in the @vytches/ddd-core library.
