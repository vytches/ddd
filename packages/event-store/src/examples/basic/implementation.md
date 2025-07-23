# Basic Event Store Implementation Guide

**Version**: 1.0.0
**Package**: @vytches-ddd/event-store
**Complexity**: basic
**Domain**: Infrastructure
**Patterns**: implementation-guide, setup-patterns, best-practices

## Overview

This guide provides a comprehensive overview of implementing event storage systems using @vytches-ddd/event-store. It covers fundamental concepts, setup patterns, and best practices for getting started with event-driven architectures.

## Core Concepts

### Event Storage Fundamentals

```typescript
// Event store serves as the single source of truth for domain events
const eventStore = new InMemoryEventStore({
  serializer: new JsonEventSerializer(),
  enableSnapshots: false
});

// Events are organized into streams (typically one per aggregate)
const streamId = `order-${orderId}`;
await eventStore.appendEvents(streamId, events, expectedVersion);
```

### Stream-Based Organization

Event stores organize events into **streams**, which typically correspond to individual aggregates in Domain-Driven Design:

- **Stream**: A sequence of related events for a specific aggregate
- **Event Number**: Position of event within the stream (0-based)
- **Expected Version**: Optimistic concurrency control mechanism
- **Global Position**: Unique position across all streams

## Basic Setup Patterns

### 1. Simple Event Store Service

```typescript
// basic-event-store.service.ts
import { InMemoryEventStore, JsonEventSerializer } from '@vytches-ddd/event-store';
import { DomainEvent } from '@vytches-ddd/events';
import { Result } from '@vytches-ddd/utils';

export class BasicEventStoreService {
  private readonly eventStore: InMemoryEventStore;

  constructor() {
    this.eventStore = new InMemoryEventStore({
      serializer: new JsonEventSerializer(),
      enableSnapshots: false
    });
  }

  // ⭐ FOCUS: Core append operation
  async appendEvents(
    streamId: string, 
    events: DomainEvent[], 
    expectedVersion: number = -1
  ): Promise<Result<void, Error>> {
    try {
      const result = await this.eventStore.appendEvents(streamId, events, expectedVersion);
      return result;
    } catch (error) {
      return Result.fail(new Error(`Append failed: ${error.message}`));
    }
  }

  // ⭐ FOCUS: Core read operation
  async readEvents(streamId: string): Promise<Result<DomainEvent[], Error>> {
    try {
      const result = await this.eventStore.readStream(streamId);
      
      if (result.isFailure()) {
        return Result.fail(result.error);
      }

      return Result.ok(result.value.events);
    } catch (error) {
      return Result.fail(new Error(`Read failed: ${error.message}`));
    }
  }
}
```

### 2. Repository Integration Pattern

```typescript
// event-sourced-repository.ts
import { BasicEventStoreService } from './basic-event-store.service';
import { AggregateRoot } from '@vytches-ddd/aggregates';
import { Result } from '@vytches-ddd/utils';

export abstract class EventSourcedRepository<T extends AggregateRoot> {
  constructor(protected readonly eventStore: BasicEventStoreService) {}

  async save(aggregate: T): Promise<Result<void, Error>> {
    try {
      const streamId = this.getStreamId(aggregate);
      const events = aggregate.getUncommittedEvents();
      
      if (events.length === 0) {
        return Result.ok(); // No changes to save
      }

      // ⭐ FOCUS: Use aggregate version for concurrency control
      const expectedVersion = aggregate.version - events.length;
      
      const appendResult = await this.eventStore.appendEvents(
        streamId, 
        events, 
        expectedVersion
      );

      if (appendResult.isSuccess()) {
        aggregate.markEventsAsCommitted();
      }

      return appendResult;
    } catch (error) {
      return Result.fail(new Error(`Save failed: ${error.message}`));
    }
  }

  async findById(id: string): Promise<Result<T | null, Error>> {
    try {
      const streamId = this.getStreamIdById(id);
      const eventsResult = await this.eventStore.readEvents(streamId);
      
      if (eventsResult.isFailure()) {
        return Result.fail(eventsResult.error);
      }

      const events = eventsResult.value;
      
      if (events.length === 0) {
        return Result.ok(null);
      }

      // ⭐ FOCUS: Reconstruct aggregate from events
      const aggregate = this.createEmptyAggregate();
      
      for (const event of events) {
        aggregate.applyEvent(event);
      }
      
      aggregate.markEventsAsCommitted();
      
      return Result.ok(aggregate);
    } catch (error) {
      return Result.fail(new Error(`Find failed: ${error.message}`));
    }
  }

  protected abstract getStreamId(aggregate: T): string;
  protected abstract getStreamIdById(id: string): string;
  protected abstract createEmptyAggregate(): T;
}
```

### 3. Application Service Integration

