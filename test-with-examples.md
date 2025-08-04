# DDD Aggregates



**Version**: 1.0.0  
**Package**: @vytches/ddd-aggregates  
**Domain**: domain-modeling  
**Patterns**: aggregate-pattern, event-sourcing, capability-system, builder-pattern  

## Business Context



## Core Components

### AggregateBuilder

Builder pattern implementation for creating aggregates with flexible capability configuration

**Business Context**: Simplifies aggregate creation by providing fluent API for configuring capabilities and dependencies


#### constructor

Private constructor for builder pattern implementation

**Business Context**: Simplifies aggregate creation by providing fluent API for configuring capabilities and dependencies

**Parameters:**
- `params`: IAggregateConstructorParams<TId> - Initial aggregate construction parameters

**Returns:** void - 


#### create

Builder pattern implementation for creating aggregates with flexible capability configuration

**Business Context**: Simplifies aggregate creation by providing fluent API for configuring capabilities and dependencies

**Parameters:**
- `params`: { id: TId | EntityId<TId>; version?: number; } - Initial aggregate parameters with id and optional version

**Returns:** AggregateBuilder<TId> - New builder instance for fluent configuration

##### Example: basic-builder

```typescript
const builder = AggregateBuilder.create({
  id: EntityId.createWithRandomUUID(),
  version: 0
});

```

##### Example: with-string-id

```typescript
const builder = AggregateBuilder.create({
  id: 'order-123',
  version: 1
});

```


#### withSnapshots

Builder pattern implementation for creating aggregates with flexible capability configuration

**Business Context**: Simplifies aggregate creation by providing fluent API for configuring capabilities and dependencies


**Returns:** this - Builder instance for method chaining

##### Example: add-snapshots

```typescript
const aggregate = AggregateBuilder.create({ id })
  .withSnapshots()
  .build();

```


#### withVersioning

Builder pattern implementation for creating aggregates with flexible capability configuration

**Business Context**: Simplifies aggregate creation by providing fluent API for configuring capabilities and dependencies


**Returns:** this - Builder instance for method chaining

##### Example: add-versioning

```typescript
const aggregate = AggregateBuilder.create({ id })
  .withVersioning()
  .build();

```


#### withAudit

Builder pattern implementation for creating aggregates with flexible capability configuration

**Business Context**: Simplifies aggregate creation by providing fluent API for configuring capabilities and dependencies


**Returns:** this - Builder instance for method chaining

##### Example: add-audit

```typescript
const aggregate = AggregateBuilder.create({ id })
  .withAudit()
  .build();

```


#### withEventSourcing

Builder pattern implementation for creating aggregates with flexible capability configuration

**Business Context**: Simplifies aggregate creation by providing fluent API for configuring capabilities and dependencies

**Parameters:**
- `eventStore`: IEventStore - Optional event store instance for persistence (optional)

**Returns:** this - Builder instance for method chaining

##### Example: basic-event-sourcing

```typescript
const aggregate = AggregateBuilder.create({ id })
  .withEventSourcing()
  .build();

```

##### Example: with-event-store

```typescript
const eventStore = new PostgreSQLEventStore(config);
const aggregate = AggregateBuilder.create({ id })
  .withEventSourcing(eventStore)
  .build();

```


#### withCapability

Builder pattern implementation for creating aggregates with flexible capability configuration

**Business Context**: Simplifies aggregate creation by providing fluent API for configuring capabilities and dependencies

**Parameters:**
- `capability`: T extends Capability & IAggregateCapability - Custom capability instance to add
- `configure`: (cap: T) => void - Optional configuration function for the capability (optional)

**Returns:** this - Builder instance for method chaining

##### Example: custom-capability

```typescript
const customCapability = new ValidationCapability();
const aggregate = AggregateBuilder.create({ id })
  .withCapability(customCapability)
  .build();

```

##### Example: configured-capability

```typescript
const aggregate = AggregateBuilder.create({ id })
  .withCapability(
    new RateLimitCapability(),
    cap => cap.setLimit(100)
  )
  .build();

```


#### setEventStore

Builder pattern implementation for creating aggregates with flexible capability configuration

**Business Context**: Simplifies aggregate creation by providing fluent API for configuring capabilities and dependencies

**Parameters:**
- `eventStore`: IEventStore - Event store instance for event persistence

**Returns:** this - Builder instance for method chaining

##### Example: set-event-store

```typescript
const eventStore = new InMemoryEventStore();
const aggregate = AggregateBuilder.create({ id })
  .setEventStore(eventStore)
  .withEventSourcing()
  .build();

```


#### build

Builder pattern implementation for creating aggregates with flexible capability configuration

**Business Context**: Simplifies aggregate creation by providing fluent API for configuring capabilities and dependencies

**Parameters:**
- `AggregateClass`: new (params: IAggregateConstructorParams<TId>) => TAgg - Optional custom aggregate class constructor (optional)

**Returns:** TAgg extends AggregateRoot<TId> - Fully configured aggregate instance

##### Example: build-default

```typescript
const aggregate = AggregateBuilder.create({ id })
  .withVersioning()
  .withAudit()
  .build();

```

##### Example: build-custom-class

```typescript
class OrderAggregate extends AggregateRoot<string> {
  // Custom aggregate implementation
}

const order = AggregateBuilder.create({ id: 'order-123' })
  .withEventSourcing()
  .build(OrderAggregate);

```


#### buildWithAllCapabilities

Builder pattern implementation for creating aggregates with flexible capability configuration

**Business Context**: Simplifies aggregate creation by providing fluent API for configuring capabilities and dependencies

**Parameters:**
- `AggregateClass`: new (params: IAggregateConstructorParams<TId>) => TAgg - Optional custom aggregate class constructor (optional)

**Returns:** TAgg extends AggregateRoot<TId> - Aggregate with all capabilities: snapshots, versioning, audit, event sourcing

##### Example: all-capabilities

```typescript
// Equivalent to calling all withXxx() methods
const aggregate = AggregateBuilder.create({ id })
  .buildWithAllCapabilities();

```

##### Example: custom-with-all

```typescript
const order = AggregateBuilder.create({ id: orderId })
  .setEventStore(eventStore)
  .buildWithAllCapabilities(OrderAggregate);

```



