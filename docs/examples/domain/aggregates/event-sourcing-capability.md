@global-settings
@strategy: merge
@description: Global description for all aggregate capability examples
@business-context: Standard business context for aggregate capability operations
@author: DDD Team
@since: 1.0.0
@global-settings-end

# EventSourcingCapability - Advanced Example

**Version**: 1.0.0
**Package**: @vytches/ddd-aggregates
**Complexity**: advanced
**Domain**: aggregates
**Patterns**: event-sourcing, event-store-integration, state-reconstruction
**Dependencies**: @vytches/ddd-contracts

## Description

Demonstrates event sourcing capability for aggregate persistence and state reconstruction from events. Shows integration with event stores for loading and saving aggregate state.

## Business Context

Event sourcing provides complete audit trails and enables temporal queries. The EventSourcingCapability handles the complexity of loading aggregates from event streams and persisting new events.

## Code Example

@description: Demonstrates event sourcing capability for complete audit trails and state reconstruction from events
@description.cli: ## Enhanced CLI Description\n\nShows event store integration for loading and saving aggregate state
@description.jsdoc: Event sourcing capability for aggregate persistence and state reconstruction
@business-context: Enables complete audit trails and temporal queries through event sourcing patterns
@business-context.cli: Extended context for enterprise event sourcing integration patterns
@business-context.jsdoc: Event sourcing pattern for aggregate persistence and reconstruction
@since: 1.0.0

@extract: event-sourcing-capability:domain:advanced

