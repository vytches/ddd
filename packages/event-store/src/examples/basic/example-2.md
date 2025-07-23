# Event Serialization Strategies

**Version**: 1.0.0 **Package**: @vytches-ddd/event-store **Complexity**: basic
**Domain**: Infrastructure **Patterns**: event-serialization, data-formats,
json-serialization, custom-serializers **Dependencies**:
@vytches-ddd/event-store, @vytches-ddd/utils

## Description

Different approaches to event serialization including JSON serialization, custom
formatters, and metadata handling. This example demonstrates how to implement
various serialization strategies for event storage with proper error handling
and format validation.

## Business Context

Event serialization is crucial for persistent event storage. Different
applications have varying requirements for data format, compression, encryption,
and backward compatibility. A flexible serialization strategy allows for
optimization based on specific business needs while maintaining data integrity.

## Code Example

```typescript
// event-serialization.ts
import {
  JsonEventSerializer,
  IEventSerializer,
} from '@vytches-ddd/event-store';
import { DomainEvent, EntityId } from '@vytches-ddd/events';
import { Result } from '@vytches-ddd/utils';
import { SerializationStrategy, EventMetadata } from './types'; // From your app

// ⭐ FOCUS: Enhanced JSON serializer with validation
export class EnhancedJsonSerializer implements IEventSerializer {
  private readonly contentType = 'application/json';

  async serialize(event: DomainEvent): Promise<Result<string, Error>> {
    try {
      // ⭐ FOCUS: Add serialization metadata
      const serializedEvent = {
        eventType: event.eventType,
        eventId: event.eventId,
        aggregateId: event.aggregateId?.value || event.aggregateId,
        aggregateType: event.aggregateType,
        version: event.version,
        timestamp: event.timestamp.toISOString(),
        correlationId: event.correlationId,
        causationId: event.causationId,
        metadata: event.metadata || {},
        data: this.extractEventData(event),
      };

      const json = JSON.stringify(serializedEvent, null, 0);

      // ⭐ FOCUS: Validate serialization
      const validation = this.validateSerialization(json);
      if (validation.isFailure()) {
        return Result.fail(validation.error);
      }

      return Result.ok(json);
    } catch (error) {
      return Result.fail(
        new Error(`JSON serialization failed: ${error.message}`)
      );
    }
  }

  async deserialize<T extends DomainEvent>(
    data: string
  ): Promise<Result<T, Error>> {
    try {
      // ⭐ FOCUS: Parse and validate JSON
      const parsed = JSON.parse(data);

      const validation = this.validateDeserializedData(parsed);
      if (validation.isFailure()) {
        return Result.fail(validation.error);
      }

      // ⭐ FOCUS: Reconstruct domain event
      const event = this.reconstructDomainEvent<T>(parsed);

      return Result.ok(event);
    } catch (error) {
      return Result.fail(
        new Error(`JSON deserialization failed: ${error.message}`)
      );
    }
  }

  getContentType(): string {
    return this.contentType;
  }

  private extractEventData(event: DomainEvent): any {
    // ⭐ FOCUS: Extract only serializable data
    const data: any = {};

    // Get all enumerable properties except inherited ones
    for (const key in event) {
      if (
        event.hasOwnProperty(key) &&
        ![
          'eventType',
          'eventId',
          'aggregateId',
          'aggregateType',
          'version',
          'timestamp',
          'correlationId',
          'causationId',
          'metadata',
        ].includes(key)
      ) {
        data[key] = (event as any)[key];
      }
    }

    return data;
  }

  private validateSerialization(json: string): Result<void, Error> {
    try {
      const parsed = JSON.parse(json);

      // ⭐ FOCUS: Required field validation
      const requiredFields = [
        'eventType',
        'eventId',
        'aggregateId',
        'version',
        'timestamp',
      ];

      for (const field of requiredFields) {
        if (
          !(field in parsed) ||
          parsed[field] === null ||
          parsed[field] === undefined
        ) {
          return Result.fail(new Error(`Missing required field: ${field}`));
        }
      }

      return Result.ok();
    } catch (error) {
      return Result.fail(
        new Error(`Serialization validation failed: ${error.message}`)
      );
    }
  }

  private validateDeserializedData(data: any): Result<void, Error> {
    if (!data || typeof data !== 'object') {
      return Result.fail(new Error('Invalid data format: must be an object'));
    }

    if (!data.eventType || typeof data.eventType !== 'string') {
      return Result.fail(
        new Error('Invalid eventType: must be a non-empty string')
      );
    }

    if (!data.eventId || typeof data.eventId !== 'string') {
      return Result.fail(
        new Error('Invalid eventId: must be a non-empty string')
      );
    }

    return Result.ok();
  }

  private reconstructDomainEvent<T extends DomainEvent>(data: any): T {
    // ⭐ FOCUS: Create base domain event structure
    const event = Object.create(DomainEvent.prototype);

    // Set standard properties
    event.eventType = data.eventType;
    event.eventId = data.eventId;
    event.aggregateId = EntityId.fromString(data.aggregateId);
    event.aggregateType = data.aggregateType;
    event.version = data.version;
    event.timestamp = new Date(data.timestamp);
    event.correlationId = data.correlationId;
    event.causationId = data.causationId;
    event.metadata = data.metadata;

    // ⭐ FOCUS: Add event-specific data
    if (data.data) {
      Object.assign(event, data.data);
    }

    return event as T;
  }
}

// ⭐ FOCUS: Compressed JSON serializer for large events
export class CompressedJsonSerializer implements IEventSerializer {
  private readonly contentType = 'application/json+compressed';

  async serialize(event: DomainEvent): Promise<Result<string, Error>> {
    try {
      const baseSerializer = new EnhancedJsonSerializer();
      const jsonResult = await baseSerializer.serialize(event);

      if (jsonResult.isFailure()) {
        return jsonResult;
      }

      // ⭐ FOCUS: Simple compression (remove whitespace)
      const compressed = jsonResult.value
        .replace(/\s+/g, ' ')
        .replace(/,\s*}/g, '}')
        .replace(/{\s*/g, '{')
        .trim();

      return Result.ok(compressed);
    } catch (error) {
      return Result.fail(new Error(`Compression failed: ${error.message}`));
    }
  }

  async deserialize<T extends DomainEvent>(
    data: string
  ): Promise<Result<T, Error>> {
    // ⭐ FOCUS: Delegate to enhanced serializer (compression is transparent)
    const baseSerializer = new EnhancedJsonSerializer();
    return await baseSerializer.deserialize<T>(data);
  }

  getContentType(): string {
    return this.contentType;
  }
}

// ⭐ FOCUS: Versioned serializer with schema evolution
export class VersionedJsonSerializer implements IEventSerializer {
  private readonly contentType = 'application/json+versioned';
  private readonly currentVersion = '1.0';

  async serialize(event: DomainEvent): Promise<Result<string, Error>> {
    try {
      const baseSerializer = new EnhancedJsonSerializer();
      const jsonResult = await baseSerializer.serialize(event);

      if (jsonResult.isFailure()) {
        return jsonResult;
      }

      const parsed = JSON.parse(jsonResult.value);

      // ⭐ FOCUS: Add serialization version
      const versionedEvent = {
        ...parsed,
        serializationVersion: this.currentVersion,
        serializedAt: new Date().toISOString(),
      };

      return Result.ok(JSON.stringify(versionedEvent));
    } catch (error) {
      return Result.fail(
        new Error(`Versioned serialization failed: ${error.message}`)
      );
    }
  }

  async deserialize<T extends DomainEvent>(
    data: string
  ): Promise<Result<T, Error>> {
    try {
      const parsed = JSON.parse(data);

      // ⭐ FOCUS: Handle different serialization versions
      const version = parsed.serializationVersion || '1.0';

      switch (version) {
        case '1.0':
          return await this.deserializeV1<T>(parsed);
        default:
          return Result.fail(
            new Error(`Unsupported serialization version: ${version}`)
          );
      }
    } catch (error) {
      return Result.fail(
        new Error(`Versioned deserialization failed: ${error.message}`)
      );
    }
  }

  private async deserializeV1<T extends DomainEvent>(
    data: any
  ): Promise<Result<T, Error>> {
    // ⭐ FOCUS: Version 1.0 deserialization logic
    const baseSerializer = new EnhancedJsonSerializer();

    // Remove versioning metadata before base deserialization
    const { serializationVersion, serializedAt, ...eventData } = data;

    return await baseSerializer.deserialize<T>(JSON.stringify(eventData));
  }

  getContentType(): string {
    return this.contentType;
  }
}

// ⭐ FOCUS: Serialization strategy factory
export class SerializationStrategyFactory {
  private static strategies = new Map<string, () => IEventSerializer>([
    ['json', () => new JsonEventSerializer()],
    ['enhanced-json', () => new EnhancedJsonSerializer()],
    ['compressed-json', () => new CompressedJsonSerializer()],
    ['versioned-json', () => new VersionedJsonSerializer()],
  ]);

  static create(strategyName: string): Result<IEventSerializer, Error> {
    const factory = this.strategies.get(strategyName);

    if (!factory) {
      const available = Array.from(this.strategies.keys()).join(', ');
      return Result.fail(
        new Error(
          `Unknown serialization strategy: ${strategyName}. Available: ${available}`
        )
      );
    }

    try {
      const serializer = factory();
      return Result.ok(serializer);
    } catch (error) {
      return Result.fail(
        new Error(`Failed to create serializer: ${error.message}`)
      );
    }
  }

  static registerStrategy(name: string, factory: () => IEventSerializer): void {
    this.strategies.set(name, factory);
  }

  static getAvailableStrategies(): string[] {
    return Array.from(this.strategies.keys());
  }
}

// ⭐ FOCUS: Serialization performance testing
export class SerializationBenchmark {
  async benchmarkStrategies(
    events: DomainEvent[],
    iterations: number = 100
  ): Promise<Record<string, any>> {
    const strategies = SerializationStrategyFactory.getAvailableStrategies();
    const results: Record<string, any> = {};

    for (const strategyName of strategies) {
      console.log(`Benchmarking ${strategyName}...`);

      const serializerResult =
        SerializationStrategyFactory.create(strategyName);
      if (serializerResult.isFailure()) {
        continue;
      }

      const serializer = serializerResult.value;
      const metrics = await this.benchmarkStrategy(
        serializer,
        events,
        iterations
      );

      results[strategyName] = {
        ...metrics,
        contentType: serializer.getContentType(),
      };
    }

    return results;
  }

  private async benchmarkStrategy(
    serializer: IEventSerializer,
    events: DomainEvent[],
    iterations: number
  ): Promise<any> {
    const metrics = {
      serializationTime: 0,
      deserializationTime: 0,
      averageSize: 0,
      successfulOperations: 0,
      errors: 0,
    };

    let totalSize = 0;

    // ⭐ FOCUS: Benchmark serialization
    const serializeStart = performance.now();
    const serializedEvents: string[] = [];

    for (let i = 0; i < iterations; i++) {
      for (const event of events) {
        try {
          const result = await serializer.serialize(event);

          if (result.isSuccess()) {
            const serialized = result.value;
            serializedEvents.push(serialized);
            totalSize += serialized.length;
            metrics.successfulOperations++;
          } else {
            metrics.errors++;
          }
        } catch (error) {
          metrics.errors++;
        }
      }
    }

    metrics.serializationTime = performance.now() - serializeStart;

    // ⭐ FOCUS: Benchmark deserialization
    const deserializeStart = performance.now();

    for (const serializedEvent of serializedEvents) {
      try {
        const result = await serializer.deserialize(serializedEvent);

        if (result.isFailure()) {
          metrics.errors++;
        }
      } catch (error) {
        metrics.errors++;
      }
    }

    metrics.deserializationTime = performance.now() - deserializeStart;
    metrics.averageSize =
      serializedEvents.length > 0 ? totalSize / serializedEvents.length : 0;

    return metrics;
  }
}

// ⭐ FOCUS: Sample domain events for testing
export class UserRegisteredEvent extends DomainEvent {
  constructor(
    aggregateId: EntityId,
    public readonly email: string,
    public readonly firstName: string,
    public readonly lastName: string,
    public readonly registrationSource: string
  ) {
    super(aggregateId, 'UserRegistered', 1);
  }
}

export class ProfileUpdatedEvent extends DomainEvent {
  constructor(
    aggregateId: EntityId,
    public readonly updatedFields: Record<string, any>,
    public readonly previousValues: Record<string, any>
  ) {
    super(aggregateId, 'ProfileUpdated', 1);
  }
}
```

