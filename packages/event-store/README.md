# @vytches-ddd/event-store

Enterprise-grade Event Store implementation for Domain-Driven Design
applications with full Event Sourcing support.

## Features

- 🚀 **Stream-based Storage** - Organize events by aggregate streams
- 🔒 **Optimistic Concurrency Control** - Version-based conflict detection
- 📸 **Snapshot Support** - Performance optimization for large aggregates
- 🌍 **Global Event Log** - Read all events across streams
- 🔄 **Event Replay** - Foundation for projection rebuilding
- 🏭 **Multiple Storage Adapters** - In-memory, file system, and database
  backends
- 📊 **Rich Metadata** - Correlation, causation, and custom metadata support
- 🧪 **Testing Ready** - In-memory implementation for tests

## Installation

```bash
npm install @vytches-ddd/event-store
```

## Quick Start

```typescript
import { InMemoryEventStore } from '@vytches-ddd/event-store';
import type { IExtendedDomainEvent } from '@vytches-ddd/contracts';

// Create event store
const eventStore = new InMemoryEventStore({
  enableSnapshots: true,
  snapshotFrequency: 100,
  enableOptimisticConcurrency: true,
});

// Append events to stream
const events: IExtendedDomainEvent[] = [
  {
    eventId: '123',
    eventType: 'OrderCreated',
    aggregateId: 'order-1',
    aggregateType: 'Order',
    aggregateVersion: 1,
    timestamp: new Date(),
    payload: { customerId: 'cust-1', total: 100 },
    metadata: { userId: 'user-1' },
  },
];

const result = await eventStore.appendToStream('order-1', events);

// Read events from stream
const stream = await eventStore.readStream('order-1');
console.log(stream.events); // All events for order-1

// Read all events globally
const allEvents = await eventStore.readAll({
  filterByEventType: ['OrderCreated'],
  maxCount: 100,
});
```

## Core Concepts

### Event Streams

Events are organized into streams, typically one stream per aggregate:

```typescript
// Append with optimistic concurrency control
await eventStore.appendToStream(
  'order-123',
  events,
  expectedVersion // Current version of the stream
);

// Read stream with options
const stream = await eventStore.readStream('order-123', {
  fromVersion: 5,
  maxCount: 50,
  direction: 'forward',
});
```

### Snapshots

Optimize performance for aggregates with many events:

```typescript
// Save snapshot
const snapshot = {
  aggregateId: 'order-123',
  aggregateType: 'Order',
  version: 100,
  timestamp: new Date(),
  data: orderState,
};

await eventStore.saveSnapshot('order-123', snapshot);

// Get latest snapshot
const latestSnapshot = await eventStore.getSnapshot('order-123');
```

### Global Event Log

Read events across all streams:

```typescript
// Read all events with filters
const globalEvents = await eventStore.readAll({
  fromPosition: 1000n,
  filterByEventType: ['OrderCreated', 'OrderShipped'],
  filterByStreamPrefix: 'order-',
  direction: 'backward',
  maxCount: 100,
});
```

## Advanced Usage

### Custom Serialization

```typescript
import { JsonEventSerializer } from '@vytches-ddd/event-store';

const eventStore = new InMemoryEventStore({
  serializer: new JsonEventSerializer(true), // Pretty print
});
```

### Stream Management

```typescript
// Check if stream exists
const exists = await eventStore.streamExists('order-123');

// Get stream version
const version = await eventStore.getStreamVersion('order-123');

// Delete stream (soft delete)
await eventStore.deleteStream('order-123', expectedVersion);

// Get/Set stream metadata
const metadata = await eventStore.getStreamMetadata('order-123');
await eventStore.setStreamMetadata('order-123', {
  customMetadata: { archived: true },
});
```

### Error Handling

```typescript
import {
  EventStoreConcurrencyError,
  StreamNotFoundError,
} from '@vytches-ddd/event-store';

try {
  await eventStore.appendToStream('order-123', events, 5);
} catch (error) {
  if (error instanceof EventStoreConcurrencyError) {
    console.error(
      'Version conflict:',
      error.expectedVersion,
      error.actualVersion
    );
  } else if (error instanceof StreamNotFoundError) {
    console.error('Stream not found:', error.streamId);
  }
}
```

## Storage Adapters

### In-Memory (Development/Testing)

