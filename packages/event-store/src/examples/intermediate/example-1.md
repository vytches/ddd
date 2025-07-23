# Event Replay Engine

**Version**: 1.0.0
**Package**: @vytches-ddd/event-store
**Complexity**: intermediate
**Domain**: Infrastructure
**Patterns**: event-replay, recovery, historical-processing, system-restoration
**Dependencies**: @vytches-ddd/event-store, @vytches-ddd/events, @vytches-ddd/utils

## Description

Advanced event replay capabilities for system recovery, historical data processing, and rebuilding projections. This example demonstrates sophisticated replay strategies, batch processing, error handling, and progress tracking for enterprise-grade event replay systems.

## Business Context

Event replay is essential for disaster recovery, debugging production issues, rebuilding projections after schema changes, and migrating data between systems. A robust replay system allows teams to confidently recover from failures and maintain data consistency across distributed systems.

## Code Example

```typescript
// event-replay-engine.ts
import { EventReplayEngine, InMemoryEventStore, JsonEventSerializer } from '@vytches-ddd/event-store';
import { DomainEvent, EntityId } from '@vytches-ddd/events';
import { Result } from '@vytches-ddd/utils';
import { Logger } from '@vytches-ddd/logging';
import { ReplayOptions, ReplayResult, ReplayError } from './types'; // From your app

// ⭐ FOCUS: Advanced event replay with comprehensive error handling
export class AdvancedEventReplayEngine {
  private readonly eventStore: InMemoryEventStore;
  private readonly logger = Logger.forContext('EventReplayEngine');
  private readonly replayState = new Map<string, any>();

  constructor() {
    this.eventStore = new InMemoryEventStore({
      serializer: new JsonEventSerializer(),
      enableSnapshots: false
    });
  }

  async replayAllStreams(
    handler: (event: DomainEvent) => Promise<void>,
    options: ReplayOptions = {}
  ): Promise<Result<ReplayResult, Error>> {
    try {
      this.logger.info('Starting full event store replay', { options });
      
      const startTime = new Date();
      const result: ReplayResult = {
        totalEventsProcessed: 0,
        successfulEvents: 0,
        failedEvents: 0,
        startTime,
        endTime: new Date(),
        errors: []
      };

      // ⭐ FOCUS: Get all streams for replay
      const streamIds = await this.eventStore.getAllStreamIds();
      
      if (streamIds.length === 0) {
        this.logger.warn('No streams found for replay');
        result.endTime = new Date();
        return Result.ok(result);
      }

      // ⭐ FOCUS: Process streams in batches for memory efficiency
      const batchSize = options.batchSize || 10;
      
      for (let i = 0; i < streamIds.length; i += batchSize) {
        const streamBatch = streamIds.slice(i, i + batchSize);
        
        const batchResult = await this.replayStreamBatch(streamBatch, handler, options);
        
        if (batchResult.isFailure()) {
          result.errors.push({
            eventNumber: -1,
            eventType: 'BatchError',
            error: batchResult.error.message,
            timestamp: new Date()
          });
        } else {
          const batchStats = batchResult.value;
          result.totalEventsProcessed += batchStats.totalEventsProcessed;
          result.successfulEvents += batchStats.successfulEvents;
          result.failedEvents += batchStats.failedEvents;
          result.errors.push(...batchStats.errors);
        }

        // ⭐ FOCUS: Progress reporting
        this.logger.info('Replay batch completed', {
          batchNumber: Math.floor(i / batchSize) + 1,
          totalBatches: Math.ceil(streamIds.length / batchSize),
          streamsProcessed: i + streamBatch.length,
          totalStreams: streamIds.length,
          eventsProcessed: result.totalEventsProcessed
        });
      }

      result.endTime = new Date();
      
      this.logger.info('Event store replay completed', {
        duration: result.endTime.getTime() - result.startTime.getTime(),
        totalEvents: result.totalEventsProcessed,
        successRate: result.totalEventsProcessed > 0 
          ? (result.successfulEvents / result.totalEventsProcessed * 100).toFixed(2) + '%'
          : '0%'
      });

      return Result.ok(result);
    } catch (error) {
      this.logger.error('Event replay failed', { error: error.message });
      return Result.fail(new Error(`Replay failed: ${error.message}`));
    }
  }

  async replayStream(
    streamId: string,
    handler: (event: DomainEvent) => Promise<void>,
    options: ReplayOptions = {}
  ): Promise<Result<ReplayResult, Error>> {
    try {
      this.logger.info('Starting stream replay', { streamId, options });
      
      const startTime = new Date();
      const result: ReplayResult = {
        totalEventsProcessed: 0,
        successfulEvents: 0,
        failedEvents: 0,
        startTime,
        endTime: new Date(),
        errors: []
      };

      // ⭐ FOCUS: Read stream with pagination for memory efficiency
      const readOptions = {
        fromEventNumber: options.fromEventNumber || 0,
        maxCount: options.toEventNumber ? 
          (options.toEventNumber - (options.fromEventNumber || 0) + 1) : 
          undefined
      };

      const readResult = await this.eventStore.readStream(streamId, readOptions);
      
      if (readResult.isFailure()) {
        return Result.fail(readResult.error);
      }

      const events = readResult.value.events;
      
      // ⭐ FOCUS: Apply event type filtering
      const filteredEvents = options.filterEventTypes ? 
        events.filter(event => options.filterEventTypes!.includes(event.eventType)) :
        events;

      result.totalEventsProcessed = filteredEvents.length;

      // ⭐ FOCUS: Process events with error handling
      for (const [index, event] of filteredEvents.entries()) {
        try {
          await handler(event);
          result.successfulEvents++;
          
          // ⭐ FOCUS: Progress tracking for large streams
          if (index > 0 && index % 100 === 0) {
            this.logger.debug('Stream replay progress', {
              streamId,
              processed: index + 1,
              total: filteredEvents.length,
              percentage: ((index + 1) / filteredEvents.length * 100).toFixed(1) + '%'
            });
          }
        } catch (error) {
          result.failedEvents++;
          result.errors.push({
            eventNumber: index,
            eventType: event.eventType,
            error: error.message,
            timestamp: new Date()
          });

          this.logger.error('Event processing failed during replay', {
            streamId,
            eventNumber: index,
            eventType: event.eventType,
            eventId: event.eventId,
            error: error.message
          });
        }
      }

      result.endTime = new Date();
      
      this.logger.info('Stream replay completed', {
        streamId,
        duration: result.endTime.getTime() - result.startTime.getTime(),
        totalEvents: result.totalEventsProcessed,
        successful: result.successfulEvents,
        failed: result.failedEvents
      });

      return Result.ok(result);
    } catch (error) {
      this.logger.error('Stream replay failed', { streamId, error: error.message });
      return Result.fail(new Error(`Stream replay failed: ${error.message}`));
    }
  }

  private async replayStreamBatch(
    streamIds: string[],
    handler: (event: DomainEvent) => Promise<void>,
    options: ReplayOptions
  ): Promise<Result<ReplayResult, Error>> {
    const batchResult: ReplayResult = {
      totalEventsProcessed: 0,
      successfulEvents: 0,
      failedEvents: 0,
      startTime: new Date(),
      endTime: new Date(),
      errors: []
    };

    try {
      // ⭐ FOCUS: Process streams in parallel for better performance
      const streamPromises = streamIds.map(async (streamId) => {
        try {
          const streamResult = await this.replayStream(streamId, handler, options);
          return streamResult;
        } catch (error) {
          return Result.fail(new Error(`Stream ${streamId} replay failed: ${error.message}`));
        }
      });

      const streamResults = await Promise.allSettled(streamPromises);
      
      // ⭐ FOCUS: Aggregate batch results
      for (const result of streamResults) {
        if (result.status === 'fulfilled' && result.value.isSuccess()) {
          const streamStats = result.value.value;
          batchResult.totalEventsProcessed += streamStats.totalEventsProcessed;
          batchResult.successfulEvents += streamStats.successfulEvents;
          batchResult.failedEvents += streamStats.failedEvents;
          batchResult.errors.push(...streamStats.errors);
        } else {
          const error = result.status === 'rejected' ? 
            result.reason : 
            (result.value as any).error;
          
          batchResult.errors.push({
            eventNumber: -1,
            eventType: 'StreamBatchError',
            error: error.message,
            timestamp: new Date()
          });
        }
      }

      batchResult.endTime = new Date();
      return Result.ok(batchResult);
    } catch (error) {
      return Result.fail(new Error(`Batch replay failed: ${error.message}`));
    }
  }

  async replayToProjection<T>(
    projectionBuilder: ProjectionBuilder<T>,
    streamId?: string,
    options: ReplayOptions = {}
  ): Promise<Result<T, Error>> {
    try {
      this.logger.info('Starting projection replay', { streamId, projectionType: projectionBuilder.name });
      
      let projection = projectionBuilder.createInitialState();
      
      const handler = async (event: DomainEvent): Promise<void> => {
        if (projectionBuilder.canHandle(event)) {
          projection = await projectionBuilder.apply(projection, event);
        }
      };

      // ⭐ FOCUS: Replay specific stream or all streams
      const replayResult = streamId ? 
        await this.replayStream(streamId, handler, options) :
        await this.replayAllStreams(handler, options);

      if (replayResult.isFailure()) {
        return Result.fail(replayResult.error);
      }

      const stats = replayResult.value;
      
      this.logger.info('Projection rebuilt successfully', {
        projectionType: projectionBuilder.name,
        eventsProcessed: stats.totalEventsProcessed,
        successful: stats.successfulEvents,
        failed: stats.failedEvents,
        duration: stats.endTime.getTime() - stats.startTime.getTime()
      });

      return Result.ok(projection);
    } catch (error) {
      this.logger.error('Projection replay failed', { 
        projectionType: projectionBuilder.name, 
        error: error.message 
      });
      return Result.fail(new Error(`Projection replay failed: ${error.message}`));
    }
  }

  async replayWithCheckpoints(
    handler: (event: DomainEvent) => Promise<void>,
    checkpointHandler: (checkpoint: ReplayCheckpoint) => Promise<void>,
    options: ReplayOptions & { checkpointInterval?: number } = {}
  ): Promise<Result<ReplayResult, Error>> {
    try {
      const checkpointInterval = options.checkpointInterval || 1000;
      let eventCount = 0;
      
      const wrappedHandler = async (event: DomainEvent): Promise<void> => {
        await handler(event);
        eventCount++;
        
        // ⭐ FOCUS: Create checkpoint at intervals
        if (eventCount % checkpointInterval === 0) {
          const checkpoint: ReplayCheckpoint = {
            position: eventCount,
            timestamp: new Date(),
            lastEventId: event.eventId,
            lastEventType: event.eventType
          };
          
          await checkpointHandler(checkpoint);
          
          this.logger.debug('Replay checkpoint created', {
            position: checkpoint.position,
            lastEventType: checkpoint.lastEventType
          });
        }
      };

      return await this.replayAllStreams(wrappedHandler, options);
    } catch (error) {
      return Result.fail(new Error(`Checkpoint replay failed: ${error.message}`));
    }
  }

  // ⭐ FOCUS: Add test data for demonstration
  async seedTestData(): Promise<void> {
    const testEvents = [
      new OrderCreatedEvent(EntityId.createUuid(), 'customer-1', 100, 'USD'),
      new OrderStatusChangedEvent(EntityId.createUuid(), 'draft', 'confirmed'),
      new PaymentProcessedEvent(EntityId.createUuid(), 'payment-1', 100, 'successful'),
      new ProductCreatedEvent(EntityId.createUuid(), 'Product A', 'Electronics', 299.99),
      new InventoryAdjustedEvent(EntityId.createUuid(), 50, 50, 'Initial stock')
    ];

    // Create multiple streams for testing
    for (let i = 0; i < 5; i++) {
      const streamId = `test-stream-${i + 1}`;
      const streamEvents = testEvents.map(event => {
        const newEvent = { ...event };
        newEvent.eventId = EntityId.createUuid().value;
        return newEvent as DomainEvent;
      });
      
      await this.eventStore.appendEvents(streamId, streamEvents);
    }

    this.logger.info('Test data seeded successfully', { 
      streams: 5, 
      eventsPerStream: testEvents.length 
    });
  }
}

// ⭐ FOCUS: Projection builder interface for replay
export interface ProjectionBuilder<T> {
  name: string;
  createInitialState(): T;
  canHandle(event: DomainEvent): boolean;
  apply(currentState: T, event: DomainEvent): Promise<T>;
}

// ⭐ FOCUS: Sample projection for order summary
export class OrderSummaryProjectionBuilder implements ProjectionBuilder<OrderSummary> {
  name = 'OrderSummaryProjection';

  createInitialState(): OrderSummary {
    return {
      totalOrders: 0,
      totalRevenue: 0,
      averageOrderValue: 0,
      ordersByStatus: {},
      currency: 'USD',
      lastUpdated: new Date()
    };
  }

  canHandle(event: DomainEvent): boolean {
    return ['OrderCreated', 'OrderStatusChanged', 'PaymentProcessed'].includes(event.eventType);
  }

  async apply(currentState: OrderSummary, event: DomainEvent): Promise<OrderSummary> {
    const newState = { ...currentState };

    switch (event.eventType) {
      case 'OrderCreated':
        const createdEvent = event as OrderCreatedEvent;
        newState.totalOrders++;
        newState.totalRevenue += createdEvent.totalAmount;
        newState.averageOrderValue = newState.totalRevenue / newState.totalOrders;
        break;

      case 'OrderStatusChanged':
        const statusEvent = event as OrderStatusChangedEvent;
        newState.ordersByStatus[statusEvent.newStatus] = 
          (newState.ordersByStatus[statusEvent.newStatus] || 0) + 1;
        break;

      case 'PaymentProcessed':
        // Additional payment processing logic
        break;
    }

    newState.lastUpdated = event.timestamp;
    return newState;
  }
}

// ⭐ FOCUS: Supporting types
interface OrderSummary {
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  ordersByStatus: Record<string, number>;
  currency: string;
  lastUpdated: Date;
}

interface ReplayCheckpoint {
  position: number;
  timestamp: Date;
  lastEventId: string;
  lastEventType: string;
}

// ⭐ FOCUS: Sample domain events
export class OrderCreatedEvent extends DomainEvent {
  constructor(
    aggregateId: EntityId,
    public readonly customerId: string,
    public readonly totalAmount: number,
    public readonly currency: string
  ) {
    super(aggregateId, 'OrderCreated', 1);
  }
}

export class OrderStatusChangedEvent extends DomainEvent {
  constructor(
    aggregateId: EntityId,
    public readonly previousStatus: string,
    public readonly newStatus: string
  ) {
    super(aggregateId, 'OrderStatusChanged', 1);
  }
}

export class PaymentProcessedEvent extends DomainEvent {
  constructor(
    aggregateId: EntityId,
    public readonly paymentId: string,
    public readonly amount: number,
    public readonly status: string
  ) {
    super(aggregateId, 'PaymentProcessed', 1);
  }
}

export class ProductCreatedEvent extends DomainEvent {
  constructor(
    aggregateId: EntityId,
    public readonly name: string,
    public readonly category: string,
    public readonly price: number
  ) {
    super(aggregateId, 'ProductCreated', 1);
  }
}

export class InventoryAdjustedEvent extends DomainEvent {
  constructor(
    aggregateId: EntityId,
    public readonly adjustment: number,
    public readonly newQuantity: number,
    public readonly reason: string
  ) {
    super(aggregateId, 'InventoryAdjusted', 1);
  }
}
```

