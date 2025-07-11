# 9. Implement Enterprise Event Store with Event Sourcing Support

Date: 2025-07-09

## Status

2025-07-09 proposed 2025-07-09 accepted

## Context

VytchesDDD currently lacks a comprehensive Event Store implementation, which is
fundamental for Event Sourcing patterns. While we have a basic `IEventStore`
interface in contracts, it only provides minimal functionality (getEvents,
saveEvents, getEventsAfterVersion) without support for:

- Event streams and stream management
- Optimistic concurrency control
- Event metadata and correlation
- Snapshots for performance optimization
- Global event ordering and positioning
- Event replay capabilities
- Multiple storage adapter support

Leading frameworks like Axon, EventStore DB, and NEventStore provide
comprehensive event storage solutions. To achieve competitive parity and enable
advanced Event Sourcing patterns, we need an enterprise-grade Event Store
implementation.

### Current Limitations:

1. Basic interface lacks stream-based operations
2. No support for event positioning/ordering
3. No snapshot mechanism for large aggregates
4. No adapter pattern for different storage backends
5. Missing event replay foundation

## Decision

We will implement a comprehensive Event Store system with the following
architecture:

### 1. **Enhanced Event Store Interfaces**

```typescript
interface IEventStore {
  // Stream operations
  appendToStream(
    streamId: string,
    events: DomainEvent[],
    expectedVersion?: number
  ): Promise<AppendResult>;
  readStream(
    streamId: string,
    options?: ReadStreamOptions
  ): Promise<EventStream>;

  // Global event log
  readAll(options?: ReadAllOptions): Promise<GlobalEventStream>;

  // Snapshots
  getSnapshot(streamId: string): Promise<AggregateSnapshot | null>;
  saveSnapshot(streamId: string, snapshot: AggregateSnapshot): Promise<void>;

  // Stream management
  deleteStream(streamId: string): Promise<void>;
  getStreamMetadata(streamId: string): Promise<StreamMetadata>;
}
```

### 2. **Storage Adapter Pattern**

- `InMemoryEventStore` - Development and testing
- `FileSystemEventStore` - Simple persistence without dependencies
- `PostgreSQLEventStore` - Production-ready with JSONB support
- `MongoDBEventStore` - Document-based storage
- `EventStoreDBAdapter` - Integration with EventStore DB

### 3. **Core Features**

- **Optimistic Concurrency Control**: Version-based conflict detection
- **Event Positioning**: Global event ordering with positions
- **Stream Isolation**: Separate streams per aggregate
- **Event Metadata**: Rich metadata with correlation, causation, and custom data
- **Snapshot Support**: Performance optimization for large aggregates
- **Event Serialization**: Pluggable serialization strategies

### 4. **Integration Points**

- Seamless integration with existing `UnifiedEventBus`
- Automatic event persistence in `IBaseRepository.save()`
- Support for `ProjectionEngine` rebuilding
- Compatibility with `VersioningCapability` for upcasting

## Consequences

### Positive Consequences:

1. **Event Sourcing Enablement**: Full Event Sourcing pattern support
2. **Performance Optimization**: Snapshots reduce aggregate loading time
3. **Audit Trail**: Complete history of all domain changes
4. **Replay Capability**: Foundation for projection rebuilding
5. **Storage Flexibility**: Multiple backend options via adapters
6. **Industry Parity**: Competitive with Axon and EventStore DB
7. **Type Safety**: Full TypeScript support with generics

### Negative Consequences:

1. **Complexity**: Additional layer of infrastructure
2. **Storage Requirements**: Events accumulate over time
3. **Migration Effort**: Existing aggregates need event sourcing support
4. **Learning Curve**: Developers need to understand Event Sourcing

### Implementation Phases:

1. **Phase 1**: Enhanced interfaces and InMemoryEventStore (1-2 weeks)
2. **Phase 2**: FileSystemEventStore and serialization (1 week)
3. **Phase 3**: Database adapters (PostgreSQL, MongoDB) (2 weeks)
4. **Phase 4**: Event replay and projection rebuilding (2 weeks)

This decision aligns with our goal of achieving feature parity with leading DDD
frameworks while maintaining our TypeScript-first, enterprise-grade approach.