```typescript
const eventStore = new InMemoryEventStore();
await eventStore.connect();

// Clear all data
await eventStore.clear();
```

### File System (Coming Soon)

```typescript
// const eventStore = new FileSystemEventStore({
//   directory: './data/events',
//   format: 'jsonl',
// });
```

### PostgreSQL with TypeORM (Production Ready)

```typescript
import { PostgreSQLEventStore } from '@vytches-ddd/event-store';
import { DataSource } from 'typeorm';
import { EventEntity, StreamEntity, SnapshotEntity } from './entities';

const dataSource = new DataSource({
  type: 'postgres',
  host: 'localhost',
  port: 5432,
  username: 'postgres',
  password: 'password',
  database: 'eventstore',
  entities: [EventEntity, StreamEntity, SnapshotEntity],
  synchronize: false, // Use migrations in production
  migrations: ['src/migrations/*.ts'],
});

const eventStore = new PostgreSQLEventStore({
  dataSource,
  schema: 'event_store',
  enableChecksums: true,
  enableSnapshots: true,
  snapshotFrequency: 100,
});
```

#### TypeORM Entities

```typescript
// entities/event.entity.ts
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

// entities/stream.entity.ts
import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

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

// entities/snapshot.entity.ts
import { Entity, Column, PrimaryColumn, CreateDateColumn } from 'typeorm';

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

#### Database Migration

```typescript
// migrations/001-create-event-store-schema.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEventStoreSchema1234567890 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE SCHEMA IF NOT EXISTS event_store;
      
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
      
      CREATE TABLE event_store.snapshots (
        stream_id VARCHAR(255) PRIMARY KEY,
        aggregate_id VARCHAR(255) NOT NULL,
        aggregate_type VARCHAR(255) NOT NULL,
        version INTEGER NOT NULL,
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        state JSONB NOT NULL,
        checksum VARCHAR(64)
      );
      
      -- Indexes for performance
      CREATE INDEX idx_events_aggregate ON event_store.events (aggregate_id, aggregate_version);
      CREATE INDEX idx_events_type ON event_store.events (event_type);
      CREATE INDEX idx_events_timestamp ON event_store.events (timestamp);
      CREATE INDEX idx_events_global_version ON event_store.events (global_version);
      CREATE INDEX idx_events_position ON event_store.events (position);
      
      -- Sequence for global ordering
      CREATE SEQUENCE event_store.global_version_seq;
      CREATE SEQUENCE event_store.position_seq;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP SCHEMA event_store CASCADE;
    `);
  }
}
```

## NestJS Integration

### Module Setup

