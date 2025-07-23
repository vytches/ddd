# Advanced Event Architecture

**Version**: 1.0.0 **Package**: @vytches-ddd/contracts **Complexity**:
Intermediate **Domain**: Foundation **Patterns**: event-persistence,
event-replay, event-store-interfaces **Dependencies**: @vytches-ddd/contracts

## Description

Advanced event architecture interfaces provide the foundation for sophisticated
event-driven systems including event persistence, replay capabilities, store
patterns, and advanced event bus implementations. These interfaces enable event
sourcing, CQRS, and complex event processing scenarios.

## Business Context

Enterprise applications require persistent event storage, event replay for
debugging and auditing, advanced querying capabilities, and robust event
processing pipelines. These interfaces provide the contracts needed to build
scalable, auditable, and recoverable event-driven systems.

## Event Persistence Interfaces

### Event Store Foundation

```typescript
// src/infrastructure/events/event-store-interfaces.ts
import {
  IEventStore,
  IEventStream,
  IEventStoreQuery,
  EventStoreOptions,
  StoredEvent,
  StreamMetadata,
} from '@vytches-ddd/contracts';

// Core event store implementation
export class AdvancedEventStore implements IEventStore {
  constructor(
    private readonly storage: IEventStorage,
    private readonly serializer: IEventSerializer,
    private readonly options: EventStoreOptions = {}
  ) {}

  // Append events to stream
  async appendToStream(
    streamId: string,
    events: IDomainEvent[],
    expectedVersion?: number
  ): Promise<void> {
    const stream = await this.getOrCreateStream(streamId);

    // Optimistic concurrency control
    if (expectedVersion !== undefined && stream.version !== expectedVersion) {
      throw new ConcurrencyError(
        `Stream ${streamId} version mismatch. Expected: ${expectedVersion}, Actual: ${stream.version}`
      );
    }

    // Serialize events
    const storedEvents: StoredEvent[] = [];
    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      const storedEvent: StoredEvent = {
        eventId: this.generateEventId(),
        streamId,
        eventType: event.eventType,
        eventVersion: event.eventVersion || '1.0.0',
        data: await this.serializer.serialize(event),
        metadata: {
          ...event.metadata,
          position: stream.version + i + 1,
          timestamp: event.occurredAt,
          checksum: await this.calculateChecksum(event),
        },
        timestamp: event.occurredAt,
      };
      storedEvents.push(storedEvent);
    }

    // Store events atomically
    await this.storage.appendEvents(streamId, storedEvents, stream.version);

    // Update stream metadata
    await this.updateStreamMetadata(streamId, {
      version: stream.version + events.length,
      eventCount: stream.eventCount + events.length,
      lastUpdated: new Date(),
    });
  }

  // Read events from stream
  async readStream(
    streamId: string,
    fromVersion?: number,
    maxCount?: number
  ): Promise<StoredEvent[]> {
    const query: IEventStoreQuery = {
      streamId,
      fromVersion: fromVersion || 0,
      maxCount: maxCount || this.options.defaultReadCount || 100,
    };

    return await this.storage.readEvents(query);
  }

  // Read all events (global event log)
  async readAllEvents(
    fromPosition?: number,
    maxCount?: number
  ): Promise<StoredEvent[]> {
    const query: IEventStoreQuery = {
      fromPosition: fromPosition || 0,
      maxCount: maxCount || this.options.defaultReadCount || 100,
    };

    return await this.storage.readAllEvents(query);
  }

  // Get stream metadata
  async getStreamMetadata(streamId: string): Promise<StreamMetadata | null> {
    return await this.storage.getStreamMetadata(streamId);
  }

  // Advanced querying
  async queryEvents(query: IEventStoreQuery): Promise<StoredEvent[]> {
    return await this.storage.queryEvents(query);
  }

  // Event replay functionality
  async replayEvents(
    streamId: string,
    fromVersion: number,
    handler: (event: IDomainEvent) => Promise<void>
  ): Promise<void> {
    const batchSize = this.options.replayBatchSize || 50;
    let currentVersion = fromVersion;
    let hasMore = true;

    while (hasMore) {
      const events = await this.readStream(streamId, currentVersion, batchSize);
      hasMore = events.length === batchSize;

      for (const storedEvent of events) {
        const domainEvent = await this.serializer.deserialize(
          storedEvent.data,
          storedEvent.eventType
        );
        await handler(domainEvent);
        currentVersion = storedEvent.metadata.position;
      }
    }
  }

  private async getOrCreateStream(streamId: string): Promise<IEventStream> {
    const metadata = await this.getStreamMetadata(streamId);
    if (metadata) {
      return {
        streamId,
        version: metadata.version,
        eventCount: metadata.eventCount,
        created: metadata.created,
        lastUpdated: metadata.lastUpdated,
      };
    }

    // Create new stream
    const stream: IEventStream = {
      streamId,
      version: 0,
      eventCount: 0,
      created: new Date(),
      lastUpdated: new Date(),
    };

    await this.storage.createStream(streamId, stream);
    return stream;
  }

  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async calculateChecksum(event: IDomainEvent): Promise<string> {
    const data = JSON.stringify({
      eventType: event.eventType,
      aggregateId: event.aggregateId,
      payload: event.payload,
    });

    // Simple checksum (in production, use proper hashing)
    let checksum = 0;
    for (let i = 0; i < data.length; i++) {
      checksum = ((checksum << 5) - checksum + data.charCodeAt(i)) & 0xffffffff;
    }
    return checksum.toString(16);
  }

  private async updateStreamMetadata(
    streamId: string,
    updates: Partial<StreamMetadata>
  ): Promise<void> {
    await this.storage.updateStreamMetadata(streamId, updates);
  }
}

class ConcurrencyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConcurrencyError';
  }
}
```

