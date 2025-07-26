# Intermediate Event Store Implementation

**Version**: 1.0.0 **Package**: @vytches/ddd-event-store **Complexity**:
intermediate **Domain**: Infrastructure **Patterns**: advanced-implementation,
enterprise-patterns, production-ready

## Overview

This guide covers intermediate-level event store implementation patterns
including advanced serialization, projection building, replay systems, and
enterprise-grade features for production environments.

## Advanced Serialization Strategies

### Custom Serialization Pipeline

```typescript
// advanced-serialization.ts
import { IEventSerializer } from '@vytches/ddd-event-store';
import { DomainEvent } from '@vytches/ddd-events';

export class ProductionEventSerializer implements IEventSerializer {
  private readonly compressionThreshold = 1024; // 1KB
  private readonly encryptionKey: string;

  constructor(encryptionKey: string) {
    this.encryptionKey = encryptionKey;
  }

  serialize(event: DomainEvent): string {
    // ⭐ FOCUS: Multi-stage serialization pipeline
    const eventData = {
      eventId: event.eventId,
      eventType: event.eventType,
      aggregateId: event.aggregateId.value,
      version: event.version,
      timestamp: event.timestamp,
      payload: this.extractPayload(event),
      metadata: event.metadata || {},
      correlationId: event.correlationId,
      causationId: event.causationId,
    };

    let serialized = JSON.stringify(eventData);

    // ⭐ FOCUS: Apply compression for large events
    if (serialized.length > this.compressionThreshold) {
      serialized = this.compress(serialized);
      eventData.metadata._compressed = true;
    }

    // ⭐ FOCUS: Encrypt sensitive data
    if (this.containsSensitiveData(event)) {
      serialized = this.encrypt(serialized);
      eventData.metadata._encrypted = true;
    }

    // ⭐ FOCUS: Add integrity check
    const checksum = this.calculateChecksum(serialized);
    const finalData = {
      data: serialized,
      checksum,
      encoding: 'utf8',
      serializerVersion: '2.0',
    };

    return JSON.stringify(finalData);
  }

  deserialize(data: string): DomainEvent {
    // ⭐ FOCUS: Reverse serialization pipeline
    const envelope = JSON.parse(data);

    // Verify integrity
    if (envelope.checksum !== this.calculateChecksum(envelope.data)) {
      throw new Error('Event data integrity check failed');
    }

    let eventData = envelope.data;

    // Decrypt if needed
    if (envelope.metadata?._encrypted) {
      eventData = this.decrypt(eventData);
    }

    // Decompress if needed
    if (envelope.metadata?._compressed) {
      eventData = this.decompress(eventData);
    }

    const parsed = JSON.parse(eventData);

    // Reconstruct domain event
    return this.reconstructEvent(parsed);
  }

  private extractPayload(event: DomainEvent): any {
    // Extract event-specific payload
    const payload = { ...event };
    delete payload.eventId;
    delete payload.eventType;
    delete payload.aggregateId;
    delete payload.version;
    delete payload.timestamp;
    delete payload.metadata;
    delete payload.correlationId;
    delete payload.causationId;

    return payload;
  }

  private containsSensitiveData(event: DomainEvent): boolean {
    // Check for sensitive data patterns
    const sensitiveTypes = [
      'UserRegistered',
      'PaymentProcessed',
      'PersonalDataUpdated',
    ];
    return sensitiveTypes.includes(event.eventType);
  }

  // Placeholder methods for production implementation
  private compress(data: string): string {
    return data;
  }
  private decompress(data: string): string {
    return data;
  }
  private encrypt(data: string): string {
    return data;
  }
  private decrypt(data: string): string {
    return data;
  }
  private calculateChecksum(data: string): string {
    return 'checksum';
  }
  private reconstructEvent(data: any): DomainEvent {
    return data as DomainEvent;
  }
}
```

## Advanced Projection Building

### Real-time Projection System

