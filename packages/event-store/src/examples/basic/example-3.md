# Event Stream Operations

**Version**: 1.0.0
**Package**: @vytches-ddd/event-store
**Complexity**: basic
**Domain**: Infrastructure
**Patterns**: stream-management, event-reading, pagination, filtering
**Dependencies**: @vytches-ddd/event-store, @vytches-ddd/events

## Description

Comprehensive event stream operations including reading, filtering, pagination, and stream management. This example demonstrates advanced stream querying capabilities, batch operations, and efficient event processing patterns.

## Business Context

Applications often need to query event streams in sophisticated ways - filtering by event types, reading specific time ranges, processing events in batches, or analyzing historical data. Efficient stream operations are essential for performance and scalability in event-driven systems.

## Code Example

```typescript
// event-stream-operations.ts
import { InMemoryEventStore, JsonEventSerializer } from '@vytches-ddd/event-store';
import { DomainEvent, EntityId } from '@vytches-ddd/events';
import { Result } from '@vytches-ddd/utils';
import { EventQuery, QueryResult, StreamInfo } from './types'; // From your app

// ⭐ FOCUS: Advanced event stream manager
export class EventStreamManager {
  private readonly eventStore: InMemoryEventStore;
  private readonly serializer = new JsonEventSerializer();

  constructor() {
    this.eventStore = new InMemoryEventStore({
      serializer: this.serializer,
      enableSnapshots: false
    });
  }

  async queryEvents(query: EventQuery): Promise<Result<QueryResult<DomainEvent>, Error>> {
    try {
      // ⭐ FOCUS: Multi-stream query support
      if (query.streamId) {
        return await this.querySingleStream(query);
      } else {
        return await this.queryAllStreams(query);
      }
    } catch (error) {
      return Result.fail(new Error(`Event query failed: ${error.message}`));
    }
  }

  private async querySingleStream(query: EventQuery): Promise<Result<QueryResult<DomainEvent>, Error>> {
    try {
      // ⭐ FOCUS: Read events from specific stream
      const readResult = await this.eventStore.readStream(query.streamId!);
      
      if (readResult.isFailure()) {
        return Result.fail(readResult.error);
      }

      const allEvents = readResult.value.events;
      const filteredEvents = this.applyFilters(allEvents, query);

      return Result.ok({
        events: filteredEvents,
        totalCount: filteredEvents.length,
        hasMore: false
      });
    } catch (error) {
      return Result.fail(new Error(`Single stream query failed: ${error.message}`));
    }
  }

  private async queryAllStreams(query: EventQuery): Promise<Result<QueryResult<DomainEvent>, Error>> {
    try {
      // ⭐ FOCUS: Read events from all streams
      const streamIds = await this.eventStore.getAllStreamIds();
      const allEvents: DomainEvent[] = [];

      for (const streamId of streamIds) {
        const readResult = await this.eventStore.readStream(streamId);
        
        if (readResult.isSuccess()) {
          allEvents.push(...readResult.value.events);
        }
      }

      // ⭐ FOCUS: Sort by timestamp for chronological order
      allEvents.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      const filteredEvents = this.applyFilters(allEvents, query);

      return Result.ok({
        events: filteredEvents,
        totalCount: filteredEvents.length,
        hasMore: false
      });
    } catch (error) {
      return Result.fail(new Error(`All streams query failed: ${error.message}`));
    }
  }

  private applyFilters(events: DomainEvent[], query: EventQuery): DomainEvent[] {
    let filtered = events;

    // ⭐ FOCUS: Filter by event types
    if (query.eventTypes && query.eventTypes.length > 0) {
      filtered = filtered.filter(event => 
        query.eventTypes!.includes(event.eventType)
      );
    }

    // ⭐ FOCUS: Filter by date range
    if (query.fromDate) {
      filtered = filtered.filter(event => 
        event.timestamp >= query.fromDate!
      );
    }

    if (query.toDate) {
      filtered = filtered.filter(event => 
        event.timestamp <= query.toDate!
      );
    }

    // ⭐ FOCUS: Filter by correlation ID
    if (query.correlationId) {
      filtered = filtered.filter(event => 
        event.correlationId === query.correlationId
      );
    }

    // ⭐ FOCUS: Filter by user ID
    if (query.userId) {
      filtered = filtered.filter(event => 
        event.metadata?.userId === query.userId
      );
    }

    // ⭐ FOCUS: Filter by custom metadata
    if (query.metadata) {
      filtered = filtered.filter(event => {
        if (!event.metadata) return false;
        
        for (const [key, value] of Object.entries(query.metadata!)) {
          if (event.metadata[key] !== value) {
            return false;
          }
        }
        return true;
      });
    }

    return filtered;
  }

  async readStreamWithPagination(
    streamId: string,
    pageSize: number = 50,
    pageToken?: string
  ): Promise<Result<{ events: DomainEvent[]; nextToken?: string; hasMore: boolean }, Error>> {
    try {
      // ⭐ FOCUS: Parse page token to get starting position
      let startIndex = 0;
      if (pageToken) {
        try {
          const parsed = JSON.parse(Buffer.from(pageToken, 'base64').toString());
          startIndex = parsed.startIndex || 0;
        } catch {
          return Result.fail(new Error('Invalid page token'));
        }
      }

      // ⭐ FOCUS: Read events with pagination
      const readResult = await this.eventStore.readStream(streamId, {
        fromEventNumber: startIndex,
        maxCount: pageSize
      });

      if (readResult.isFailure()) {
        return Result.fail(readResult.error);
      }

      const events = readResult.value.events;
      const hasMore = events.length === pageSize;
      
      // ⭐ FOCUS: Generate next token
      let nextToken: string | undefined;
      if (hasMore) {
        const nextIndex = startIndex + events.length;
        const tokenData = { startIndex: nextIndex };
        nextToken = Buffer.from(JSON.stringify(tokenData)).toString('base64');
      }

      return Result.ok({
        events,
        nextToken,
        hasMore
      });
    } catch (error) {
      return Result.fail(new Error(`Paginated read failed: ${error.message}`));
    }
  }

  async getStreamStatistics(streamId: string): Promise<Result<StreamInfo, Error>> {
    try {
      // ⭐ FOCUS: Comprehensive stream statistics
      const exists = await this.eventStore.streamExists(streamId);
      
      if (!exists) {
        return Result.fail(new Error(`Stream ${streamId} does not exist`));
      }

      const readResult = await this.eventStore.readStream(streamId);
      
      if (readResult.isFailure()) {
        return Result.fail(readResult.error);
      }

      const events = readResult.value.events;
      
      if (events.length === 0) {
        return Result.ok({
          streamId,
          eventCount: 0,
          firstEventNumber: -1,
          lastEventNumber: -1,
          createdAt: new Date(),
          lastModified: new Date()
        });
      }

      // ⭐ FOCUS: Calculate stream statistics
      const firstEvent = events[0];
      const lastEvent = events[events.length - 1];

      const streamInfo: StreamInfo = {
        streamId,
        eventCount: events.length,
        firstEventNumber: 0,
        lastEventNumber: events.length - 1,
        createdAt: firstEvent.timestamp,
        lastModified: lastEvent.timestamp
      };

      return Result.ok(streamInfo);
    } catch (error) {
      return Result.fail(new Error(`Stream statistics failed: ${error.message}`));
    }
  }

  async batchReadStreams(streamIds: string[]): Promise<Result<Record<string, DomainEvent[]>, Error>> {
    try {
      // ⭐ FOCUS: Efficient batch reading
      const results: Record<string, DomainEvent[]> = {};
      
      // Process streams in parallel
      const readPromises = streamIds.map(async (streamId) => {
        try {
          const readResult = await this.eventStore.readStream(streamId);
          
          if (readResult.isSuccess()) {
            return { streamId, events: readResult.value.events };
          } else {
            return { streamId, events: [] };
          }
        } catch {
          return { streamId, events: [] };
        }
      });

      const batchResults = await Promise.all(readPromises);
      
      // ⭐ FOCUS: Organize results by stream ID
      for (const result of batchResults) {
        results[result.streamId] = result.events;
      }

      return Result.ok(results);
    } catch (error) {
      return Result.fail(new Error(`Batch read failed: ${error.message}`));
    }
  }

  async findEventsByCorrelation(correlationId: string): Promise<Result<DomainEvent[], Error>> {
    try {
      // ⭐ FOCUS: Cross-stream correlation query
      const query: EventQuery = {
        correlationId
      };

      const queryResult = await this.queryEvents(query);
      
      if (queryResult.isFailure()) {
        return Result.fail(queryResult.error);
      }

      return Result.ok(queryResult.value.events);
    } catch (error) {
      return Result.fail(new Error(`Correlation query failed: ${error.message}`));
    }
  }

  async findEventsByTimeRange(
    fromDate: Date, 
    toDate: Date, 
    eventTypes?: string[]
  ): Promise<Result<DomainEvent[], Error>> {
    try {
      // ⭐ FOCUS: Time-based event analysis
      const query: EventQuery = {
        fromDate,
        toDate,
        eventTypes
      };

      const queryResult = await this.queryEvents(query);
      
      if (queryResult.isFailure()) {
        return Result.fail(queryResult.error);
      }

      return Result.ok(queryResult.value.events);
    } catch (error) {
      return Result.fail(new Error(`Time range query failed: ${error.message}`));
    }
  }

  async getEventTypeDistribution(): Promise<Result<Record<string, number>, Error>> {
    try {
      // ⭐ FOCUS: Analyze event type distribution across all streams
      const allEventsQuery: EventQuery = {};
      const queryResult = await this.queryEvents(allEventsQuery);
      
      if (queryResult.isFailure()) {
        return Result.fail(queryResult.error);
      }

      const distribution: Record<string, number> = {};
      
      for (const event of queryResult.value.events) {
        distribution[event.eventType] = (distribution[event.eventType] || 0) + 1;
      }

      return Result.ok(distribution);
    } catch (error) {
      return Result.fail(new Error(`Event distribution analysis failed: ${error.message}`));
    }
  }

  async streamExists(streamId: string): Promise<boolean> {
    try {
      return await this.eventStore.streamExists(streamId);
    } catch {
      return false;
    }
  }

  async getAllStreamIds(): Promise<string[]> {
    try {
      return await this.eventStore.getAllStreamIds();
    } catch {
      return [];
    }
  }

  // ⭐ FOCUS: Append events for testing
  async appendEvents(streamId: string, events: DomainEvent[]): Promise<Result<void, Error>> {
    try {
      const appendResult = await this.eventStore.appendEvents(streamId, events);
      
      if (appendResult.isFailure()) {
        return Result.fail(appendResult.error);
      }

      return Result.ok();
    } catch (error) {
      return Result.fail(new Error(`Event append failed: ${error.message}`));
    }
  }
}

// ⭐ FOCUS: Sample events for demonstration
export class ProductCreatedEvent extends DomainEvent {
  constructor(
    aggregateId: EntityId,
    public readonly name: string,
    public readonly category: string,
    public readonly price: number,
    public readonly currency: string
  ) {
    super(aggregateId, 'ProductCreated', 1);
  }
}

export class ProductPriceChangedEvent extends DomainEvent {
  constructor(
    aggregateId: EntityId,
    public readonly oldPrice: number,
    public readonly newPrice: number,
    public readonly reason: string
  ) {
    super(aggregateId, 'ProductPriceChanged', 1);
  }
}

export class ProductCategorizedEvent extends DomainEvent {
  constructor(
    aggregateId: EntityId,
    public readonly oldCategory: string,
    public readonly newCategory: string
  ) {
    super(aggregateId, 'ProductCategorized', 1);
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
// Complete stream operations demonstration
import { 
  EventStreamManager,
  ProductCreatedEvent,
  ProductPriceChangedEvent,
  ProductCategorizedEvent,
  InventoryAdjustedEvent
} from './event-stream-operations';

async function demonstrateStreamOperations() {
  const streamManager = new EventStreamManager();
  
  // ⭐ FOCUS: Create sample data
  const productId1 = EntityId.createUuid();
  const productId2 = EntityId.createUuid();
  const correlationId = 'batch-update-123';

  // Create events for Product 1
  const product1Events = [
    new ProductCreatedEvent(productId1, 'Laptop Pro', 'Electronics', 1999.99, 'USD'),
    new ProductPriceChangedEvent(productId1, 1999.99, 1899.99, 'Black Friday Sale'),
    new InventoryAdjustedEvent(productId1, 100, 100, 'Initial stock')
  ];
  
  // Set correlation ID for batch operation
  product1Events.forEach(event => {
    event.correlationId = correlationId;
    event.metadata = { userId: 'admin-123', region: 'US' };
  });

  // Create events for Product 2
  const product2Events = [
    new ProductCreatedEvent(productId2, 'Mouse Wireless', 'Electronics', 49.99, 'USD'),
    new ProductCategorizedEvent(productId2, 'Electronics', 'Accessories'),
    new InventoryAdjustedEvent(productId2, 50, 50, 'Initial stock')
  ];
  
  product2Events.forEach(event => {
    event.correlationId = correlationId;
    event.metadata = { userId: 'admin-123', region: 'EU' };
  });

  // ⭐ FOCUS: Append events to streams
  await streamManager.appendEvents(`product-${productId1.value}`, product1Events);
  await streamManager.appendEvents(`product-${productId2.value}`, product2Events);

  console.log('--- Stream Operations Demo ---\n');

  // ⭐ FOCUS: Query events by type
  console.log('1. Query by Event Type:');
  const priceChangeQuery = await streamManager.queryEvents({
    eventTypes: ['ProductPriceChanged', 'ProductCategorized']
  });
  
  if (priceChangeQuery.isSuccess()) {
    console.log(`Found ${priceChangeQuery.value.events.length} price/category change events`);
    priceChangeQuery.value.events.forEach(event => {
      console.log(`  - ${event.eventType} at ${event.timestamp.toISOString()}`);
    });
  }

  // ⭐ FOCUS: Query by correlation ID
  console.log('\n2. Query by Correlation ID:');
  const correlatedEvents = await streamManager.findEventsByCorrelation(correlationId);
  
  if (correlatedEvents.isSuccess()) {
    console.log(`Found ${correlatedEvents.value.length} events with correlation ${correlationId}`);
    correlatedEvents.value.forEach(event => {
      console.log(`  - ${event.eventType} from ${event.aggregateId.value.substring(0, 8)}...`);
    });
  }

  // ⭐ FOCUS: Query by time range
  console.log('\n3. Query by Time Range:');
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  const now = new Date();
  
  const timeRangeEvents = await streamManager.findEventsByTimeRange(
    fiveMinutesAgo, 
    now, 
    ['ProductCreated', 'InventoryAdjusted']
  );
  
  if (timeRangeEvents.isSuccess()) {
    console.log(`Found ${timeRangeEvents.value.length} create/inventory events in last 5 minutes`);
  }

  // ⭐ FOCUS: Query by metadata
  console.log('\n4. Query by Metadata:');
  const metadataQuery = await streamManager.queryEvents({
    metadata: { region: 'US' }
  });
  
  if (metadataQuery.isSuccess()) {
    console.log(`Found ${metadataQuery.value.events.length} events from US region`);
  }

  // ⭐ FOCUS: Paginated stream reading
  console.log('\n5. Paginated Stream Reading:');
  const streamId = `product-${productId1.value}`;
  let pageToken: string | undefined;
  let pageNumber = 1;
  
  do {
    const pageResult = await streamManager.readStreamWithPagination(
      streamId,
      2, // 2 events per page
      pageToken
    );
    
    if (pageResult.isSuccess()) {
      const { events, nextToken, hasMore } = pageResult.value;
      console.log(`  Page ${pageNumber}: ${events.length} events`);
      events.forEach(event => {
        console.log(`    - ${event.eventType}`);
      });
      
      pageToken = nextToken;
      pageNumber++;
      
      if (!hasMore) break;
    } else {
      break;
    }
  } while (pageToken);

  // ⭐ FOCUS: Stream statistics
  console.log('\n6. Stream Statistics:');
  const streamStats = await streamManager.getStreamStatistics(streamId);
  
  if (streamStats.isSuccess()) {
    const stats = streamStats.value;
    console.log(`  Stream: ${stats.streamId}`);
    console.log(`  Events: ${stats.eventCount}`);
    console.log(`  Created: ${stats.createdAt.toISOString()}`);
    console.log(`  Modified: ${stats.lastModified.toISOString()}`);
  }

  // ⭐ FOCUS: Batch read multiple streams
  console.log('\n7. Batch Stream Reading:');
  const streamIds = [`product-${productId1.value}`, `product-${productId2.value}`];
  const batchResult = await streamManager.batchReadStreams(streamIds);
  
  if (batchResult.isSuccess()) {
    const streams = batchResult.value;
    for (const [streamId, events] of Object.entries(streams)) {
      console.log(`  ${streamId}: ${events.length} events`);
    }
  }

  // ⭐ FOCUS: Event type distribution analysis
  console.log('\n8. Event Type Distribution:');
  const distribution = await streamManager.getEventTypeDistribution();
  
  if (distribution.isSuccess()) {
    const eventTypes = distribution.value;
    console.log('  Event distribution:');
    for (const [eventType, count] of Object.entries(eventTypes)) {
      console.log(`    ${eventType}: ${count}`);
    }
  }

  // ⭐ FOCUS: Stream existence check
  console.log('\n9. Stream Management:');
  const allStreams = await streamManager.getAllStreamIds();
  console.log(`  Total streams: ${allStreams.length}`);
  
  for (const streamId of allStreams) {
    const exists = await streamManager.streamExists(streamId);
    console.log(`  ${streamId}: ${exists ? 'exists' : 'not found'}`);
  }
}

// Run the demonstration
demonstrateStreamOperations().catch(console.error);
```