```typescript
// order.service.ts
import { EventSourcedRepository } from './event-sourced-repository';
import { OrderAggregate } from './order.aggregate';
import { CreateOrderCommand } from './commands';
import { Result } from '@vytches-ddd/utils';

export class OrderRepository extends EventSourcedRepository<OrderAggregate> {
  protected getStreamId(aggregate: OrderAggregate): string {
    return `order-${aggregate.id.value}`;
  }

  protected getStreamIdById(id: string): string {
    return `order-${id}`;
  }

  protected createEmptyAggregate(): OrderAggregate {
    return new OrderAggregate();
  }
}

export class OrderService {
  constructor(private readonly orderRepository: OrderRepository) {}

  async createOrder(command: CreateOrderCommand): Promise<Result<OrderAggregate, Error>> {
    try {
      // ⭐ FOCUS: Business logic creates domain events
      const order = OrderAggregate.create(command);
      
      // ⭐ FOCUS: Repository handles event storage
      const saveResult = await this.orderRepository.save(order);
      
      if (saveResult.isFailure()) {
        return Result.fail(saveResult.error);
      }

      return Result.ok(order);
    } catch (error) {
      return Result.fail(new Error(`Order creation failed: ${error.message}`));
    }
  }

  async getOrder(orderId: string): Promise<Result<OrderAggregate | null, Error>> {
    return await this.orderRepository.findById(orderId);
  }
}
```

## Configuration Options

### Event Store Configuration

```typescript
interface EventStoreConfig {
  // Serialization strategy
  serializer: IEventSerializer;
  
  // Snapshot configuration
  enableSnapshots: boolean;
  snapshotFrequency?: number;
  
  // Performance tuning
  batchSize?: number;
  maxRetries?: number;
  retryDelayMs?: number;
}

// Example configurations
const developmentConfig: EventStoreConfig = {
  serializer: new JsonEventSerializer(),
  enableSnapshots: false,
  batchSize: 100
};

const productionConfig: EventStoreConfig = {
  serializer: new CompressedJsonSerializer(),
  enableSnapshots: true,
  snapshotFrequency: 50,
  batchSize: 500,
  maxRetries: 3,
  retryDelayMs: 1000
};
```

### Serialization Strategy Selection

```typescript
// Choose serializer based on requirements
const serializers = {
  // Development: Human readable
  development: new JsonEventSerializer(),
  
  // Production: Space efficient
  production: new CompressedJsonSerializer(),
  
  // Enterprise: Version safe
  enterprise: new VersionedJsonSerializer(),
  
  // High-performance: Custom binary
  highPerformance: new BinaryEventSerializer()
};
```

## Error Handling Patterns

### Comprehensive Error Handling

```typescript
export class RobustEventStoreService {
  async appendEventsWithRetry(
    streamId: string, 
    events: DomainEvent[], 
    expectedVersion: number,
    maxRetries: number = 3
  ): Promise<Result<void, Error>> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.eventStore.appendEvents(streamId, events, expectedVersion);
        
        if (result.isSuccess()) {
          return result;
        }
        
        lastError = result.error;
        
        // ⭐ FOCUS: Handle specific error types
        if (result.error.name === 'ConcurrencyError') {
          // Don't retry concurrency errors
          break;
        }
        
        // ⭐ FOCUS: Exponential backoff
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000;
          await this.sleep(delay);
        }
        
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000;
          await this.sleep(delay);
        }
      }
    }
    
    return Result.fail(new Error(`Failed after ${maxRetries} attempts: ${lastError.message}`));
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

## Testing Patterns

### Unit Testing Event Stores

```typescript
// event-store.test.ts
describe('EventStoreService', () => {
  let eventStore: BasicEventStoreService;
  let testEvents: DomainEvent[];

  beforeEach(() => {
    eventStore = new BasicEventStoreService();
    testEvents = [
      new OrderCreatedEvent(EntityId.createUuid(), 'customer-1', 100, 'USD'),
      new OrderStatusChangedEvent(EntityId.createUuid(), 'pending', 'confirmed')
    ];
  });

  it('should append and read events successfully', async () => {
    const streamId = 'test-stream-1';
    
    // ⭐ FOCUS: Test append operation
    const appendResult = await eventStore.appendEvents(streamId, testEvents);
    expect(appendResult.isSuccess()).toBe(true);
    
    // ⭐ FOCUS: Test read operation
    const readResult = await eventStore.readEvents(streamId);
    expect(readResult.isSuccess()).toBe(true);
    
    const events = readResult.value;
    expect(events).toHaveLength(2);
    expect(events[0].eventType).toBe('OrderCreated');
    expect(events[1].eventType).toBe('OrderStatusChanged');
  });

  it('should handle concurrency conflicts', async () => {
    const streamId = 'test-stream-2';
    
    // ⭐ FOCUS: First append
    const firstAppend = await eventStore.appendEvents(streamId, [testEvents[0]], -1);
    expect(firstAppend.isSuccess()).toBe(true);
    
    // ⭐ FOCUS: Concurrent append with wrong expected version
    const secondAppend = await eventStore.appendEvents(streamId, [testEvents[1]], -1);
    expect(secondAppend.isFailure()).toBe(true);
  });
});
```

## Performance Optimization

### Batch Operations

```typescript
export class OptimizedEventStoreService extends BasicEventStoreService {
  async appendEventsBatch(
    operations: Array<{ streamId: string; events: DomainEvent[]; expectedVersion: number }>
  ): Promise<Result<void, Error>> {
    try {
      // ⭐ FOCUS: Process operations in parallel where possible
      const results = await Promise.allSettled(
        operations.map(op => 
          this.appendEvents(op.streamId, op.events, op.expectedVersion)
        )
      );
      
      const failures = results.filter(r => r.status === 'rejected');
      
      if (failures.length > 0) {
        const errorMessages = failures.map(f => (f as PromiseRejectedResult).reason.message);
        return Result.fail(new Error(`Batch append failed: ${errorMessages.join(', ')}`));
      }
      
      return Result.ok();
    } catch (error) {
      return Result.fail(new Error(`Batch operation failed: ${error.message}`));
    }
  }
}
```

## Best Practices

### 1. Stream Naming Conventions

```typescript
// ✅ GOOD: Clear, consistent naming
const streamId = `order-${orderId}`;
const userStreamId = `user-${userId}`;
const paymentStreamId = `payment-${paymentId}`;