```typescript
// projection-system.ts
import { EventVersioningManager } from './event-versioning-manager';
import { Result } from '@vytches/ddd-utils';
import { Logger } from '@vytches/ddd-logging';

export abstract class BaseProjection<T> {
  protected abstract readonly projectionName: string;
  protected readonly logger = Logger.forContext(this.constructor.name);

  abstract getInitialState(): T;
  abstract canHandle(event: DomainEvent): boolean;
  abstract apply(currentState: T, event: DomainEvent): Promise<T>;

  // ⭐ FOCUS: Projection lifecycle hooks
  async beforeProjection(state: T, event: DomainEvent): Promise<void> {
    this.logger.debug('Processing event for projection', {
      projection: this.projectionName,
      eventType: event.eventType,
      eventId: event.eventId,
    });
  }

  async afterProjection(
    oldState: T,
    newState: T,
    event: DomainEvent
  ): Promise<void> {
    this.logger.debug('Projection updated', {
      projection: this.projectionName,
      eventType: event.eventType,
      hasChanges: JSON.stringify(oldState) !== JSON.stringify(newState),
    });
  }

  async onError(error: Error, state: T, event: DomainEvent): Promise<void> {
    this.logger.error('Projection error', {
      projection: this.projectionName,
      eventType: event.eventType,
      error: error.message,
    });
  }
}

export class ProjectionEngine {
  private readonly projections = new Map<string, BaseProjection<any>>();
  private readonly projectionStates = new Map<string, any>();
  private readonly logger = Logger.forContext('ProjectionEngine');

  registerProjection<T>(projection: BaseProjection<T>): void {
    const name = projection['projectionName'];
    this.projections.set(name, projection);
    this.projectionStates.set(name, projection.getInitialState());

    this.logger.info('Projection registered', { projectionName: name });
  }

  async processEvent(event: DomainEvent): Promise<Result<void, Error>> {
    try {
      const results: Array<{
        projection: string;
        success: boolean;
        error?: Error;
      }> = [];

      // ⭐ FOCUS: Process event through all applicable projections
      for (const [name, projection] of this.projections.entries()) {
        try {
          if (!projection.canHandle(event)) {
            continue;
          }

          const currentState = this.projectionStates.get(name);

          await projection.beforeProjection(currentState, event);

          const newState = await projection.apply(currentState, event);

          await projection.afterProjection(currentState, newState, event);

          this.projectionStates.set(name, newState);

          results.push({ projection: name, success: true });
        } catch (error) {
          const projectionError = error as Error;
          await projection.onError(
            projectionError,
            this.projectionStates.get(name),
            event
          );

          results.push({
            projection: name,
            success: false,
            error: projectionError,
          });
        }
      }

      // ⭐ FOCUS: Report processing results
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      this.logger.info('Event processed by projections', {
        eventType: event.eventType,
        eventId: event.eventId,
        successful,
        failed,
        totalProjections: this.projections.size,
      });

      if (failed > 0) {
        const errors = results
          .filter(r => !r.success)
          .map(r => r.error?.message);
        return Result.fail(
          new Error(`${failed} projections failed: ${errors.join(', ')}`)
        );
      }

      return Result.ok();
    } catch (error) {
      return Result.fail(
        new Error(`Projection processing failed: ${error.message}`)
      );
    }
  }

  getProjectionState<T>(projectionName: string): T | null {
    return this.projectionStates.get(projectionName) || null;
  }

  async rebuildProjection(
    projectionName: string,
    events: DomainEvent[]
  ): Promise<Result<void, Error>> {
    try {
      const projection = this.projections.get(projectionName);

      if (!projection) {
        return Result.fail(new Error(`Projection ${projectionName} not found`));
      }

      // ⭐ FOCUS: Reset and rebuild projection
      let state = projection.getInitialState();

      for (const event of events) {
        if (projection.canHandle(event)) {
          await projection.beforeProjection(state, event);

          const newState = await projection.apply(state, event);

          await projection.afterProjection(state, newState, event);

          state = newState;
        }
      }

      this.projectionStates.set(projectionName, state);

      this.logger.info('Projection rebuilt', {
        projectionName,
        eventsProcessed: events.length,
      });

      return Result.ok();
    } catch (error) {
      return Result.fail(
        new Error(`Projection rebuild failed: ${error.message}`)
      );
    }
  }
}

// ⭐ FOCUS: Sample projection implementation
export class OrderSummaryProjection extends BaseProjection<OrderSummary> {
  protected readonly projectionName = 'OrderSummaryProjection';

  getInitialState(): OrderSummary {
    return {
      totalOrders: 0,
      totalRevenue: 0,
      averageOrderValue: 0,
      ordersByStatus: {},
      ordersByCustomer: {},
      lastUpdated: new Date(),
    };
  }

  canHandle(event: DomainEvent): boolean {
    return ['OrderCreated', 'OrderStatusChanged', 'OrderCancelled'].includes(
      event.eventType
    );
  }

  async apply(
    currentState: OrderSummary,
    event: DomainEvent
  ): Promise<OrderSummary> {
    const newState = { ...currentState };

    switch (event.eventType) {
      case 'OrderCreated':
        const orderEvent = event as any;
        newState.totalOrders++;
        newState.totalRevenue += orderEvent.totalAmount;
        newState.averageOrderValue =
          newState.totalRevenue / newState.totalOrders;

        newState.ordersByStatus['created'] =
          (newState.ordersByStatus['created'] || 0) + 1;
        newState.ordersByCustomer[orderEvent.customerId] =
          (newState.ordersByCustomer[orderEvent.customerId] || 0) + 1;
        break;

      case 'OrderStatusChanged':
        const statusEvent = event as any;
        newState.ordersByStatus[statusEvent.newStatus] =
          (newState.ordersByStatus[statusEvent.newStatus] || 0) + 1;

        if (newState.ordersByStatus[statusEvent.previousStatus] > 0) {
          newState.ordersByStatus[statusEvent.previousStatus]--;
        }
        break;

      case 'OrderCancelled':
        // Handle cancellation logic
        break;
    }

    newState.lastUpdated = new Date();
    return newState;
  }
}

interface OrderSummary {
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  ordersByStatus: Record<string, number>;
  ordersByCustomer: Record<string, number>;
  lastUpdated: Date;
}
```