### Event Persistence Handler

```typescript
// src/infrastructure/events/persistence-handler.ts
import { IEventPersistenceHandler, IDomainEvent } from '@vytches-ddd/contracts';

export class DatabaseEventPersistenceHandler
  implements IEventPersistenceHandler
{
  constructor(
    private readonly eventStore: IEventStore,
    private readonly logger: ILogger,
    private readonly options: PersistenceOptions = {}
  ) {}

  async persistEvent(event: IDomainEvent): Promise<void> {
    await this.persistEvents([event]);
  }

  async persistEvents(events: IDomainEvent[]): Promise<void> {
    if (events.length === 0) return;

    // Group events by stream (aggregate)
    const eventsByStream = this.groupEventsByStream(events);

    // Persist each stream atomically
    for (const [streamId, streamEvents] of eventsByStream) {
      try {
        await this.persistStreamEvents(streamId, streamEvents);

        this.logger.debug('Events persisted successfully', {
          streamId,
          eventCount: streamEvents.length,
          eventTypes: streamEvents.map(e => e.eventType),
        });
      } catch (error) {
        this.logger.error('Failed to persist events', {
          streamId,
          eventCount: streamEvents.length,
          error: error.message,
        });
        throw error;
      }
    }
  }

  async getEvents(
    aggregateId: string,
    fromVersion?: number
  ): Promise<IDomainEvent[]> {
    const storedEvents = await this.eventStore.readStream(
      aggregateId,
      fromVersion
    );

    const events: IDomainEvent[] = [];
    for (const storedEvent of storedEvents) {
      const event = await this.deserializeEvent(storedEvent);
      events.push(event);
    }

    return events;
  }

  async getEventCount(aggregateId: string): Promise<number> {
    const metadata = await this.eventStore.getStreamMetadata(aggregateId);
    return metadata?.eventCount || 0;
  }

  // Event stream subscription
  async subscribeToEvents(
    handler: (event: IDomainEvent) => Promise<void>,
    options: SubscriptionOptions = {}
  ): Promise<EventSubscription> {
    const subscription = new EventStreamSubscription(
      this.eventStore,
      handler,
      options,
      this.logger
    );

    await subscription.start();
    return subscription;
  }

  private groupEventsByStream(
    events: IDomainEvent[]
  ): Map<string, IDomainEvent[]> {
    const eventsByStream = new Map<string, IDomainEvent[]>();

    for (const event of events) {
      const streamId = event.aggregateId;
      if (!eventsByStream.has(streamId)) {
        eventsByStream.set(streamId, []);
      }
      eventsByStream.get(streamId)!.push(event);
    }

    return eventsByStream;
  }

  private async persistStreamEvents(
    streamId: string,
    events: IDomainEvent[]
  ): Promise<void> {
    // Get current stream version for concurrency control
    const metadata = await this.eventStore.getStreamMetadata(streamId);
    const expectedVersion = metadata?.version || 0;

    // Append events with optimistic concurrency control
    await this.eventStore.appendToStream(streamId, events, expectedVersion);
  }

  private async deserializeEvent(
    storedEvent: StoredEvent
  ): Promise<IDomainEvent> {
    // In a real implementation, you'd use a proper serializer
    return JSON.parse(storedEvent.data);
  }
}

interface PersistenceOptions {
  batchSize?: number;
  timeout?: number;
  retryAttempts?: number;
}

interface SubscriptionOptions {
  fromPosition?: number;
  filter?: (event: IDomainEvent) => boolean;
  batchSize?: number;
}

interface EventSubscription {
  stop(): Promise<void>;
  isRunning(): boolean;
}
```

