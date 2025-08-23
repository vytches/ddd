# VP-004: Event Store Streaming Performance

**Priority**: 86/100  
**Category**: Performance  
**Pillar**: Performance Excellence  
**Estimated Time**: 18 hours  
**Dependencies**: VP-002 (Repository Performance)  
**Status**: Ready for Implementation

## 📋 Context

Current event store implementation has performance limitations for streaming
scenarios:

- Loading entire event streams into memory
- No efficient snapshot mechanism for long streams
- Inefficient deserialization for large event payloads
- Lack of parallel stream processing
- No stream caching or indexing

**Business Impact**: 60% improvement potential in event replay performance,
critical for event sourcing

## 🎯 Objectives

1. Achieve 60% faster event replay for large aggregates
2. Implement efficient snapshot strategy
3. Enable parallel stream processing
4. Add stream caching with intelligent invalidation
5. Optimize memory usage for long event streams

## 📊 Current Performance Baseline

```typescript
// Current problematic patterns
class EventStore {
  async loadEvents(streamId: string): Promise<Event[]> {
    // Loads ALL events into memory
    const events = await this.db.query(
      'SELECT * FROM events WHERE stream_id = $1 ORDER BY version',
      [streamId]
    );

    // Deserializes all at once
    return events.map(e => JSON.parse(e.payload));
  }
}

// Performance issues:
// - 5+ seconds for 10,000 events
// - 500MB+ memory for large streams
// - No pagination or streaming
```

## ✅ Implementation Tasks

### Phase 1: Stream Analysis & Profiling (4 hours)

- [ ] Profile current event loading patterns
- [ ] Analyze event stream size distribution
- [ ] Identify memory usage patterns
- [ ] Document replay performance by stream size
- [ ] Create baseline metrics for optimization

### Phase 2: Streaming Implementation (6 hours)

#### Task 2.1: Implement Cursor-Based Streaming

```typescript
export class StreamingEventStore {
  async *streamEvents(
    streamId: string,
    options: StreamOptions = {}
  ): AsyncGenerator<DomainEvent> {
    const batchSize = options.batchSize || 100;
    let lastVersion = options.fromVersion || 0;

    while (true) {
      const events = await this.db.query(
        `SELECT * FROM events 
         WHERE stream_id = $1 AND version > $2 
         ORDER BY version 
         LIMIT $3`,
        [streamId, lastVersion, batchSize]
      );

      if (events.length === 0) break;

      for (const event of events) {
        yield this.deserializeEvent(event);
        lastVersion = event.version;
      }

      // Allow other operations between batches
      await this.yieldControl();
    }
  }

  async loadAggregateWithStreaming(
    streamId: string,
    AggregateClass: typeof AggregateRoot
  ): Promise<AggregateRoot> {
    const aggregate = new AggregateClass();

    // Stream events instead of loading all
    for await (const event of this.streamEvents(streamId)) {
      aggregate.applyEvent(event);

      // Check for snapshot opportunity
      if (this.shouldTakeSnapshot(aggregate)) {
        await this.saveSnapshot(aggregate);
      }
    }

    return aggregate;
  }
}
```

#### Task 2.2: Implement Snapshot Optimization

```typescript
export interface Snapshot {
  streamId: string;
  version: number;
  state: any;
  createdAt: Date;
  checksum: string;
}

export class SnapshotStore {
  private readonly snapshotInterval = 100;
  private readonly maxSnapshotAge = 86400000; // 24 hours

  async getLatestSnapshot(streamId: string): Promise<Snapshot | null> {
    const snapshot = await this.db.queryOne(
      `SELECT * FROM snapshots 
       WHERE stream_id = $1 
       AND created_at > $2
       ORDER BY version DESC 
       LIMIT 1`,
      [streamId, new Date(Date.now() - this.maxSnapshotAge)]
    );

    if (snapshot && this.verifyChecksum(snapshot)) {
      return snapshot;
    }

    return null;
  }

  async loadFromSnapshot(
    streamId: string,
    AggregateClass: typeof AggregateRoot
  ): Promise<{ aggregate: AggregateRoot; fromVersion: number }> {
    const snapshot = await this.getLatestSnapshot(streamId);

    if (snapshot) {
      const aggregate = AggregateClass.fromSnapshot(snapshot.state);
      return { aggregate, fromVersion: snapshot.version };
    }

    return {
      aggregate: new AggregateClass(),
      fromVersion: 0,
    };
  }

  shouldTakeSnapshot(aggregate: AggregateRoot): boolean {
    // Intelligent snapshot strategy
    const factors = {
      versionGap: aggregate.version % this.snapshotInterval === 0,
      stateSize: JSON.stringify(aggregate).length > 10000,
      timeSinceLastSnapshot:
        this.getTimeSinceLastSnapshot(aggregate.id) > 3600000,
      eventCount: aggregate.uncommittedEvents.length > 50,
    };

    return (
      factors.versionGap ||
      (factors.stateSize && factors.timeSinceLastSnapshot) ||
      factors.eventCount
    );
  }
}
```