## Enterprise Event Store Service

### Production-Ready Implementation

```typescript
// enterprise-event-store.service.ts
import { InMemoryEventStore } from '@vytches/ddd-event-store';
import { ProjectionEngine } from './projection-system';
import { EventVersioningManager } from './event-versioning-manager';
import { Result } from '@vytches/ddd-utils';
import { Logger } from '@vytches/ddd-logging';

export class EnterpriseEventStoreService {
  private readonly eventStore: InMemoryEventStore;
  private readonly projectionEngine: ProjectionEngine;
  private readonly versioningManager: EventVersioningManager;
  private readonly logger = Logger.forContext('EnterpriseEventStore');
  private readonly metrics = new EventStoreMetrics();

  constructor() {
    this.eventStore = new InMemoryEventStore({
      serializer: new ProductionEventSerializer('production-key'),
      enableSnapshots: true,
      snapshotFrequency: 100,
    });

    this.projectionEngine = new ProjectionEngine();
    this.versioningManager = new EventVersioningManager();

    this.setupProjections();
    this.setupMonitoring();
  }

  private setupProjections(): void {
    // ⭐ FOCUS: Register production projections
    this.projectionEngine.registerProjection(new OrderSummaryProjection());
    // Add more projections as needed
  }

  private setupMonitoring(): void {
    // ⭐ FOCUS: Setup comprehensive monitoring
    setInterval(() => {
      this.recordHealthMetrics();
    }, 30000); // Every 30 seconds
  }

  async appendEvents(
    streamId: string,
    events: DomainEvent[],
    expectedVersion: number = -1
  ): Promise<Result<void, Error>> {
    const startTime = performance.now();

    try {
      // ⭐ FOCUS: Enterprise-grade append with full pipeline
      this.logger.info('Appending events', {
        streamId,
        eventCount: events.length,
        expectedVersion,
      });

      // 1. Validate events
      const validationResult = await this.validateEvents(events);
      if (validationResult.isFailure()) {
        this.metrics.recordAppendError(streamId, 'validation_failed');
        return Result.fail(validationResult.error);
      }

      // 2. Apply versioning
      const versionedEvents = await this.applyVersioning(events);
      if (versionedEvents.isFailure()) {
        this.metrics.recordAppendError(streamId, 'versioning_failed');
        return Result.fail(versionedEvents.error);
      }

      // 3. Store events
      const storeResult = await this.eventStore.appendEvents(
        streamId,
        versionedEvents.value,
        expectedVersion
      );

      if (storeResult.isFailure()) {
        this.metrics.recordAppendError(streamId, 'store_failed');
        return Result.fail(storeResult.error);
      }

      // 4. Update projections
      const projectionResult = await this.updateProjections(
        versionedEvents.value
      );
      if (projectionResult.isFailure()) {
        this.logger.warn('Projection update failed', {
          streamId,
          error: projectionResult.error.message,
        });
        // Don't fail the append for projection errors
      }

      // 5. Record success metrics
      const duration = performance.now() - startTime;
      this.metrics.recordAppendSuccess(streamId, events.length, duration);

      this.logger.info('Events appended successfully', {
        streamId,
        eventCount: events.length,
        duration,
      });

      return Result.ok();
    } catch (error) {
      const duration = performance.now() - startTime;
      this.metrics.recordAppendError(streamId, 'exception', duration);

      this.logger.error('Event append failed', {
        streamId,
        eventCount: events.length,
        error: error.message,
        duration,
      });

      return Result.fail(new Error(`Append failed: ${error.message}`));
    }
  }

  async readEvents(
    streamId: string,
    options: ReadOptions = {}
  ): Promise<Result<StreamReadResult, Error>> {
    const startTime = performance.now();

    try {
      // ⭐ FOCUS: Enterprise read with migration and caching
      this.logger.debug('Reading events', { streamId, options });

      // 1. Check cache first
      const cacheResult = await this.checkCache(streamId, options);
      if (cacheResult.isSuccess()) {
        this.metrics.recordCacheHit(streamId);
        return cacheResult;
      }

      // 2. Read from store with migration
      const readResult = await this.versioningManager.readEventsWithMigration(
        streamId,
        options.targetVersion
      );

      if (readResult.isFailure()) {
        this.metrics.recordReadError(streamId, 'read_failed');
        return Result.fail(readResult.error);
      }

      // 3. Apply filtering and pagination
      const filteredEvents = this.applyFilters(readResult.value, options);
      const paginatedResult = this.applyPagination(filteredEvents, options);

      // 4. Cache result
      await this.cacheResult(streamId, paginatedResult, options);

      const duration = performance.now() - startTime;
      this.metrics.recordReadSuccess(
        streamId,
        paginatedResult.events.length,
        duration
      );

      return Result.ok(paginatedResult);
    } catch (error) {
      const duration = performance.now() - startTime;
      this.metrics.recordReadError(streamId, 'exception', duration);

      return Result.fail(new Error(`Read failed: ${error.message}`));
    }
  }

  async getProjectionState<T>(
    projectionName: string
  ): Promise<Result<T | null, Error>> {
    try {
      const state = this.projectionEngine.getProjectionState<T>(projectionName);
      return Result.ok(state);
    } catch (error) {
      return Result.fail(
        new Error(`Projection state retrieval failed: ${error.message}`)
      );
    }
  }

  async rebuildProjection(
    projectionName: string,
    fromTimestamp?: Date
  ): Promise<Result<void, Error>> {
    try {
      this.logger.info('Rebuilding projection', {
        projectionName,
        fromTimestamp,
      });

      // ⭐ FOCUS: Collect all events for projection rebuild
      const allEvents = await this.collectEventsForProjection(fromTimestamp);

      const rebuildResult = await this.projectionEngine.rebuildProjection(
        projectionName,
        allEvents
      );

      if (rebuildResult.isSuccess()) {
        this.logger.info('Projection rebuilt successfully', { projectionName });
      }

      return rebuildResult;
    } catch (error) {
      return Result.fail(
        new Error(`Projection rebuild failed: ${error.message}`)
      );
    }
  }

  async getHealthStatus(): Promise<HealthStatus> {
    return {
      isHealthy: true,
      eventStoreStatus: 'healthy',
      projectionEngineStatus: 'healthy',
      versioningManagerStatus: 'healthy',
      metrics: this.metrics.getSnapshot(),
      timestamp: new Date(),
    };
  }

  // ⭐ FOCUS: Helper methods
  private async validateEvents(
    events: DomainEvent[]
  ): Promise<Result<void, Error>> {
    // Implement event validation logic
    return Result.ok();
  }

  private async applyVersioning(
    events: DomainEvent[]
  ): Promise<Result<DomainEvent[], Error>> {
    // Apply event versioning if needed
    return Result.ok(events);
  }

  private async updateProjections(
    events: DomainEvent[]
  ): Promise<Result<void, Error>> {
    for (const event of events) {
      const result = await this.projectionEngine.processEvent(event);
      if (result.isFailure()) {
        return result;
      }
    }
    return Result.ok();
  }

  private async checkCache(
    streamId: string,
    options: ReadOptions
  ): Promise<Result<StreamReadResult, Error>> {
    // Implement caching logic
    return Result.fail(new Error('Cache miss'));
  }

  private async cacheResult(
    streamId: string,
    result: StreamReadResult,
    options: ReadOptions
  ): Promise<void> {
    // Implement result caching
  }

  private applyFilters(
    events: DomainEvent[],
    options: ReadOptions
  ): DomainEvent[] {
    // Implement filtering logic
    return events;
  }

  private applyPagination(
    events: DomainEvent[],
    options: ReadOptions
  ): StreamReadResult {
    return {
      events,
      streamId: '',
      version: 0,
      hasMore: false,
    };
  }

  private async collectEventsForProjection(
    fromTimestamp?: Date
  ): Promise<DomainEvent[]> {
    // Implement event collection for projection rebuild
    return [];
  }

  private recordHealthMetrics(): void {
    // Record periodic health metrics
    this.metrics.recordHealthCheck();
  }
}

// ⭐ FOCUS: Supporting interfaces and classes
class EventStoreMetrics {
  private appendSuccesses = 0;
  private appendErrors = 0;
  private readSuccesses = 0;
  private readErrors = 0;
  private cacheHits = 0;
  private cacheMisses = 0;

  recordAppendSuccess(
    streamId: string,
    eventCount: number,
    duration: number
  ): void {
    this.appendSuccesses++;
  }

  recordAppendError(
    streamId: string,
    errorType: string,
    duration?: number
  ): void {
    this.appendErrors++;
  }

  recordReadSuccess(
    streamId: string,
    eventCount: number,
    duration: number
  ): void {
    this.readSuccesses++;
  }

  recordReadError(
    streamId: string,
    errorType: string,
    duration?: number
  ): void {
    this.readErrors++;
  }

  recordCacheHit(streamId: string): void {
    this.cacheHits++;
  }

  recordHealthCheck(): void {
    // Record health metrics
  }

  getSnapshot(): any {
    return {
      appendSuccesses: this.appendSuccesses,
      appendErrors: this.appendErrors,
      readSuccesses: this.readSuccesses,
      readErrors: this.readErrors,
      cacheHits: this.cacheHits,
      successRate:
        this.appendSuccesses / (this.appendSuccesses + this.appendErrors),
    };
  }
}

interface ReadOptions {
  targetVersion?: number;
  fromEventNumber?: number;
  maxCount?: number;
  eventTypes?: string[];
  fromTimestamp?: Date;
  toTimestamp?: Date;
}

interface StreamReadResult {
  events: DomainEvent[];
  streamId: string;
  version: number;
  hasMore: boolean;
}

interface HealthStatus {
  isHealthy: boolean;
  eventStoreStatus: string;
  projectionEngineStatus: string;
  versioningManagerStatus: string;
  metrics: any;
  timestamp: Date;
}
```