### AggregateError

Comprehensive error classes for aggregate-specific domain errors and validation failures

**Business Context**: Essential error handling for aggregate operations, version conflicts, and capability management


#### invalidArguments

Comprehensive error classes for aggregate-specific domain errors and validation failures

**Business Context**: Essential error handling for aggregate operations, version conflicts, and capability management

**Parameters:**
- `message`: string - Descriptive error message
- `data`: DomainErrorOptions - Additional error context and metadata (optional)

**Returns:** AggregateError - Configured error instance with InvalidParameter code

##### Example: invalid-argument-error

```typescript
// Validate aggregate constructor parameters
if (!params.id) {
  throw AggregateError.invalidArguments(
    'Aggregate ID is required',
    { context: 'AggregateRoot constructor' }
  );
}

```


#### versionConflict

Comprehensive error classes for aggregate-specific domain errors and validation failures

**Business Context**: Essential error handling for aggregate operations, version conflicts, and capability management

**Parameters:**
- `aggregateType`: string - Type name of the aggregate
- `aggregateId`: string | number - Identifier of the aggregate with conflict
- `currentVersion`: number - Current version of the aggregate
- `expectedVersion`: number - Expected version from the operation

**Returns:** AggregateError - Configured error with version conflict details

##### Example: version-conflict-error

```typescript
// Repository save operation detecting version conflict
if (aggregate.getVersion() !== expectedVersion) {
  throw AggregateError.versionConflict(
    'OrderAggregate',
    'order-123',
    aggregate.getVersion(),
    expectedVersion
  );
}

```


#### featureNotEnabled

Comprehensive error classes for aggregate-specific domain errors and validation failures

**Business Context**: Essential error handling for aggregate operations, version conflicts, and capability management

**Parameters:**
- `feature`: string - Name of the required feature/capability

**Returns:** AggregateError - Configured error indicating missing capability

##### Example: feature-not-enabled-error

```typescript
// Capability validation in utility functions
if (!aggregate.hasCapability(SnapshotCapability)) {
  throw AggregateError.featureNotEnabled('snapshot');
}

```


#### methodNotImplemented

Comprehensive error classes for aggregate-specific domain errors and validation failures

**Business Context**: Essential error handling for aggregate operations, version conflicts, and capability management

**Parameters:**
- `methodName`: string - Name of the missing method
- `aggregateType`: string - Type name of the aggregate class

**Returns:** AggregateError - Configured error indicating missing implementation

##### Example: method-not-implemented-error

```typescript
// Abstract method validation
if (typeof this.handleDomainEvent !== 'function') {
  throw AggregateError.methodNotImplemented(
    'handleDomainEvent',
    this.constructor.name
  );
}

```


#### invalidSnapshot

Comprehensive error classes for aggregate-specific domain errors and validation failures

**Business Context**: Essential error handling for aggregate operations, version conflicts, and capability management

**Parameters:**
- `aggregateType`: string - Type name of the aggregate
- `reason`: string - Specific reason for snapshot invalidity (optional)

**Returns:** AggregateError - Configured error with snapshot validation details


#### idMismatch

Comprehensive error classes for aggregate-specific domain errors and validation failures

**Business Context**: Essential error handling for aggregate operations, version conflicts, and capability management

**Parameters:**
- `snapshotId`: string | number - ID from the snapshot data
- `aggregateId`: string | number - ID of the target aggregate

**Returns:** AggregateError - Configured error with ID mismatch details


#### typeMismatch

Comprehensive error classes for aggregate-specific domain errors and validation failures

**Business Context**: Essential error handling for aggregate operations, version conflicts, and capability management

**Parameters:**
- `snapshotType`: string - Type from the snapshot data
- `aggregateType`: string - Type of the target aggregate

**Returns:** AggregateError - Configured error with type mismatch details


#### duplicateUpcaster

Comprehensive error classes for aggregate-specific domain errors and validation failures

**Business Context**: Essential error handling for aggregate operations, version conflicts, and capability management

**Parameters:**
- `eventType`: string - Event type for the upcaster
- `sourceVersion`: number - Source version already registered

**Returns:** AggregateError - Configured error with upcaster conflict details


#### missingUpcaster

Comprehensive error classes for aggregate-specific domain errors and validation failures

**Business Context**: Essential error handling for aggregate operations, version conflicts, and capability management

**Parameters:**
- `eventType`: string - Event type requiring upcasting
- `fromVersion`: number - Source version of the event
- `toVersion`: number - Target version needed

**Returns:** AggregateError - Configured error with missing upcaster details

##### Example: missing-upcaster-error

```typescript
// Event versioning system detecting missing upcaster
if (!this.hasUpcaster(eventType, fromVersion)) {
  throw AggregateError.missingUpcaster(eventType, fromVersion, toVersion);
}

```


#### configurationError

Comprehensive error classes for aggregate-specific domain errors and validation failures

**Business Context**: Essential error handling for aggregate operations, version conflicts, and capability management

**Parameters:**
- `aggregateType`: string - Type name of the aggregate with configuration issue
- `message`: string - Specific configuration error message

**Returns:** AggregateError - Configured error with configuration details


#### cannotInterceptApplyMethod

Comprehensive error classes for aggregate-specific domain errors and validation failures

**Business Context**: Essential error handling for aggregate operations, version conflicts, and capability management

**Parameters:**
- `aggregateId`: string - Identifier of the aggregate with interception failure
- `data`: DomainErrorOptions - Additional error context (optional)

**Returns:** AggregateError - Configured error with interception failure details


#### eventStoreNotConfigured

Comprehensive error classes for aggregate-specific domain errors and validation failures

**Business Context**: Essential error handling for aggregate operations, version conflicts, and capability management

**Parameters:**
- `data`: DomainErrorOptions - Additional error context (optional)

**Returns:** AggregateError - Configured error indicating missing event store

##### Example: event-store-not-configured

```typescript
// Event sourcing capability checking for event store
if (!this.eventStore) {
  throw AggregateError.eventStoreNotConfigured({
    capability: 'EventSourcingCapability',
    operation: 'loadFromEventStore'
  });
}

```


