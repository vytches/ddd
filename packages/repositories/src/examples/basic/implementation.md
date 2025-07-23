# Basic Repository Implementation Patterns

This document provides comprehensive guidance on implementing repository
patterns using the @vytches-ddd/repositories package, focusing on foundation
patterns and best practices.

## Core Repository Patterns

### 1. Generic Repository Pattern

The generic repository provides standard CRUD operations with type safety and
consistent interface patterns.

#### Implementation Structure

```typescript
import { BaseRepository, IRepository } from '@vytches-ddd/repositories';
import { EntityId, Result } from '@vytches-ddd/domain-primitives';

export class GenericRepository<T extends { id: string }>
  extends BaseRepository<T>
  implements IRepository<T>
{
  constructor(tableName: string) {
    super(tableName);
  }

  // ✅ FOCUS: Type-safe CRUD operations
  async create(entity: T): Promise<T> {
    // Validation before persistence
    this.validateEntity(entity);

    // Use library create method
    return await super.create(entity);
  }

  async update(id: EntityId, updates: Partial<T>): Promise<T | null> {
    // Optimistic locking check
    const current = await this.findById(id);
    if (!current) return null;

    // Merge updates with timestamp
    const updatedEntity = {
      ...updates,
      updatedAt: new Date(),
      version: (current as any).version + 1,
    };

    return await super.update(id, updatedEntity);
  }

  async delete(id: EntityId): Promise<boolean> {
    // Soft delete implementation
    const result = await super.update(id, {
      isDeleted: true,
      deletedAt: new Date(),
    } as any);

    return result !== null;
  }

  // ✅ FOCUS: Query optimization
  async findWithPagination(
    queryOptions: QueryOptions,
    page: number = 1,
    limit: number = 50
  ): Promise<PaginationResult<T>> {
    const offset = (page - 1) * limit;
    const enhancedOptions = {
      ...queryOptions,
      limit,
      offset,
    };

    const [data, total] = await Promise.all([
      this.find(enhancedOptions),
      this.count(queryOptions),
    ]);

    return createPaginationResult(data, total, page, limit);
  }

  // Validation helper
  protected validateEntity(entity: T): void {
    if (!entity.id) {
      throw new Error('Entity ID is required');
    }

    // Additional validation can be overridden in subclasses
    this.performCustomValidation(entity);
  }

  protected performCustomValidation(entity: T): void {
    // Override in subclasses for specific validation
  }
}
```

#### Usage Guidelines

1. **Entity Requirements**: Entities must have `id`, `createdAt`, `updatedAt`,
   and `version` fields
2. **Validation**: Always validate entities before persistence
3. **Soft Deletes**: Prefer soft deletion for audit trail preservation
4. **Optimistic Locking**: Use version fields for concurrency control

---

### 2. Event-Sourced Repository Pattern

Event sourcing provides immutable audit trails and enables temporal queries by
persisting domain events.

#### Implementation Structure