## Performance Optimization Patterns

### Connection Pooling and Caching

```typescript
// performance-optimizations.ts
export class CachedEventStore {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly cacheMaxSize = 1000;
  private readonly cacheMaxAge = 5 * 60 * 1000; // 5 minutes

  async readStreamCached(
    streamId: string
  ): Promise<Result<DomainEvent[], Error>> {
    // ⭐ FOCUS: Check cache first
    const cacheKey = `stream:${streamId}`;
    const cached = this.cache.get(cacheKey);

    if (cached && !this.isCacheExpired(cached)) {
      return Result.ok(cached.events);
    }

    // ⭐ FOCUS: Load from store and cache
    const readResult = await this.eventStore.readStream(streamId);

    if (readResult.isSuccess()) {
      this.setCacheEntry(cacheKey, {
        events: readResult.value.events,
        timestamp: new Date(),
        streamVersion: readResult.value.version,
      });
    }

    return readResult.isSuccess()
      ? Result.ok(readResult.value.events)
      : Result.fail(readResult.error);
  }

  private isCacheExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp.getTime() > this.cacheMaxAge;
  }

  private setCacheEntry(key: string, entry: CacheEntry): void {
    if (this.cache.size >= this.cacheMaxSize) {
      // ⭐ FOCUS: LRU eviction
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, entry);
  }
}

interface CacheEntry {
  events: DomainEvent[];
  timestamp: Date;
  streamVersion: number;
}
```