#### aggregateDoesNotSupportReplay

Comprehensive error classes for aggregate-specific domain errors and validation failures

**Business Context**: Essential error handling for aggregate operations, version conflicts, and capability management

**Parameters:**
- `aggregateType`: string - Type name of the aggregate that doesn't support replay
- `data`: DomainErrorOptions - Additional error context (optional)

**Returns:** AggregateError - Configured error indicating replay not supported



### AggregateInterfaces

Core interfaces for aggregate root functionality, capability system, and supporting contracts

**Business Context**: Foundation contracts for aggregate behavior, capability management, and type safety



### AggregateRoot

Core aggregate root class with event sourcing capabilities and capability system

**Business Context**: Main aggregate implementation following DDD principles with enterprise capabilities


#### constructor

Creates new aggregate instance with unique identifier and initial configuration

**Business Context**: Main aggregate implementation following DDD principles with enterprise capabilities

**Parameters:**
- `params`: IAggregateConstructorParams<TId> - Aggregate construction parameters

**Returns:** void - 

##### Example: basic-construction

```typescript
const orderId = EntityId.createWithRandomUUID();
const aggregate = new AggregateRoot({
  id: orderId,
  version: 0
});

```

##### Example: with-capabilities

```typescript
const aggregate = new AggregateRoot({
  id: EntityId.fromText('order-123'),
  version: 0
});

```


#### getId

Core aggregate root class with event sourcing capabilities and capability system

**Business Context**: Main aggregate implementation following DDD principles with enterprise capabilities


**Returns:** EntityId<TId> - Strongly-typed aggregate identifier

##### Example: get-id-basic

```typescript
const aggregate = new AggregateRoot({ id: EntityId.fromText('order-123') });
const id = aggregate.getId();
console.log(id.toString()); // 'order-123'

```


#### getVersion

Core aggregate root class with event sourcing capabilities and capability system

**Business Context**: Main aggregate implementation following DDD principles with enterprise capabilities


**Returns:** number - Current version number for optimistic locking

##### Example: version-tracking

```typescript
const aggregate = new AggregateRoot({ id, version: 5 });
console.log(aggregate.getVersion()); // 5

aggregate.apply('OrderUpdated', { status: 'confirmed' });
aggregate.commit();
console.log(aggregate.getVersion()); // 6

```


#### getInitialVersion

Core aggregate root class with event sourcing capabilities and capability system

**Business Context**: Main aggregate implementation following DDD principles with enterprise capabilities


**Returns:** number - Initial version when aggregate was loaded

##### Example: initial-version

```typescript
const aggregate = new AggregateRoot({ id, version: 10 });
console.log(aggregate.getInitialVersion()); // 10

aggregate.apply('OrderUpdated', { status: 'shipped' });
aggregate.commit();

console.log(aggregate.getVersion()); // 11
console.log(aggregate.getInitialVersion()); // 11 (updated after commit)

```


#### hasChanges

Core aggregate root class with event sourcing capabilities and capability system

**Business Context**: Main aggregate implementation following DDD principles with enterprise capabilities


**Returns:** boolean - True if there are pending domain events

##### Example: check-changes

```typescript
const aggregate = new AggregateRoot({ id });
console.log(aggregate.hasChanges()); // false

aggregate.apply('OrderCreated', orderData);
console.log(aggregate.hasChanges()); // true

aggregate.commit();
console.log(aggregate.hasChanges()); // false

```


#### getDomainEvents

Gets all uncommitted domain events

**Business Context**: Main aggregate implementation following DDD principles with enterprise capabilities


**Returns:** ReadonlyArray<IExtendedDomainEvent> - Array of uncommitted domain events

##### Example: get-pending-events

```typescript
const aggregate = new AggregateRoot({ id });

aggregate.apply('OrderCreated', { customerId: 'cust-123' });
aggregate.apply('ItemAdded', { productId: 'prod-456', quantity: 2 });

const events = aggregate.getDomainEvents();
console.log(events.length); // 2
console.log(events[0].eventType); // 'OrderCreated'
console.log(events[1].eventType); // 'ItemAdded'

```


#### apply

Core aggregate root class with event sourcing capabilities and capability system

**Business Context**: Main aggregate implementation following DDD principles with enterprise capabilities

**Parameters:**
- `eventTypeOrEvent`: string | IExtendedDomainEvent<P> - Event type string or complete event object
- `payload`: P - Event payload containing business data (optional)
- `metadata`: Partial<IEventMetadata> - Optional event metadata (optional)

**Returns:** void - Method does not return value, modifies aggregate state

##### Example: simple-event

```typescript
aggregate.apply('OrderCreated', {
  customerId: 'cust-123',
  amount: 99.99,
  currency: 'USD'
});

```

##### Example: event-chain

```typescript
aggregate.apply('OrderCreated', { customerId, amount });
aggregate.apply('PaymentRequested', { amount, method: 'credit-card' });
aggregate.apply('InventoryReserved', { items: orderItems });

```


#### commit

Core aggregate root class with event sourcing capabilities and capability system

**Business Context**: Main aggregate implementation following DDD principles with enterprise capabilities


**Returns:** void - Clears pending events and increments version

##### Example: basic-commit

```typescript
aggregate.apply('OrderCreated', orderData);
const events = aggregate.commit();
console.log(`Committed ${events.length} events`);

```

##### Example: with-persistence

```typescript
try {
  aggregate.apply('OrderCreated', orderData);
  const events = aggregate.commit();
  await eventStore.save(aggregate.getId(), events);
} catch (error) {
  console.error('Failed to commit events:', error);
  throw new DomainError('Order creation failed');
}

```


#### loadFromHistory

Core aggregate root class with event sourcing capabilities and capability system

**Business Context**: Main aggregate implementation following DDD principles with enterprise capabilities

**Parameters:**
- `events`: IExtendedDomainEvent[] - Array of historical domain events in chronological order

**Returns:** void - Reconstructs aggregate state from events

##### Example: simple-replay

```typescript
const events = await eventStore.getEvents(aggregateId);
const aggregate = new AggregateRoot({ id: aggregateId });
aggregate.loadFromHistory(events);

```

##### Example: snapshot-replay