// ❌ AVOID: Generic or unclear names
const streamId = `stream-${id}`;
const dataStreamId = `data-${someId}`;
```

### 2. Event Versioning Strategy

```typescript
// ✅ GOOD: Plan for event evolution
export class OrderCreatedEvent extends DomainEvent {
  public readonly version = 2; // Track event schema version
  
  constructor(
    aggregateId: EntityId,
    public readonly customerId: string,
    public readonly items: OrderItem[], // Added in v2
    public readonly totalAmount: number
  ) {
    super(aggregateId, 'OrderCreated', 2);
  }
}
```

### 3. Error Recovery Patterns

```typescript
// ✅ GOOD: Implement comprehensive error recovery
export class ResilienceEventStoreService {
  async safeAppendEvents(
    streamId: string, 
    events: DomainEvent[]
  ): Promise<Result<void, Error>> {
    try {
      // 1. Check stream exists
      const exists = await this.streamExists(streamId);
      
      if (!exists && events.length === 0) {
        return Result.ok(); // Nothing to do
      }
      
      // 2. Get current version
      const currentVersion = await this.getCurrentVersion(streamId);
      
      // 3. Append with proper version
      return await this.appendEvents(streamId, events, currentVersion);
      
    } catch (error) {
      // 4. Comprehensive error handling
      return this.handleAppendError(error, streamId, events);
    }
  }
}
```

### 4. Monitoring and Observability

```typescript
// ✅ GOOD: Add comprehensive monitoring
export class MonitoredEventStoreService extends BasicEventStoreService {
  async appendEvents(
    streamId: string, 
    events: DomainEvent[], 
    expectedVersion: number
  ): Promise<Result<void, Error>> {
    const startTime = performance.now();
    
    try {
      const result = await super.appendEvents(streamId, events, expectedVersion);
      
      // ⭐ FOCUS: Success metrics
      const duration = performance.now() - startTime;
      this.recordMetrics('append_success', {
        streamId,
        eventCount: events.length,
        duration
      });
      
      return result;
    } catch (error) {
      // ⭐ FOCUS: Error metrics
      const duration = performance.now() - startTime;
      this.recordMetrics('append_error', {
        streamId,
        eventCount: events.length,
        duration,
        error: error.message
      });
      
      throw error;
    }
  }

  private recordMetrics(operation: string, data: any): void {
    // Integrate with your metrics system
    console.log(`Metric: ${operation}`, data);
  }
}
```

## Common Pitfalls and Solutions

### 1. Concurrency Issues

**Problem**: Multiple processes trying to append to the same stream
**Solution**: Always use expected version for optimistic concurrency control

### 2. Memory Usage

**Problem**: Loading large event streams into memory
**Solution**: Use pagination and stream processing patterns

### 3. Event Schema Changes

**Problem**: Breaking changes in event structure over time
**Solution**: Plan versioning strategy from the beginning

### 4. Error Handling

**Problem**: Silent failures or incomplete error information
**Solution**: Comprehensive Result pattern usage and monitoring

### 5. Testing Complexity

**Problem**: Difficulty testing event-driven flows
**Solution**: Focus on behavior verification rather than implementation details

This implementation guide provides the foundation for building robust event storage systems. Start with these basic patterns and gradually add complexity as your requirements evolve.