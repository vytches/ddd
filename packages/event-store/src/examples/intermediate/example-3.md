# Event Versioning and Migration

**Version**: 1.0.0 **Package**: @vytches-ddd/event-store **Complexity**:
intermediate **Domain**: Infrastructure **Patterns**: event-versioning,
schema-migration, backward-compatibility, event-evolution **Dependencies**:
@vytches-ddd/event-store, @vytches-ddd/events, @vytches-ddd/utils

## Description

Comprehensive event versioning and migration strategies for evolving event
schemas over time. This example demonstrates version-safe event storage,
backward compatibility patterns, and automated migration processes for
enterprise-grade event-driven systems.

## Business Context

As business requirements evolve, event schemas need to change while maintaining
backward compatibility with existing event data. A robust versioning strategy
allows teams to evolve their domain models without breaking existing
integrations or losing historical data.

## Code Example

```typescript
// event-versioning-manager.ts
import {
  InMemoryEventStore,
  JsonEventSerializer,
} from '@vytches-ddd/event-store';
import { DomainEvent, EntityId } from '@vytches-ddd/events';
import { Result } from '@vytches-ddd/utils';
import { Logger } from '@vytches-ddd/logging';
import { EventMigration, VersionedEvent, MigrationContext } from './types'; // From your app

// ⭐ FOCUS: Advanced event versioning with migration support
export class EventVersioningManager {
  private readonly eventStore: InMemoryEventStore;
  private readonly logger = Logger.forContext('EventVersioningManager');
  private readonly migrations = new Map<string, EventMigration[]>();
  private readonly supportedVersions = new Map<string, number[]>();

  constructor() {
    this.eventStore = new InMemoryEventStore({
      serializer: new VersionedEventSerializer(),
      enableSnapshots: false,
    });

    this.registerMigrations();
  }

  private registerMigrations(): void {
    // ⭐ FOCUS: Register migration strategies for different event types
    this.registerEventMigrations('OrderCreated', [
      {
        fromVersion: 1,
        toVersion: 2,
        description: 'Add customer email and shipping address',
        migrate: (event: any) => ({
          ...event,
          customerEmail: event.customerId + '@unknown.com', // Default value
          shippingAddress: {
            street: 'Unknown',
            city: 'Unknown',
            country: 'Unknown',
            postalCode: '00000',
          },
          version: 2,
        }),
      },
      {
        fromVersion: 2,
        toVersion: 3,
        description: 'Add order priority and payment method',
        migrate: (event: any) => ({
          ...event,
          priority: 'normal', // Default priority
          paymentMethod: {
            type: 'credit_card',
            provider: 'unknown',
            last4: '0000',
          },
          version: 3,
        }),
      },
    ]);

    this.registerEventMigrations('ProductCreated', [
      {
        fromVersion: 1,
        toVersion: 2,
        description: 'Add product dimensions and weight',
        migrate: (event: any) => ({
          ...event,
          dimensions: {
            length: 0,
            width: 0,
            height: 0,
            unit: 'cm',
          },
          weight: {
            value: 0,
            unit: 'kg',
          },
          version: 2,
        }),
      },
    ]);

    this.registerEventMigrations('UserRegistered', [
      {
        fromVersion: 1,
        toVersion: 2,
        description: 'Add user preferences and timezone',
        migrate: (event: any) => ({
          ...event,
          preferences: {
            emailNotifications: true,
            smsNotifications: false,
            marketingEmails: false,
          },
          timezone: 'UTC',
          locale: 'en-US',
          version: 2,
        }),
      },
    ]);
  }

  private registerEventMigrations(
    eventType: string,
    migrations: EventMigration[]
  ): void {
    this.migrations.set(eventType, migrations);

    // Track supported versions
    const versions = migrations.map(m => m.fromVersion);
    const latestVersion = Math.max(...migrations.map(m => m.toVersion));
    versions.push(latestVersion);

    this.supportedVersions.set(eventType, [...new Set(versions)].sort());

    this.logger.info('Event migrations registered', {
      eventType,
      migrations: migrations.length,
      supportedVersions: this.supportedVersions.get(eventType),
    });
  }

  async appendVersionedEvents(
    streamId: string,
    events: VersionedEvent[],
    expectedVersion: number = -1
  ): Promise<Result<void, Error>> {
    try {
      // ⭐ FOCUS: Validate event versions before appending
      const validationResult = this.validateEventVersions(events);
      if (validationResult.isFailure()) {
        return Result.fail(validationResult.error);
      }

      // ⭐ FOCUS: Append events with version metadata
      const versionedEvents = events.map(event => ({
        ...event,
        metadata: {
          ...event.metadata,
          eventVersion: event.version,
          migratedFrom: event.originalVersion || event.version,
        },
      }));

      const result = await this.eventStore.appendEvents(
        streamId,
        versionedEvents,
        expectedVersion
      );

      if (result.isSuccess()) {
        this.logger.info('Versioned events appended', {
          streamId,
          eventCount: events.length,
          versions: events.map(e => `${e.eventType}:v${e.version}`),
        });
      }

      return result;
    } catch (error) {
      return Result.fail(
        new Error(`Versioned append failed: ${error.message}`)
      );
    }
  }

  async readEventsWithMigration(
    streamId: string,
    targetVersion?: number
  ): Promise<Result<VersionedEvent[], Error>> {
    try {
      // ⭐ FOCUS: Read raw events from store
      const readResult = await this.eventStore.readStream(streamId);

      if (readResult.isFailure()) {
        return Result.fail(readResult.error);
      }

      const rawEvents = readResult.value.events as VersionedEvent[];

      // ⭐ FOCUS: Apply migrations to bring events to target version
      const migratedEvents: VersionedEvent[] = [];

      for (const event of rawEvents) {
        const migratedEvent = await this.migrateEvent(event, targetVersion);

        if (migratedEvent.isSuccess()) {
          migratedEvents.push(migratedEvent.value);
        } else {
          this.logger.warn('Event migration failed', {
            eventType: event.eventType,
            eventVersion: event.version,
            error: migratedEvent.error.message,
          });

          // Include original event if migration fails
          migratedEvents.push(event);
        }
      }

      this.logger.info('Events read with migration', {
        streamId,
        eventCount: migratedEvents.length,
        targetVersion,
      });

      return Result.ok(migratedEvents);
    } catch (error) {
      return Result.fail(
        new Error(`Read with migration failed: ${error.message}`)
      );
    }
  }

  private async migrateEvent(
    event: VersionedEvent,
    targetVersion?: number
  ): Promise<Result<VersionedEvent, Error>> {
    try {
      const eventType = event.eventType;
      const currentVersion = event.version || 1;

      // ⭐ FOCUS: Determine target version
      const finalVersion = targetVersion || this.getLatestVersion(eventType);

      if (currentVersion === finalVersion) {
        return Result.ok(event); // No migration needed
      }

      if (currentVersion > finalVersion) {
        return Result.fail(
          new Error(
            `Cannot downgrade event from v${currentVersion} to v${finalVersion}`
          )
        );
      }

      // ⭐ FOCUS: Apply migration chain
      let migratedEvent = { ...event };
      let currentVer = currentVersion;

      while (currentVer < finalVersion) {
        const migration = this.findMigration(eventType, currentVer);

        if (!migration) {
          return Result.fail(
            new Error(`No migration found for ${eventType} from v${currentVer}`)
          );
        }

        migratedEvent = migration.migrate(migratedEvent);
        migratedEvent.originalVersion = currentVersion;
        currentVer = migration.toVersion;

        this.logger.debug('Event migrated', {
          eventType,
          fromVersion: migration.fromVersion,
          toVersion: migration.toVersion,
          eventId: event.eventId,
        });
      }

      return Result.ok(migratedEvent);
    } catch (error) {
      return Result.fail(new Error(`Event migration failed: ${error.message}`));
    }
  }

  private findMigration(
    eventType: string,
    fromVersion: number
  ): EventMigration | undefined {
    const migrations = this.migrations.get(eventType) || [];
    return migrations.find(m => m.fromVersion === fromVersion);
  }

  private getLatestVersion(eventType: string): number {
    const versions = this.supportedVersions.get(eventType) || [1];
    return Math.max(...versions);
  }

  private validateEventVersions(events: VersionedEvent[]): Result<void, Error> {
    for (const event of events) {
      const eventType = event.eventType;
      const version = event.version || 1;

      const supportedVersions = this.supportedVersions.get(eventType);

      if (!supportedVersions) {
        return Result.fail(new Error(`Unknown event type: ${eventType}`));
      }

      if (!supportedVersions.includes(version)) {
        return Result.fail(
          new Error(
            `Unsupported version ${version} for event type ${eventType}`
          )
        );
      }
    }

    return Result.ok();
  }

  async migrateStream(
    streamId: string,
    targetVersion?: number
  ): Promise<Result<MigrationResult, Error>> {
    try {
      this.logger.info('Starting stream migration', {
        streamId,
        targetVersion,
      });

      const migrationResult: MigrationResult = {
        streamId,
        originalEventCount: 0,
        migratedEventCount: 0,
        skippedEventCount: 0,
        errorEventCount: 0,
        migrationDetails: [],
        startTime: new Date(),
        endTime: new Date(),
      };

      // ⭐ FOCUS: Read events with migration
      const readResult = await this.readEventsWithMigration(
        streamId,
        targetVersion
      );

      if (readResult.isFailure()) {
        return Result.fail(readResult.error);
      }

      const events = readResult.value;
      migrationResult.originalEventCount = events.length;
      migrationResult.migratedEventCount = events.filter(
        e => e.originalVersion
      ).length;
      migrationResult.skippedEventCount = events.filter(
        e => !e.originalVersion
      ).length;

      // ⭐ FOCUS: Track migration details
      for (const event of events) {
        if (event.originalVersion && event.originalVersion !== event.version) {
          migrationResult.migrationDetails.push({
            eventId: event.eventId,
            eventType: event.eventType,
            fromVersion: event.originalVersion,
            toVersion: event.version!,
            timestamp: new Date(),
          });
        }
      }

      migrationResult.endTime = new Date();

      this.logger.info('Stream migration completed', {
        streamId,
        duration:
          migrationResult.endTime.getTime() -
          migrationResult.startTime.getTime(),
        migrated: migrationResult.migratedEventCount,
        skipped: migrationResult.skippedEventCount,
      });

      return Result.ok(migrationResult);
    } catch (error) {
      return Result.fail(
        new Error(`Stream migration failed: ${error.message}`)
      );
    }
  }

  async getSupportedVersions(eventType: string): Promise<number[]> {
    return this.supportedVersions.get(eventType) || [];
  }

  async getEventTypeVersions(): Promise<Record<string, number[]>> {
    const result: Record<string, number[]> = {};

    for (const [eventType, versions] of this.supportedVersions.entries()) {
      result[eventType] = versions;
    }

    return result;
  }

  async validateMigrationPath(
    eventType: string,
    fromVersion: number,
    toVersion: number
  ): Promise<Result<string[], Error>> {
    try {
      const path: string[] = [];
      let currentVersion = fromVersion;

      while (currentVersion < toVersion) {
        const migration = this.findMigration(eventType, currentVersion);

        if (!migration) {
          return Result.fail(
            new Error(
              `No migration path from v${fromVersion} to v${toVersion} for ${eventType}`
            )
          );
        }

        path.push(
          `v${migration.fromVersion} -> v${migration.toVersion}: ${migration.description}`
        );
        currentVersion = migration.toVersion;
      }

      return Result.ok(path);
    } catch (error) {
      return Result.fail(
        new Error(`Migration path validation failed: ${error.message}`)
      );
    }
  }

  // ⭐ FOCUS: Add test data for demonstration
  async seedTestData(): Promise<void> {
    // Create events with different versions
    const orderV1 = new OrderCreatedEventV1(
      EntityId.createUuid(),
      'customer-1',
      150.0,
      'USD'
    );

    const orderV2 = new OrderCreatedEventV2(
      EntityId.createUuid(),
      'customer-2',
      250.0,
      'USD',
      'customer-2@example.com',
      {
        street: '123 Main St',
        city: 'New York',
        country: 'USA',
        postalCode: '10001',
      }
    );

    const orderV3 = new OrderCreatedEventV3(
      EntityId.createUuid(),
      'customer-3',
      350.0,
      'USD',
      'customer-3@example.com',
      {
        street: '456 Oak Ave',
        city: 'Los Angeles',
        country: 'USA',
        postalCode: '90210',
      },
      'high',
      {
        type: 'credit_card',
        provider: 'visa',
        last4: '1234',
      }
    );

    // Append mixed version events
    await this.appendVersionedEvents('order-mixed-1', [orderV1]);
    await this.appendVersionedEvents('order-mixed-2', [orderV2]);
    await this.appendVersionedEvents('order-mixed-3', [orderV3]);

    this.logger.info('Test data seeded', {
      streams: 3,
      versions: [orderV1.version, orderV2.version, orderV3.version],
    });
  }
}

// ⭐ FOCUS: Versioned event serializer
export class VersionedEventSerializer extends JsonEventSerializer {
  serialize(event: DomainEvent): string {
    const versionedEvent = event as VersionedEvent;

    const serializedData = {
      ...event,
      version: versionedEvent.version || 1,
      originalVersion: versionedEvent.originalVersion,
      schemaVersion: '1.0',
      serializedAt: new Date().toISOString(),
    };

    return JSON.stringify(serializedData);
  }

  deserialize(data: string): DomainEvent {
    const parsed = JSON.parse(data);

    // Reconstruct versioned event with version information
    const event = super.deserialize(data) as VersionedEvent;
    event.version = parsed.version || 1;
    event.originalVersion = parsed.originalVersion;

    return event;
  }
}

// ⭐ FOCUS: Supporting types and interfaces
interface MigrationResult {
  streamId: string;
  originalEventCount: number;
  migratedEventCount: number;
  skippedEventCount: number;
  errorEventCount: number;
  migrationDetails: Array<{
    eventId: string;
    eventType: string;
    fromVersion: number;
    toVersion: number;
    timestamp: Date;
  }>;
  startTime: Date;
  endTime: Date;
}

// ⭐ FOCUS: Sample versioned events
export class OrderCreatedEventV1 extends DomainEvent implements VersionedEvent {
  public readonly version = 1;
  public originalVersion?: number;

  constructor(
    aggregateId: EntityId,
    public readonly customerId: string,
    public readonly totalAmount: number,
    public readonly currency: string
  ) {
    super(aggregateId, 'OrderCreated', 1);
  }
}

export class OrderCreatedEventV2 extends DomainEvent implements VersionedEvent {
  public readonly version = 2;
  public originalVersion?: number;

  constructor(
    aggregateId: EntityId,
    public readonly customerId: string,
    public readonly totalAmount: number,
    public readonly currency: string,
    public readonly customerEmail: string,
    public readonly shippingAddress: {
      street: string;
      city: string;
      country: string;
      postalCode: string;
    }
  ) {
    super(aggregateId, 'OrderCreated', 2);
  }
}

export class OrderCreatedEventV3 extends DomainEvent implements VersionedEvent {
  public readonly version = 3;
  public originalVersion?: number;

  constructor(
    aggregateId: EntityId,
    public readonly customerId: string,
    public readonly totalAmount: number,
    public readonly currency: string,
    public readonly customerEmail: string,
    public readonly shippingAddress: {
      street: string;
      city: string;
      country: string;
      postalCode: string;
    },
    public readonly priority: string,
    public readonly paymentMethod: {
      type: string;
      provider: string;
      last4: string;
    }
  ) {
    super(aggregateId, 'OrderCreated', 3);
  }
}

export class ProductCreatedEventV1
  extends DomainEvent
  implements VersionedEvent
{
  public readonly version = 1;
  public originalVersion?: number;

  constructor(
    aggregateId: EntityId,
    public readonly name: string,
    public readonly category: string,
    public readonly price: number
  ) {
    super(aggregateId, 'ProductCreated', 1);
  }
}

export class UserRegisteredEventV1
  extends DomainEvent
  implements VersionedEvent
{
  public readonly version = 1;
  public originalVersion?: number;

  constructor(
    aggregateId: EntityId,
    public readonly email: string,
    public readonly firstName: string,
    public readonly lastName: string
  ) {
    super(aggregateId, 'UserRegistered', 1);
  }
}
```

