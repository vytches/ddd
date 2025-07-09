# @vytches-ddd/event-store

Enterprise-grade Event Store implementation for Domain-Driven Design applications with full Event Sourcing support.

## Features

- 🚀 **Stream-based Storage** - Organize events by aggregate streams
- 🔒 **Optimistic Concurrency Control** - Version-based conflict detection
- 📸 **Snapshot Support** - Performance optimization for large aggregates
- 🌍 **Global Event Log** - Read all events across streams
- 🔄 **Event Replay** - Foundation for projection rebuilding
- 🏭 **Multiple Storage Adapters** - In-memory, file system, and database backends
- 📊 **Rich Metadata** - Correlation, causation, and custom metadata support
- 🧪 **Testing Ready** - In-memory implementation for tests

## Installation

```bash
npm install @vytches-ddd/event-store
```

## Quick Start

```typescript
import { InMemoryEventStore } from '@vytches-ddd/event-store';
import type { IExtendedDomainEvent } from '@vytches-ddd/contracts';

// Create event store
const eventStore = new InMemoryEventStore({
  enableSnapshots: true,
  snapshotFrequency: 100,
  enableOptimisticConcurrency: true,
});

// Append events to stream
const events: IExtendedDomainEvent[] = [
  {
    eventId: '123',
    eventType: 'OrderCreated',
    aggregateId: 'order-1',
    aggregateType: 'Order',
    aggregateVersion: 1,
    timestamp: new Date(),
    payload: { customerId: 'cust-1', total: 100 },
    metadata: { userId: 'user-1' },
  },
];

const result = await eventStore.appendToStream('order-1', events);

// Read events from stream
const stream = await eventStore.readStream('order-1');
console.log(stream.events); // All events for order-1

// Read all events globally
const allEvents = await eventStore.readAll({
  filterByEventType: ['OrderCreated'],
  maxCount: 100,
});
```

## Core Concepts

### Event Streams

Events are organized into streams, typically one stream per aggregate:

```typescript
// Append with optimistic concurrency control
await eventStore.appendToStream(
  'order-123', 
  events, 
  expectedVersion // Current version of the stream
);

// Read stream with options
const stream = await eventStore.readStream('order-123', {
  fromVersion: 5,
  maxCount: 50,
  direction: 'forward',
});
```

### Snapshots

Optimize performance for aggregates with many events:

```typescript
// Save snapshot
const snapshot = {
  aggregateId: 'order-123',
  aggregateType: 'Order',
  version: 100,
  timestamp: new Date(),
  data: orderState,
};

await eventStore.saveSnapshot('order-123', snapshot);

// Get latest snapshot
const latestSnapshot = await eventStore.getSnapshot('order-123');
```

### Global Event Log

Read events across all streams:

```typescript
// Read all events with filters
const globalEvents = await eventStore.readAll({
  fromPosition: 1000n,
  filterByEventType: ['OrderCreated', 'OrderShipped'],
  filterByStreamPrefix: 'order-',
  direction: 'backward',
  maxCount: 100,
});
```

## Advanced Usage

### Custom Serialization

```typescript
import { JsonEventSerializer } from '@vytches-ddd/event-store';

const eventStore = new InMemoryEventStore({
  serializer: new JsonEventSerializer(true), // Pretty print
});
```

### Stream Management

```typescript
// Check if stream exists
const exists = await eventStore.streamExists('order-123');

// Get stream version
const version = await eventStore.getStreamVersion('order-123');

// Delete stream (soft delete)
await eventStore.deleteStream('order-123', expectedVersion);

// Get/Set stream metadata
const metadata = await eventStore.getStreamMetadata('order-123');
await eventStore.setStreamMetadata('order-123', {
  customMetadata: { archived: true },
});
```

### Error Handling

```typescript
import { 
  EventStoreConcurrencyError, 
  StreamNotFoundError 
} from '@vytches-ddd/event-store';

try {
  await eventStore.appendToStream('order-123', events, 5);
} catch (error) {
  if (error instanceof EventStoreConcurrencyError) {
    console.error('Version conflict:', error.expectedVersion, error.actualVersion);
  } else if (error instanceof StreamNotFoundError) {
    console.error('Stream not found:', error.streamId);
  }
}
```

## Storage Adapters

### In-Memory (Development/Testing)

```typescript
const eventStore = new InMemoryEventStore();
await eventStore.connect();

// Clear all data
await eventStore.clear();
```

### File System (Coming Soon)

```typescript
// const eventStore = new FileSystemEventStore({
//   directory: './data/events',
//   format: 'jsonl',
// });
```

### PostgreSQL (Coming Soon)

```typescript
// const eventStore = new PostgreSQLEventStore({
//   connectionString: 'postgresql://...',
//   schema: 'event_store',
// });
```

## Integration with DDD Patterns

### Repository Integration

```typescript
import { BaseRepository } from '@vytches-ddd/repositories';
import { IAdvancedEventStore } from '@vytches-ddd/event-store';

class OrderRepository extends BaseRepository<Order> {
  constructor(
    private eventStore: IAdvancedEventStore,
    eventDispatcher: IEventDispatcher
  ) {
    super(eventDispatcher);
  }

  async save(order: Order): Promise<void> {
    // Persist events to event store
    await this.eventStore.appendToStream(
      order.id,
      order.getUncommittedEvents(),
      order.version
    );

    // Dispatch events
    await super.save(order);
  }

  async findById(id: string): Promise<Order | null> {
    // Try to load from snapshot
    const snapshot = await this.eventStore.getSnapshot<OrderState>(id);
    
    // Load events after snapshot
    const fromVersion = snapshot ? snapshot.version + 1 : 0;
    const stream = await this.eventStore.readStream(id, { fromVersion });

    if (!snapshot && stream.events.length === 0) {
      return null;
    }

    // Reconstruct aggregate from snapshot + events
    const order = snapshot 
      ? Order.fromSnapshot(snapshot)
      : new Order(id);

    order.loadFromHistory(stream.events);
    return order;
  }
}
```

### Event Sourcing Aggregate

```typescript
import { AggregateRoot } from '@vytches-ddd/core';

class Order extends AggregateRoot {
  loadFromHistory(events: IStoredEvent[]): void {
    events.forEach(event => {
      this.applyEvent(event, false); // Don't add to uncommitted
    });
  }

  static fromSnapshot(snapshot: IAggregateSnapshot<OrderState>): Order {
    const order = new Order(snapshot.aggregateId);
    order.restoreFromSnapshot(snapshot.data);
    order.version = snapshot.version;
    return order;
  }

  toSnapshot(): OrderState {
    return {
      id: this.id,
      customerId: this.customerId,
      items: this.items,
      status: this.status,
      total: this.total,
    };
  }
}
```

## Best Practices

1. **One Stream Per Aggregate** - Keep events for each aggregate in its own stream
2. **Use Snapshots Wisely** - Balance between performance and storage
3. **Version Everything** - Always use optimistic concurrency control in production
4. **Event Immutability** - Never modify events after they're stored
5. **Metadata Standards** - Establish consistent metadata patterns across your domain

## API Reference

See the [API documentation](https://vytches-ddd.dev/api/event-store) for detailed interface definitions.

## License

MIT