```typescript
const snapshot = await snapshotStore.getSnapshot(aggregateId);
const eventsAfterSnapshot = await eventStore.getEventsAfter(
  aggregateId,
  snapshot.version
);

const aggregate = AggregateRoot.fromSnapshot(snapshot);
aggregate.loadFromHistory(eventsAfterSnapshot);

```


#### registerEventHandler

Core aggregate root class with event sourcing capabilities and capability system

**Business Context**: Main aggregate implementation following DDD principles with enterprise capabilities

**Parameters:**
- `eventType`: string - Event type to register handler for
- `handler`: IAggregateEventHandler<T> - Event handler function

**Returns:** this - Returns this for method chaining

##### Example: event-handlers

```typescript
class OrderAggregate extends AggregateRoot {
  constructor(params) {
    super(params);
    this.registerEventHandler('OrderCreated', this.onOrderCreated.bind(this));
    this.registerEventHandler('OrderCancelled', this.onOrderCancelled.bind(this));
  }

  private onOrderCreated(event: IExtendedDomainEvent) {
    this.status = 'created';
    this.customerId = event.payload.customerId;
  }
}

```


#### addCapability

Core aggregate root class with event sourcing capabilities and capability system

**Business Context**: Main aggregate implementation following DDD principles with enterprise capabilities

**Parameters:**
- `capability`: T extends Capability & IAggregateCapability - Capability instance to add to the aggregate

**Returns:** this - Returns this for method chaining

##### Example: single-capability

```typescript
const aggregate = new AggregateRoot({ id, version: 0 });
aggregate.addCapability(new AuditCapability());

```

##### Example: chained-capabilities

```typescript
aggregate
  .addCapability(new AuditCapability())
  .addCapability(new SnapshotCapability({ frequency: 10 }))
  .addCapability(new ValidationCapability());

```


#### getCapability

Core aggregate root class with event sourcing capabilities and capability system

**Business Context**: Main aggregate implementation following DDD principles with enterprise capabilities

**Parameters:**
- `CapabilityClass`: CapabilityConstructor<T> - Constructor of the capability to retrieve

**Returns:** T | undefined - Capability instance or undefined if not found

##### Example: basic-retrieval

```typescript
const auditCap = aggregate.getCapability(AuditCapability);
if (auditCap) {
  const auditLog = auditCap.getAuditLog();
}

```

##### Example: chained-operations

```typescript
// Chain capability operations
const snapshot = aggregate.getCapability(SnapshotCapability);
const audit = aggregate.getCapability(AuditCapability);

if (snapshot && audit) {
  const data = snapshot.createSnapshot();
  audit.recordSnapshot(data);
}

```


#### hasCapability

Core aggregate root class with event sourcing capabilities and capability system

**Business Context**: Main aggregate implementation following DDD principles with enterprise capabilities

**Parameters:**
- `CapabilityClass`: CapabilityConstructor<T> - Constructor of the capability to check

**Returns:** boolean - True if capability is present

##### Example: capability-check

```typescript
if (aggregate.hasCapability(SnapshotCapability)) {
  // Perform snapshot-specific operations
  const snapshot = aggregate.createSnapshot();
}

```


#### removeCapability

Core aggregate root class with event sourcing capabilities and capability system

**Business Context**: Main aggregate implementation following DDD principles with enterprise capabilities

**Parameters:**
- `CapabilityClass`: CapabilityConstructor<T> - Constructor of the capability to remove

**Returns:** this - Returns this for method chaining

##### Example: capability-removal

```typescript
# Remove audit capability after migration
aggregate.removeCapability(AuditCapability);

```


#### getAllCapabilities

Core aggregate root class with event sourcing capabilities and capability system

**Business Context**: Main aggregate implementation following DDD principles with enterprise capabilities


**Returns:** Capability[] - Array of all registered capabilities

##### Example: list-capabilities

```typescript
const aggregate = new AggregateRoot({ id });
aggregate.addCapability(new AuditCapability());
aggregate.addCapability(new SnapshotCapability());

const capabilities = aggregate.getAllCapabilities();
console.log(capabilities.length); // 2

```


#### getCapabilityTypes

Core aggregate root class with event sourcing capabilities and capability system

**Business Context**: Main aggregate implementation following DDD principles with enterprise capabilities


**Returns:** string[] - Array of capability type names

##### Example: capability-types

```typescript
const aggregate = new AggregateRoot({ id });
aggregate.addCapability(new AuditCapability());
aggregate.addCapability(new VersioningCapability());

const types = aggregate.getCapabilityTypes();
console.log(types); // ['AuditCapability', 'VersioningCapability']

```


#### _internal_setState

Core aggregate root class with event sourcing capabilities and capability system

**Business Context**: Main aggregate implementation following DDD principles with enterprise capabilities

**Parameters:**
- `state`: { version: number; initialVersion: number; domainEvents: IExtendedDomainEvent[]; } - Internal state to set

**Returns:** void - 



### AggregateUtilities

Type utilities, guards, and helper functions for working with aggregate capabilities

**Business Context**: Essential utilities for type-safe capability operations and aggregate management



### AuditCapability

Enterprise-grade auditing capability for tracking aggregate changes and events

**Business Context**: Provides comprehensive audit trails for compliance, debugging, and business intelligence


#### constructor

Enterprise-grade auditing capability for tracking aggregate changes and events

**Business Context**: Provides comprehensive audit trails for compliance, debugging, and business intelligence


**Returns:** void - 

##### Example: basic

```typescript
const auditCapability = new AuditCapability();
aggregate.addCapability(auditCapability);

```


#### attach

Enterprise-grade auditing capability for tracking aggregate changes and events

**Business Context**: Provides comprehensive audit trails for compliance, debugging, and business intelligence

**Parameters:**
- `aggregate`: unknown - Aggregate instance to attach auditing to

**Returns:** void - No return value - modifies aggregate behavior

##### Example: attachment

```typescript
const auditCapability = new AuditCapability();
auditCapability.attach(myAggregate);

// Now all events will be automatically audited
myAggregate.apply('OrderCreated', { orderId: '123' });
const auditLog = auditCapability.getAuditLog();

```


#### detach

Enterprise-grade auditing capability for tracking aggregate changes and events