## Usage Examples

```typescript
// Complete event versioning demonstration
import {
  EventVersioningManager,
  OrderCreatedEventV1,
  OrderCreatedEventV2,
  OrderCreatedEventV3,
} from './event-versioning-manager';

async function demonstrateEventVersioning() {
  const versionManager = new EventVersioningManager();

  // ⭐ FOCUS: Seed test data with mixed versions
  await versionManager.seedTestData();

  console.log('--- Event Versioning & Migration Demo ---\n');

  // ⭐ FOCUS: 1. Show supported versions
  console.log('1. Supported Event Versions:');
  const versionInfo = await versionManager.getEventTypeVersions();

  for (const [eventType, versions] of Object.entries(versionInfo)) {
    console.log(`  ${eventType}: versions ${versions.join(', ')}`);
  }

  // ⭐ FOCUS: 2. Validate migration paths
  console.log('\n2. Migration Path Validation:');
  const migrationPath = await versionManager.validateMigrationPath(
    'OrderCreated',
    1,
    3
  );

  if (migrationPath.isSuccess()) {
    console.log('  Migration path from v1 to v3:');
    migrationPath.value.forEach(step => {
      console.log(`    ${step}`);
    });
  }

  // ⭐ FOCUS: 3. Read events with automatic migration
  console.log('\n3. Reading Events with Migration:');

  // Read v1 events and migrate to latest version
  const v1StreamResult = await versionManager.readEventsWithMigration(
    'order-mixed-1',
    3
  );

  if (v1StreamResult.isSuccess()) {
    const events = v1StreamResult.value;
    console.log(`  Stream 1: ${events.length} events`);
    events.forEach(event => {
      const originalVer = event.originalVersion || event.version;
      const currentVer = event.version;
      console.log(`    ${event.eventType}: v${originalVer} -> v${currentVer}`);
    });
  }

  // ⭐ FOCUS: 4. Stream migration with full reporting
  console.log('\n4. Complete Stream Migration:');
  const migrationResult = await versionManager.migrateStream(
    'order-mixed-2',
    3
  );

  if (migrationResult.isSuccess()) {
    const result = migrationResult.value;
    console.log(`  Migration Results for ${result.streamId}:`);
    console.log(`    Original events: ${result.originalEventCount}`);
    console.log(`    Migrated events: ${result.migratedEventCount}`);
    console.log(`    Skipped events: ${result.skippedEventCount}`);
    console.log(
      `    Duration: ${result.endTime.getTime() - result.startTime.getTime()}ms`
    );

    if (result.migrationDetails.length > 0) {
      console.log('    Migration details:');
      result.migrationDetails.forEach(detail => {
        console.log(
          `      ${detail.eventType}: v${detail.fromVersion} -> v${detail.toVersion}`
        );
      });
    }
  }

  // ⭐ FOCUS: 5. Append new versioned events
  console.log('\n5. Appending Versioned Events:');

  const newOrderV3 = new OrderCreatedEventV3(
    EntityId.createUuid(),
    'customer-new',
    500.0,
    'USD',
    'customer-new@example.com',
    {
      street: '789 Pine St',
      city: 'Chicago',
      country: 'USA',
      postalCode: '60601',
    },
    'urgent',
    {
      type: 'debit_card',
      provider: 'mastercard',
      last4: '5678',
    }
  );

  const appendResult = await versionManager.appendVersionedEvents(
    'order-new-1',
    [newOrderV3]
  );

  if (appendResult.isSuccess()) {
    console.log('  New v3 order event appended successfully');

    // Read it back to verify
    const readBack =
      await versionManager.readEventsWithMigration('order-new-1');
    if (readBack.isSuccess() && readBack.value.length > 0) {
      const event = readBack.value[0];
      console.log(`    Verified: ${event.eventType} v${event.version}`);
      console.log(`    Priority: ${(event as any).priority}`);
      console.log(`    Payment: ${(event as any).paymentMethod.provider}`);
    }
  }

  // ⭐ FOCUS: 6. Demonstrate backward compatibility
  console.log('\n6. Backward Compatibility:');

  // Create a mix of versions and append to same stream
  const mixedEvents = [
    new OrderCreatedEventV1(EntityId.createUuid(), 'customer-old', 100, 'USD'),
    new OrderCreatedEventV2(
      EntityId.createUuid(),
      'customer-mid',
      200,
      'USD',
      'mid@example.com',
      {
        street: 'Mid St',
        city: 'Mid City',
        country: 'USA',
        postalCode: '12345',
      }
    ),
    new OrderCreatedEventV3(
      EntityId.createUuid(),
      'customer-latest',
      300,
      'USD',
      'latest@example.com',
      {
        street: 'Latest Ave',
        city: 'Latest Town',
        country: 'USA',
        postalCode: '67890',
      },
      'normal',
      { type: 'paypal', provider: 'paypal', last4: 'N/A' }
    ),
  ];

  const mixedAppendResult = await versionManager.appendVersionedEvents(
    'order-mixed-versions',
    mixedEvents
  );

  if (mixedAppendResult.isSuccess()) {
    console.log('  Mixed version events appended successfully');

    // Read with migration to latest
    const mixedReadResult = await versionManager.readEventsWithMigration(
      'order-mixed-versions',
      3
    );

    if (mixedReadResult.isSuccess()) {
      const events = mixedReadResult.value;
      console.log('  All events migrated to v3:');
      events.forEach((event, index) => {
        const originalVer = event.originalVersion || event.version;
        console.log(
          `    Event ${index + 1}: v${originalVer} -> v${event.version}`
        );
      });
    }
  }

  // ⭐ FOCUS: 7. Version compatibility check
  console.log('\n7. Version Compatibility:');
  const orderVersions =
    await versionManager.getSupportedVersions('OrderCreated');
  const productVersions =
    await versionManager.getSupportedVersions('ProductCreated');

  console.log(`  OrderCreated supports versions: ${orderVersions.join(', ')}`);
  console.log(
    `  ProductCreated supports versions: ${productVersions.join(', ')}`
  );
}

// Run the demonstration
demonstrateEventVersioning().catch(console.error);
```

