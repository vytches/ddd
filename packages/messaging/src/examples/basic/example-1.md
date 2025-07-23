# Basic Outbox Pattern Implementation

**Version**: 1.0.0  
**Package**: @vytches-ddd/messaging  
**Complexity**: Basic  
**Domain**: E-commerce Order Processing  
**Patterns**: Outbox Pattern, Transactional Messaging  
**Dependencies**: @vytches-ddd/messaging, @vytches-ddd/core

## Description

This example demonstrates the basic implementation of the Outbox Pattern for
reliable message delivery in distributed systems. It shows how to ensure that
database transactions and message publishing are atomic, preventing data
inconsistencies.

## Business Context

In e-commerce systems, when an order is placed, multiple systems need to be
notified: inventory service, payment service, shipping service, and notification
service. Using the Outbox Pattern ensures that if the order is saved to the
database, the corresponding events are guaranteed to be published eventually,
even if the message broker is temporarily unavailable.

## Code Example

```typescript
// order-outbox.service.ts
import { OutboxMessageHandler, OutboxMessage } from '@vytches-ddd/messaging';
import { AggregateRoot, EntityId } from '@vytches-ddd/core';
import { Order, OrderStatus } from './types';

// Domain aggregate that produces events
export class OrderAggregate extends AggregateRoot {
  private status: OrderStatus;
  private totalAmount: number;

  static create(customerId: string, amount: number): OrderAggregate {
    const order = new OrderAggregate(EntityId.generate());
    order.status = 'pending';
    order.totalAmount = amount;

    // Add domain event that will be stored in outbox
    order.addDomainEvent({
      eventType: 'OrderCreated',
      aggregateId: order.id.toString(),
      payload: { customerId, amount, orderId: order.id.toString() },
      occurredAt: new Date(),
    });

    return order;
  }

  confirmPayment(transactionId: string): void {
    this.status = 'payment_completed';

    this.addDomainEvent({
      eventType: 'PaymentConfirmed',
      aggregateId: this.id.toString(),
      payload: {
        orderId: this.id.toString(),
        transactionId,
        amount: this.totalAmount,
      },
      occurredAt: new Date(),
    });
  }
}

// Service that uses outbox for reliable messaging
export class OrderService {
  constructor(
    private outboxHandler: OutboxMessageHandler,
    private orderRepository: IOrderRepository
  ) {}

  async createOrder(customerId: string, amount: number): Promise<void> {
    // Create order aggregate with events
    const order = OrderAggregate.create(customerId, amount);

    // Save order and publish events atomically using outbox
    await this.orderRepository.transaction(async tx => {
      // 1. Save the aggregate
      await this.orderRepository.save(order, tx);

      // 2. Store events in outbox (same transaction)
      const outboxMessages = order.getUncommittedEvents().map(event =>
        OutboxMessage.fromDomainEvent(event, {
          targetService: this.determineTargetService(event.eventType),
          priority: 'normal',
          maxRetries: 3,
        })
      );

      await this.outboxHandler.storeMessages(outboxMessages, tx);

      // 3. Mark events as committed
      order.markEventsAsCommitted();
    });

    // 4. Process outbox asynchronously (outside transaction)
    await this.outboxHandler.processOutbox();
  }

  private determineTargetService(eventType: string): string {
    const serviceMapping: Record<string, string> = {
      OrderCreated: 'inventory-service',
      PaymentConfirmed: 'shipping-service',
      OrderCancelled: 'notification-service',
    };
    return serviceMapping[eventType] || 'event-stream';
  }
}

// Background worker for processing outbox
export class OutboxProcessor {
  constructor(
    private outboxHandler: OutboxMessageHandler,
    private intervalMs: number = 5000
  ) {}

  start(): void {
    setInterval(async () => {
      try {
        const processed = await this.outboxHandler.processOutbox({
          batchSize: 100,
          lockTimeout: 30000,
        });

        if (processed > 0) {
          console.log(`Processed ${processed} outbox messages`);
        }
      } catch (error) {
        console.error('Outbox processing error:', error);
      }
    }, this.intervalMs);
  }
}
```

## Key Features

- **Transactional Guarantee**: Messages are stored in the same transaction as
  business data
- **At-Least-Once Delivery**: Messages are retried until successfully delivered
- **Idempotency**: Each message has unique ID to prevent duplicate processing
- **Failure Handling**: Built-in retry mechanism with configurable attempts
- **Performance**: Batch processing of outbox messages

## Common Pitfalls

- **Not using transactions**: Storing outbox messages outside the business
  transaction defeats the purpose
- **Synchronous processing**: Processing outbox immediately can slow down the
  main transaction
- **Missing idempotency**: Consumers must handle duplicate messages gracefully
- **Large payloads**: Keep message payloads small; use references to data
  instead

## Related Examples

- [Advanced Saga Orchestration](/packages/messaging/src/examples/advanced/example-1.md)
- [Event-Driven Integration](/packages/events/src/examples/intermediate/example-1.md)
- [CQRS Event Sourcing](/packages/cqrs/src/examples/advanced/example-1.md)