**Business Context**: Provides comprehensive audit trails for compliance, debugging, and business intelligence


**Returns:** void - No return value - restores original behavior

##### Example: cleanup

```typescript
auditCapability.detach();
// Aggregate's apply method is restored to original

```


#### getAuditLog

Enterprise-grade auditing capability for tracking aggregate changes and events

**Business Context**: Provides comprehensive audit trails for compliance, debugging, and business intelligence


**Returns:** IAuditEvent[] - Array copy of all audit events in chronological order

##### Example: basic-retrieval

```typescript
const auditLog = auditCapability.getAuditLog();
console.log(`Total events: ${auditLog.length}`);

auditLog.forEach(event => {
  console.log(`${event.timestamp}: ${event.eventType}`);
});

```


#### clearAuditLog

Enterprise-grade auditing capability for tracking aggregate changes and events

**Business Context**: Provides comprehensive audit trails for compliance, debugging, and business intelligence


**Returns:** void - No return value - empties audit log

##### Example: reset

```typescript
auditCapability.clearAuditLog();
console.log(auditCapability.getAuditLog().length); // 0

```


#### getAuditStatistics

Enterprise-grade auditing capability for tracking aggregate changes and events

**Business Context**: Provides comprehensive audit trails for compliance, debugging, and business intelligence


**Returns:** { totalEvents: number; eventsByType: Record<string, number>; averageTimeBetweenEvents: number } - Statistics object with event counts, type distribution, and timing metrics

##### Example: statistics

```typescript
const stats = auditCapability.getAuditStatistics();

console.log(`Total events: ${stats.totalEvents}`);
console.log(`Event types:`, stats.eventsByType);
console.log(`Avg time between events: ${stats.averageTimeBetweenEvents}ms`);

// Example output:
// Total events: 15
// Event types: { OrderCreated: 5, OrderUpdated: 8, OrderCancelled: 2 }
// Avg time between events: 1247ms

```


#### recordEvent

Enterprise-grade auditing capability for tracking aggregate changes and events

**Business Context**: Provides comprehensive audit trails for compliance, debugging, and business intelligence

**Parameters:**
- `event`: IExtendedDomainEvent - Domain event to record with payload and metadata

**Returns:** void - No return value - adds event to audit log

##### Example: manual-recording

```typescript
const externalEvent = {
  eventType: 'ExternalOrderUpdate',
  payload: { orderId: '123', status: 'shipped' },
  metadata: { source: 'external-system' }
};

auditCapability.recordEvent(externalEvent);

```


#### getEventsByType

Enterprise-grade auditing capability for tracking aggregate changes and events

**Business Context**: Provides comprehensive audit trails for compliance, debugging, and business intelligence

**Parameters:**
- `eventType`: string - Event type to filter by (case-sensitive)

**Returns:** IAuditEvent[] - Array of audit events matching the specified type

##### Example: type-filtering

```typescript
const orderCreatedEvents = auditCapability.getEventsByType('OrderCreated');
const orderCancelledEvents = auditCapability.getEventsByType('OrderCancelled');

console.log(`Created: ${orderCreatedEvents.length}, Cancelled: ${orderCancelledEvents.length}`);

```


#### getEventsByTimeRange

Enterprise-grade auditing capability for tracking aggregate changes and events

**Business Context**: Provides comprehensive audit trails for compliance, debugging, and business intelligence

**Parameters:**
- `startDate`: Date - Start of time range (inclusive)
- `endDate`: Date - End of time range (inclusive)

**Returns:** IAuditEvent[] - Array of audit events within the specified time range

##### Example: time-range-query

```typescript
const today = new Date();
const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

const recentEvents = auditCapability.getEventsByTimeRange(yesterday, today);
console.log(`Events in last 24 hours: ${recentEvents.length}`);

```


#### getFirstEvent

Enterprise-grade auditing capability for tracking aggregate changes and events

**Business Context**: Provides comprehensive audit trails for compliance, debugging, and business intelligence


**Returns:** IAuditEvent | null - First audit event in chronological order or null if audit log is empty

##### Example: first-event

```typescript
const firstEvent = auditCapability.getFirstEvent();
if (firstEvent) {
  console.log(`Aggregate created: ${firstEvent.timestamp}`);
  console.log(`First event: ${firstEvent.eventType}`);
}

```


#### getLastEvent

Enterprise-grade auditing capability for tracking aggregate changes and events

**Business Context**: Provides comprehensive audit trails for compliance, debugging, and business intelligence


**Returns:** IAuditEvent | null - Last audit event in chronological order or null if audit log is empty

##### Example: last-event

```typescript
const lastEvent = auditCapability.getLastEvent();
if (lastEvent) {
  console.log(`Last modified: ${lastEvent.timestamp}`);
  console.log(`Latest event: ${lastEvent.eventType}`);
}

```



### EventSourcingCapability

Event sourcing capability that provides persistence and loading of aggregate events

**Business Context**: Enables event-driven persistence, replay capabilities, and temporal querying for aggregates


#### constructor

Event sourcing capability that provides persistence and loading of aggregate events

**Business Context**: Enables event-driven persistence, replay capabilities, and temporal querying for aggregates


**Returns:** void - 

##### Example: basic

```typescript
const eventSourcingCapability = new EventSourcingCapability();
aggregate.addCapability(eventSourcingCapability);

```


#### attach

Event sourcing capability that provides persistence and loading of aggregate events

**Business Context**: Enables event-driven persistence, replay capabilities, and temporal querying for aggregates

**Parameters:**
- `aggregate`: unknown - Aggregate instance to enable event sourcing for

**Returns:** void - No return value - capability is now attached

##### Example: attachment

```typescript
const capability = new EventSourcingCapability();
capability.attach(orderAggregate);

// Now the aggregate can use event sourcing features
await capability.setEventStore(eventStore);

```


#### detach

Event sourcing capability that provides persistence and loading of aggregate events

**Business Context**: Enables event-driven persistence, replay capabilities, and temporal querying for aggregates


**Returns:** void - No return value - capability is detached and cleaned up

##### Example: cleanup

```typescript
capability.detach();
// Event store references are cleared

```


#### setEventStore

