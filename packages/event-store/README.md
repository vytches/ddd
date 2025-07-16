# @vytches-ddd/event-store

<!-- LLM-METADATA
Package: @vytches-ddd/event-store
Category: Infrastructure
Purpose: Enterprise-grade Event Store with Event Sourcing support, stream-based storage, snapshots, and optimistic concurrency control
Dependencies: @vytches-ddd/core, @vytches-ddd/logging
Complexity: High
DDD Patterns: Event Sourcing, Aggregate Streams, Snapshots, Optimistic Concurrency Control, Event Replay
Integration Points: Essential for CQRS, Event Sourcing, and projection rebuilding; integrates with aggregates, repositories, and event systems
-->

[![npm version](https://badge.fury.io/js/%40vytches-ddd%2Fevent-store.svg)](https://badge.fury.io/js/%40vytches-ddd%2Fevent-store)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Enterprise-grade Event Store implementation for Domain-Driven Design
> applications with full Event Sourcing support**

Comprehensive Event Store implementation providing stream-based storage,
optimistic concurrency control, snapshots, event replay capabilities, and
production-ready adapters for building robust Event Sourcing and CQRS
applications.

## 📋 Table of Contents

- [Installation](#installation)
- [Key Features](#key-features)
- [Core Concepts](#core-concepts)
- [Quick Start](#quick-start)
- [Event Streams](#event-streams)
- [Snapshots](#snapshots)
- [Event Replay](#event-replay)
- [Storage Adapters](#storage-adapters)
- [Concurrency Control](#concurrency-control)
- [Serialization](#serialization)
- [Error Handling](#error-handling)
- [NestJS Integration](#nestjs-integration)
- [Production Deployment](#production-deployment)
- [Security](#security)
- [Performance](#performance)
- [Testing](#testing)
- [Best Practices](#best-practices)
- [Contributing](#contributing)

## 🚀 Installation

```bash
# npm
npm install @vytches-ddd/event-store

# yarn
yarn add @vytches-ddd/event-store

# pnpm
pnpm add @vytches-ddd/event-store
```

### Dependencies

```bash
# Required peer dependencies
npm install @vytches-ddd/core @vytches-ddd/logging
```

## ✨ Key Features

### Event Sourcing

- **Stream-based Storage**: Organize events by aggregate streams with version
  control
- **Optimistic Concurrency Control**: Version-based conflict detection and
  resolution
- **Event Immutability**: Immutable event storage with integrity guarantees
- **Aggregate Reconstruction**: Rebuild aggregates from event history

### Performance Optimization

- **Snapshot Support**: Performance optimization for large aggregates with
  configurable frequency
- **Global Event Log**: Read all events across streams with filtering and
  pagination
- **Efficient Querying**: Optimized event retrieval with streaming support
- **Batch Processing**: Batch event appending for improved performance

### Enterprise Features

- **Event Replay**: Foundation for projection rebuilding and system recovery
- **Multiple Storage Adapters**: In-memory, file system, and database backends
- **Rich Metadata**: Correlation, causation, and custom metadata support for
  events
- **Error Handling**: Comprehensive error hierarchy with domain-specific
  exceptions

### Production Ready

- **NestJS Integration**: Production-ready TypeORM entities and module
  configuration
- **Security Features**: Encryption, checksums, and audit logging for sensitive
  events
- **Performance Optimization**: Connection pooling, caching, and indexing
  strategies
- **Testing Support**: Complete test coverage with event store test harness
  utilities

## 🎯 Core Concepts

### Event Store Interface

The core interface for all event store implementations:

```typescript
interface IEventStore {
  appendToStream(
    streamId: string,
    events: IStoredDomainEvent[],
    expectedVersion?: number
  ): Promise<IAppendResult>;

  readStream<T = unknown>(
    streamId: string,
    options?: IReadStreamOptions
  ): Promise<IEventStream<T>>;

  readAll<T = unknown>(
    options?: IReadAllOptions
  ): Promise<IGlobalEventStream<T>>;

  getSnapshot<T = unknown>(
    streamId: string
  ): Promise<IAggregateSnapshot<T> | null>;

  saveSnapshot<T = unknown>(
    streamId: string,
    snapshot: IAggregateSnapshot<T>
  ): Promise<void>;
}
```

### Stored Event Structure

```typescript
interface IStoredEvent<T = unknown> {
  eventId: string;
  eventType: string;
  streamId: string;
  streamVersion: number;
  globalVersion: bigint;
  position: bigint;
  aggregateId: string;
  aggregateType: string;
  aggregateVersion: number;
  timestamp: Date;
  payload: T;
  metadata?: Record<string, any>;
  checksum?: string;
  contentType: string;
}
```

### Stream Metadata

```typescript
interface IStreamMetadata {
  streamId: string;
  version: number;
  eventCount: number;
  created: Date;
  updated: Date;
  deleted?: boolean;
  firstEventPosition?: bigint;
  lastEventPosition?: bigint;
  customMetadata?: Record<string, any>;
}
```

## 🚀 Quick Start

### Basic Usage

```typescript
import { InMemoryEventStore } from '@vytches-ddd/event-store';
import type { IStoredDomainEvent } from '@vytches-ddd/contracts';

// Create event store
const eventStore = new InMemoryEventStore({
  enableSnapshots: true,
  snapshotFrequency: 100,
  enableOptimisticConcurrency: true,
  enableChecksums: false,
  maxEventsPerStream: 10000,
  eventRetentionDays: 365,
});

// Connect to event store
await eventStore.connect();

// Create events
const events: IStoredDomainEvent[] = [
  {
    eventId: '123e4567-e89b-12d3-a456-426614174000',
    eventType: 'OrderCreated',
    aggregateId: 'order-1',
    aggregateType: 'Order',
    aggregateVersion: 1,
    timestamp: new Date(),
    payload: {
      customerId: 'cust-1',
      items: [{ productId: 'prod-1', quantity: 2, price: 10.0 }],
      total: 20.0,
    },
    metadata: {
      userId: 'user-1',
      correlationId: 'corr-123',
    },
  },
];

// Append events to stream
const result = await eventStore.appendToStream('order-1', events);

console.log('Append result:', {
  streamId: result.streamId,
  fromVersion: result.fromVersion,
  toVersion: result.toVersion,
  events: result.events,
  position: result.position,
});

// Read events from stream
const stream = await eventStore.readStream('order-1');
console.log('Stream events:', stream.events);

// Read all events globally
const allEvents = await eventStore.readAll({
  filterByEventType: ['OrderCreated'],
  maxCount: 100,
});
console.log('All events:', allEvents.events);
```

### With Configuration

```typescript
import {
  InMemoryEventStore,
  JsonEventSerializer,
} from '@vytches-ddd/event-store';

// Create with custom configuration
const eventStore = new InMemoryEventStore({
  serializer: new JsonEventSerializer(true), // Pretty print JSON
  enableSnapshots: true,
  snapshotFrequency: 50, // Snapshot every 50 events
  enableOptimisticConcurrency: true,
  enableChecksums: true, // Enable integrity checking
  maxEventsPerStream: 5000,
  eventRetentionDays: 180,
});

// Check connection status
console.log('Connected:', eventStore.isConnected());

// Clear all data (for testing)
await eventStore.clear();
```

## 🌊 Event Streams

### Basic Stream Operations

```typescript
// Check if stream exists
const exists = await eventStore.streamExists('order-1');

// Get stream version
const version = await eventStore.getStreamVersion('order-1');

// Get stream metadata
const metadata = await eventStore.getStreamMetadata('order-1');

console.log('Stream metadata:', {
  streamId: metadata?.streamId,
  version: metadata?.version,
  eventCount: metadata?.eventCount,
  created: metadata?.created,
  updated: metadata?.updated,
});

// Set custom metadata
await eventStore.setStreamMetadata('order-1', {
  customMetadata: {
    category: 'orders',
    archived: false,
    owner: 'order-service',
  },
});
```

### Reading Stream Events

```typescript
// Read with options
const stream = await eventStore.readStream('order-1', {
  fromVersion: 5, // Start from version 5
  maxCount: 50, // Maximum 50 events
  direction: 'forward', // Read forward (or 'backward')
});

console.log('Stream info:', {
  streamId: stream.streamId,
  fromVersion: stream.fromVersion,
  lastVersion: stream.lastVersion,
  isEndOfStream: stream.isEndOfStream,
  nextVersion: stream.nextVersion,
  eventCount: stream.events.length,
});

// Read backwards
const backwardStream = await eventStore.readStream('order-1', {
  fromVersion: 100,
  maxCount: 10,
  direction: 'backward',
});
```

### Appending with Concurrency Control

```typescript
import { EventStoreConcurrencyError } from '@vytches-ddd/event-store';

try {
  // Append with expected version
  const result = await eventStore.appendToStream(
    'order-1',
    events,
    5 // Expected current version
  );

  console.log('Events appended successfully:', result);
} catch (error) {
  if (error instanceof EventStoreConcurrencyError) {
    console.error('Concurrency conflict:', {
      streamId: error.streamId,
      expectedVersion: error.expectedVersion,
      actualVersion: error.actualVersion,
    });

    // Handle conflict - typically reload and retry
    await handleConcurrencyConflict(error);
  } else {
    throw error;
  }
}

async function handleConcurrencyConflict(error: EventStoreConcurrencyError) {
  // Reload current state
  const currentStream = await eventStore.readStream(error.streamId);

  // Reapply business logic with current state
  // ... business logic ...

  // Retry append with correct version
  await eventStore.appendToStream(error.streamId, events, error.actualVersion);
}
```

### Stream Deletion

```typescript
import { StreamDeletedError } from '@vytches-ddd/event-store';

try {
  // Soft delete stream
  await eventStore.deleteStream('order-1', expectedVersion);

  // Attempting to read deleted stream will throw error
  const stream = await eventStore.readStream('order-1');
} catch (error) {
  if (error instanceof StreamDeletedError) {
    console.log('Stream is deleted:', error.streamId);
  }
}
```

## 📸 Snapshots

### Basic Snapshot Operations

```typescript
// Create snapshot
const snapshot = {
  aggregateId: 'order-1',
  aggregateType: 'Order',
  version: 100,
  timestamp: new Date(),
  state: {
    customerId: 'cust-1',
    items: [{ productId: 'prod-1', quantity: 2, price: 10.0 }],
    status: 'confirmed',
    total: 20.0,
  },
};

// Save snapshot
await eventStore.saveSnapshot('order-1', snapshot);

// Get latest snapshot
const latestSnapshot = await eventStore.getSnapshot('order-1');

if (latestSnapshot) {
  console.log('Snapshot loaded:', {
    version: latestSnapshot.version,
    timestamp: latestSnapshot.timestamp,
    state: latestSnapshot.state,
  });
}
```

### Aggregate Reconstruction with Snapshots

```typescript
async function loadAggregate(aggregateId: string): Promise<Order | null> {
  try {
    // Try to load from snapshot first
    const snapshot = await eventStore.getSnapshot<OrderState>(aggregateId);

    // Load events after snapshot
    const fromVersion = snapshot ? snapshot.version + 1 : 0;
    const stream = await eventStore.readStream(aggregateId, { fromVersion });

    if (!snapshot && stream.events.length === 0) {
      return null;
    }

    // Reconstruct aggregate
    const order = snapshot
      ? Order.fromSnapshot(snapshot)
      : Order.create(aggregateId);

    // Apply events after snapshot
    if (stream.events.length > 0) {
      order.loadFromHistory(stream.events);
    }

    return order;
  } catch (error) {
    if (error instanceof StreamNotFoundError) {
      return null;
    }
    throw error;
  }
}
```

### Automatic Snapshotting

```typescript
// Configure automatic snapshotting
const eventStore = new InMemoryEventStore({
  enableSnapshots: true,
  snapshotFrequency: 100, // Snapshot every 100 events
});

// Snapshots are automatically created when configured frequency is reached
// during appendToStream operations
```

## 🔄 Event Replay

### Basic Event Replay

```typescript
// Create replay instance
const replay = eventStore.createEventReplay();

// Replay from specific stream
const result = await replay.replayFromStream('order-1', async event => {
  console.log('Replaying event:', {
    eventType: event.eventType,
    aggregateId: event.aggregateId,
    streamVersion: event.streamVersion,
  });

  // Process event (e.g., update projection)
  await processEvent(event);
});

console.log('Replay result:', {
  eventsReplayed: result.eventsReplayed,
  eventsFailed: result.eventsFailed,
  duration: result.duration,
  success: result.success,
});

// Replay all events
const allResult = await replay.replayAll(async event => {
  await processEvent(event);
});
```

### Advanced Event Replay

```typescript
// Create advanced replay with session control
const advancedReplay = eventStore.createAdvancedEventReplay();

// Start replay session
const sessionId = await advancedReplay.startSession({
  batchSize: 100,
  maxConcurrency: 4,
  errorHandling: 'continue', // or 'stop'
  progressCallback: progress => {
    console.log('Progress:', progress);
  },
});

// Replay with filters
const filteredResult = await advancedReplay.replayWithFilter(
  {
    eventTypes: ['OrderCreated', 'OrderShipped'],
    fromTimestamp: new Date('2023-01-01'),
    toTimestamp: new Date('2023-12-31'),
    streamPrefix: 'order-',
  },
  async event => {
    await processEvent(event);
  },
  sessionId
);

// End session
await advancedReplay.endSession(sessionId);
```

### Event Replay Factory

```typescript
import { EventReplayFactory } from '@vytches-ddd/event-store';

// Create factory
const replayFactory = new EventReplayFactory(eventStore);

// Create basic replay
const basicReplay = replayFactory.createBasicReplay();

// Create advanced replay
const advancedReplay = replayFactory.createAdvancedReplay();

// Quick utility methods
await eventStore.replayStream('order-1', async event => {
  await processEvent(event);
});

await eventStore.replayAll(async event => {
  await processEvent(event);
});
```

## 🗄️ Storage Adapters

### In-Memory Event Store

```typescript
import { InMemoryEventStore } from '@vytches-ddd/event-store';

// Perfect for development and testing
const eventStore = new InMemoryEventStore({
  enableSnapshots: true,
  snapshotFrequency: 100,
  enableOptimisticConcurrency: true,
});

// Connect (no-op for in-memory)
await eventStore.connect();

// Clear all data
await eventStore.clear();

// Disconnect
await eventStore.disconnect();

// Check connection
console.log('Connected:', eventStore.isConnected());
```

### Database Event Store (Production)

```typescript
import { PostgreSQLEventStore } from '@vytches-ddd/event-store';
import { DataSource } from 'typeorm';

// Create data source
const dataSource = new DataSource({
  type: 'postgres',
  host: 'localhost',
  port: 5432,
  username: 'postgres',
  password: 'password',
  database: 'eventstore',
  entities: [EventEntity, StreamEntity, SnapshotEntity],
  synchronize: false,
  migrations: ['src/migrations/*.ts'],
  logging: ['error', 'warn'],
  pool: {
    min: 5,
    max: 20,
  },
});

// Initialize event store
const eventStore = new PostgreSQLEventStore({
  dataSource,
  schema: 'event_store',
  enableChecksums: true,
  enableSnapshots: true,
  snapshotFrequency: 100,
  enableOptimisticConcurrency: true,
  maxEventsPerStream: 10000,
  eventRetentionDays: 365,
});

// Connect
await eventStore.connect();
```

### Custom Storage Adapter

```typescript
import { BaseEventStore } from '@vytches-ddd/event-store';

class CustomEventStore extends BaseEventStore {
  async appendToStream(
    streamId: string,
    events: IStoredDomainEvent[],
    expectedVersion?: number
  ): Promise<IAppendResult> {
    // Validate expected version
    const currentVersion = await this.validateExpectedVersion(
      streamId,
      expectedVersion
    );

    // Custom storage logic
    const storedEvents = await this.storeEvents(
      streamId,
      events,
      currentVersion
    );

    // Return result
    return {
      streamId,
      fromVersion: currentVersion + 1,
      toVersion: currentVersion + events.length,
      events: events.length,
      position: BigInt(storedEvents.length),
    };
  }

  // Implement other abstract methods...
}
```

## 🔐 Concurrency Control

### Optimistic Concurrency Control

```typescript
// Enable optimistic concurrency control
const eventStore = new InMemoryEventStore({
  enableOptimisticConcurrency: true,
});

// Append with version check
async function appendWithRetry(
  streamId: string,
  events: IStoredDomainEvent[],
  maxRetries: number = 3
): Promise<IAppendResult> {
  let retries = 0;

  while (retries < maxRetries) {
    try {
      // Get current version
      const currentVersion = await eventStore.getStreamVersion(streamId);

      // Append with expected version
      return await eventStore.appendToStream(streamId, events, currentVersion);
    } catch (error) {
      if (
        error instanceof EventStoreConcurrencyError &&
        retries < maxRetries - 1
      ) {
        retries++;

        // Exponential backoff
        await new Promise(resolve =>
          setTimeout(resolve, Math.pow(2, retries) * 100)
        );

        continue;
      }

      throw error;
    }
  }

  throw new Error(`Failed to append after ${maxRetries} retries`);
}
```

### Handling Concurrency Conflicts

```typescript
import { EventStoreConcurrencyError } from '@vytches-ddd/event-store';

class OrderService {
  async updateOrder(
    orderId: string,
    command: UpdateOrderCommand
  ): Promise<void> {
    try {
      // Load current order
      const order = await this.loadOrder(orderId);

      // Apply command
      order.applyCommand(command);

      // Save with concurrency control
      await this.saveOrder(order);
    } catch (error) {
      if (error instanceof EventStoreConcurrencyError) {
        // Reload and retry
        await this.handleConcurrencyConflict(orderId, command, error);
      } else {
        throw error;
      }
    }
  }

  private async handleConcurrencyConflict(
    orderId: string,
    command: UpdateOrderCommand,
    error: EventStoreConcurrencyError
  ): Promise<void> {
    // Reload current state
    const freshOrder = await this.loadOrder(orderId);

    // Check if command is still valid
    if (!freshOrder.canApplyCommand(command)) {
      throw new Error('Command no longer valid after reload');
    }

    // Retry
    freshOrder.applyCommand(command);
    await this.saveOrder(freshOrder);
  }
}
```

## 📝 Serialization

### JSON Serialization

```typescript
import { JsonEventSerializer } from '@vytches-ddd/event-store';

// Create serializer
const serializer = new JsonEventSerializer(true); // Pretty print

// Use with event store
const eventStore = new InMemoryEventStore({
  serializer,
});

// Serializer methods
const event = {
  eventType: 'OrderCreated',
  payload: { customerId: 'cust-1', total: 100 },
};

const serialized = serializer.serialize(event);
console.log('Serialized:', serialized);

const deserialized = serializer.deserialize(serialized);
console.log('Deserialized:', deserialized);

console.log('Content type:', serializer.getContentType()); // 'application/json'
```

### Custom Serialization

```typescript
import { IEventSerializer } from '@vytches-ddd/contracts';

class CustomEventSerializer implements IEventSerializer {
  serialize(event: IStoredDomainEvent): string {
    // Custom serialization logic
    return Buffer.from(JSON.stringify(event)).toString('base64');
  }

  deserialize<T = unknown>(data: string): IStoredDomainEvent<T> {
    // Custom deserialization logic
    const json = Buffer.from(data, 'base64').toString('utf8');
    return JSON.parse(json);
  }

  getContentType(): string {
    return 'application/base64-json';
  }
}

// Use custom serializer
const eventStore = new InMemoryEventStore({
  serializer: new CustomEventSerializer(),
});
```

## ⚠️ Error Handling

### Event Store Errors

```typescript
import {
  EventStoreError,
  EventStoreConcurrencyError,
  StreamNotFoundError,
  StreamDeletedError,
  EventSerializationError,
  EventDeserializationError,
  EventStoreConnectionError,
  InvalidStreamVersionError,
} from '@vytches-ddd/event-store';

// Handle specific errors
try {
  await eventStore.appendToStream('order-1', events, 5);
} catch (error) {
  if (error instanceof EventStoreConcurrencyError) {
    console.error('Concurrency conflict:', {
      streamId: error.streamId,
      expectedVersion: error.expectedVersion,
      actualVersion: error.actualVersion,
    });
  } else if (error instanceof StreamNotFoundError) {
    console.error('Stream not found:', error.streamId);
  } else if (error instanceof StreamDeletedError) {
    console.error('Stream deleted:', error.streamId);
  } else if (error instanceof EventSerializationError) {
    console.error('Serialization error:', error.message);
  } else if (error instanceof EventStoreConnectionError) {
    console.error('Connection error:', error.message);
  } else if (error instanceof InvalidStreamVersionError) {
    console.error('Invalid version:', error.message);
  }
}
```

### Error Recovery

```typescript
class EventStoreService {
  async appendWithRetry(
    streamId: string,
    events: IStoredDomainEvent[],
    maxRetries: number = 3
  ): Promise<IAppendResult> {
    let lastError: Error;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const currentVersion = await this.eventStore.getStreamVersion(streamId);
        return await this.eventStore.appendToStream(
          streamId,
          events,
          currentVersion
        );
      } catch (error) {
        lastError = error as Error;

        if (error instanceof EventStoreConcurrencyError) {
          // Retry concurrency conflicts
          await this.delay(Math.pow(2, attempt) * 100);
          continue;
        } else if (error instanceof EventStoreConnectionError) {
          // Retry connection errors
          await this.reconnect();
          continue;
        } else {
          // Don't retry other errors
          throw error;
        }
      }
    }

    throw new Error(`Failed after ${maxRetries} retries: ${lastError.message}`);
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async reconnect(): Promise<void> {
    await this.eventStore.disconnect();
    await this.eventStore.connect();
  }
}
```

## 🏗️ NestJS Integration

### Event Store Module

```typescript
import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEntity, StreamEntity, SnapshotEntity } from './entities';
import { PostgreSQLEventStore } from '@vytches-ddd/event-store';
import { JsonEventSerializer } from '@vytches-ddd/event-store';
import { DataSource } from 'typeorm';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([EventEntity, StreamEntity, SnapshotEntity]),
  ],
  providers: [
    {
      provide: 'EVENT_STORE',
      useFactory: async (dataSource: DataSource) => {
        const eventStore = new PostgreSQLEventStore({
          dataSource,
          schema: 'event_store',
          serializer: new JsonEventSerializer(false),
          enableSnapshots: true,
          snapshotFrequency: 100,
          enableOptimisticConcurrency: true,
          enableChecksums: true,
          maxEventsPerStream: 10000,
          eventRetentionDays: 365,
        });

        await eventStore.connect();
        return eventStore;
      },
      inject: [DataSource],
    },
  ],
  exports: ['EVENT_STORE'],
})
export class EventStoreModule {}
```

### Service Implementation

```typescript
import { Injectable, Inject } from '@nestjs/common';
import { IAdvancedEventStore } from '@vytches-ddd/event-store';
import { Order } from '../domain/order.aggregate';

@Injectable()
export class OrderEventStoreService {
  constructor(
    @Inject('EVENT_STORE')
    private readonly eventStore: IAdvancedEventStore
  ) {}

  async saveOrder(order: Order): Promise<void> {
    const events = order.getUncommittedEvents();

    if (events.length === 0) {
      return;
    }

    // Convert domain events to stored events
    const storedEvents = events.map(event => ({
      eventId: event.eventId,
      eventType: event.eventType,
      aggregateId: order.id,
      aggregateType: 'Order',
      aggregateVersion: event.aggregateVersion,
      timestamp: event.timestamp,
      payload: event.payload,
      metadata: event.metadata,
    }));

    // Append to event store
    await this.eventStore.appendToStream(
      order.id,
      storedEvents,
      order.version - events.length
    );

    // Create snapshot if needed
    if (order.version % 100 === 0) {
      await this.eventStore.saveSnapshot(order.id, {
        aggregateId: order.id,
        aggregateType: 'Order',
        version: order.version,
        timestamp: new Date(),
        state: order.toSnapshot(),
      });
    }

    // Mark events as committed
    order.markEventsAsCommitted();
  }

  async loadOrder(orderId: string): Promise<Order | null> {
    try {
      // Load snapshot
      const snapshot = await this.eventStore.getSnapshot<OrderState>(orderId);

      // Load events after snapshot
      const fromVersion = snapshot ? snapshot.version + 1 : 0;
      const stream = await this.eventStore.readStream(orderId, { fromVersion });

      if (!snapshot && stream.events.length === 0) {
        return null;
      }

      // Reconstruct aggregate
      const order = snapshot
        ? Order.fromSnapshot(snapshot)
        : Order.create(orderId);

      // Apply events
      if (stream.events.length > 0) {
        order.loadFromHistory(stream.events);
      }

      return order;
    } catch (error) {
      if (error instanceof StreamNotFoundError) {
        return null;
      }
      throw error;
    }
  }
}
```

### TypeORM Entities

```typescript
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  Index,
  CreateDateColumn,
} from 'typeorm';

@Entity('events')
@Index(['streamId', 'streamVersion'], { unique: true })
@Index(['aggregateId', 'aggregateVersion'])
@Index(['eventType'])
@Index(['timestamp'])
export class EventEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  eventId: string;

  @Column('varchar', { length: 255 })
  streamId: string;

  @Column('int')
  streamVersion: number;

  @Column('bigint')
  globalVersion: bigint;

  @Column('bigint')
  position: bigint;

  @Column('varchar', { length: 255 })
  eventType: string;

  @Column('varchar', { length: 255 })
  aggregateId: string;

  @Column('varchar', { length: 255 })
  aggregateType: string;

  @Column('int')
  aggregateVersion: number;

  @CreateDateColumn()
  timestamp: Date;

  @Column('jsonb')
  payload: any;

  @Column('jsonb', { nullable: true })
  metadata: any;

  @Column('varchar', { length: 64, nullable: true })
  checksum?: string;

  @Column('varchar', { length: 50 })
  contentType: string;
}

@Entity('streams')
export class StreamEntity {
  @PrimaryColumn('varchar', { length: 255 })
  streamId: string;

  @Column('int', { default: -1 })
  version: number;

  @Column('bigint', { nullable: true })
  firstEventPosition?: bigint;

  @Column('bigint', { nullable: true })
  lastEventPosition?: bigint;

  @Column('int', { default: 0 })
  eventCount: number;

  @Column('boolean', { default: false })
  deleted: boolean;

  @CreateDateColumn()
  created: Date;

  @UpdateDateColumn()
  updated: Date;

  @Column('jsonb', { nullable: true })
  customMetadata?: any;
}

@Entity('snapshots')
export class SnapshotEntity {
  @PrimaryColumn('varchar', { length: 255 })
  streamId: string;

  @Column('varchar', { length: 255 })
  aggregateId: string;

  @Column('varchar', { length: 255 })
  aggregateType: string;

  @Column('int')
  version: number;

  @CreateDateColumn()
  timestamp: Date;

  @Column('jsonb')
  state: any;

  @Column('varchar', { length: 64, nullable: true })
  checksum?: string;
}
```

## 🚀 Production Deployment

### Database Migration

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEventStoreSchema1234567890 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE SCHEMA IF NOT EXISTS event_store;
      
      -- Events table
      CREATE TABLE event_store.events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event_id UUID NOT NULL,
        stream_id VARCHAR(255) NOT NULL,
        stream_version INTEGER NOT NULL,
        global_version BIGINT NOT NULL,
        position BIGINT NOT NULL,
        event_type VARCHAR(255) NOT NULL,
        aggregate_id VARCHAR(255) NOT NULL,
        aggregate_type VARCHAR(255) NOT NULL,
        aggregate_version INTEGER NOT NULL,
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        payload JSONB NOT NULL,
        metadata JSONB,
        checksum VARCHAR(64),
        content_type VARCHAR(50) NOT NULL DEFAULT 'application/json',
        
        CONSTRAINT uq_stream_version UNIQUE (stream_id, stream_version)
      );
      
      -- Streams table
      CREATE TABLE event_store.streams (
        stream_id VARCHAR(255) PRIMARY KEY,
        version INTEGER NOT NULL DEFAULT -1,
        first_event_position BIGINT,
        last_event_position BIGINT,
        event_count INTEGER NOT NULL DEFAULT 0,
        deleted BOOLEAN NOT NULL DEFAULT FALSE,
        created TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        custom_metadata JSONB
      );
      
      -- Snapshots table
      CREATE TABLE event_store.snapshots (
        stream_id VARCHAR(255) PRIMARY KEY,
        aggregate_id VARCHAR(255) NOT NULL,
        aggregate_type VARCHAR(255) NOT NULL,
        version INTEGER NOT NULL,
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        state JSONB NOT NULL,
        checksum VARCHAR(64)
      );
      
      -- Performance indexes
      CREATE INDEX idx_events_aggregate ON event_store.events (aggregate_id, aggregate_version);
      CREATE INDEX idx_events_type ON event_store.events (event_type);
      CREATE INDEX idx_events_timestamp ON event_store.events (timestamp);
      CREATE INDEX idx_events_global_version ON event_store.events (global_version);
      CREATE INDEX idx_events_position ON event_store.events (position);
      
      -- Sequences for global ordering
      CREATE SEQUENCE event_store.global_version_seq;
      CREATE SEQUENCE event_store.position_seq;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP SCHEMA event_store CASCADE;`);
  }
}
```

### Production Configuration

```typescript
// production.config.ts
export const productionEventStoreConfig = {
  // Database configuration
  database: {
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'eventstore',
    schema: 'event_store',
    ssl: process.env.NODE_ENV === 'production',
    logging: ['error', 'warn'],

    // Connection pooling
    pool: {
      min: 5,
      max: 20,
      acquireTimeoutMillis: 30000,
      idleTimeoutMillis: 600000,
    },
  },

  // Event store configuration
  eventStore: {
    enableSnapshots: true,
    snapshotFrequency: 100,
    enableOptimisticConcurrency: true,
    enableChecksums: true,
    maxEventsPerStream: 10000,
    eventRetentionDays: 365,
  },

  // Performance optimizations
  performance: {
    batchSize: 100,
    connectionPoolSize: 20,
    enableMetadataCache: true,
    metadataCacheTtl: 300000, // 5 minutes
    enableCompression: true,
    compressionLevel: 6,
  },

  // Security
  security: {
    enableEncryption: true,
    encryptionKey: process.env.ENCRYPTION_KEY,
    enableAuditLogging: true,
  },
};
```

### Health Checks

```typescript
import { Injectable, Inject } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { IAdvancedEventStore } from '@vytches-ddd/event-store';

@Injectable()
export class EventStoreHealthIndicator extends HealthIndicator {
  constructor(
    @Inject('EVENT_STORE')
    private readonly eventStore: IAdvancedEventStore
  ) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const isConnected = this.eventStore.isConnected();

    if (isConnected) {
      try {
        // Test basic operations
        await this.eventStore.readAll({ maxCount: 1 });
        return this.getStatus(key, true);
      } catch (error) {
        throw new HealthCheckError(
          'Event Store operations failed',
          this.getStatus(key, false, { error: error.message })
        );
      }
    }

    throw new HealthCheckError(
      'Event Store not connected',
      this.getStatus(key, false)
    );
  }
}
```

## 🔒 Security

### Encryption

```typescript
import { Injectable } from '@nestjs/common';
import { createCipher, createDecipher, createHash } from 'crypto';

@Injectable()
export class EventStoreSecurityService {
  private readonly encryptionKey: string;
  private readonly algorithm = 'aes-256-cbc';

  constructor() {
    this.encryptionKey = process.env.EVENT_STORE_ENCRYPTION_KEY!;
  }

  encryptEventData(data: any): string {
    const cipher = createCipher(this.algorithm, this.encryptionKey);
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  decryptEventData(encryptedData: string): any {
    const decipher = createDecipher(this.algorithm, this.encryptionKey);
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
  }

  calculateChecksum(event: any): string {
    const hash = createHash('sha256');
    hash.update(JSON.stringify(event));
    return hash.digest('hex');
  }

  verifyEventIntegrity(event: any, expectedChecksum: string): boolean {
    const actualChecksum = this.calculateChecksum(event);
    return actualChecksum === expectedChecksum;
  }
}
```

### Audit Logging

```typescript
@Injectable()
export class EventStoreAuditService {
  async logEventAppend(
    streamId: string,
    eventCount: number,
    userId: string,
    metadata?: any
  ): Promise<void> {
    const auditEntry = {
      timestamp: new Date(),
      action: 'APPEND_EVENTS',
      streamId,
      eventCount,
      userId,
      metadata,
    };

    // Store in audit log
    await this.storeAuditEntry(auditEntry);
  }

  async logStreamAccess(
    streamId: string,
    action: 'READ' | 'DELETE',
    userId: string
  ): Promise<void> {
    const auditEntry = {
      timestamp: new Date(),
      action,
      streamId,
      userId,
    };

    await this.storeAuditEntry(auditEntry);
  }

  private async storeAuditEntry(entry: any): Promise<void> {
    // Implementation depends on audit storage (separate database, file, etc.)
  }
}
```

## ⚡ Performance

### Optimization Strategies

```typescript
// Connection pooling
const eventStore = new PostgreSQLEventStore({
  dataSource: new DataSource({
    type: 'postgres',
    host: 'localhost',
    port: 5432,
    username: 'postgres',
    password: 'password',
    database: 'eventstore',

    // Connection pool configuration
    pool: {
      min: 5,
      max: 20,
      acquireTimeoutMillis: 30000,
      idleTimeoutMillis: 600000,
    },
  }),

  // Performance options
  enableSnapshots: true,
  snapshotFrequency: 100, // Balance between performance and storage
  enableChecksums: false, // Disable in performance-critical scenarios

  // Batch processing
  batchSize: 100,
  maxConcurrentWrites: 10,
});
```

### Caching

```typescript
class CachedEventStore implements IAdvancedEventStore {
  private metadataCache = new Map<string, IStreamMetadata>();

  constructor(
    private eventStore: IAdvancedEventStore,
    private cacheTtl: number = 300000 // 5 minutes
  ) {}

  async getStreamMetadata(streamId: string): Promise<IStreamMetadata | null> {
    // Check cache first
    const cached = this.metadataCache.get(streamId);
    if (cached && this.isCacheValid(cached)) {
      return cached;
    }

    // Load from store
    const metadata = await this.eventStore.getStreamMetadata(streamId);

    if (metadata) {
      // Cache with timestamp
      this.metadataCache.set(streamId, {
        ...metadata,
        cachedAt: new Date(),
      });
    }

    return metadata;
  }

  private isCacheValid(metadata: any): boolean {
    const now = new Date();
    const cacheTime = metadata.cachedAt;
    return now.getTime() - cacheTime.getTime() < this.cacheTtl;
  }
}
```

### Batch Processing

```typescript
class BatchEventStoreService {
  private pendingEvents = new Map<string, IStoredDomainEvent[]>();
  private flushTimer: NodeJS.Timeout | null = null;

  constructor(
    private eventStore: IAdvancedEventStore,
    private batchSize: number = 100,
    private flushInterval: number = 1000
  ) {}

  async appendToStream(
    streamId: string,
    events: IStoredDomainEvent[]
  ): Promise<void> {
    // Add to pending batch
    const pending = this.pendingEvents.get(streamId) || [];
    pending.push(...events);
    this.pendingEvents.set(streamId, pending);

    // Flush if batch size reached
    if (pending.length >= this.batchSize) {
      await this.flush(streamId);
    } else {
      // Schedule flush
      this.scheduleFlush();
    }
  }

  private async flush(streamId?: string): Promise<void> {
    if (streamId) {
      // Flush specific stream
      const events = this.pendingEvents.get(streamId);
      if (events && events.length > 0) {
        await this.eventStore.appendToStream(streamId, events);
        this.pendingEvents.delete(streamId);
      }
    } else {
      // Flush all streams
      const flushPromises = Array.from(this.pendingEvents.entries()).map(
        async ([streamId, events]) => {
          if (events.length > 0) {
            await this.eventStore.appendToStream(streamId, events);
          }
        }
      );

      await Promise.all(flushPromises);
      this.pendingEvents.clear();
    }
  }

  private scheduleFlush(): void {
    if (this.flushTimer) return;

    this.flushTimer = setTimeout(async () => {
      await this.flush();
      this.flushTimer = null;
    }, this.flushInterval);
  }
}
```

## 🧪 Testing

### Unit Testing

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { InMemoryEventStore } from '@vytches-ddd/event-store';
import { safeRun } from '@vytches-ddd/testing';

describe('EventStore', () => {
  let eventStore: InMemoryEventStore;

  beforeEach(async () => {
    eventStore = new InMemoryEventStore();
    await eventStore.connect();
  });

  afterEach(async () => {
    await eventStore.disconnect();
  });

  describe('appendToStream', () => {
    it('should append events to stream', async () => {
      const events = [
        {
          eventId: '123',
          eventType: 'OrderCreated',
          aggregateId: 'order-1',
          aggregateType: 'Order',
          aggregateVersion: 1,
          timestamp: new Date(),
          payload: { customerId: 'cust-1', total: 100 },
        },
      ];

      const [error, result] = await safeRun(async () => {
        return await eventStore.appendToStream('order-1', events);
      });

      expect(error).toBeUndefined();
      expect(result).toBeDefined();
      expect(result?.streamId).toBe('order-1');
      expect(result?.events).toBe(1);
      expect(result?.fromVersion).toBe(0);
      expect(result?.toVersion).toBe(0);
    });

    it('should handle concurrency conflicts', async () => {
      const events = [
        {
          eventId: '123',
          eventType: 'OrderCreated',
          aggregateId: 'order-1',
          aggregateType: 'Order',
          aggregateVersion: 1,
          timestamp: new Date(),
          payload: { customerId: 'cust-1', total: 100 },
        },
      ];

      // Append first event
      await eventStore.appendToStream('order-1', events);

      // Try to append with wrong expected version
      const [error] = await safeRun(async () => {
        return await eventStore.appendToStream('order-1', events, 5);
      });

      expect(error).toBeInstanceOf(EventStoreConcurrencyError);
      expect(error?.expectedVersion).toBe(5);
      expect(error?.actualVersion).toBe(0);
    });
  });

  describe('readStream', () => {
    it('should read events from stream', async () => {
      const events = [
        {
          eventId: '123',
          eventType: 'OrderCreated',
          aggregateId: 'order-1',
          aggregateType: 'Order',
          aggregateVersion: 1,
          timestamp: new Date(),
          payload: { customerId: 'cust-1', total: 100 },
        },
      ];

      await eventStore.appendToStream('order-1', events);

      const [error, stream] = await safeRun(async () => {
        return await eventStore.readStream('order-1');
      });

      expect(error).toBeUndefined();
      expect(stream).toBeDefined();
      expect(stream?.events).toHaveLength(1);
      expect(stream?.events[0]?.eventType).toBe('OrderCreated');
    });

    it('should handle stream not found', async () => {
      const [error] = await safeRun(async () => {
        return await eventStore.readStream('nonexistent');
      });

      expect(error).toBeInstanceOf(StreamNotFoundError);
    });
  });

  describe('snapshots', () => {
    it('should save and load snapshots', async () => {
      const snapshot = {
        aggregateId: 'order-1',
        aggregateType: 'Order',
        version: 10,
        timestamp: new Date(),
        state: { customerId: 'cust-1', total: 100 },
      };

      const [saveError] = await safeRun(async () => {
        return await eventStore.saveSnapshot('order-1', snapshot);
      });

      expect(saveError).toBeUndefined();

      const [loadError, loadedSnapshot] = await safeRun(async () => {
        return await eventStore.getSnapshot('order-1');
      });

      expect(loadError).toBeUndefined();
      expect(loadedSnapshot).toBeDefined();
      expect(loadedSnapshot?.version).toBe(10);
      expect(loadedSnapshot?.state).toEqual(snapshot.state);
    });
  });
});
```

### Integration Testing

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SimpleTestHarness } from '@vytches-ddd/testing';
import { InMemoryEventStore } from '@vytches-ddd/event-store';

describe('Order Integration', () => {
  let harness: SimpleTestHarness;
  let eventStore: InMemoryEventStore;
  let orderService: OrderService;

  beforeEach(async () => {
    harness = new SimpleTestHarness({
      autoCleanup: true,
      setupFn: async () => {
        eventStore = new InMemoryEventStore();
        await eventStore.connect();
        orderService = new OrderService(eventStore);
      },
    });

    await harness.initialize();
    await harness.setup();
  });

  afterEach(async () => {
    await harness.teardown();
    await harness.dispose();
  });

  it('should create and load order', async () => {
    const orderId = 'order-123';
    const customerId = 'cust-456';

    // Create order
    const [createError] = await harness.safeExecute(async () => {
      return await orderService.createOrder(orderId, customerId);
    });

    expect(createError).toBeUndefined();

    // Load order
    const [loadError, order] = await harness.safeExecute(async () => {
      return await orderService.loadOrder(orderId);
    });

    expect(loadError).toBeUndefined();
    expect(order).toBeDefined();
    expect(order?.id).toBe(orderId);
    expect(order?.customerId).toBe(customerId);

    // Verify events were stored
    const stream = await eventStore.readStream(orderId);
    expect(stream.events).toHaveLength(1);
    expect(stream.events[0]?.eventType).toBe('OrderCreated');
  });
});
```

## 🎯 Best Practices

### Event Store Design

1. **One Stream Per Aggregate**: Keep events for each aggregate in its own
   stream
2. **Consistent Stream Naming**: Use consistent naming conventions (e.g.,
   `{aggregateType}-{aggregateId}`)
3. **Event Versioning**: Include version information in events for evolution
4. **Immutable Events**: Never modify events after they're stored
5. **Rich Metadata**: Include correlation IDs, user IDs, and other contextual
   information

### Performance Optimization

1. **Use Snapshots Wisely**: Balance between performance and storage costs
2. **Batch Operations**: Group multiple operations when possible
3. **Connection Pooling**: Configure appropriate connection pool sizes
4. **Indexing Strategy**: Create indexes for common query patterns
5. **Monitoring**: Monitor event store performance and storage usage

### Error Handling

1. **Graceful Degradation**: Handle event store failures gracefully
2. **Retry Logic**: Implement exponential backoff for transient failures
3. **Circuit Breaker**: Use circuit breaker pattern for external dependencies
4. **Monitoring**: Monitor error rates and types
5. **Alerting**: Set up alerts for critical failures

### Security

1. **Encryption**: Encrypt sensitive event data
2. **Access Control**: Implement proper authentication and authorization
3. **Audit Logging**: Log all access and modifications
4. **Data Retention**: Implement proper data retention policies
5. **Compliance**: Ensure compliance with regulations (GDPR, etc.)

### Testing

1. **Unit Tests**: Test event store operations in isolation
2. **Integration Tests**: Test complete workflows with real event store
3. **Load Testing**: Test performance under load
4. **Disaster Recovery**: Test backup and recovery procedures
5. **Consistency Tests**: Test optimistic concurrency control

## 🤝 Contributing

We welcome contributions! Please see our
[Contributing Guide](../../CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone repository
git clone https://github.com/vytches/vytches-ddd.git
cd vytches-ddd

# Install dependencies
pnpm install

# Run tests
pnpm test

# Build package
pnpm build

# Run event-store-specific tests
pnpm test:packages:event-store
```

## 📄 License

This project is licensed under the MIT License - see the
[LICENSE](../../LICENSE) file for details.

---

**Part of the VytchesDDD Enterprise Suite**

For more information about the complete VytchesDDD ecosystem, visit our
[main documentation](../../README.md).