### Event Replay System

```typescript
// src/infrastructure/events/event-replay.ts
import {
  IEventReplay,
  ReplayOptions,
  ReplayResult,
} from '@vytches-ddd/contracts';

export class EventReplayService implements IEventReplay {
  constructor(
    private readonly eventStore: IEventStore,
    private readonly eventBus: IEventBus,
    private readonly logger: ILogger
  ) {}

  // Replay events for specific aggregate
  async replayAggregate(
    aggregateId: string,
    options: ReplayOptions = {}
  ): Promise<ReplayResult> {
    const startTime = Date.now();
    let eventsReplayed = 0;
    let errors: Error[] = [];

    try {
      this.logger.info('Starting aggregate replay', { aggregateId, options });

      await this.eventStore.replayEvents(
        aggregateId,
        options.fromVersion || 0,
        async (event: IDomainEvent) => {
          try {
            // Apply filters if specified
            if (
              options.eventTypeFilter &&
              !options.eventTypeFilter.includes(event.eventType)
            ) {
              return;
            }

            if (options.timeRangeFilter) {
              const eventTime = event.occurredAt.getTime();
              if (
                eventTime < options.timeRangeFilter.from.getTime() ||
                eventTime > options.timeRangeFilter.to.getTime()
              ) {
                return;
              }
            }

            // Replay event
            if (options.dryRun) {
              this.logger.debug('Would replay event', {
                eventType: event.eventType,
                aggregateId: event.aggregateId,
              });
            } else {
              await this.eventBus.publish(event);
            }

            eventsReplayed++;

            // Progress callback
            if (options.onProgress) {
              await options.onProgress(eventsReplayed, event);
            }
          } catch (error) {
            const replayError = new Error(
              `Failed to replay event ${event.eventType}: ${error.message}`
            );
            errors.push(replayError);

            if (!options.continueOnError) {
              throw replayError;
            }
          }
        }
      );

      const result: ReplayResult = {
        success: true,
        eventsReplayed,
        errors,
        duration: Date.now() - startTime,
        aggregateId,
      };

      this.logger.info('Aggregate replay completed', result);
      return result;
    } catch (error) {
      const result: ReplayResult = {
        success: false,
        eventsReplayed,
        errors: [...errors, error],
        duration: Date.now() - startTime,
        aggregateId,
      };

      this.logger.error('Aggregate replay failed', result);
      return result;
    }
  }

  // Replay events across all aggregates
  async replayAll(options: ReplayOptions = {}): Promise<ReplayResult[]> {
    const results: ReplayResult[] = [];

    // This would need to be implemented based on your event store's
    // ability to list all streams/aggregates
    const aggregateIds = await this.getAllAggregateIds();

    for (const aggregateId of aggregateIds) {
      const result = await this.replayAggregate(aggregateId, options);
      results.push(result);

      // Stop on first failure if not continuing on error
      if (!result.success && !options.continueOnError) {
        break;
      }
    }

    return results;
  }

  // Replay events to rebuild projection
  async replayToProjection(
    projectionName: string,
    handler: (event: IDomainEvent) => Promise<void>,
    options: ReplayOptions = {}
  ): Promise<ReplayResult> {
    const startTime = Date.now();
    let eventsReplayed = 0;
    let errors: Error[] = [];

    try {
      this.logger.info('Starting projection replay', {
        projectionName,
        options,
      });

      // Read all events in chronological order
      let fromPosition = options.fromPosition || 0;
      const batchSize = options.batchSize || 100;
      let hasMore = true;

      while (hasMore) {
        const events = await this.eventStore.readAllEvents(
          fromPosition,
          batchSize
        );
        hasMore = events.length === batchSize;

        for (const storedEvent of events) {
          try {
            const domainEvent = await this.deserializeEvent(storedEvent);

            // Apply filters
            if (
              options.eventTypeFilter &&
              !options.eventTypeFilter.includes(domainEvent.eventType)
            ) {
              continue;
            }

            // Process event
            if (!options.dryRun) {
              await handler(domainEvent);
            }

            eventsReplayed++;
            fromPosition = storedEvent.metadata.position;

            // Progress callback
            if (options.onProgress) {
              await options.onProgress(eventsReplayed, domainEvent);
            }
          } catch (error) {
            const replayError = new Error(
              `Failed to replay event for projection ${projectionName}: ${error.message}`
            );
            errors.push(replayError);

            if (!options.continueOnError) {
              throw replayError;
            }
          }
        }
      }

      const result: ReplayResult = {
        success: true,
        eventsReplayed,
        errors,
        duration: Date.now() - startTime,
        projectionName,
      };

      this.logger.info('Projection replay completed', result);
      return result;
    } catch (error) {
      const result: ReplayResult = {
        success: false,
        eventsReplayed,
        errors: [...errors, error],
        duration: Date.now() - startTime,
        projectionName,
      };

      this.logger.error('Projection replay failed', result);
      return result;
    }
  }

  private async getAllAggregateIds(): Promise<string[]> {
    // This would need to be implemented based on your event store
    // For now, return empty array
    return [];
  }

  private async deserializeEvent(
    storedEvent: StoredEvent
  ): Promise<IDomainEvent> {
    // In a real implementation, use proper serializer
    return JSON.parse(storedEvent.data);
  }
}

// Subscription implementation for real-time event processing
class EventStreamSubscription implements EventSubscription {
  private isActive = false;
  private processingPromise?: Promise<void>;

  constructor(
    private readonly eventStore: IEventStore,
    private readonly handler: (event: IDomainEvent) => Promise<void>,
    private readonly options: SubscriptionOptions,
    private readonly logger: ILogger
  ) {}

  async start(): Promise<void> {
    if (this.isActive) {
      throw new Error('Subscription is already active');
    }

    this.isActive = true;
    this.processingPromise = this.processEvents();
  }

  async stop(): Promise<void> {
    this.isActive = false;
    if (this.processingPromise) {
      await this.processingPromise;
    }
  }

  isRunning(): boolean {
    return this.isActive;
  }

  private async processEvents(): Promise<void> {
    let currentPosition = this.options.fromPosition || 0;
    const batchSize = this.options.batchSize || 10;

    while (this.isActive) {
      try {
        const events = await this.eventStore.readAllEvents(
          currentPosition,
          batchSize
        );

        for (const storedEvent of events) {
          if (!this.isActive) break;

          const domainEvent = await this.deserializeEvent(storedEvent);

          // Apply filter if specified
          if (this.options.filter && !this.options.filter(domainEvent)) {
            continue;
          }

          await this.handler(domainEvent);
          currentPosition = storedEvent.metadata.position + 1;
        }

        // If no new events, wait before polling again
        if (events.length === 0) {
          await this.sleep(1000); // Wait 1 second
        }
      } catch (error) {
        this.logger.error('Error in event subscription', {
          error: error.message,
        });
        await this.sleep(5000); // Wait 5 seconds before retrying
      }
    }
  }

  private async deserializeEvent(
    storedEvent: StoredEvent
  ): Promise<IDomainEvent> {
    return JSON.parse(storedEvent.data);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### Advanced Event Bus with Persistence

```typescript
// src/infrastructure/events/persistent-event-bus.ts
export class PersistentEventBus implements IEventBus {
  constructor(
    private readonly eventStore: IEventStore,
    private readonly persistenceHandler: IEventPersistenceHandler,
    private readonly inMemoryBus: IEventBus,
    private readonly logger: ILogger
  ) {}

