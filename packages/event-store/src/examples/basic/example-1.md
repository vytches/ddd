# In-Memory Event Store

**Version**: 1.0.0
**Package**: @vytches-ddd/event-store
**Complexity**: basic
**Domain**: Infrastructure
**Patterns**: event-storage, stream-management, basic-persistence, in-memory-storage
**Dependencies**: @vytches-ddd/event-store, @vytches-ddd/events

## Description

Basic event storage and retrieval using the in-memory event store implementation. This example demonstrates fundamental event storage concepts including stream management, event appending, reading, and basic error handling patterns.

## Business Context

Every event-driven application needs persistent storage for domain events. The in-memory event store provides a simple starting point for development, testing, and small applications where events need to be stored and retrieved reliably within a single process lifecycle.

## Code Example

```typescript
// basic-event-storage.ts
import { InMemoryEventStore, JsonEventSerializer } from '@vytches-ddd/event-store';
import { DomainEvent, EntityId } from '@vytches-ddd/events';
import { Result } from '@vytches-ddd/utils';
import { CreateOrderData, Order, OrderStatus } from './types'; // From your app

// ⭐ FOCUS: Basic event store setup
export class OrderEventStoreService {
  private readonly eventStore: InMemoryEventStore;
  private readonly serializer = new JsonEventSerializer();

  constructor() {
    // ⭐ FOCUS: Initialize with in-memory implementation
    this.eventStore = new InMemoryEventStore({
      serializer: this.serializer,
      enableSnapshots: false
    });
  }

  async appendOrderEvents(
    orderId: string, 
    events: DomainEvent[], 
    expectedVersion: number = -1
  ): Promise<Result<void, Error>> {
    try {
      // ⭐ FOCUS: Append events to stream
      const result = await this.eventStore.appendEvents(
        `order-${orderId}`, 
        events, 
        expectedVersion
      );

      if (result.isFailure()) {
        return Result.fail(new Error(`Failed to append events: ${result.error.message}`));
      }

      console.log(`Appended ${events.length} events to order-${orderId}`);
      return Result.ok();
    } catch (error) {
      return Result.fail(new Error(`Event append failed: ${error.message}`));
    }
  }

  async readOrderEvents(orderId: string): Promise<Result<DomainEvent[], Error>> {
    try {
      // ⭐ FOCUS: Read all events from stream
      const result = await this.eventStore.readStream(`order-${orderId}`);

      if (result.isFailure()) {
        return Result.fail(new Error(`Failed to read stream: ${result.error.message}`));
      }

      const events = result.value.events;
      console.log(`Read ${events.length} events from order-${orderId}`);

      return Result.ok(events);
    } catch (error) {
      return Result.fail(new Error(`Stream read failed: ${error.message}`));
    }
  }

  async readOrderEventsWithPagination(
    orderId: string,
    fromEventNumber: number = 0,
    maxCount: number = 50
  ): Promise<Result<DomainEvent[], Error>> {
    try {
      // ⭐ FOCUS: Read stream with pagination
      const result = await this.eventStore.readStream(`order-${orderId}`, {
        fromEventNumber,
        maxCount
      });

      if (result.isFailure()) {
        return Result.fail(result.error);
      }

      return Result.ok(result.value.events);
    } catch (error) {
      return Result.fail(new Error(`Paginated read failed: ${error.message}`));
    }
  }

  async getStreamInfo(orderId: string): Promise<Result<any, Error>> {
    try {
      // ⭐ FOCUS: Get metadata about stream
      const streamExists = await this.eventStore.streamExists(`order-${orderId}`);
      
      if (!streamExists) {
        return Result.fail(new Error(`Stream order-${orderId} does not exist`));
      }

      const result = await this.eventStore.readStream(`order-${orderId}`);
      
      if (result.isFailure()) {
        return Result.fail(result.error);
      }

      const stream = result.value;
      
      return Result.ok({
        streamId: `order-${orderId}`,
        eventCount: stream.events.length,
        firstEventNumber: stream.events.length > 0 ? 0 : -1,
        lastEventNumber: stream.events.length - 1,
        exists: true
      });
    } catch (error) {
      return Result.fail(new Error(`Stream info retrieval failed: ${error.message}`));
    }
  }

  async getAllStreams(): Promise<Result<string[], Error>> {
    try {
      // ⭐ FOCUS: List all streams in store
      const streams = await this.eventStore.getAllStreamIds();
      return Result.ok(streams);
    } catch (error) {
      return Result.fail(new Error(`Failed to get all streams: ${error.message}`));
    }
  }

  async deleteStream(orderId: string): Promise<Result<void, Error>> {
    try {
      // ⭐ FOCUS: Delete entire stream (use with caution)
      const result = await this.eventStore.deleteStream(`order-${orderId}`);
      
      if (result.isFailure()) {
        return Result.fail(result.error);
      }

      console.log(`Deleted stream order-${orderId}`);
      return Result.ok();
    } catch (error) {
      return Result.fail(new Error(`Stream deletion failed: ${error.message}`));
    }
  }
}

// ⭐ FOCUS: Domain events for order processing
export class OrderCreatedEvent extends DomainEvent {
  constructor(
    aggregateId: EntityId,
    public readonly customerId: string,
    public readonly totalAmount: number,
    public readonly currency: string,
    public readonly items: any[]
  ) {
    super(aggregateId, 'OrderCreated', 1);
  }
}

export class OrderStatusChangedEvent extends DomainEvent {
  constructor(
    aggregateId: EntityId,
    public readonly previousStatus: OrderStatus,
    public readonly newStatus: OrderStatus,
    public readonly reason?: string
  ) {
    super(aggregateId, 'OrderStatusChanged', 1);
  }
}

export class OrderItemAddedEvent extends DomainEvent {
  constructor(
    aggregateId: EntityId,
    public readonly productId: string,
    public readonly quantity: number,
    public readonly unitPrice: number
  ) {
    super(aggregateId, 'OrderItemAdded', 1);
  }
}

// ⭐ FOCUS: Complete order processing with event storage
export class OrderProcessingService {
  constructor(private readonly eventStore: OrderEventStoreService) {}

  async createOrder(orderData: CreateOrderData): Promise<Result<Order, Error>> {
    try {
      const orderId = EntityId.createUuid().value;
      
      // ⭐ FOCUS: Create and store domain events
      const events: DomainEvent[] = [
        new OrderCreatedEvent(
          EntityId.fromString(orderId),
          orderData.customerId,
          orderData.totalAmount,
          orderData.currency,
          orderData.items
        )
      ];

      // Add events for each item
      for (const item of orderData.items) {
        events.push(new OrderItemAddedEvent(
          EntityId.fromString(orderId),
          item.productId,
          item.quantity,
          item.unitPrice
        ));
      }

      // ⭐ FOCUS: Append events to store
      const appendResult = await this.eventStore.appendOrderEvents(orderId, events);
      
      if (appendResult.isFailure()) {
        return Result.fail(appendResult.error);
      }

      // Create order from events
      const order: Order = {
        id: orderId,
        customerId: orderData.customerId,
        items: orderData.items,
        status: 'draft',
        totalAmount: orderData.totalAmount,
        currency: orderData.currency,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      return Result.ok(order);
    } catch (error) {
      return Result.fail(new Error(`Order creation failed: ${error.message}`));
    }
  }

  async changeOrderStatus(
    orderId: string, 
    newStatus: OrderStatus, 
    reason?: string
  ): Promise<Result<void, Error>> {
    try {
      // ⭐ FOCUS: Read existing events to get current state
      const eventsResult = await this.eventStore.readOrderEvents(orderId);
      
      if (eventsResult.isFailure()) {
        return Result.fail(eventsResult.error);
      }

      // Determine current status from events
      const currentStatus = this.getCurrentStatusFromEvents(eventsResult.value);
      
      if (currentStatus === newStatus) {
        return Result.ok(); // No change needed
      }

      // ⭐ FOCUS: Create status change event
      const statusChangeEvent = new OrderStatusChangedEvent(
        EntityId.fromString(orderId),
        currentStatus,
        newStatus,
        reason
      );

      // Append new event with optimistic concurrency
      const appendResult = await this.eventStore.appendOrderEvents(
        orderId, 
        [statusChangeEvent],
        eventsResult.value.length - 1 // Expected version
      );
      
      return appendResult;
    } catch (error) {
      return Result.fail(new Error(`Status change failed: ${error.message}`));
    }
  }

  async reconstructOrderFromEvents(orderId: string): Promise<Result<Order | null, Error>> {
    try {
      // ⭐ FOCUS: Reconstruct aggregate from event stream
      const eventsResult = await this.eventStore.readOrderEvents(orderId);
      
      if (eventsResult.isFailure()) {
        return Result.fail(eventsResult.error);
      }

      const events = eventsResult.value;
      
      if (events.length === 0) {
        return Result.ok(null);
      }

      // ⭐ FOCUS: Replay events to build current state
      let order: Order | null = null;
      
      for (const event of events) {
        switch (event.eventType) {
          case 'OrderCreated':
            const createdEvent = event as OrderCreatedEvent;
            order = {
              id: orderId,
              customerId: createdEvent.customerId,
              items: [],
              status: 'draft',
              totalAmount: createdEvent.totalAmount,
              currency: createdEvent.currency,
              createdAt: event.timestamp,
              updatedAt: event.timestamp
            };
            break;
            
          case 'OrderItemAdded':
            const itemEvent = event as OrderItemAddedEvent;
            if (order) {
              order.items.push({
                productId: itemEvent.productId,
                quantity: itemEvent.quantity,
                unitPrice: itemEvent.unitPrice
              });
            }
            break;
            
          case 'OrderStatusChanged':
            const statusEvent = event as OrderStatusChangedEvent;
            if (order) {
              order.status = statusEvent.newStatus;
              order.updatedAt = event.timestamp;
            }
            break;
        }
      }

      return Result.ok(order);
    } catch (error) {
      return Result.fail(new Error(`Order reconstruction failed: ${error.message}`));
    }
  }

  private getCurrentStatusFromEvents(events: DomainEvent[]): OrderStatus {
    let status: OrderStatus = 'draft';
    
    for (const event of events) {
      if (event.eventType === 'OrderStatusChanged') {
        const statusEvent = event as OrderStatusChangedEvent;
        status = statusEvent.newStatus;
      }
    }
    
    return status;
  }
}
```