```typescript
// event-store.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEntity, StreamEntity, SnapshotEntity } from './entities';
import { PostgreSQLEventStore } from '@vytches-ddd/event-store';
import { JsonEventSerializer } from '@vytches-ddd/event-store';

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
          serializer: new JsonEventSerializer(),
          enableSnapshots: true,
          snapshotFrequency: 100,
          enableOptimisticConcurrency: true,
          enableChecksums: true,
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

### Service Layer

```typescript
// order-event-store.service.ts
import { Injectable, Inject } from '@nestjs/common';
import { IAdvancedEventStore } from '@vytches-ddd/event-store';
import { Order } from '../domain/order.aggregate';
import { OrderCreatedEvent, OrderShippedEvent } from '../domain/events';

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

    await this.eventStore.appendToStream(
      order.id,
      storedEvents,
      order.version - events.length // Expected version before new events
    );

    // Save snapshot every 100 events
    if (order.version % 100 === 0) {
      await this.eventStore.saveSnapshot(order.id, {
        aggregateId: order.id,
        aggregateType: 'Order',
        version: order.version,
        timestamp: new Date(),
        state: order.toSnapshot(),
      });
    }

    order.markEventsAsCommitted();
  }

  async loadOrder(orderId: string): Promise<Order | null> {
    try {
      // Try to load from snapshot first
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

  async getOrderHistory(orderId: string): Promise<IStoredEvent[]> {
    const stream = await this.eventStore.readStream(orderId);
    return stream.events;
  }

  async getAllOrderEvents(fromPosition?: bigint): Promise<IStoredEvent[]> {
    const result = await this.eventStore.readAll({
      fromPosition,
      filterByStreamPrefix: 'order-',
      maxCount: 1000,
    });
    return result.events;
  }
}
```

### Application Service

```typescript
// order.service.ts
import { Injectable } from '@nestjs/common';
import { OrderEventStoreService } from './order-event-store.service';
import { CreateOrderCommand, ShipOrderCommand } from '../commands';
import { Order } from '../domain/order.aggregate';
import { EventStoreConcurrencyError } from '@vytches-ddd/event-store';

@Injectable()
export class OrderService {
  constructor(private readonly orderEventStore: OrderEventStoreService) {}

  async createOrder(command: CreateOrderCommand): Promise<void> {
    const order = Order.create(command.orderId);
    order.initialize(command.customerId, command.items);

    await this.orderEventStore.saveOrder(order);
  }

  async shipOrder(command: ShipOrderCommand): Promise<void> {
    const order = await this.orderEventStore.loadOrder(command.orderId);

    if (!order) {
      throw new Error(`Order ${command.orderId} not found`);
    }

    order.ship(command.trackingNumber, command.carrier);

    try {
      await this.orderEventStore.saveOrder(order);
    } catch (error) {
      if (error instanceof EventStoreConcurrencyError) {
        // Reload and retry
        const freshOrder = await this.orderEventStore.loadOrder(
          command.orderId
        );
        if (freshOrder) {
          freshOrder.ship(command.trackingNumber, command.carrier);
          await this.orderEventStore.saveOrder(freshOrder);
        }
      } else {
        throw error;
      }
    }
  }

  async getOrderDetails(orderId: string): Promise<OrderDetails | null> {
    const order = await this.orderEventStore.loadOrder(orderId);
    return order ? order.toDetails() : null;
  }
}
```

### Domain Aggregate with Event Store

```typescript
// domain/order.aggregate.ts
import { AggregateRoot } from '@vytches-ddd/core';
import { OrderCreatedEvent, OrderShippedEvent } from './events';
import { IStoredEvent } from '@vytches-ddd/event-store';

export class Order extends AggregateRoot {
  private constructor(
    id: string,
    private customerId?: string,
    private items: OrderItem[] = [],
    private status: OrderStatus = OrderStatus.Created,
    private trackingNumber?: string,
    private carrier?: string
  ) {
    super(id);
  }

  static create(orderId: string): Order {
    return new Order(orderId);
  }

  static fromSnapshot(snapshot: IAggregateSnapshot<OrderState>): Order {
    const order = new Order(
      snapshot.aggregateId as string,
      snapshot.state.customerId,
      snapshot.state.items,
      snapshot.state.status,
      snapshot.state.trackingNumber,
      snapshot.state.carrier
    );
    order.version = snapshot.version;
    return order;
  }

  initialize(customerId: string, items: OrderItem[]): void {
    if (this.customerId) {
      throw new Error('Order already initialized');
    }

    this.customerId = customerId;
    this.items = items;
    this.status = OrderStatus.Created;

    this.addDomainEvent(
      new OrderCreatedEvent({
        orderId: this.id,
        customerId,
        items,
        total: this.calculateTotal(),
      })
    );
  }

  ship(trackingNumber: string, carrier: string): void {
    if (this.status !== OrderStatus.Created) {
      throw new Error('Order cannot be shipped');
    }

    this.trackingNumber = trackingNumber;
    this.carrier = carrier;
    this.status = OrderStatus.Shipped;

    this.addDomainEvent(
      new OrderShippedEvent({
        orderId: this.id,
        trackingNumber,
        carrier,
      })
    );
  }

  loadFromHistory(events: IStoredEvent[]): void {
    events.forEach(event => {
      this.applyEvent(event, false); // Don't add to uncommitted events
    });
  }

  protected applyEvent(event: IStoredEvent, isNew = true): void {
    switch (event.eventType) {
      case 'OrderCreated':
        this.applyOrderCreated(event.payload as OrderCreatedEvent['payload']);
        break;
      case 'OrderShipped':
        this.applyOrderShipped(event.payload as OrderShippedEvent['payload']);
        break;
    }

    if (isNew) {
      this.version++;
    } else {
      this.version = event.aggregateVersion;
    }
  }

  private applyOrderCreated(payload: any): void {
    this.customerId = payload.customerId;
    this.items = payload.items;
    this.status = OrderStatus.Created;
  }

  private applyOrderShipped(payload: any): void {
    this.trackingNumber = payload.trackingNumber;
    this.carrier = payload.carrier;
    this.status = OrderStatus.Shipped;
  }

  toSnapshot(): OrderState {
    return {
      customerId: this.customerId!,
      items: this.items,
      status: this.status,
      trackingNumber: this.trackingNumber,
      carrier: this.carrier,
    };
  }

  toDetails(): OrderDetails {
    return {
      id: this.id,
      customerId: this.customerId!,
      items: this.items,
      status: this.status,
      trackingNumber: this.trackingNumber,
      carrier: this.carrier,
      total: this.calculateTotal(),
    };
  }

  private calculateTotal(): number {
    return this.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
  }
}

interface OrderState {
  customerId: string;
  items: OrderItem[];
  status: OrderStatus;
  trackingNumber?: string;
  carrier?: string;
}

interface OrderDetails extends OrderState {
  id: string;
  total: number;
}

interface OrderItem {
  productId: string;
  quantity: number;
  price: number;
}

enum OrderStatus {
  Created = 'created',
  Shipped = 'shipped',
  Delivered = 'delivered',
}
```

### Health Check

```typescript
// health/event-store.health.ts
import { Injectable } from '@nestjs/common';
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
    const isHealthy = this.eventStore.isConnected();

    if (isHealthy) {
      return this.getStatus(key, true);
    }

    throw new HealthCheckError(
      'Event Store health check failed',
      this.getStatus(key, false)
    );
  }
}
```

### Performance Considerations

```typescript
// performance/event-store.config.ts
export const eventStoreConfig = {
  // Connection pooling
  connectionPoolSize: 20,

  // Batch processing
  batchSize: 100,
  flushInterval: 1000, // ms

  // Caching
  enableMetadataCache: true,
  metadataCacheTtl: 300000, // 5 minutes

  // Compression
  enableCompression: true,
  compressionLevel: 6,

  // Indexing strategy
  enableEventTypeIndex: true,
  enableTimestampIndex: true,
  enableAggregateIndex: true,

  // Snapshot optimization
  snapshotFrequency: 100,
  enableSnapshotCompression: true,

  // Query optimization
  defaultPageSize: 100,
  maxPageSize: 1000,
  enableQueryHints: true,
};

