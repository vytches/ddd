# @vytches/ddd-projections

<!-- LLM-METADATA
Package: @vytches/ddd-projections
Category: Architecture
Purpose: Event projections and read model capabilities with advanced features like snapshots, checkpoints, and rebuilding
Dependencies: @vytches/ddd-core, @vytches/ddd-events
Complexity: High
DDD Patterns: Event Projections, Read Models, CQRS, Event Sourcing, Snapshots
Integration Points: Integrates with event stores, domain events, and CQRS query handlers; essential for read model maintenance
-->

[![npm version](https://badge.fury.io/js/%40vytches%2Fddd-projections.svg)](https://badge.fury.io/js/%40vytches%2Fddd-projections)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Event projections and read model capabilities for CQRS and Event Sourcing
> applications**

Enterprise-grade event projection system for building and maintaining read
models in CQRS and Event Sourcing architectures. Provides advanced features like
snapshots, checkpoints, rebuilding, error handling, and capability-based
extensibility.

## 📋 Table of Contents

- [Installation](#installation)
- [Key Features](#key-features)
- [Core Concepts](#core-concepts)
- [Quick Start](#quick-start)
- [Projection Engine](#projection-engine)
- [Projection Builder](#projection-builder)
- [Capabilities System](#capabilities-system)
- [Checkpoints](#checkpoints)
- [Snapshots](#snapshots)
- [Rebuilding](#rebuilding)
- [Error Handling](#error-handling)
- [Advanced Usage](#advanced-usage)
- [Integration Patterns](#integration-patterns)
- [Testing](#testing)
- [Best Practices](#best-practices)
- [Contributing](#contributing)

## 🚀 Installation

```bash
# npm
npm install @vytches/ddd-projections

# yarn
yarn add @vytches/ddd-projections

# pnpm
pnpm add @vytches/ddd-projections
```

### Dependencies

```bash
# Required peer dependencies
npm install @vytches/ddd-core @vytches/ddd-events
```

## ✨ Key Features

### Event Projections

- **Read Model Generation**: Transform domain events into optimized read models
- **Event Filtering**: Process only relevant events for each projection
- **State Management**: Maintain projection state with persistence
- **Lifecycle Hooks**: Before/after event processing hooks

### Advanced Capabilities

- **Snapshots**: Create snapshots for performance optimization
- **Checkpoints**: Track processing position with checkpoint persistence
- **Circuit Breaker**: Prevent cascading failures with circuit breaker pattern
- **Dead Letter Queue**: Handle failed events with retry and dead letter storage
- **Rebuilding**: Rebuild projections from event history

### Extensibility

- **Capability System**: Extensible architecture with pluggable capabilities
- **Middleware Support**: Add custom behavior through capability system
- **Builder Pattern**: Fluent API for projection configuration
- **Type Safety**: Full TypeScript support with generic types

### Performance

- **Lazy Loading**: Load projection state only when needed
- **Batch Processing**: Process multiple events efficiently
- **Retry Logic**: Configurable retry strategies for transient failures
- **Parallel Processing**: Process independent projections concurrently

## 🎯 Core Concepts

### Projection Interface

The core interface for all projections:

```typescript
interface IProjection<TReadModel> {
  readonly name: string;
  readonly eventTypes: string[];

  createInitialState(): TReadModel | Promise<TReadModel>;
  apply(
    readModel: TReadModel,
    event: IDomainEvent
  ): TReadModel | Promise<TReadModel>;
  handles(eventType: string): boolean;
}
```

### Projection Store

For read model persistence:

```typescript
interface IProjectionStore<TReadModel> {
  load(projectionName: string): Promise<TReadModel | null>;
  save(projectionName: string, state: TReadModel): Promise<void>;
  delete(projectionName: string): Promise<void>;
  deleteAll(): Promise<void>;
  exists(projectionName: string): Promise<boolean>;
}
```

### Projection Engine

The engine that processes events:

```typescript
interface IProjectionEngine<TReadModel> {
  getProjectionName(): string;
  getEventTypes(): string[];
  processEvent(event: IDomainEvent): Promise<void>;
  isInterestedIn(event: IDomainEvent): boolean;
  getState(): Promise<TReadModel | null>;
  reset(): Promise<void>;
  addCapability<T extends Capability & IProjectionCapability>(
    capability: T
  ): this;
}
```

## 🚀 Quick Start

### Basic Projection

```typescript
import { BaseProjection, ProjectionEngine } from '@vytches/ddd-projections';

// Define read model
interface UserStatsReadModel {
  totalUsers: number;
  activeUsers: number;
  usersByStatus: { [status: string]: number };
  lastUpdated: Date;
}

// Create projection
class UserStatsProjection extends BaseProjection<UserStatsReadModel> {
  constructor() {
    super('UserStats', ['UserCreated', 'UserActivated', 'UserDeactivated']);
  }

  createInitialState(): UserStatsReadModel {
    return {
      totalUsers: 0,
      activeUsers: 0,
      usersByStatus: {},
      lastUpdated: new Date(),
    };
  }

  apply(
    readModel: UserStatsReadModel,
    event: IDomainEvent
  ): UserStatsReadModel {
    const newState = { ...readModel };

    switch (event.eventType) {
      case 'UserCreated':
        newState.totalUsers++;
        newState.usersByStatus[event.payload.status] =
          (newState.usersByStatus[event.payload.status] || 0) + 1;
        break;

      case 'UserActivated':
        newState.activeUsers++;
        break;

      case 'UserDeactivated':
        newState.activeUsers--;
        break;
    }

    newState.lastUpdated = new Date();
    return newState;
  }
}

// Create projection store
class InMemoryProjectionStore<T> implements IProjectionStore<T> {
  private store = new Map<string, T>();

  async load(projectionName: string): Promise<T | null> {
    return this.store.get(projectionName) || null;
  }

  async save(projectionName: string, state: T): Promise<void> {
    this.store.set(projectionName, state);
  }

  async delete(projectionName: string): Promise<void> {
    this.store.delete(projectionName);
  }

  async deleteAll(): Promise<void> {
    this.store.clear();
  }

  async exists(projectionName: string): Promise<boolean> {
    return this.store.has(projectionName);
  }
}

// Create and use projection engine
const projection = new UserStatsProjection();
const store = new InMemoryProjectionStore<UserStatsReadModel>();
const engine = new ProjectionEngine(projection, store);

// Process events
const userCreatedEvent = {
  eventType: 'UserCreated',
  aggregateId: 'user-123',
  payload: { name: 'John Doe', status: 'active' },
  timestamp: new Date(),
  version: 1,
};

await engine.processEvent(userCreatedEvent);

// Get current state
const currentState = await engine.getState();
console.log('Current stats:', currentState);
```

## 🔧 Projection Engine

### Basic Projection Engine

```typescript
import { ProjectionEngine } from '@vytches/ddd-projections';

// Create engine
const engine = new ProjectionEngine(projection, store);

// Process single event
await engine.processEvent(event);

// Check if projection is interested in event
if (engine.isInterestedIn(event)) {
  await engine.processEvent(event);
}

// Get current state
const state = await engine.getState();

// Reset projection
await engine.reset();
```

### Enhanced Projection Engine

```typescript
import { EnhancedProjectionEngine } from '@vytches/ddd-projections';

// Create enhanced engine with retry configuration
const retryConfig = {
  maxAttempts: 3,
  baseDelayMs: 100,
  maxDelayMs: 5000,
  backoffMultiplier: 2,
  retryableErrors: ['NetworkError', 'TimeoutError'],
  nonRetryableErrors: ['ValidationError'],
};

const enhancedEngine = new EnhancedProjectionEngine(
  projection,
  store,
  retryConfig
);

// Process events with automatic retry
try {
  await enhancedEngine.processEvent(event);
} catch (error) {
  console.error('Event processing failed after retries:', error);
}
```

### Batch Processing

```typescript
// Process multiple events
async function processEventBatch(
  engine: ProjectionEngine<any>,
  events: IDomainEvent[]
) {
  for (const event of events) {
    if (engine.isInterestedIn(event)) {
      await engine.processEvent(event);
    }
  }
}

// Process events from stream
async function processEventStream(
  engine: ProjectionEngine<any>,
  eventStream: AsyncIterable<IDomainEvent>
) {
  for await (const event of eventStream) {
    if (engine.isInterestedIn(event)) {
      await engine.processEvent(event);
    }
  }
}
```

## 🏗️ Projection Builder

### Basic Builder Usage

```typescript
import { ProjectionBuilder } from '@vytches/ddd-projections';

// Create projection engine using builder
const engine = new ProjectionBuilder(projection, store)
  .withCheckpoints(checkpointStore, { interval: 100 })
  .withSnapshots(snapshotStore, { interval: 1000, maxSnapshots: 10 })
  .build();

// Process events
await engine.processEvent(event);
```

### Advanced Builder Configuration

```typescript
import {
  ProjectionBuilder,
  CheckpointCapability,
  SnapshotProjectionCapability,
  CircuitBreakerCapability,
} from '@vytches/ddd-projections';

// Create with custom capabilities
const customCapability = new CustomLoggingCapability();
const circuitBreaker = new CircuitBreakerCapability({
  failureThreshold: 5,
  recoveryTimeoutMs: 30000,
  halfOpenMaxAttempts: 3,
});

const engine = new ProjectionBuilder(projection, store)
  .withCheckpoints(checkpointStore, {
    interval: 100,
    saveOnRebuildComplete: true,
  })
  .withSnapshots(snapshotStore, {
    interval: 1000,
    maxSnapshots: 10,
    compressState: state => JSON.stringify(state),
    decompressState: compressed => JSON.parse(compressed as string),
  })
  .withCustomCapability(customCapability)
  .withCustomCapability(circuitBreaker)
  .build();
```

## 🎛️ Capabilities System

### Checkpoint Capability

```typescript
import { CheckpointCapability } from '@vytches/ddd-projections';

// Create checkpoint store
class DatabaseCheckpointStore implements IProjectionCheckpointStore {
  async save<TState>(
    projectionName: string,
    checkpoint: Omit<IProjectionCheckpoint<TState>, 'projectionName'>
  ): Promise<void> {
    // Save checkpoint to database
    await this.database.saveCheckpoint({
      projectionName,
      ...checkpoint,
    });
  }

  async load<TState>(
    projectionName: string
  ): Promise<IProjectionCheckpoint<TState> | null> {
    // Load checkpoint from database
    const checkpoint = await this.database.loadCheckpoint(projectionName);
    return checkpoint || null;
  }

  async delete(projectionName: string): Promise<void> {
    // Delete checkpoint from database
    await this.database.deleteCheckpoint(projectionName);
  }
}

// Use checkpoint capability
const checkpointStore = new DatabaseCheckpointStore();
const checkpointCapability = new CheckpointCapability(checkpointStore, {
  interval: 100, // Save checkpoint every 100 events
  saveOnRebuildComplete: true,
});

engine.addCapability(checkpointCapability);
```

### Snapshot Capability

```typescript
import { SnapshotProjectionCapability } from '@vytches/ddd-projections';

// Create snapshot store
class DatabaseSnapshotStore implements IProjectionSnapshotStore {
  async save<TState>(
    projectionName: string,
    snapshot: Omit<IProjectionSnapshot<TState>, 'projectionName'>
  ): Promise<void> {
    // Save snapshot to database
    await this.database.saveSnapshot({
      projectionName,
      ...snapshot,
    });
  }

  async load<TState>(
    projectionName: string
  ): Promise<IProjectionSnapshot<TState> | null> {
    // Load snapshot from database
    const snapshot = await this.database.loadSnapshot(projectionName);
    return snapshot || null;
  }

  async loadLatest<TState>(
    projectionName: string
  ): Promise<IProjectionSnapshot<TState> | null> {
    // Load latest snapshot from database
    const snapshot = await this.database.loadLatestSnapshot(projectionName);
    return snapshot || null;
  }

  async delete(projectionName: string): Promise<void> {
    // Delete snapshot from database
    await this.database.deleteSnapshot(projectionName);
  }

  async deleteOlderThan(projectionName: string, date: Date): Promise<number> {
    // Delete snapshots older than date
    return await this.database.deleteSnapshotsOlderThan(projectionName, date);
  }
}

// Use snapshot capability
const snapshotStore = new DatabaseSnapshotStore();
const snapshotCapability = new SnapshotProjectionCapability(snapshotStore, {
  interval: 1000, // Create snapshot every 1000 events
  maxSnapshots: 10, // Keep maximum 10 snapshots
  compressState: state => {
    // Custom compression logic
    return JSON.stringify(state);
  },
  decompressState: compressed => {
    // Custom decompression logic
    return JSON.parse(compressed as string);
  },
});

engine.addCapability(snapshotCapability);
```

### Circuit Breaker Capability

```typescript
import { CircuitBreakerCapability } from '@vytches/ddd-projections';

// Create circuit breaker
const circuitBreaker = new CircuitBreakerCapability({
  failureThreshold: 5, // Open circuit after 5 failures
  recoveryTimeoutMs: 30000, // Try to recover after 30 seconds
  halfOpenMaxAttempts: 3, // Max 3 attempts in half-open state
});

engine.addCapability(circuitBreaker);

// Monitor circuit breaker state
const state = circuitBreaker.getState();
console.log('Circuit breaker state:', state); // CLOSED, OPEN, or HALF_OPEN
```

### Dead Letter Capability

```typescript
import { DeadLetterCapability } from '@vytches/ddd-projections';

// Create dead letter store
class DatabaseDeadLetterStore implements IDeadLetterStore {
  async store(deadLetter: IDeadLetter): Promise<void> {
    // Store failed event in dead letter queue
    await this.database.storeDeadLetter(deadLetter);
  }

  async getByProjection(projectionName: string): Promise<IDeadLetter[]> {
    // Get dead letters for projection
    return await this.database.getDeadLettersByProjection(projectionName);
  }

  async retry(deadLetterId: string): Promise<IDomainEvent> {
    // Retry dead letter event
    const deadLetter = await this.database.getDeadLetter(deadLetterId);
    return deadLetter.event;
  }

  async delete(deadLetterId: string): Promise<void> {
    // Delete dead letter
    await this.database.deleteDeadLetter(deadLetterId);
  }
}

// Use dead letter capability
const deadLetterStore = new DatabaseDeadLetterStore();
const deadLetterCapability = new DeadLetterCapability(deadLetterStore);

engine.addCapability(deadLetterCapability);
```

### Custom Capabilities

```typescript
import { BaseProjectionCapability } from '@vytches/ddd-projections';

// Create custom capability
class LoggingCapability extends BaseProjectionCapability {
  constructor(private logger: ILogger) {
    super();
  }

  async onBeforeApply(state: any, event: IDomainEvent): Promise<void> {
    this.logger.info('Processing event', {
      projection: this.getProjectionName(),
      eventType: event.eventType,
      aggregateId: event.aggregateId,
    });
  }

  async onAfterApply(state: any, event: IDomainEvent): Promise<void> {
    this.logger.info('Event processed successfully', {
      projection: this.getProjectionName(),
      eventType: event.eventType,
      aggregateId: event.aggregateId,
    });
  }

  async onError(error: Error, event?: IDomainEvent): Promise<void> {
    this.logger.error('Event processing failed', {
      projection: this.getProjectionName(),
      error: error.message,
      eventType: event?.eventType,
      aggregateId: event?.aggregateId,
    });
  }
}

// Use custom capability
const loggingCapability = new LoggingCapability(logger);
engine.addCapability(loggingCapability);
```

## 💾 Checkpoints

### Basic Checkpoint Usage

```typescript
import { CheckpointCapability } from '@vytches/ddd-projections';

// Create checkpoint store
const checkpointStore = new DatabaseCheckpointStore();

// Create projection with checkpoints
const engine = new ProjectionBuilder(projection, store)
  .withCheckpoints(checkpointStore, {
    interval: 100, // Save checkpoint every 100 events
    saveOnRebuildComplete: true,
  })
  .build();

// Process events - checkpoints are saved automatically
await engine.processEvent(event1);
await engine.processEvent(event2);
// ... checkpoint saved after 100 events
```

### Manual Checkpoint Management

```typescript
// Get checkpoint capability
const checkpointCapability = engine.getCapability(CheckpointCapability);

if (checkpointCapability) {
  // Load checkpoint
  const checkpoint = await checkpointCapability.loadCheckpoint();

  if (checkpoint) {
    console.log('Loaded checkpoint:', {
      position: checkpoint.position,
      state: checkpoint.state,
      timestamp: checkpoint.timestamp,
    });
  }

  // Save checkpoint manually
  const currentState = await engine.getState();
  await checkpointCapability.saveCheckpoint(currentState, 500);
}
```

### Checkpoint Recovery

```typescript
// Recover projection from checkpoint
async function recoverFromCheckpoint(
  engine: ProjectionEngine<any>,
  eventStream: AsyncIterable<IDomainEvent>
) {
  const checkpointCapability = engine.getCapability(CheckpointCapability);

  if (checkpointCapability) {
    const checkpoint = await checkpointCapability.loadCheckpoint();

    if (checkpoint) {
      // Restore state from checkpoint
      await engine.saveState(checkpoint.state);

      // Process events from checkpoint position
      let position = checkpoint.position;
      for await (const event of eventStream) {
        if (position >= checkpoint.position) {
          await engine.processEvent(event);
        }
        position++;
      }
    }
  }
}
```

## 📸 Snapshots

### Basic Snapshot Usage

```typescript
import { SnapshotProjectionCapability } from '@vytches/ddd-projections';

// Create snapshot store
const snapshotStore = new DatabaseSnapshotStore();

// Create projection with snapshots
const engine = new ProjectionBuilder(projection, store)
  .withSnapshots(snapshotStore, {
    interval: 1000, // Create snapshot every 1000 events
    maxSnapshots: 10, // Keep maximum 10 snapshots
    compressState: state => JSON.stringify(state),
    decompressState: compressed => JSON.parse(compressed as string),
  })
  .build();

// Process events - snapshots are created automatically
for (let i = 0; i < 2000; i++) {
  await engine.processEvent(createTestEvent(i));
}
// Snapshots created at positions 1000 and 2000
```

### Manual Snapshot Management

```typescript
// Get snapshot capability
const snapshotCapability = engine.getCapability(SnapshotProjectionCapability);

if (snapshotCapability) {
  // Create snapshot manually
  const currentState = await engine.getState();
  await snapshotCapability.createSnapshot(currentState, 1500);

  // Load latest snapshot
  const snapshot = await snapshotCapability.loadLatestSnapshot();

  if (snapshot) {
    console.log('Latest snapshot:', {
      position: snapshot.position,
      timestamp: snapshot.timestamp,
      version: snapshot.version,
    });
  }
}
```

### Snapshot Recovery

```typescript
// Recover projection from snapshot
async function recoverFromSnapshot(
  engine: ProjectionEngine<any>,
  eventStream: AsyncIterable<IDomainEvent>
) {
  const snapshotCapability = engine.getCapability(SnapshotProjectionCapability);

  if (snapshotCapability) {
    const snapshot = await snapshotCapability.loadLatestSnapshot();

    if (snapshot) {
      // Restore state from snapshot
      await engine.saveState(snapshot.state);

      // Process events from snapshot position
      let position = 0;
      for await (const event of eventStream) {
        if (position > snapshot.position) {
          await engine.processEvent(event);
        }
        position++;
      }
    }
  }
}
```

## 🔄 Rebuilding

### Basic Rebuilding

```typescript
import { ProjectionRebuilder } from '@vytches/ddd-projections';

// Create rebuilder
const rebuilder = new ProjectionRebuilder(eventStore, engine, store);

// Rebuild projection from all events
const result = await rebuilder.rebuild();

console.log('Rebuild result:', {
  totalEvents: result.totalEvents,
  processedEvents: result.processedEvents,
  errors: result.errors,
  startTime: result.startTime,
  endTime: result.endTime,
});
```

### Rebuilding with Filters

```typescript
// Rebuild with event type filter
const result = await rebuilder.rebuild({
  eventTypes: ['UserCreated', 'UserUpdated'],
  fromTimestamp: new Date('2023-01-01'),
  toTimestamp: new Date('2023-12-31'),
});

// Rebuild from specific stream
const streamResult = await rebuilder.rebuildFromStream('user-stream-123', {
  eventTypes: ['UserCreated', 'UserUpdated'],
});
```

### Rebuilding with Configuration

```typescript
// Rebuild with custom configuration
const result = await rebuilder.rebuild(
  {
    eventTypes: ['UserCreated', 'UserUpdated'],
    fromTimestamp: new Date('2023-01-01'),
  },
  {
    batchSize: 100,
    concurrency: 4,
    skipErrors: false,
    resetBeforeRebuild: true,
  }
);
```

### Projection Engine Rebuilding

```typescript
// Rebuild using projection engine
const result = await engine.rebuild(
  eventStore,
  {
    eventTypes: ['UserCreated', 'UserUpdated'],
    fromTimestamp: new Date('2023-01-01'),
  },
  {
    batchSize: 100,
    resetBeforeRebuild: true,
  }
);

// Rebuild from specific stream
const streamResult = await engine.rebuildFromStream(
  eventStore,
  'user-stream-123',
  {
    eventTypes: ['UserCreated'],
  }
);
```

## ⚠️ Error Handling

### Retry Strategies

```typescript
import { ExponentialBackoffStrategy } from '@vytches/ddd-projections';

// Create custom retry strategy
class CustomRetryStrategy implements IProjectionErrorStrategy {
  shouldRetry(
    error: Error,
    attempt: number,
    config?: IProjectionRetryConfig
  ): boolean {
    if (!config || attempt >= config.maxAttempts) {
      return false;
    }

    // Don't retry validation errors
    if (error.name === 'ValidationError') {
      return false;
    }

    // Retry network and timeout errors
    return error.name === 'NetworkError' || error.name === 'TimeoutError';
  }

  getRetryDelay(attempt: number, config: IProjectionRetryConfig): number {
    const delay =
      config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt - 1);
    return Math.min(delay, config.maxDelayMs);
  }

  isRetryableError(error: Error, config: IProjectionRetryConfig): boolean {
    return (
      config.retryableErrors.includes(error.name) ||
      !config.nonRetryableErrors.includes(error.name)
    );
  }
}

// Use custom retry strategy
const retryConfig = {
  maxAttempts: 3,
  baseDelayMs: 100,
  maxDelayMs: 5000,
  backoffMultiplier: 2,
  retryableErrors: ['NetworkError', 'TimeoutError'],
  nonRetryableErrors: ['ValidationError'],
};

const customStrategy = new CustomRetryStrategy();
const enhancedEngine = new EnhancedProjectionEngine(
  projection,
  store,
  retryConfig,
  customStrategy
);
```

### Error Handling Capabilities

```typescript
// Create error handling capability
class ErrorHandlingCapability extends BaseProjectionCapability {
  private errorCount = 0;

  async onError(error: Error, event?: IDomainEvent): Promise<void> {
    this.errorCount++;

    // Log error
    console.error('Projection error:', {
      projection: this.getProjectionName(),
      error: error.message,
      eventType: event?.eventType,
      errorCount: this.errorCount,
    });

    // Send to monitoring system
    await this.sendToMonitoring(error, event);

    // Send to dead letter queue if too many errors
    if (this.errorCount > 10) {
      await this.sendToDeadLetter(event, error);
    }
  }

  private async sendToMonitoring(
    error: Error,
    event?: IDomainEvent
  ): Promise<void> {
    // Send error to monitoring system
  }

  private async sendToDeadLetter(
    event: IDomainEvent | undefined,
    error: Error
  ): Promise<void> {
    // Send event to dead letter queue
  }
}
```

### Global Error Handling

```typescript
// Create global error handler
class GlobalProjectionErrorHandler {
  private static instance: GlobalProjectionErrorHandler;
  private errorStats = new Map<string, number>();

  static getInstance(): GlobalProjectionErrorHandler {
    if (!GlobalProjectionErrorHandler.instance) {
      GlobalProjectionErrorHandler.instance =
        new GlobalProjectionErrorHandler();
    }
    return GlobalProjectionErrorHandler.instance;
  }

  async handleError(
    projectionName: string,
    error: Error,
    event?: IDomainEvent
  ): Promise<void> {
    // Update error statistics
    const currentCount = this.errorStats.get(projectionName) || 0;
    this.errorStats.set(projectionName, currentCount + 1);

    // Log error
    console.error(`Projection ${projectionName} error:`, {
      error: error.message,
      eventType: event?.eventType,
      aggregateId: event?.aggregateId,
      totalErrors: currentCount + 1,
    });

    // Send alert if error count exceeds threshold
    if (currentCount > 5) {
      await this.sendAlert(projectionName, error, currentCount);
    }
  }

  private async sendAlert(
    projectionName: string,
    error: Error,
    errorCount: number
  ): Promise<void> {
    // Send alert to monitoring system
  }

  getErrorStats(): Map<string, number> {
    return new Map(this.errorStats);
  }
}
```

## 🔗 Integration Patterns

### CQRS Integration

```typescript
import { QueryHandler } from '@vytches/ddd-cqrs';

// Query handler using projection
@QueryHandler(GetUserStatsQuery)
class GetUserStatsQueryHandler {
  constructor(private userStatsEngine: ProjectionEngine<UserStatsReadModel>) {}

  async handle(query: GetUserStatsQuery): Promise<UserStatsReadModel> {
    const stats = await this.userStatsEngine.getState();

    if (!stats) {
      throw new Error('User stats not available');
    }

    return stats;
  }
}

// Event handler for projection updates
@DomainEventHandler(UserCreatedEvent)
class UserCreatedEventHandler {
  constructor(private userStatsEngine: ProjectionEngine<UserStatsReadModel>) {}

  async handle(event: UserCreatedEvent): Promise<void> {
    // Convert domain event to extended domain event
    const extendedEvent: IDomainEvent = {
      eventType: 'UserCreated',
      aggregateId: event.aggregateId,
      payload: event.payload,
      timestamp: event.timestamp,
      version: event.version,
    };

    await this.userStatsEngine.processEvent(extendedEvent);
  }
}
```

### Event Store Integration

```typescript
// Event store integration
class EventStoreProjectionRunner {
  constructor(
    private eventStore: IEventStore,
    private projections: ProjectionEngine<any>[]
  ) {}

  async startProjections(): Promise<void> {
    // Subscribe to event store
    await this.eventStore.subscribe(async event => {
      // Process event through all interested projections
      for (const projection of this.projections) {
        if (projection.isInterestedIn(event)) {
          try {
            await projection.processEvent(event);
          } catch (error) {
            console.error(
              `Projection ${projection.getProjectionName()} failed:`,
              error
            );
          }
        }
      }
    });
  }

  async rebuildAllProjections(): Promise<void> {
    // Rebuild all projections from event store
    for (const projection of this.projections) {
      console.log(`Rebuilding projection: ${projection.getProjectionName()}`);

      const result = await projection.rebuild(this.eventStore);

      console.log(`Rebuild completed:`, {
        projection: projection.getProjectionName(),
        totalEvents: result.totalEvents,
        processedEvents: result.processedEvents,
        errors: result.errors.length,
      });
    }
  }
}
```

### Repository Integration

```typescript
// Repository that maintains projections
class UserRepository {
  constructor(
    private baseRepository: IUserRepository,
    private userStatsEngine: ProjectionEngine<UserStatsReadModel>
  ) {}

  async save(user: User): Promise<User> {
    // Save to base repository
    const savedUser = await this.baseRepository.save(user);

    // Update projections
    const events = user.getUncommittedEvents();
    for (const event of events) {
      const extendedEvent: IDomainEvent = {
        eventType: event.eventType,
        aggregateId: event.aggregateId,
        payload: event.payload,
        timestamp: event.timestamp,
        version: event.version,
      };

      await this.userStatsEngine.processEvent(extendedEvent);
    }

    return savedUser;
  }

  async getUserStats(): Promise<UserStatsReadModel> {
    const stats = await this.userStatsEngine.getState();

    if (!stats) {
      throw new Error('User stats not available');
    }

    return stats;
  }
}
```

## 🧪 Testing

### Unit Testing Projections

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { ProjectionEngine } from '@vytches/ddd-projections';

describe('UserStatsProjection', () => {
  let projection: UserStatsProjection;
  let store: InMemoryProjectionStore<UserStatsReadModel>;
  let engine: ProjectionEngine<UserStatsReadModel>;

  beforeEach(() => {
    projection = new UserStatsProjection();
    store = new InMemoryProjectionStore<UserStatsReadModel>();
    engine = new ProjectionEngine(projection, store);
  });

  describe('event handling', () => {
    it('should handle UserCreated event', async () => {
      const event: IDomainEvent = {
        eventType: 'UserCreated',
        aggregateId: 'user-123',
        payload: { name: 'John Doe', status: 'active' },
        timestamp: new Date(),
        version: 1,
      };

      await engine.processEvent(event);

      const state = await engine.getState();
      expect(state?.totalUsers).toBe(1);
      expect(state?.usersByStatus.active).toBe(1);
    });

    it('should handle UserActivated event', async () => {
      // Initialize with a user
      await engine.processEvent({
        eventType: 'UserCreated',
        aggregateId: 'user-123',
        payload: { name: 'John Doe', status: 'inactive' },
        timestamp: new Date(),
        version: 1,
      });

      const activatedEvent: IDomainEvent = {
        eventType: 'UserActivated',
        aggregateId: 'user-123',
        payload: { userId: 'user-123' },
        timestamp: new Date(),
        version: 2,
      };

      await engine.processEvent(activatedEvent);

      const state = await engine.getState();
      expect(state?.activeUsers).toBe(1);
    });
  });

  describe('projection lifecycle', () => {
    it('should create initial state', async () => {
      const state = await engine.getState();

      expect(state).toBeDefined();
      expect(state?.totalUsers).toBe(0);
      expect(state?.activeUsers).toBe(0);
      expect(state?.usersByStatus).toEqual({});
    });

    it('should reset projection', async () => {
      // Process some events
      await engine.processEvent({
        eventType: 'UserCreated',
        aggregateId: 'user-123',
        payload: { name: 'John Doe', status: 'active' },
        timestamp: new Date(),
        version: 1,
      });

      let state = await engine.getState();
      expect(state?.totalUsers).toBe(1);

      // Reset projection
      await engine.reset();

      state = await engine.getState();
      expect(state?.totalUsers).toBe(0);
    });
  });
});
```

### Integration Testing

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SimpleTestHarness } from '@vytches/ddd-testing';

describe('Projection Integration', () => {
  let harness: SimpleTestHarness;
  let engine: ProjectionEngine<UserStatsReadModel>;
  let eventStore: IEventStore;

  beforeEach(async () => {
    harness = new SimpleTestHarness({
      autoCleanup: true,
      setupFn: async () => {
        // Setup test infrastructure
        eventStore = new InMemoryEventStore();
        const projection = new UserStatsProjection();
        const store = new InMemoryProjectionStore<UserStatsReadModel>();
        engine = new ProjectionEngine(projection, store);
      },
    });

    await harness.initialize();
    await harness.setup();
  });

  afterEach(async () => {
    await harness.teardown();
    await harness.dispose();
  });

  it('should rebuild projection from event store', async () => {
    // Store events in event store
    const events = [
      {
        eventType: 'UserCreated',
        aggregateId: 'user-1',
        payload: { status: 'active' },
      },
      {
        eventType: 'UserCreated',
        aggregateId: 'user-2',
        payload: { status: 'inactive' },
      },
      {
        eventType: 'UserActivated',
        aggregateId: 'user-2',
        payload: { userId: 'user-2' },
      },
    ];

    for (const event of events) {
      await eventStore.append('user-stream', [event]);
    }

    // Rebuild projection
    const result = await engine.rebuild(eventStore);

    expect(result.totalEvents).toBe(3);
    expect(result.processedEvents).toBe(3);
    expect(result.errors).toHaveLength(0);

    const state = await engine.getState();
    expect(state?.totalUsers).toBe(2);
    expect(state?.activeUsers).toBe(1);
  });

  it('should handle checkpoint recovery', async () => {
    const checkpointStore = new InMemoryCheckpointStore();
    const enhancedEngine = new ProjectionBuilder(
      new UserStatsProjection(),
      new InMemoryProjectionStore<UserStatsReadModel>()
    )
      .withCheckpoints(checkpointStore, { interval: 2 })
      .build();

    // Process events
    const events = [
      {
        eventType: 'UserCreated',
        aggregateId: 'user-1',
        payload: { status: 'active' },
      },
      {
        eventType: 'UserCreated',
        aggregateId: 'user-2',
        payload: { status: 'active' },
      },
      {
        eventType: 'UserCreated',
        aggregateId: 'user-3',
        payload: { status: 'active' },
      },
    ];

    for (const event of events) {
      await enhancedEngine.processEvent(event);
    }

    // Verify checkpoint was created
    const checkpointCapability =
      enhancedEngine.getCapability(CheckpointCapability);
    const checkpoint = await checkpointCapability?.loadCheckpoint();

    expect(checkpoint).toBeDefined();
    expect(checkpoint?.position).toBe(2);
    expect(checkpoint?.state.totalUsers).toBe(2);
  });
});
```

### Testing Capabilities

```typescript
describe('Projection Capabilities', () => {
  it('should create snapshots at intervals', async () => {
    const snapshotStore = new InMemorySnapshotStore();
    const engine = new ProjectionBuilder(
      new UserStatsProjection(),
      new InMemoryProjectionStore<UserStatsReadModel>()
    )
      .withSnapshots(snapshotStore, { interval: 3 })
      .build();

    // Process events
    for (let i = 0; i < 5; i++) {
      await engine.processEvent({
        eventType: 'UserCreated',
        aggregateId: `user-${i}`,
        payload: { name: `User ${i}`, status: 'active' },
        timestamp: new Date(),
        version: 1,
      });
    }

    // Verify snapshot was created
    const snapshotCapability = engine.getCapability(
      SnapshotProjectionCapability
    );
    const snapshot = await snapshotCapability?.loadLatestSnapshot();

    expect(snapshot).toBeDefined();
    expect(snapshot?.position).toBe(3);
    expect(snapshot?.state.totalUsers).toBe(3);
  });

  it('should handle circuit breaker', async () => {
    const circuitBreaker = new CircuitBreakerCapability({
      failureThreshold: 2,
      recoveryTimeoutMs: 1000,
      halfOpenMaxAttempts: 1,
    });

    const engine = new ProjectionBuilder(
      new FaultyProjection(), // Projection that always fails
      new InMemoryProjectionStore<any>()
    )
      .withCustomCapability(circuitBreaker)
      .build();

    // Process events that will fail
    for (let i = 0; i < 3; i++) {
      try {
        await engine.processEvent({
          eventType: 'TestEvent',
          aggregateId: `test-${i}`,
          payload: {},
          timestamp: new Date(),
          version: 1,
        });
      } catch (error) {
        // Expected to fail
      }
    }

    // Circuit should be open
    expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
  });
});
```

## 🎯 Best Practices

### Projection Design

1. **Single Responsibility**: Each projection should have a single, well-defined
   purpose
2. **Immutable Updates**: Always create new state objects rather than mutating
   existing ones
3. **Event Filtering**: Only process events that are relevant to the projection
4. **Error Handling**: Implement proper error handling and recovery mechanisms
5. **Performance**: Use snapshots and checkpoints for large projections

### State Management

1. **Initial State**: Always provide a meaningful initial state
2. **State Validation**: Validate state before saving
3. **Backward Compatibility**: Design state structures to be backward compatible
4. **Compression**: Use compression for large state objects
5. **Serialization**: Use efficient serialization formats

### Capability Usage

1. **Appropriate Intervals**: Choose appropriate intervals for checkpoints and
   snapshots
2. **Error Strategies**: Implement appropriate retry strategies for your use
   case
3. **Circuit Breaker**: Use circuit breaker for external dependencies
4. **Dead Letter**: Implement dead letter handling for failed events
5. **Monitoring**: Add monitoring capabilities for observability

### Performance Optimization

1. **Batch Processing**: Process events in batches when possible
2. **Parallel Processing**: Use parallel processing for independent projections
3. **Memory Management**: Monitor memory usage for large projections
4. **Database Optimization**: Optimize database queries for projection stores
5. **Caching**: Implement caching for frequently accessed projections

## 🤝 Contributing

We welcome contributions! Please see our
[Contributing Guide](../../CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone repository
git clone https://github.com/vytches/ddd.git
cd ddd

# Install dependencies
pnpm install

# Run tests
pnpm test

# Build package
pnpm build

# Run projections-specific tests
pnpm test:packages:projections
```

## 📄 License

This project is licensed under the MIT License - see the
[LICENSE](../../LICENSE) file for details.

---

**Part of the VytchesDDD Enterprise Suite**

For more information about the complete VytchesDDD ecosystem, visit our
[main documentation](../../README.md).