## Usage Examples

```typescript
// Complete event replay demonstration
import { 
  AdvancedEventReplayEngine, 
  OrderSummaryProjectionBuilder 
} from './event-replay-engine';

async function demonstrateEventReplay() {
  const replayEngine = new AdvancedEventReplayEngine();
  
  // ⭐ FOCUS: Seed test data
  await replayEngine.seedTestData();
  
  console.log('--- Event Replay Engine Demo ---\n');

  // ⭐ FOCUS: 1. Simple event handler for logging
  console.log('1. Basic Event Replay:');
  const logHandler = async (event: DomainEvent): Promise<void> => {
    console.log(`  Processing: ${event.eventType} at ${event.timestamp.toISOString()}`);
  };

  const basicReplay = await replayEngine.replayAllStreams(logHandler, {
    batchSize: 2,
    filterEventTypes: ['OrderCreated', 'ProductCreated']
  });

  if (basicReplay.isSuccess()) {
    const result = basicReplay.value;
    console.log(`  Processed ${result.successfulEvents} events successfully`);
    console.log(`  Duration: ${result.endTime.getTime() - result.startTime.getTime()}ms`);
  }

  // ⭐ FOCUS: 2. Replay specific stream
  console.log('\n2. Single Stream Replay:');
  const streamReplay = await replayEngine.replayStream(
    'test-stream-1',
    logHandler,
    { fromEventNumber: 1, toEventNumber: 3 }
  );

  if (streamReplay.isSuccess()) {
    const result = streamReplay.value;
    console.log(`  Stream replay: ${result.successfulEvents} events processed`);
  }

  // ⭐ FOCUS: 3. Build projection from events
  console.log('\n3. Projection Rebuild:');
  const projectionBuilder = new OrderSummaryProjectionBuilder();
  
  const projectionResult = await replayEngine.replayToProjection(projectionBuilder);

  if (projectionResult.isSuccess()) {
    const summary = projectionResult.value;
    console.log('  Order Summary Projection:');
    console.log(`    Total Orders: ${summary.totalOrders}`);
    console.log(`    Total Revenue: $${summary.totalRevenue}`);
    console.log(`    Average Order Value: $${summary.averageOrderValue.toFixed(2)}`);
    console.log(`    Last Updated: ${summary.lastUpdated.toISOString()}`);
  }

  // ⭐ FOCUS: 4. Replay with checkpoints
  console.log('\n4. Checkpoint-based Replay:');
  let checkpointCount = 0;
  
  const checkpointHandler = async (checkpoint: any): Promise<void> => {
    checkpointCount++;
    console.log(`  Checkpoint ${checkpointCount}: Position ${checkpoint.position}, Last event: ${checkpoint.lastEventType}`);
  };

  const eventCounter = { count: 0 };
  const countingHandler = async (event: DomainEvent): Promise<void> => {
    eventCounter.count++;
  };

  const checkpointReplay = await replayEngine.replayWithCheckpoints(
    countingHandler,
    checkpointHandler,
    { checkpointInterval: 5 }
  );

  if (checkpointReplay.isSuccess()) {
    const result = checkpointReplay.value;
    console.log(`  Checkpoint replay: ${result.successfulEvents} events, ${checkpointCount} checkpoints`);
  }

  // ⭐ FOCUS: 5. Error handling demonstration
  console.log('\n5. Error Handling:');
  const faultyHandler = async (event: DomainEvent): Promise<void> => {
    if (event.eventType === 'OrderCreated') {
      throw new Error('Simulated processing error');
    }
    console.log(`  Successfully processed: ${event.eventType}`);
  };

  const errorReplay = await replayEngine.replayAllStreams(faultyHandler);

  if (errorReplay.isSuccess()) {
    const result = errorReplay.value;
    console.log(`  Error replay: ${result.successfulEvents} successful, ${result.failedEvents} failed`);
    
    if (result.errors.length > 0) {
      console.log('  Errors encountered:');
      result.errors.slice(0, 3).forEach(error => {
        console.log(`    ${error.eventType}: ${error.error}`);
      });
    }
  }
}

// Run the demonstration
demonstrateEventReplay().catch(console.error);
```