## Key Features

- **Schema Evolution**: Systematic approach to evolving event schemas over time
- **Automatic Migration**: Chain migrations to upgrade events to target versions
- **Backward Compatibility**: Read old events while maintaining compatibility
- **Version Validation**: Ensure only supported versions are stored and
  processed
- **Migration Tracking**: Detailed logging and reporting of migration operations
- **Flexible Targeting**: Migrate to specific versions or latest automatically
- **Error Handling**: Comprehensive error handling for migration failures

## Versioning Benefits

1. **Business Continuity**: Evolve schemas without breaking existing systems
2. **Historical Data**: Maintain access to legacy event data
3. **Gradual Migration**: Migrate systems incrementally without downtime
4. **Quality Assurance**: Validate migration paths before deployment
5. **Audit Trails**: Complete history of schema changes and migrations
6. **Developer Experience**: Clear migration paths and version management

## Migration Strategies

- **Forward Migration**: Upgrade events from old to new versions
- **Chain Migration**: Multiple migration steps for complex version jumps
- **Lazy Migration**: Migrate events only when read from storage
- **Batch Migration**: Process entire streams for version consistency
- **Validation**: Verify migration paths before applying changes
- **Rollback Planning**: Prepare for migration failure scenarios

## Version Management

- **Semantic Versioning**: Clear version numbering for event schemas
- **Supported Versions**: Track which versions are actively supported
- **Migration Registry**: Centralized migration logic and documentation
- **Compatibility Matrix**: Understanding of cross-version compatibility
- **Deprecation Timeline**: Planned obsolescence of old schema versions

## Performance Considerations

- **Lazy Migration**: Migrate only when events are actually read
- **Caching**: Cache migrated events to avoid repeated processing
- **Batch Operations**: Process multiple events efficiently
- **Memory Management**: Handle large streams without memory issues
- **Index Strategy**: Maintain performance with version metadata

## Common Pitfalls

- **Breaking Changes**: Avoid migrations that cannot preserve data integrity
- **Performance Impact**: Monitor migration overhead on read operations
- **Version Sprawl**: Limit the number of supported versions over time
- **Migration Bugs**: Thoroughly test migration logic before deployment
- **Documentation**: Maintain clear documentation of schema changes

## Related Examples

- [Event Replay Engine](./example-1.md)
- [Stream-Based Projections](./example-2.md)
- [High-Performance Event Store](../advanced/example-2.md)