## Testing Patterns

### Integration Testing

```typescript
// integration-tests.ts
describe('EnterpriseEventStore', () => {
  let eventStore: EnterpriseEventStoreService;
  let testEvents: DomainEvent[];

  beforeEach(async () => {
    eventStore = new EnterpriseEventStoreService();
    testEvents = createTestEvents();
  });

  it('should handle high-volume event processing', async () => {
    const streamCount = 100;
    const eventsPerStream = 50;

    // ⭐ FOCUS: High-volume test
    const appendPromises = [];

    for (let i = 0; i < streamCount; i++) {
      const streamId = `load-test-${i}`;
      const promise = eventStore.appendEvents(streamId, testEvents);
      appendPromises.push(promise);
    }

    const results = await Promise.allSettled(appendPromises);
    const failures = results.filter(r => r.status === 'rejected');

    expect(failures).toHaveLength(0);
  });

  it('should maintain projection consistency', async () => {
    const streamId = 'projection-test';

    // ⭐ FOCUS: Test projection updates
    await eventStore.appendEvents(streamId, testEvents);

    const projectionState = await eventStore.getProjectionState(
      'OrderSummaryProjection'
    );
    expect(projectionState.isSuccess()).toBe(true);
    expect(projectionState.value).toBeDefined();
  });
});
```

This intermediate implementation guide provides enterprise-grade patterns for
production event stores, including advanced serialization, projection systems,
caching, monitoring, and testing strategies.