## Key Features

- **Advanced Querying**: Filter events by type, date range, correlation, and metadata
- **Pagination Support**: Efficient pagination with token-based navigation
- **Batch Operations**: Process multiple streams concurrently for performance
- **Stream Statistics**: Comprehensive stream metadata and analysis
- **Cross-Stream Search**: Find related events across all streams
- **Flexible Filtering**: Combine multiple filter criteria for precise queries
- **Performance Optimization**: Parallel processing and efficient data structures

## Query Capabilities

1. **Single Stream Queries**: Target specific aggregate streams
2. **Cross-Stream Analysis**: Search across all streams simultaneously
3. **Time-Based Filtering**: Query events within specific date ranges
4. **Event Type Filtering**: Focus on specific types of domain events
5. **Correlation Tracking**: Find all events related to business processes
6. **Metadata Search**: Query by custom event metadata properties

## Performance Benefits

- **Indexed Access**: Fast stream lookups and existence checks
- **Batch Processing**: Concurrent operations for multiple streams
- **Memory Efficient**: Pagination prevents loading large result sets
- **Filter Optimization**: Early filtering reduces processing overhead
- **Parallel Queries**: Simultaneous stream processing where possible

## Stream Management Features

- **Stream Statistics**: Event counts, timestamps, and metadata
- **Existence Checking**: Verify stream availability before operations
- **Batch Reading**: Efficient multi-stream data retrieval
- **Distribution Analysis**: Understanding event patterns across streams
- **Token-Based Pagination**: Scalable result set navigation

## Common Use Cases

- **Audit Trails**: Query events for compliance and debugging
- **Business Intelligence**: Analyze patterns and trends in event data
- **Correlation Analysis**: Track related events across business processes
- **Historical Queries**: Examine system state at specific points in time
- **Performance Monitoring**: Analyze event throughput and distribution

## Performance Considerations

- **Filter Early**: Apply filters before processing large result sets
- **Use Pagination**: Avoid loading entire streams into memory
- **Batch Operations**: Process multiple streams concurrently
- **Index Strategy**: Consider indexing for frequently queried fields
- **Memory Management**: Monitor memory usage with large event volumes

## Common Pitfalls

- **Large Result Sets**: Always use pagination for potentially large queries
- **Filter Efficiency**: Order filters by selectivity (most restrictive first)
- **Memory Leaks**: Clean up references after processing large batches
- **Concurrent Access**: Consider thread safety for concurrent operations
- **Error Handling**: Handle partial failures in batch operations gracefully

## Related Examples

- [In-Memory Event Store](./example-1.md)
- [Event Serialization Strategies](./example-2.md)
- [Event Replay Engine](../intermediate/example-1.md)