## Key Features

- **Full Store Replay**: Replay all events across all streams with batch processing
- **Stream-Specific Replay**: Target individual streams for focused reconstruction
- **Projection Rebuilding**: Reconstruct read models and projections from events
- **Checkpoint System**: Progress tracking with resumable replay capabilities
- **Error Handling**: Comprehensive error tracking and recovery strategies
- **Filtering Options**: Process only relevant events based on type and criteria
- **Performance Optimization**: Batch processing and memory-efficient streaming

## Replay Benefits

1. **Disaster Recovery**: Reconstruct system state after data loss or corruption
2. **Debugging**: Replay production issues in development environment
3. **Migration**: Move data between systems while preserving complete history
4. **Projection Updates**: Rebuild read models after schema or logic changes
5. **Analytics**: Process historical data for business intelligence insights
6. **Testing**: Create realistic test scenarios from production event streams

## Common Replay Scenarios

- **System Migration**: Moving from one event store to another
- **Bug Investigation**: Replaying events to reproduce production issues
- **Projection Updates**: Rebuilding read models after business logic changes
- **Data Recovery**: Restoring system state after hardware failures
- **Performance Testing**: Using production event patterns for load testing
- **Compliance Auditing**: Reconstructing system state for regulatory reviews

## Performance Considerations

- **Memory Usage**: Process events in batches to avoid memory exhaustion
- **Progress Tracking**: Implement checkpoints for long-running replay operations
- **Error Recovery**: Plan for partial failures and resumption strategies
- **Parallelization**: Process independent streams concurrently when possible
- **Resource Management**: Monitor CPU, memory, and I/O during replay operations

## Common Pitfalls

- **Memory Leaks**: Large event volumes can exhaust available memory
- **Handler Errors**: Unhandled exceptions can stop entire replay process
- **Version Compatibility**: Event schema changes may break replay handlers
- **Performance Impact**: Replay operations can impact production system performance
- **Checkpoint Frequency**: Balance between progress tracking and performance overhead

## Related Examples

- [Stream-Based Projections](./example-2.md)
- [Event Versioning and Migration](./example-3.md)
- [In-Memory Event Store](../basic/example-1.md)