```typescript
import { 
  AggregateBuilder, 
  EventSourcingCapability,
  AggregateError 
} from '@vytches/ddd-aggregates';
import { EntityId, IEventStore } from '@vytches/ddd-contracts';

// Mock event store implementation
class MockEventStore implements IEventStore {
  private events: Map<string | number, IExtendedDomainEvent[]> = new Map();

  async getEvents(aggregateId: string | number): Promise<IExtendedDomainEvent[]> {
    return this.events.get(aggregateId) || [];
  }

  async getEventsAfterVersion(
    aggregateId: string | number, 
    version: number
  ): Promise<IExtendedDomainEvent[]> {
    const allEvents = await this.getEvents(aggregateId);
    return allEvents.filter(event => 
      (event.metadata?.aggregateVersion || 0) > version
    );
  }

  async saveEvents(
    aggregateId: string | number,
    events: IExtendedDomainEvent[],
    expectedVersion: number
  ): Promise<void> {
    const existing = this.events.get(aggregateId) || [];
    
    // Simulate optimistic concurrency check
    if (existing.length !== expectedVersion) {
      throw new Error(`Concurrency conflict: expected version ${expectedVersion}, got ${existing.length}`);
    }

    // Add version to events and store
    const versionedEvents = events.map((event, index) => ({
      ...event,
      metadata: {
        ...event.metadata,
        aggregateVersion: expectedVersion + index + 1,
        eventId: `event-${Date.now()}-${index}`,
        timestamp: new Date()
      }
    }));

    this.events.set(aggregateId, [...existing, ...versionedEvents]);
    console.log(`Saved ${events.length} events for aggregate ${aggregateId}`);
  }

  // Additional methods for demonstration
  async getAllStreams(): Promise<Array<{ aggregateId: string | number; eventCount: number }>> {
    const streams: Array<{ aggregateId: string | number; eventCount: number }> = [];
    
    for (const [aggregateId, events] of this.events.entries()) {
      streams.push({ aggregateId, eventCount: events.length });
    }
    
    return streams;
  }
}

// Domain events
interface OrderCreatedEvent {
  orderId: string;
  customerId: string;
  createdAt: Date;
}

interface OrderItemAddedEvent {
  orderId: string;
  productId: string;
  quantity: number;
  price: number;
}

interface OrderConfirmedEvent {
  orderId: string;
  confirmedAt: Date;
  totalAmount: number;
}

// Order aggregate with event sourcing
class OrderAggregate extends AggregateRoot<string> {
  private customerId: string = '';
  private items: Array<{
    productId: string;
    quantity: number;
    price: number;
  }> = [];
  private totalAmount: number = 0;
  private confirmedAt?: Date;
  private createdAt?: Date;

  constructor(params: IAggregateConstructorParams<string>) {
    super(params);
  }

  // Business methods that produce events
  static createOrder(orderId: string, customerId: string): OrderAggregate {
    const id = new EntityId(orderId, 'text');
    const order = new OrderAggregate({ id, version: 0 });
    
    order.addDomainEvent({
      eventType: 'OrderCreated',
      payload: {
        orderId,
        customerId,
        createdAt: new Date()
      } as OrderCreatedEvent,
      metadata: {
        aggregateId: orderId,
        aggregateType: 'OrderAggregate'
      }
    });
    
    return order;
  }

  addItem(productId: string, quantity: number, price: number): void {
    this.addDomainEvent({
      eventType: 'OrderItemAdded',
      payload: {
        orderId: this.getId().getValue(),
        productId,
        quantity,
        price
      } as OrderItemAddedEvent,
      metadata: {
        aggregateId: this.getId().getValue(),
        aggregateType: 'OrderAggregate'
      }
    });
  }

  confirmOrder(): void {
    const now = new Date();
    
    this.addDomainEvent({
      eventType: 'OrderConfirmed',
      payload: {
        orderId: this.getId().getValue(),
        confirmedAt: now,
        totalAmount: this.calculateTotal()
      } as OrderConfirmedEvent,
      metadata: {
        aggregateId: this.getId().getValue(),
        aggregateType: 'OrderAggregate'
      }
    });
  }

  // Event handlers for state reconstruction
  loadFromHistory(events: IExtendedDomainEvent[]): void {
    for (const event of events) {
      this.applyEvent(event);
    }
    
    // Reset version to match the last event
    if (events.length > 0) {
      const lastEvent = events[events.length - 1];
      this.setVersion(lastEvent.metadata?.aggregateVersion || events.length);
      this.setInitialVersion(this.getVersion());
    }
  }

  private applyEvent(event: IExtendedDomainEvent): void {
    switch (event.eventType) {
      case 'OrderCreated':
        this.onOrderCreated(event.payload as OrderCreatedEvent);
        break;
      case 'OrderItemAdded':
        this.onOrderItemAdded(event.payload as OrderItemAddedEvent);
        break;
      case 'OrderConfirmed':
        this.onOrderConfirmed(event.payload as OrderConfirmedEvent);
        break;
      default:
        console.warn(`Unknown event type: ${event.eventType}`);
    }
  }

  private onOrderCreated(event: OrderCreatedEvent): void {
    this.customerId = event.customerId;
    this.createdAt = event.createdAt;
  }

  private onOrderItemAdded(event: OrderItemAddedEvent): void {
    this.items.push({
      productId: event.productId,
      quantity: event.quantity,
      price: event.price
    });
    this.totalAmount = this.calculateTotal();
  }

  private onOrderConfirmed(event: OrderConfirmedEvent): void {
    this.confirmedAt = event.confirmedAt;
    this.totalAmount = event.totalAmount;
  }

  private calculateTotal(): number {
    return this.items.reduce((total, item) => 
      total + (item.quantity * item.price), 0
    );
  }

  // Getters for current state
  getCustomerId(): string { return this.customerId; }
  getItems(): typeof this.items { return [...this.items]; }
  getTotalAmount(): number { return this.totalAmount; }
  getConfirmedAt(): Date | undefined { return this.confirmedAt; }
  getCreatedAt(): Date | undefined { return this.createdAt; }
  isConfirmed(): boolean { return !!this.confirmedAt; }
}

// Create aggregate with event sourcing capability
function createOrderWithEventSourcing(eventStore: IEventStore) {
  const orderId = new EntityId('order-123', 'text');
  
  const orderAggregate = AggregateBuilder
    .create({ id: orderId, version: 0 })
    .withEventSourcing(eventStore)
    .build(OrderAggregate);

  return orderAggregate;
}

// Demonstrate event sourcing lifecycle
async function demonstrateEventSourcingLifecycle() {
  const eventStore = new MockEventStore();
  
  // 1. Create new aggregate
  const order = OrderAggregate.createOrder('order-123', 'customer-456');
  
  // Add event sourcing capability
  order.addCapability(new EventSourcingCapability());
  const eventSourcingCap = order.getCapability(EventSourcingCapability);
  eventSourcingCap?.setEventStore(eventStore);

  // 2. Build up state with business operations
  order.addItem('product-1', 2, 25.00);
  order.addItem('product-2', 1, 50.00);
  order.confirmOrder();

  console.log('Original order state:', {
    id: order.getId().getValue(),
    customerId: order.getCustomerId(),
    items: order.getItems(),
    total: order.getTotalAmount(),
    confirmed: order.isConfirmed(),
    version: order.getVersion(),
    eventCount: order.getDomainEvents().length
  });

  // 3. Save to event store
  if (eventSourcingCap?.hasEventStore()) {
    await eventSourcingCap.saveToEventStore();
    order.commit(); // Clear uncommitted events
    
    console.log('Events saved to store');
  }

  // 4. Load aggregate from event store
  const loadedOrder = createOrderWithEventSourcing(eventStore);
  const loadedEventSourcingCap = loadedOrder.getCapability(EventSourcingCapability);
  
  await loadedEventSourcingCap?.loadFromEventStore('order-123');

  console.log('Loaded order state:', {
    id: loadedOrder.getId().getValue(),
    customerId: loadedOrder.getCustomerId(),
    items: loadedOrder.getItems(),
    total: loadedOrder.getTotalAmount(),
    confirmed: loadedOrder.isConfirmed(),
    version: loadedOrder.getVersion(),
    eventCount: loadedOrder.getDomainEvents().length
  });

  return { original: order, loaded: loadedOrder, eventStore };
}

// Demonstrate incremental loading
async function demonstrateIncrementalLoading() {
  const eventStore = new MockEventStore();
  
  // Create and save initial state
  const order = OrderAggregate.createOrder('order-456', 'customer-789');
  order.addCapability(new EventSourcingCapability());
  const eventSourcingCap = order.getCapability(EventSourcingCapability);
  eventSourcingCap?.setEventStore(eventStore);

  // Add some items and save
  order.addItem('product-1', 1, 20.00);
  order.addItem('product-2', 2, 15.00);
  await eventSourcingCap?.saveToEventStore();
  order.commit();

  const versionAfterFirstSave = order.getVersion();
  console.log('Version after first save:', versionAfterFirstSave);

  // Add more items
  order.addItem('product-3', 1, 30.00);
  order.confirmOrder();
  await eventSourcingCap?.saveToEventStore();
  order.commit();

  console.log('Final version:', order.getVersion());

  // Load aggregate only up to first save point
  const partialOrder = createOrderWithEventSourcing(eventStore);
  const partialEventSourcingCap = partialOrder.getCapability(EventSourcingCapability);
  
  // Load only events from a specific version
  await partialEventSourcingCap?.loadFromVersion('order-456', versionAfterFirstSave);

  console.log('Partial load - only recent events:', {
    version: partialOrder.getVersion(),
    items: partialOrder.getItems(),
    confirmed: partialOrder.isConfirmed()
  });

  return { eventStore };
}

// Error handling with event sourcing
async function handleEventSourcingErrors() {
  const eventStore = new MockEventStore();
  
  // 1. No event store configured
  try {
    const order = AggregateBuilder
      .create({ id: new EntityId('order-error', 'text') })
      .withEventSourcing() // No event store provided
      .build(OrderAggregate);

    const eventSourcingCap = order.getCapability(EventSourcingCapability);
    await eventSourcingCap?.saveToEventStore();
  } catch (error) {
    console.log('Expected error - no event store:', error.message);
  }

  // 2. Concurrency conflict
  try {
    const order1 = createOrderWithEventSourcing(eventStore);
    const order2 = createOrderWithEventSourcing(eventStore);

    // Both start from version 0
    order1.addItem('product-1', 1, 10.00);
    order2.addItem('product-2', 1, 20.00);

    // First save succeeds
    await order1.getCapability(EventSourcingCapability)?.saveToEventStore();
    
    // Second save fails due to concurrency conflict
    await order2.getCapability(EventSourcingCapability)?.saveToEventStore();
  } catch (error) {
    console.log('Expected concurrency conflict:', error.message);
  }

  // 3. Loading non-existent aggregate
  const nonExistentOrder = createOrderWithEventSourcing(eventStore);
  await nonExistentOrder.getCapability(EventSourcingCapability)
    ?.loadFromEventStore('non-existent-order');
    
  console.log('Loading non-existent aggregate - no error, but no state change');
}

// Advanced event sourcing features
async function demonstrateAdvancedFeatures() {
  const eventStore = new MockEventStore();
  const order = createOrderWithEventSourcing(eventStore);
  const eventSourcingCap = order.getCapability(EventSourcingCapability);

  // Check if event store is configured
  console.log('Has event store:', eventSourcingCap?.hasEventStore());

  // Get stream name for debugging
  console.log('Stream name:', eventSourcingCap?.getStreamName());

  // Create some data
  order.addItem('product-1', 1, 25.00);
  await eventSourcingCap?.saveToEventStore();
  order.commit();

  // Get event store reference for external operations
  const eventStoreRef = eventSourcingCap?.getEventStore();
  if (eventStoreRef instanceof MockEventStore) {
    const allStreams = await eventStoreRef.getAllStreams();
    console.log('All event streams:', allStreams);
  }

  return { eventStore };
}
```

@extract-end

## Key Features

- **Event Store Integration**: Seamless integration with event store implementations
- **State Reconstruction**: Rebuild aggregate state from event history
- **Incremental Loading**: Load only events after a specific version
- **Concurrency Control**: Optimistic locking with version checking
- **Stream Management**: Automatic stream naming and event versioning

## Common Pitfalls

- Always implement proper event handlers for state reconstruction
- Handle concurrency conflicts gracefully with retry logic
- Ensure event store is configured before using capability
- Test state reconstruction with historical event data

## Related Examples

- [AggregateRoot](./aggregate-root.md) - Basic aggregate implementation
- [SnapshotCapability](./snapshot-capability.md) - Snapshot optimization
- [VersioningCapability](./versioning-capability.md) - Event versioning