// Connection with optimizations
const eventStore = new PostgreSQLEventStore({
  dataSource,
  schema: 'event_store',
  ...eventStoreConfig,

  // Read replicas for queries
  readReplicas: [
    { host: 'replica1.db.com', port: 5432 },
    { host: 'replica2.db.com', port: 5432 },
  ],

  // Connection pooling
  pool: {
    min: 5,
    max: 20,
    acquireTimeoutMillis: 30000,
    idleTimeoutMillis: 600000,
  },
});
```

### Security Implementation

```typescript
// security/event-store-security.service.ts
import { Injectable } from '@nestjs/common';
import { createHash, createCipher, createDecipher } from 'crypto';

@Injectable()
export class EventStoreSecurityService {
  private readonly encryptionKey: string;
  private readonly algorithm = 'aes-256-cbc';

  constructor() {
    this.encryptionKey = process.env.EVENT_STORE_ENCRYPTION_KEY!;
  }

  // Encrypt sensitive event data
  encryptEventData(data: any): string {
    const cipher = createCipher(this.algorithm, this.encryptionKey);
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  // Decrypt sensitive event data
  decryptEventData(encryptedData: string): any {
    const decipher = createDecipher(this.algorithm, this.encryptionKey);
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
  }

  // Calculate event checksum for integrity
  calculateChecksum(event: any): string {
    const hash = createHash('sha256');
    hash.update(JSON.stringify(event));
    return hash.digest('hex');
  }

  // Verify event integrity
  verifyEventIntegrity(event: any, expectedChecksum: string): boolean {
    const actualChecksum = this.calculateChecksum(event);
    return actualChecksum === expectedChecksum;
  }

  // Audit log entry
  createAuditEntry(
    action: string,
    streamId: string,
    userId: string,
    metadata?: any
  ): AuditEntry {
    return {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      action,
      streamId,
      userId,
      metadata,
      checksum: this.calculateChecksum({ action, streamId, userId, metadata }),
    };
  }
}

// Secure event store wrapper
@Injectable()
export class SecureEventStoreService {
  constructor(
    @Inject('EVENT_STORE')
    private readonly eventStore: IAdvancedEventStore,
    private readonly securityService: EventStoreSecurityService
  ) {}