## Usage Examples

```typescript
// Complete workflow example
import { OrderProcessingService, OrderEventStoreService } from './basic-event-storage';

async function demonstrateBasicEventStore() {
  // ⭐ FOCUS: Setup event store services
  const eventStore = new OrderEventStoreService();
  const orderService = new OrderProcessingService(eventStore);

  // ⭐ FOCUS: Create order with events
  const orderData: CreateOrderData = {
    customerId: 'customer-123',
    totalAmount: 299.99,
    currency: 'USD',
    items: [
      { productId: 'product-1', quantity: 2, unitPrice: 99.99 },
      { productId: 'product-2', quantity: 1, unitPrice: 100.01 }
    ],
    shippingAddress: {
      street: '123 Main St',
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      country: 'US'
    },
    billingAddress: {
      street: '123 Main St',
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      country: 'US'
    }
  };

  const createResult = await orderService.createOrder(orderData);
  
  if (createResult.isFailure()) {
    console.error('Order creation failed:', createResult.error.message);
    return;
  }

  const order = createResult.value;
  console.log('Order created:', order.id);

  // ⭐ FOCUS: Change order status
  await orderService.changeOrderStatus(order.id, 'confirmed', 'Payment received');
  await orderService.changeOrderStatus(order.id, 'processing', 'Order picked for fulfillment');

  // ⭐ FOCUS: Reconstruct order from events
  const reconstructedResult = await orderService.reconstructOrderFromEvents(order.id);
  
  if (reconstructedResult.isSuccess()) {
    const reconstructed = reconstructedResult.value;
    console.log('Reconstructed order status:', reconstructed?.status);
    console.log('Total events processed:', reconstructed ? 'success' : 'no events');
  }

  // ⭐ FOCUS: Get stream information
  const streamInfoResult = await eventStore.getStreamInfo(order.id);
  
  if (streamInfoResult.isSuccess()) {
    const info = streamInfoResult.value;
    console.log(`Stream ${info.streamId} contains ${info.eventCount} events`);
  }

  // ⭐ FOCUS: List all streams
  const streamsResult = await eventStore.getAllStreams();
  
  if (streamsResult.isSuccess()) {
    console.log('All streams:', streamsResult.value);
  }

  // ⭐ FOCUS: Read events with pagination
  const paginatedResult = await eventStore.readOrderEventsWithPagination(
    order.id,
    0, // Start from first event
    2  // Read 2 events maximum
  );
  
  if (paginatedResult.isSuccess()) {
    console.log(`Read ${paginatedResult.value.length} events from pagination`);
  }
}

// Run the demonstration
demonstrateBasicEventStore().catch(console.error);
```