```typescript
import { EventSourcedRepository, IEventStore } from '@vytches-ddd/repositories';
import { DomainEvent, EntityId } from '@vytches-ddd/domain-primitives';

export class EventSourcedRepositoryBase<T> extends EventSourcedRepository<T> {
  constructor(aggregateType: string, eventStore?: IEventStore) {
    super(aggregateType, eventStore);
  }

  // ✅ FOCUS: Event persistence with optimistic locking
  async saveAggregate(aggregate: T, expectedVersion: number): Promise<void> {
    const events = this.extractEventsFromAggregate(aggregate);
    const aggregateId = this.getAggregateId(aggregate);

    try {
      // Use library saveEvents with version check
      await this.saveEvents(aggregateId, events, expectedVersion);

      // Clear events after successful save
      this.clearAggregateEvents(aggregate);
    } catch (error) {
      if (error.message.includes('version conflict')) {
        throw new Error('Concurrent modification detected. Please retry.');
      }
      throw error;
    }
  }

  // ✅ FOCUS: Aggregate reconstruction
  async getAggregate(id: EntityId): Promise<T | null> {
    const eventStream = await this.getEventStream(id);
    if (!eventStream || eventStream.events.length === 0) {
      return null;
    }

    // Reconstruct aggregate from events
    return this.reconstructFromEvents(eventStream.events);
  }

  // ✅ FOCUS: Snapshot optimization for large aggregates
  async getAggregateWithSnapshot(id: EntityId): Promise<T | null> {
    const snapshot = await this.getLatestSnapshot(id);
    let aggregate: T | null = null;
    let fromVersion = 0;

    if (snapshot) {
      aggregate = this.deserializeSnapshot(snapshot);
      fromVersion = snapshot.version;
    }

    // Get events after snapshot
    const events = await this.getEventsFromVersion(id, fromVersion + 1);

    if (events.length === 0) {
      return aggregate;
    }

    // Apply events to snapshot or create from events
    if (aggregate) {
      return this.applyEventsToAggregate(aggregate, events);
    } else {
      return this.reconstructFromEvents(events);
    }
  }

  // ✅ FOCUS: Point-in-time queries
  async getAggregateAtTime(id: EntityId, timestamp: Date): Promise<T | null> {
    const events = await this.getEventsUntilTime(id, timestamp);
    if (events.length === 0) return null;

    return this.reconstructFromEvents(events);
  }

  // Abstract methods for subclasses
  protected abstract extractEventsFromAggregate(aggregate: T): DomainEvent[];
  protected abstract getAggregateId(aggregate: T): EntityId;
  protected abstract clearAggregateEvents(aggregate: T): void;
  protected abstract reconstructFromEvents(events: StoredEvent[]): T;
  protected abstract applyEventsToAggregate(
    aggregate: T,
    events: StoredEvent[]
  ): T;

  // Snapshot management
  protected async saveSnapshot(aggregate: T): Promise<void> {
    const id = this.getAggregateId(aggregate);
    const version = this.getAggregateVersion(aggregate);

    // Save snapshot every 50 events
    if (version % 50 === 0) {
      const snapshotData = this.serializeForSnapshot(aggregate);
      await super.saveSnapshot(id, snapshotData, version);
    }
  }
}
```

#### Event Sourcing Best Practices

1. **Event Design**: Keep events focused and immutable
2. **Versioning**: Plan for event schema evolution
3. **Snapshots**: Implement for aggregates with many events
4. **Concurrency**: Use optimistic locking with version numbers

---

### 3. Cached Repository Pattern

Caching improves performance for read-heavy workloads while maintaining data
consistency.

#### Implementation Structure