#### Task 2.3: Implement Parallel Stream Processing

```typescript
export class ParallelStreamProcessor {
  private readonly workerPool: WorkerPool;

  constructor(workerCount: number = 4) {
    this.workerPool = new WorkerPool(workerCount);
  }

  async processStreamsInParallel(
    streamIds: string[],
    processor: (events: DomainEvent[]) => Promise<void>
  ): Promise<void> {
    const chunks = this.chunkArray(streamIds, this.workerPool.size);

    await Promise.all(
      chunks.map(chunk =>
        this.workerPool.execute(async worker => {
          for (const streamId of chunk) {
            const events = await this.streamEvents(streamId);
            await processor(events);
          }
        })
      )
    );
  }

  async replayEventsInParallel(
    streamId: string,
    fromVersion: number = 0
  ): Promise<AggregateRoot> {
    // Split event stream into chunks for parallel processing
    const eventCount = await this.getEventCount(streamId, fromVersion);
    const chunkSize = Math.ceil(eventCount / this.workerPool.size);

    const tasks = [];
    for (let i = 0; i < this.workerPool.size; i++) {
      const start = fromVersion + i * chunkSize;
      const end = Math.min(start + chunkSize, fromVersion + eventCount);

      tasks.push(
        this.workerPool.execute(async worker => {
          return await this.loadEventRange(streamId, start, end);
        })
      );
    }

    const eventChunks = await Promise.all(tasks);
    return this.mergeEventChunks(eventChunks);
  }
}
```

### Phase 3: Caching & Indexing (4 hours)

#### Task 3.1: Implement Stream Cache

```typescript
export class CachedEventStore extends StreamingEventStore {
  private cache: LRUCache<string, CachedStream>;
  private indexes: Map<string, StreamIndex>;

  constructor(cacheSize: number = 100) {
    super();
    this.cache = new LRUCache({ max: cacheSize });
    this.indexes = new Map();
  }

  async getCachedStream(streamId: string): Promise<CachedStream | null> {
    const cached = this.cache.get(streamId);

    if (cached && !cached.isStale()) {
      return cached;
    }

    return null;
  }

  async *streamEventsWithCache(
    streamId: string,
    options: StreamOptions = {}
  ): AsyncGenerator<DomainEvent> {
    // Check cache first
    const cached = await this.getCachedStream(streamId);

    if (cached && options.fromVersion <= cached.lastVersion) {
      // Serve from cache
      for (const event of cached.events) {
        if (event.version >= options.fromVersion) {
          yield event;
        }
      }

      // Continue from where cache ends
      options.fromVersion = cached.lastVersion + 1;
    }

    // Stream remaining events
    const newEvents: DomainEvent[] = [];
    for await (const event of this.streamEvents(streamId, options)) {
      newEvents.push(event);
      yield event;
    }

    // Update cache
    if (newEvents.length > 0) {
      this.updateCache(streamId, newEvents);
    }
  }

  private updateCache(streamId: string, newEvents: DomainEvent[]): void {
    const cached = this.cache.get(streamId) || new CachedStream(streamId);
    cached.addEvents(newEvents);

    // Implement cache eviction strategy
    if (cached.size > this.maxCacheSize) {
      cached.truncate(this.snapshotInterval);
    }

    this.cache.set(streamId, cached);
  }
}
```

#### Task 3.2: Implement Event Indexes

```typescript
export class IndexedEventStore extends CachedEventStore {
  async createIndex(
    indexName: string,
    streamId: string,
    indexFunction: (event: DomainEvent) => string
  ): Promise<void> {
    const index = new StreamIndex(indexName);

    for await (const event of this.streamEvents(streamId)) {
      const key = indexFunction(event);
      index.add(key, event);
    }

    this.indexes.set(`${streamId}:${indexName}`, index);
  }

  async queryByIndex(
    streamId: string,
    indexName: string,
    key: string
  ): Promise<DomainEvent[]> {
    const index = this.indexes.get(`${streamId}:${indexName}`);

    if (!index) {
      throw new Error(`Index ${indexName} not found for stream ${streamId}`);
    }

    return index.get(key);
  }

  // Optimized event queries using indexes
  async findEventsByType(
    streamId: string,
    eventType: string
  ): Promise<DomainEvent[]> {
    // Use type index if available
    const typeIndex = this.indexes.get(`${streamId}:type`);

    if (typeIndex) {
      return typeIndex.get(eventType);
    }

    // Fallback to streaming with filter
    const events: DomainEvent[] = [];
    for await (const event of this.streamEvents(streamId)) {
      if (event.type === eventType) {
        events.push(event);
      }
    }

    return events;
  }
}
```