  // Publish with persistence
  async publish<T extends IDomainEvent>(event: T): Promise<void> {
    try {
      // First persist the event
      await this.persistenceHandler.persistEvent(event);

      // Then publish to in-memory handlers
      await this.inMemoryBus.publish(event);

      this.logger.debug('Event published and persisted', {
        eventType: event.eventType,
        aggregateId: event.aggregateId,
        correlationId: event.metadata.correlationId,
      });
    } catch (error) {
      this.logger.error('Failed to publish event', {
        eventType: event.eventType,
        aggregateId: event.aggregateId,
        error: error.message,
      });
      throw error;
    }
  }

  // Publish many with transaction-like semantics
  async publishMany<T extends IDomainEvent>(events: T[]): Promise<void> {
    if (events.length === 0) return;

    try {
      // Persist all events atomically
      await this.persistenceHandler.persistEvents(events);

      // Publish to in-memory handlers
      await this.inMemoryBus.publishMany(events);

      this.logger.info('Events batch published and persisted', {
        eventCount: events.length,
        eventTypes: events.map(e => e.eventType),
      });
    } catch (error) {
      this.logger.error('Failed to publish event batch', {
        eventCount: events.length,
        error: error.message,
      });
      throw error;
    }
  }

  // Subscribe to in-memory bus (for real-time processing)
  subscribe<T extends IDomainEvent>(
    eventType: string,
    handler: IEventHandler<T>
  ): void {
    this.inMemoryBus.subscribe(eventType, handler);
  }