```typescript
import { CachedRepository, ICacheProvider } from '@vytches-ddd/repositories';

export class CachedRepositoryBase<
  T extends { id: string },
> extends CachedRepository<T> {
  constructor(
    tableName: string,
    cacheConfig: CacheConfiguration,
    cacheProvider?: ICacheProvider
  ) {
    super(tableName, cacheConfig, cacheProvider);
  }

  // ✅ FOCUS: Intelligent cache key generation
  protected generateCacheKey(operation: string, params: any): string {
    const baseKey = `${this.tableName}:${operation}`;

    if (typeof params === 'string') {
      return `${baseKey}:${params}`;
    }

    if (params && typeof params === 'object') {
      const sortedKeys = Object.keys(params).sort();
      const paramString = sortedKeys
        .map(key => `${key}=${JSON.stringify(params[key])}`)
        .join('&');

      return `${baseKey}:${this.hashString(paramString)}`;
    }

    return baseKey;
  }

  // ✅ FOCUS: Cache-aside pattern implementation
  async findByIdWithCache(
    id: EntityId,
    options?: CacheOptions
  ): Promise<T | null> {
    const cacheKey = this.generateCacheKey('findById', id.value);

    // Try cache first
    const cached = await this.getFromCache<T>(cacheKey);
    if (cached) {
      this.recordCacheHit();
      return cached;
    }

    // Cache miss - get from database
    this.recordCacheMiss();
    const entity = await super.findById(id);

    if (entity) {
      const ttl = options?.ttl || this.cacheConfig.defaultTtl;
      await this.setInCache(cacheKey, entity, ttl);
    }

    return entity;
  }

  // ✅ FOCUS: Batch operations with cache optimization
  async findMultipleWithCache(ids: EntityId[]): Promise<T[]> {
    const cacheKeys = ids.map(id =>
      this.generateCacheKey('findById', id.value)
    );

    // Get all from cache
    const cachedEntities = await this.getMultipleFromCache<T>(cacheKeys);
    const foundEntities: T[] = [];
    const missingIds: EntityId[] = [];

    // Identify cache misses
    for (let i = 0; i < ids.length; i++) {
      if (cachedEntities[i]) {
        foundEntities.push(cachedEntities[i]);
        this.recordCacheHit();
      } else {
        missingIds.push(ids[i]);
        this.recordCacheMiss();
      }
    }

    // Fetch missing entities from database
    if (missingIds.length > 0) {
      const dbEntities = await super.findByIds(missingIds);
      foundEntities.push(...dbEntities);

      // Cache the retrieved entities
      const cachePromises = dbEntities.map(entity => {
        const cacheKey = this.generateCacheKey('findById', entity.id);
        return this.setInCache(cacheKey, entity, this.cacheConfig.defaultTtl);
      });

      await Promise.all(cachePromises);
    }

    return foundEntities;
  }

  // ✅ FOCUS: Write-through cache pattern
  async createWithCache(entity: T): Promise<T> {
    const created = await super.create(entity);

    // Immediately cache the created entity
    const cacheKey = this.generateCacheKey('findById', created.id);
    await this.setInCache(cacheKey, created, this.cacheConfig.defaultTtl);

    // Invalidate related query caches
    await this.invalidateQueryCaches(created);

    return created;
  }

  async updateWithCache(id: EntityId, updates: Partial<T>): Promise<T | null> {
    const updated = await super.update(id, updates);

    if (updated) {
      // Update cache
      const cacheKey = this.generateCacheKey('findById', id.value);
      await this.setInCache(cacheKey, updated, this.cacheConfig.defaultTtl);

      // Invalidate related caches
      await this.invalidateQueryCaches(updated);
    }

    return updated;
  }

  // ✅ FOCUS: Cache invalidation strategies
  protected async invalidateQueryCaches(entity: T): Promise<void> {
    // Pattern-based invalidation for related queries
    const patterns = this.getInvalidationPatterns(entity);

    const invalidationPromises = patterns.map(pattern =>
      this.invalidateCacheByPattern(pattern)
    );

    await Promise.all(invalidationPromises);
  }

  protected getInvalidationPatterns(entity: T): string[] {
    // Override in subclasses for specific invalidation patterns
    return [`${this.tableName}:find:*`, `${this.tableName}:count:*`];
  }

  // Cache warming
  async warmCache(entities: T[]): Promise<void> {
    const cachePromises = entities.map(entity => {
      const cacheKey = this.generateCacheKey('findById', entity.id);
      return this.setInCache(cacheKey, entity, this.cacheConfig.defaultTtl);
    });

    await Promise.all(cachePromises);
  }

  // Utility methods
  private hashString(input: string): string {
    // Simple hash function for cache key generation
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }
}
```

#### Caching Best Practices

1. **Cache Keys**: Use hierarchical, predictable key patterns
2. **TTL Strategy**: Balance freshness vs performance based on use case
3. **Invalidation**: Implement precise invalidation to avoid stale data
4. **Monitoring**: Track cache hit rates and performance metrics

---

## Repository Configuration

### Database Connection Management