## Key Features

- **Simple Setup**: Easy-to-use in-memory event store for development and testing
- **Stream Management**: Organize events by aggregate/stream with unique identifiers
- **Event Appending**: Store events with optimistic concurrency control
- **Stream Reading**: Retrieve events with pagination and filtering options
- **Event Reconstruction**: Rebuild aggregate state from stored events
- **Error Handling**: Comprehensive error handling with Result pattern
- **Serialization**: JSON-based event serialization for persistence

## Event Store Benefits

1. **Event Sourcing**: Complete audit trail of all state changes
2. **Temporal Queries**: Query system state at any point in time
3. **Debugging**: Full visibility into how data arrived at current state
4. **Integration**: Events can be published to other systems
5. **Scalability**: Events can be processed asynchronously

## Common Use Cases

- **Order Processing**: Track order lifecycle from creation to fulfillment
- **User Account Management**: Audit user actions and state changes
- **Financial Transactions**: Maintain immutable transaction history
- **Inventory Management**: Track stock movements and availability
- **Workflow Systems**: Store process state and transitions

## Performance Considerations

- **Memory Usage**: In-memory store holds all events in RAM
- **Batch Operations**: Use batch reads for better performance
- **Stream Size**: Consider stream splitting for very large aggregates
- **Concurrency**: Handle concurrent writes with version checking

## Common Pitfalls

- **Memory Limits**: In-memory store not suitable for large event volumes
- **Data Loss**: Events lost on application restart (use persistent store for production)
- **Concurrency Issues**: Always use expected version for consistency
- **Event Schema**: Plan for event versioning from the beginning

## Related Examples

- [Event Serialization Strategies](./example-2.md)
- [Event Stream Operations](./example-3.md)
- [Event Replay Engine](../intermediate/example-1.md)