## Usage Examples

```typescript
// Complete serialization demonstration
import {
  SerializationStrategyFactory,
  SerializationBenchmark,
  UserRegisteredEvent,
  ProfileUpdatedEvent,
} from './event-serialization';

async function demonstrateEventSerialization() {
  // ⭐ FOCUS: Create test events
  const userId = EntityId.createUuid();

  const events = [
    new UserRegisteredEvent(
      userId,
      'john.doe@example.com',
      'John',
      'Doe',
      'web-signup'
    ),
    new ProfileUpdatedEvent(
      userId,
      { firstName: 'Jonathan', phone: '+1-555-0123' },
      { firstName: 'John', phone: null }
    ),
  ];

  // ⭐ FOCUS: Test different serialization strategies
  const strategies = ['enhanced-json', 'compressed-json', 'versioned-json'];

  for (const strategyName of strategies) {
    console.log(`\n--- Testing ${strategyName} Strategy ---`);

    const serializerResult = SerializationStrategyFactory.create(strategyName);

    if (serializerResult.isFailure()) {
      console.error(
        `Failed to create ${strategyName}:`,
        serializerResult.error.message
      );
      continue;
    }

    const serializer = serializerResult.value;

    // ⭐ FOCUS: Serialize events
    for (const event of events) {
      const serializeResult = await serializer.serialize(event);

      if (serializeResult.isSuccess()) {
        const serialized = serializeResult.value;
        console.log(
          `${event.eventType} serialized (${serialized.length} chars)`
        );

        // ⭐ FOCUS: Test deserialization
        const deserializeResult = await serializer.deserialize(serialized);

        if (deserializeResult.isSuccess()) {
          const deserialized = deserializeResult.value;
          console.log(`Successfully deserialized ${deserialized.eventType}`);

          // Verify data integrity
          if (deserialized.eventId === event.eventId) {
            console.log('✅ Data integrity verified');
          } else {
            console.log('❌ Data integrity check failed');
          }
        } else {
          console.error(
            'Deserialization failed:',
            deserializeResult.error.message
          );
        }
      } else {
        console.error('Serialization failed:', serializeResult.error.message);
      }
    }
  }

  // ⭐ FOCUS: Performance benchmarking
  console.log('\n--- Performance Benchmark ---');
  const benchmark = new SerializationBenchmark();
  const benchmarkResults = await benchmark.benchmarkStrategies(events, 10);

  for (const [strategy, metrics] of Object.entries(benchmarkResults)) {
    console.log(`\n${strategy}:`);
    console.log(`  Serialization: ${metrics.serializationTime.toFixed(2)}ms`);
    console.log(
      `  Deserialization: ${metrics.deserializationTime.toFixed(2)}ms`
    );
    console.log(`  Average size: ${metrics.averageSize.toFixed(0)} chars`);
    console.log(
      `  Success rate: ${((metrics.successfulOperations / (metrics.successfulOperations + metrics.errors)) * 100).toFixed(1)}%`
    );
    console.log(`  Content-Type: ${metrics.contentType}`);
  }
}

// ⭐ FOCUS: Register custom serializer
function registerCustomSerializer() {
  class CustomBinarySerializer implements IEventSerializer {
    getContentType(): string {
      return 'application/octet-stream';
    }

    async serialize(event: DomainEvent): Promise<Result<string, Error>> {
      // Custom binary serialization logic
      return Result.ok('binary-data-placeholder');
    }

    async deserialize<T extends DomainEvent>(
      data: string
    ): Promise<Result<T, Error>> {
      // Custom binary deserialization logic
      return Result.fail(new Error('Binary deserialization not implemented'));
    }
  }

  SerializationStrategyFactory.registerStrategy(
    'custom-binary',
    () => new CustomBinarySerializer()
  );

  console.log(
    'Available strategies:',
    SerializationStrategyFactory.getAvailableStrategies()
  );
}

// Run demonstrations
demonstrateEventSerialization().catch(console.error);
registerCustomSerializer();
```