Event sourcing capability that provides persistence and loading of aggregate events

**Business Context**: Enables event-driven persistence, replay capabilities, and temporal querying for aggregates

**Parameters:**
- `eventStore`: IEventStore - Event store implementation for persisting and loading events

**Returns:** void - No return value - event store is configured

##### Example: configuration

```typescript
const eventStore = new PostgreSQLEventStore(connectionString);
capability.setEventStore(eventStore);

// Alternative: In-memory for testing
const testStore = new InMemoryEventStore();
capability.setEventStore(testStore);

```


#### getEventStore

Event sourcing capability that provides persistence and loading of aggregate events

**Business Context**: Enables event-driven persistence, replay capabilities, and temporal querying for aggregates


**Returns:** IEventStore | null - Current event store instance or null if not configured

##### Example: store-access

```typescript
const store = capability.getEventStore();
if (store) {
  console.log('Event store is configured');
  // Can access store methods directly if needed
} else {
  throw new Error('Event store not configured');
}

```


#### loadFromEventStore

Event sourcing capability that provides persistence and loading of aggregate events

**Business Context**: Enables event-driven persistence, replay capabilities, and temporal querying for aggregates

**Parameters:**
- `aggregateId`: string | number - Unique identifier of aggregate to load events for

**Returns:** Promise<void> - Promise that resolves when all events are loaded and applied

##### Example: full-load

```typescript
// Load complete event history
await capability.loadFromEventStore('order-123');

// Aggregate now has full state reconstructed from events
console.log(`Order version: ${aggregate.getVersion()}`);
console.log(`Order events: ${aggregate.getDomainEvents().length}`);

```

##### Example: empty-history

```typescript
// Handles case where no events exist
await capability.loadFromEventStore('new-order-456');
// No events loaded, aggregate remains in initial state

```


#### saveToEventStore

Event sourcing capability that provides persistence and loading of aggregate events

**Business Context**: Enables event-driven persistence, replay capabilities, and temporal querying for aggregates


**Returns:** Promise<void> - Promise that resolves when all events are successfully persisted

##### Example: save-events

```typescript
// Apply business logic that generates events
aggregate.createOrder({ customerId: '123', amount: 100 });
aggregate.addItem({ productId: 'ABC', quantity: 2 });

// Persist all pending events
await capability.saveToEventStore();

// Events are now persisted, aggregate is clean
console.log(`Saved events: ${aggregate.getDomainEvents().length}`);

```


#### hasEventStore

Event sourcing capability that provides persistence and loading of aggregate events

**Business Context**: Enables event-driven persistence, replay capabilities, and temporal querying for aggregates


**Returns:** boolean - True if event store is configured, false otherwise

##### Example: validation

```typescript
if (!capability.hasEventStore()) {
  throw new Error('Event store must be configured before saving');
}

await capability.saveToEventStore();

```


#### getStreamName

Event sourcing capability that provides persistence and loading of aggregate events

**Business Context**: Enables event-driven persistence, replay capabilities, and temporal querying for aggregates


**Returns:** string - Stream name in format 'AggregateType-aggregateId'

##### Example: stream-naming

```typescript
const streamName = capability.getStreamName();
console.log(streamName); // "OrderAggregate-order-123"

// Used internally by event store operations
// Can be used for external event store queries

```


#### loadFromVersion

Event sourcing capability that provides persistence and loading of aggregate events

**Business Context**: Enables event-driven persistence, replay capabilities, and temporal querying for aggregates

**Parameters:**
- `aggregateId`: string | number - Unique identifier of aggregate to load events for
- `fromVersion`: number - Version number to start loading from (exclusive)

**Returns:** Promise<void> - Promise that resolves when events from specified version are loaded

##### Example: incremental-load

```typescript
// Load only events after version 5
await capability.loadFromVersion('order-123', 5);

// Use case: Loading updates since last snapshot
const snapshotVersion = snapshot.version;
await capability.loadFromVersion(aggregateId, snapshotVersion);

```

##### Example: replay-scenario

```typescript
// Replay events from specific point for debugging
const problemVersion = 10;
await capability.loadFromVersion('order-123', problemVersion);

// Aggregate now has state from version 11 onwards

```



### SnapshotCapability

Performance optimization capability that creates and restores aggregate state snapshots

**Business Context**: Reduces event replay overhead for long-lived aggregates and improves system performance


#### constructor

Performance optimization capability that creates and restores aggregate state snapshots

**Business Context**: Reduces event replay overhead for long-lived aggregates and improves system performance


**Returns:** void - 

##### Example: basic

```typescript
const snapshotCapability = new SnapshotCapability<OrderState, OrderMetadata>();
aggregate.addCapability(snapshotCapability);

```


#### attach

Performance optimization capability that creates and restores aggregate state snapshots

**Business Context**: Reduces event replay overhead for long-lived aggregates and improves system performance

**Parameters:**
- `aggregate`: unknown - Aggregate instance to enable snapshotting for

**Returns:** void - No return value - capability is now attached

##### Example: attachment

```typescript
const capability = new SnapshotCapability<OrderState, OrderMetadata>();
capability.attach(orderAggregate);

// Now the aggregate can create and restore snapshots
const snapshot = capability.createSnapshot(() => order.getState());

```


#### detach

Performance optimization capability that creates and restores aggregate state snapshots

**Business Context**: Reduces event replay overhead for long-lived aggregates and improves system performance


**Returns:** void - No return value - capability is detached and memory freed

##### Example: cleanup

```typescript
capability.detach();
// All snapshot data is cleared to prevent memory leaks

```


#### createSnapshot

Performance optimization capability that creates and restores aggregate state snapshots

**Business Context**: Reduces event replay overhead for long-lived aggregates and improves system performance

**Parameters:**
- `serializer`: () => TState - Function that extracts and serializes aggregate state
- `metadataCreator`: () => TMeta - Optional function that creates snapshot metadata

**Returns:** IAggregateSnapshot<TState, TMeta> - Complete snapshot object with state, metadata, and versioning information

##### Example: basic-snapshot