  unsubscribe<T extends IDomainEvent>(
    eventType: string,
    handler: IEventHandler<T>
  ): void {
    this.inMemoryBus.unsubscribe(eventType, handler);
  }

  getHandlers<T extends IDomainEvent>(eventType: string): IEventHandler<T>[] {
    return this.inMemoryBus.getHandlers(eventType);
  }

  clear(): void {
    this.inMemoryBus.clear();
  }

  // Additional persistence-specific methods
  async getEventHistory(aggregateId: string): Promise<IDomainEvent[]> {
    return await this.persistenceHandler.getEvents(aggregateId);
  }

  async subscribeToPersistedEvents(
    handler: (event: IDomainEvent) => Promise<void>
  ): Promise<EventSubscription> {
    return await this.persistenceHandler.subscribeToEvents(handler);
  }
}
```

## Key Features

- **Event Persistence**: Durable event storage with concurrency control
- **Event Replay**: Rebuild aggregates and projections from events
- **Advanced Querying**: Flexible event querying capabilities
- **Stream Management**: Complete event stream lifecycle management
- **Subscription Model**: Real-time event processing subscriptions
- **Transactional Safety**: Atomic event persistence operations
- **Concurrency Control**: Optimistic locking for event streams
- **Error Handling**: Comprehensive error handling and recovery

## Common Pitfalls

- **Concurrency Issues**: Always handle optimistic concurrency conflicts
- **Memory Usage**: Be careful with large event replays
- **Serialization**: Ensure proper event serialization/deserialization
- **Error Recovery**: Implement proper error handling in subscriptions

## Related Examples

- Event Interfaces - Basic event patterns and handlers
- Capability System - Using capabilities for event processing
- Cross-Package Architecture - Event integration across domains

## Best Practices

- Use optimistic concurrency control for event streams
- Implement proper event serialization strategies
- Design events for forward compatibility
- Include comprehensive metadata in stored events
- Implement proper error handling and retry logic
- Use batch operations for better performance
- Monitor event store performance and storage usage
- Implement proper backup and recovery procedures