```typescript
export interface RepositoryConfiguration {
  database: {
    connectionString: string;
    pool: {
      min: number;
      max: number;
      idleTimeoutMillis: number;
    };
    retryAttempts: number;
    queryTimeout: number;
  };

  cache: {
    provider: 'redis' | 'memory' | 'none';
    connectionString?: string;
    defaultTtl: number;
    keyPrefix: string;
  };

  eventStore: {
    provider: 'postgresql' | 'mongodb' | 'memory';
    connectionString?: string;
    snapshotFrequency: number;
  };

  monitoring: {
    enableMetrics: boolean;
    slowQueryThreshold: number;
    enableTracing: boolean;
  };
}
```

### Factory Pattern for Repository Creation

```typescript
export class RepositoryFactory {
  constructor(private config: RepositoryConfiguration) {}

  createRepository<T>(
    type: 'generic' | 'event-sourced' | 'cached',
    entityName: string
  ): IRepository<T> {
    switch (type) {
      case 'generic':
        return new GenericRepository<T>(entityName);

      case 'event-sourced':
        return new EventSourcedRepositoryBase<T>(entityName);

      case 'cached':
        return new CachedRepositoryBase<T>(entityName, this.config.cache);

      default:
        throw new Error(`Unknown repository type: ${type}`);
    }
  }
}
```

## Testing Repository Implementations

### Unit Test Structure

```typescript
describe('Repository Implementation Tests', () => {
  let repository: UserRepository;
  let mockDatabase: MockDatabase;

  beforeEach(() => {
    mockDatabase = new MockDatabase();
    repository = new UserRepository(mockDatabase);
  });

  describe('CRUD Operations', () => {
    test('should create user with valid data', async () => {
      const userData = createMockUserData();

      const user = await repository.createUser(userData);

      expect(user).toBeDefined();
      expect(user.id).toBeTruthy();
      expect(user.email).toBe(userData.email);
      expect(mockDatabase.lastInsert).toMatchObject(userData);
    });

    test('should handle concurrent updates with optimistic locking', async () => {
      const user = await repository.createUser(createMockUserData());

      // Simulate concurrent update
      const [error1, result1] = await safeRun(() =>
        repository.update(user.id, { firstName: 'John1' })
      );
      const [error2, result2] = await safeRun(() =>
        repository.update(user.id, { firstName: 'John2' })
      );

      expect(error1).toBeNull();
      expect(error2).toBeInstanceOf(ConcurrencyError);
    });
  });
});
```

## Error Handling Patterns

### Repository Error Hierarchy

```typescript
export abstract class RepositoryError extends Error {
  abstract readonly code: string;
  abstract readonly retryable: boolean;
}

export class EntityNotFoundError extends RepositoryError {
  readonly code = 'ENTITY_NOT_FOUND';
  readonly retryable = false;

  constructor(entityType: string, id: string) {
    super(`${entityType} with ID ${id} not found`);
  }
}

export class ConcurrencyError extends RepositoryError {
  readonly code = 'CONCURRENCY_CONFLICT';
  readonly retryable = true;

  constructor(message: string) {
    super(message);
  }
}

export class ValidationError extends RepositoryError {
  readonly code = 'VALIDATION_ERROR';
  readonly retryable = false;

  constructor(public readonly violations: string[]) {
    super(`Validation failed: ${violations.join(', ')}`);
  }
}
```

### Error Recovery Strategies

```typescript
export class ResilientRepository<T> {
  constructor(
    private repository: IRepository<T>,
    private retryPolicy: RetryPolicy
  ) {}

  async findById(id: EntityId): Promise<T | null> {
    return await this.retryPolicy.execute(async () => {
      try {
        return await this.repository.findById(id);
      } catch (error) {
        if (error instanceof RepositoryError && !error.retryable) {
          throw error; // Don't retry non-retryable errors
        }
        throw error; // Let retry policy handle retryable errors
      }
    });
  }
}
```

This implementation guide provides the foundation for building robust, scalable
repository patterns with the @vytches-ddd/repositories package. Each pattern
addresses specific use cases while maintaining consistency and type safety
across your domain model persistence layer.