```typescript
const snapshot = capability.createSnapshot(
  () => ({
    orderId: order.getId(),
    customerId: order.getCustomerId(),
    items: order.getItems(),
    status: order.getStatus()
  })
);

console.log(`Snapshot created at version ${snapshot.version}`);

```

##### Example: with-metadata

```typescript
const snapshot = capability.createSnapshot(
  () => order.getState(),
  () => ({
    createdBy: 'system',
    reason: 'scheduled-backup',
    environment: 'production'
  })
);

console.log(`Metadata:`, snapshot.metadata);

```


#### restoreFromSnapshot

Performance optimization capability that creates and restores aggregate state snapshots

**Business Context**: Reduces event replay overhead for long-lived aggregates and improves system performance

**Parameters:**
- `snapshot`: IAggregateSnapshot<TState, TMeta> - Snapshot object containing state and metadata to restore
- `deserializer`: (state: TState) => void - Function that applies state data to aggregate
- `metadataRestorer`: (metadata: TMeta) => void - Optional function that processes snapshot metadata

**Returns:** void - No return value - aggregate state is modified in-place

##### Example: basic-restore

```typescript
capability.restoreFromSnapshot(
  snapshot,
  (state) => {
    order.setCustomerId(state.customerId);
    order.setItems(state.items);
    order.setStatus(state.status);
  }
);

console.log(`Restored to version ${snapshot.version}`);

```

##### Example: with-metadata

```typescript
capability.restoreFromSnapshot(
  snapshot,
  (state) => order.setState(state),
  (metadata) => {
    console.log(`Restored from ${metadata.environment} snapshot`);
    console.log(`Created by: ${metadata.createdBy}`);
  }
);

```


#### saveTemporaryState

Performance optimization capability that creates and restores aggregate state snapshots

**Business Context**: Reduces event replay overhead for long-lived aggregates and improves system performance

**Parameters:**
- `state`: TState - State object to save temporarily

**Returns:** void - No return value - state is stored in memory

##### Example: temporary-save

```typescript
// Save current state before risky operation
capability.saveTemporaryState(order.getState());

try {
  order.performRiskyOperation();
} catch (error) {
  // Can restore from temporary state if needed
  const previousState = capability.getPreviousState();
}

```


#### getLastSnapshotTimestamp

Performance optimization capability that creates and restores aggregate state snapshots

**Business Context**: Reduces event replay overhead for long-lived aggregates and improves system performance


**Returns:** Date | null - Timestamp of last snapshot or null if no snapshots exist

##### Example: timestamp-check

```typescript
const lastSnapshot = capability.getLastSnapshotTimestamp();
if (lastSnapshot) {
  const age = Date.now() - lastSnapshot.getTime();
  console.log(`Last snapshot was ${age}ms ago`);
  
  // Create new snapshot if too old
  if (age > 24 * 60 * 60 * 1000) { // 24 hours
    capability.saveSnapshot(() => order.getState());
  }
}

```


#### saveSnapshot

Performance optimization capability that creates and restores aggregate state snapshots

**Business Context**: Reduces event replay overhead for long-lived aggregates and improves system performance

**Parameters:**
- `serializer`: () => TState - Function that extracts and serializes aggregate state
- `metadataCreator`: () => TMeta - Optional function that creates snapshot metadata

**Returns:** void - No return value - snapshot is created and stored internally

##### Example: save-internal

```typescript
// Save snapshot internally for later use
capability.saveSnapshot(
  () => order.getState(),
  () => ({ savedBy: 'user-123', reason: 'manual-backup' })
);

// Later retrieve the saved snapshot
const savedSnapshot = capability.getPreviousState();

```


#### getPreviousState

Performance optimization capability that creates and restores aggregate state snapshots

**Business Context**: Reduces event replay overhead for long-lived aggregates and improves system performance


**Returns:** IAggregateSnapshot<TState, TMeta> | null - Previously saved snapshot or null if none exists - clears internal storage

##### Example: retrieve-previous

```typescript
// Save current state
capability.saveSnapshot(() => order.getState());

// Perform operations
order.updateStatus('processing');
order.addItems([newItem]);

// Retrieve previous state (and clear internal storage)
const previousSnapshot = capability.getPreviousState();
if (previousSnapshot) {
  console.log(`Previous version: ${previousSnapshot.version}`);
  // Can restore if needed
}

// Second call returns null (state was cleared)
const shouldBeNull = capability.getPreviousState(); // null

```



### VersioningCapability

Advanced capability that handles event schema evolution and version migration through upcasting

**Business Context**: Essential for maintaining backward compatibility in evolving event-sourced systems


#### constructor

Advanced capability that handles event schema evolution and version migration through upcasting

**Business Context**: Essential for maintaining backward compatibility in evolving event-sourced systems


**Returns:** void - 

##### Example: basic

```typescript
const versioningCapability = new VersioningCapability();
aggregate.addCapability(versioningCapability);

```


#### attach

Advanced capability that handles event schema evolution and version migration through upcasting

**Business Context**: Essential for maintaining backward compatibility in evolving event-sourced systems

**Parameters:**
- `aggregate`: unknown - Aggregate instance to enable versioning for

**Returns:** void - No return value - capability is now attached

##### Example: attachment

```typescript
const capability = new VersioningCapability();
capability.attach(orderAggregate);

// Now the aggregate can handle versioned events
capability.registerUpcaster('OrderCreated', 1, orderCreatedV1ToV2Upcaster);

```


#### detach

Advanced capability that handles event schema evolution and version migration through upcasting

**Business Context**: Essential for maintaining backward compatibility in evolving event-sourced systems


**Returns:** void - No return value - capability detached and upcasters cleared

##### Example: cleanup

```typescript
capability.detach();
// All upcasters are cleared to free memory

```


#### registerUpcaster

Advanced capability that handles event schema evolution and version migration through upcasting

**Business Context**: Essential for maintaining backward compatibility in evolving event-sourced systems

**Parameters:**
- `eventType`: string - Type of event this upcaster handles
- `sourceVersion`: number - Source version number to transform from
- `upcaster`: IEventUpcaster<TFrom, TTo> - Upcaster implementation that transforms event data

**Returns:** void - No return value - upcaster is registered in internal registry

##### Example: basic-upcaster