## Key Features

- **Multiple Strategies**: JSON, compressed, versioned, and custom serializers
- **Data Validation**: Comprehensive validation during
  serialization/deserialization
- **Schema Evolution**: Version-aware serialization for backward compatibility
- **Performance Testing**: Built-in benchmarking for strategy comparison
- **Error Handling**: Robust error handling with Result pattern
- **Extensible Design**: Easy registration of custom serialization strategies

## Serialization Benefits

1. **Data Integrity**: Validation ensures data consistency across serialization
   cycles
2. **Performance Optimization**: Choose appropriate strategy based on
   requirements
3. **Schema Evolution**: Handle event schema changes over time
4. **Debugging**: Clear error messages for serialization issues
5. **Flexibility**: Support for multiple data formats and compression strategies

## Strategy Selection Guidelines

- **JSON**: Human-readable, good for development and debugging
- **Compressed JSON**: Space-efficient for large events
- **Versioned JSON**: Future-proof serialization with migration support
- **Binary**: Maximum performance and space efficiency (custom implementation)

## Performance Considerations

- **Event Size**: Large events benefit from compression strategies
- **Serialization Frequency**: High-frequency scenarios need optimized
  serializers
- **Schema Complexity**: Complex nested objects may require specialized handling
- **Version Migration**: Plan migration strategies early in design

## Common Pitfalls

- **Missing Validation**: Always validate serialized data structure
- **Version Compatibility**: Plan for schema evolution from the beginning
- **Error Handling**: Don't ignore serialization/deserialization errors
- **Performance Testing**: Benchmark strategies with realistic data volumes

## Related Examples

- [In-Memory Event Store](./example-1.md)
- [Event Stream Operations](./example-3.md)
- [Event Versioning and Migration](../intermediate/example-3.md)