### Phase 4: Performance Testing (4 hours)

#### Task 4.1: Create Streaming Benchmarks

```typescript
describe('Event Store Streaming Performance', () => {
  it('should achieve 60% faster replay for large streams', async () => {
    const streamId = 'test-stream';
    const eventCount = 10000;

    // Generate test events
    await generateTestEvents(streamId, eventCount);

    // Baseline: Load all events
    const baselineStart = Date.now();
    const baselineEvents = await originalStore.loadEvents(streamId);
    const aggregate1 = replayEvents(baselineEvents);
    const baselineTime = Date.now() - baselineStart;

    // Optimized: Stream with snapshots
    const optimizedStart = Date.now();
    const aggregate2 = await optimizedStore.loadAggregateWithStreaming(
      streamId,
      TestAggregate
    );
    const optimizedTime = Date.now() - optimizedStart;

    const improvement = ((baselineTime - optimizedTime) / baselineTime) * 100;

    console.log(`
      Event Replay Performance (${eventCount} events):
      Baseline: ${baselineTime}ms
      Optimized: ${optimizedTime}ms
      Improvement: ${improvement.toFixed(1)}%
    `);

    expect(improvement).toBeGreaterThan(60);
    expect(aggregate1.state).toEqual(aggregate2.state);
  });

  it('should handle concurrent stream processing', async () => {
    const streamIds = Array.from({ length: 100 }, (_, i) => `stream-${i}`);

    const start = Date.now();
    await optimizedStore.processStreamsInParallel(streamIds, async events => {
      // Process events
    });
    const duration = Date.now() - start;

    console.log(`Processed ${streamIds.length} streams in ${duration}ms`);
    expect(duration).toBeLessThan(5000); // Should process 100 streams in <5s
  });
});
```

## 📈 Success Metrics

### Performance Targets

- [ ] 60% faster event replay for streams >1000 events
- [ ] <100ms snapshot loading time
- [ ] <1GB memory usage for 100K event streams
- [ ] Support for 1M+ events per stream

### Quality Metrics

- [ ] Zero event loss during streaming
- [ ] Snapshot integrity verification
- [ ] Consistent replay results
- [ ] Automatic index maintenance

## 🔧 Technical Implementation Details

### Streaming Strategies

1. **Cursor-based**: Forward-only streaming with position tracking
2. **Batch streaming**: Process events in configurable batches
3. **Parallel streaming**: Multi-threaded event processing
4. **Reactive streaming**: Backpressure-aware streaming

### Snapshot Strategies

1. **Interval-based**: Every N events
2. **Time-based**: Every X minutes
3. **Size-based**: When state exceeds threshold
4. **Hybrid**: Combination of above

### Cache Strategies

1. **LRU**: Least recently used eviction
2. **TTL**: Time-based expiration
3. **Size-based**: Memory limit enforcement
4. **Prioritized**: Keep hot streams in cache

## 🚨 Risk Mitigation

### Performance Risks

- **Memory leaks**: Implement proper stream cleanup
- **Cache invalidation**: Event-based cache updates
- **Index maintenance**: Async index updates

### Consistency Risks

- **Snapshot corruption**: Checksum verification
- **Event ordering**: Strict version ordering
- **Concurrent access**: Optimistic locking

## 📚 References

- [Event Sourcing Performance](https://www.eventstore.com/blog/event-sourcing-and-performance)
- [Stream Processing Patterns](https://www.confluent.io/blog/event-streaming-platform-architecture/)
- [Snapshot Strategies](https://martinfowler.com/eaaDev/Snapshot.html)
- [Database Streaming](https://www.postgresql.org/docs/current/queries-cursor.html)

## ✅ Definition of Done

- [ ] All performance targets met
- [ ] Streaming benchmarks passing
- [ ] Snapshot system operational
- [ ] Cache hit rate >80%
- [ ] Documentation complete
- [ ] Migration guide created