```typescript
// Register upcaster for OrderCreated v1 -> v2
capability.registerUpcaster('OrderCreated', 1, {
  upcast: (payload, metadata) => ({
    ...payload,
    orderDate: new Date(payload.timestamp), // New field in v2
    customerId: payload.customer_id,        // Renamed field
  })
});

```

##### Example: complex-upcaster

```typescript
// Register upcaster for complex transformation
const orderItemsUpcaster = {
  upcast: (payload, metadata) => ({
    ...payload,
    items: payload.line_items.map(item => ({
      productId: item.product_id,
      quantity: item.qty,
      price: item.unit_price,
      // Calculate new fields
      totalPrice: item.qty * item.unit_price
    }))
  })
};

capability.registerUpcaster('OrderCreated', 2, orderItemsUpcaster);

```


#### handleVersionedEvent

Advanced capability that handles event schema evolution and version migration through upcasting

**Business Context**: Essential for maintaining backward compatibility in evolving event-sourced systems

**Parameters:**
- `event`: IExtendedDomainEvent - Domain event that may need version transformation
- `handlers`: Map<string, IAggregateEventHandler> - Map of event handlers by event type

**Returns:** void - No return value - event is processed and handler is called

##### Example: automatic-upcasting

```typescript
// Historical event from version 1
const oldEvent = {
  eventType: 'OrderCreated',
  payload: { customer_id: '123', timestamp: '2023-01-01' },
  metadata: { version: 1 }
};

const handlers = new Map([
  ['OrderCreated', (payload, metadata) => {
    // Handler expects v3 format
    console.log(`Order date: ${payload.orderDate}`);
    console.log(`Customer: ${payload.customerId}`);
  }]
]);

// Automatically upcasts v1 -> v2 -> v3 then calls handler
capability.handleVersionedEvent(oldEvent, handlers);

```

##### Example: current-version

```typescript
// Current version event (no upcasting needed)
const currentEvent = {
  eventType: 'OrderCreated',
  payload: { customerId: '123', orderDate: new Date() },
  metadata: { version: 3 }
};

// Calls handler directly without upcasting
capability.handleVersionedEvent(currentEvent, handlers);

```


#### getRegisteredEventTypes

Advanced capability that handles event schema evolution and version migration through upcasting

**Business Context**: Essential for maintaining backward compatibility in evolving event-sourced systems


**Returns:** string[] - Array of event type names that have upcasters

##### Example: diagnostics

```typescript
const eventTypes = capability.getRegisteredEventTypes();
console.log('Events with upcasters:', eventTypes);
// Output: ['OrderCreated', 'OrderUpdated', 'OrderCancelled']

// Verify critical events have upcasters
const requiredEvents = ['OrderCreated', 'PaymentProcessed'];
const missing = requiredEvents.filter(type => !eventTypes.includes(type));
if (missing.length > 0) {
  console.warn('Missing upcasters for:', missing);
}

```


#### hasUpcaster

Advanced capability that handles event schema evolution and version migration through upcasting

**Business Context**: Essential for maintaining backward compatibility in evolving event-sourced systems

**Parameters:**
- `eventType`: string - Event type to check
- `version`: number - Version number to check for upcaster

**Returns:** boolean - True if upcaster exists for specified event type and version

##### Example: validation

```typescript
if (!capability.hasUpcaster('OrderCreated', 1)) {
  throw new Error('Missing upcaster for OrderCreated v1');
}

// Safe to process v1 events
capability.handleVersionedEvent(oldEvent, handlers);

```

##### Example: conditional-processing

```typescript
const eventVersion = event.metadata?.version || 1;
if (eventVersion < 3 && !capability.hasUpcaster(event.eventType, eventVersion)) {
  console.warn(`No upcaster for ${event.eventType} v${eventVersion}`);
  // Handle legacy event differently or skip
  return;
}

```


#### getUpcastersForType

Advanced capability that handles event schema evolution and version migration through upcasting

**Business Context**: Essential for maintaining backward compatibility in evolving event-sourced systems

**Parameters:**
- `eventType`: string - Event type to get upcasters for

**Returns:** Map<number, IEventUpcaster> | undefined - Map of upcasters by version number, or undefined if no upcasters exist

##### Example: inspection

```typescript
const upcasters = capability.getUpcastersForType('OrderCreated');
if (upcasters) {
  console.log(`OrderCreated has ${upcasters.size} upcasters`);
  console.log('Versions:', Array.from(upcasters.keys()));
  // Versions: [1, 2, 3]
}

```

##### Example: validation-chain

```typescript
const validateUpcasterChain = (eventType, maxVersion) => {
  const upcasters = capability.getUpcastersForType(eventType);
  if (!upcasters) return false;
  
  // Check for gaps in version chain
  for (let v = 1; v < maxVersion; v++) {
    if (!upcasters.has(v)) {
      console.error(`Missing upcaster for ${eventType} v${v}`);
      return false; 
    }
  }
  return true;
};

```


#### clearUpcastersForType

Advanced capability that handles event schema evolution and version migration through upcasting

**Business Context**: Essential for maintaining backward compatibility in evolving event-sourced systems

**Parameters:**
- `eventType`: string - Event type to clear upcasters for

**Returns:** void - No return value - all upcasters for event type are removed

##### Example: cleanup

```typescript
// Clear all OrderCreated upcasters
capability.clearUpcastersForType('OrderCreated');

// Re-register with new logic
capability.registerUpcaster('OrderCreated', 1, newUpcasterV1);
capability.registerUpcaster('OrderCreated', 2, newUpcasterV2);

```


#### getTotalUpcasterCount

Advanced capability that handles event schema evolution and version migration through upcasting

**Business Context**: Essential for maintaining backward compatibility in evolving event-sourced systems


**Returns:** number - Total count of all registered upcasters

##### Example: metrics

```typescript
const totalUpcasters = capability.getTotalUpcasterCount();
console.log(`System has ${totalUpcasters} upcasters registered`);

// Monitor for system health
if (totalUpcasters < expectedMinimum) {
  console.warn('Fewer upcasters than expected - check configuration');
}

```





---

*Generated with @vytches/ddd-cli on 2025-08-04T12:27:02.806Z*  
*Using Enhanced Metadata System V2*