  async appendToStreamSecure(
    streamId: string,
    events: IStoredDomainEvent[],
    userId: string,
    expectedVersion?: number
  ): Promise<IAppendResult> {
    // Encrypt sensitive data
    const secureEvents = events.map(event => ({
      ...event,
      payload: this.shouldEncryptEvent(event.eventType)
        ? this.securityService.encryptEventData(event.payload)
        : event.payload,
      checksum: this.securityService.calculateChecksum(event),
      metadata: {
        ...event.metadata,
        userId,
        encrypted: this.shouldEncryptEvent(event.eventType),
      },
    }));

    // Append to store
    const result = await this.eventStore.appendToStream(
      streamId,
      secureEvents,
      expectedVersion
    );

    // Create audit entry
    const auditEntry = this.securityService.createAuditEntry(
      'APPEND_EVENTS',
      streamId,
      userId,
      { eventCount: events.length, version: result.toVersion }
    );

    // Log audit entry (implement your audit logging)
    await this.logAuditEntry(auditEntry);

    return result;
  }

  private shouldEncryptEvent(eventType: string): boolean {
    // Define which events contain sensitive data
    const sensitiveEvents = [
      'UserRegistered',
      'PaymentProcessed',
      'PersonalDataUpdated',
    ];
    return sensitiveEvents.includes(eventType);
  }

  private async logAuditEntry(entry: AuditEntry): Promise<void> {
    // Implement audit logging to separate audit store
    // This ensures compliance with security requirements
  }
}

interface AuditEntry {
  id: string;
  timestamp: Date;
  action: string;
  streamId: string;
  userId: string;
  metadata?: any;
  checksum: string;
}
```

## Integration with DDD Patterns

### Repository Integration

```typescript
import { BaseRepository } from '@vytches-ddd/repositories';
import { IAdvancedEventStore } from '@vytches-ddd/event-store';

class OrderRepository extends BaseRepository<Order> {
  constructor(
    private eventStore: IAdvancedEventStore,
    eventDispatcher: IEventDispatcher
  ) {
    super(eventDispatcher);
  }

  async save(order: Order): Promise<void> {
    // Persist events to event store
    await this.eventStore.appendToStream(
      order.id,
      order.getUncommittedEvents(),
      order.version
    );

    // Dispatch events
    await super.save(order);
  }

  async findById(id: string): Promise<Order | null> {
    // Try to load from snapshot
    const snapshot = await this.eventStore.getSnapshot<OrderState>(id);

    // Load events after snapshot
    const fromVersion = snapshot ? snapshot.version + 1 : 0;
    const stream = await this.eventStore.readStream(id, { fromVersion });

    if (!snapshot && stream.events.length === 0) {
      return null;
    }

    // Reconstruct aggregate from snapshot + events
    const order = snapshot ? Order.fromSnapshot(snapshot) : new Order(id);

    order.loadFromHistory(stream.events);
    return order;
  }
}
```

### Event Sourcing Aggregate

```typescript
import { AggregateRoot } from '@vytches-ddd/core';

class Order extends AggregateRoot {
  loadFromHistory(events: IStoredEvent[]): void {
    events.forEach(event => {
      this.applyEvent(event, false); // Don't add to uncommitted
    });
  }

  static fromSnapshot(snapshot: IAggregateSnapshot<OrderState>): Order {
    const order = new Order(snapshot.aggregateId);
    order.restoreFromSnapshot(snapshot.data);
    order.version = snapshot.version;
    return order;
  }

  toSnapshot(): OrderState {
    return {
      id: this.id,
      customerId: this.customerId,
      items: this.items,
      status: this.status,
      total: this.total,
    };
  }
}
```

## Best Practices

1. **One Stream Per Aggregate** - Keep events for each aggregate in its own
   stream
2. **Use Snapshots Wisely** - Balance between performance and storage
3. **Version Everything** - Always use optimistic concurrency control in
   production
4. **Event Immutability** - Never modify events after they're stored
5. **Metadata Standards** - Establish consistent metadata patterns across your
   domain

## API Reference

See the [API documentation](https://vytches-ddd.dev/api/event-store) for
detailed interface definitions.

## License

MIT
