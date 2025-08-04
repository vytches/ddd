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


```typescript

```


```typescript

```


#### withSnapshots

Builder pattern implementation for creating aggregates with flexible capability configuration

**Business Context**: Simplifies aggregate creation by providing fluent API for configuring capabilities and dependencies


**Returns:** this - Builder instance for method chaining


```typescript

```


#### withVersioning

Builder pattern implementation for creating aggregates with flexible capability configuration

**Business Context**: Simplifies aggregate creation by providing fluent API for configuring capabilities and dependencies


**Returns:** this - Builder instance for method chaining


```typescript

```


#### withAudit

Builder pattern implementation for creating aggregates with flexible capability configuration

**Business Context**: Simplifies aggregate creation by providing fluent API for configuring capabilities and dependencies


**Returns:** this - Builder instance for method chaining


```typescript

```


#### withEventSourcing

Builder pattern implementation for creating aggregates with flexible capability configuration

**Business Context**: Simplifies aggregate creation by providing fluent API for configuring capabilities and dependencies

**Parameters:**
- `eventStore`: IEventStore - Optional event store instance for persistence (optional)

**Returns:** this - Builder instance for method chaining


```typescript

```


```typescript

```


#### withCapability

Builder pattern implementation for creating aggregates with flexible capability configuration

**Business Context**: Simplifies aggregate creation by providing fluent API for configuring capabilities and dependencies

**Parameters:**
- `capability`: T extends Capability & IAggregateCapability - Custom capability instance to add
- `configure`: (cap: T) => void - Optional configuration function for the capability (optional)

**Returns:** this - Builder instance for method chaining


```typescript

```


```typescript

```


#### setEventStore

Builder pattern implementation for creating aggregates with flexible capability configuration

**Business Context**: Simplifies aggregate creation by providing fluent API for configuring capabilities and dependencies

**Parameters:**
- `eventStore`: IEventStore - Event store instance for event persistence

**Returns:** this - Builder instance for method chaining


```typescript

```


#### build

Builder pattern implementation for creating aggregates with flexible capability configuration

**Business Context**: Simplifies aggregate creation by providing fluent API for configuring capabilities and dependencies

**Parameters:**
- `AggregateClass`: new (params: IAggregateConstructorParams<TId>) => TAgg - Optional custom aggregate class constructor (optional)

**Returns:** TAgg extends AggregateRoot<TId> - Fully configured aggregate instance


```typescript

```


```typescript

```


#### buildWithAllCapabilities

Builder pattern implementation for creating aggregates with flexible capability configuration

**Business Context**: Simplifies aggregate creation by providing fluent API for configuring capabilities and dependencies

**Parameters:**
- `AggregateClass`: new (params: IAggregateConstructorParams<TId>) => TAgg - Optional custom aggregate class constructor (optional)

**Returns:** TAgg extends AggregateRoot<TId> - Aggregate with all capabilities: snapshots, versioning, audit, event sourcing


```typescript

```


```typescript

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


```typescript

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


```typescript

```


#### featureNotEnabled

Comprehensive error classes for aggregate-specific domain errors and validation failures

**Business Context**: Essential error handling for aggregate operations, version conflicts, and capability management

**Parameters:**
- `feature`: string - Name of the required feature/capability

**Returns:** AggregateError - Configured error indicating missing capability


```typescript

```


#### methodNotImplemented

Comprehensive error classes for aggregate-specific domain errors and validation failures

**Business Context**: Essential error handling for aggregate operations, version conflicts, and capability management

**Parameters:**
- `methodName`: string - Name of the missing method
- `aggregateType`: string - Type name of the aggregate class

**Returns:** AggregateError - Configured error indicating missing implementation


```typescript

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


```typescript

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


```typescript

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


```typescript

```


```typescript

```


#### getId

Core aggregate root class with event sourcing capabilities and capability system

**Business Context**: Main aggregate implementation following DDD principles with enterprise capabilities


**Returns:** EntityId<TId> - Strongly-typed aggregate identifier


```typescript

```


#### getVersion

Core aggregate root class with event sourcing capabilities and capability system

**Business Context**: Main aggregate implementation following DDD principles with enterprise capabilities


**Returns:** number - Current version number for optimistic locking


```typescript

```


#### getInitialVersion

Core aggregate root class with event sourcing capabilities and capability system

**Business Context**: Main aggregate implementation following DDD principles with enterprise capabilities


**Returns:** number - Initial version when aggregate was loaded


```typescript

```


#### hasChanges

Core aggregate root class with event sourcing capabilities and capability system

**Business Context**: Main aggregate implementation following DDD principles with enterprise capabilities


**Returns:** boolean - True if there are pending domain events


```typescript

```


#### getDomainEvents

Gets all uncommitted domain events

**Business Context**: Main aggregate implementation following DDD principles with enterprise capabilities


**Returns:** ReadonlyArray<IExtendedDomainEvent> - Array of uncommitted domain events


```typescript

```


#### apply

Core aggregate root class with event sourcing capabilities and capability system

**Business Context**: Main aggregate implementation following DDD principles with enterprise capabilities

**Parameters:**
- `eventTypeOrEvent`: string | IExtendedDomainEvent<P> - Event type string or complete event object
- `payload`: P - Event payload containing business data (optional)
- `metadata`: Partial<IEventMetadata> - Optional event metadata (optional)

**Returns:** void - Method does not return value, modifies aggregate state


```typescript

```


```typescript

```


#### commit

Core aggregate root class with event sourcing capabilities and capability system

**Business Context**: Main aggregate implementation following DDD principles with enterprise capabilities


**Returns:** void - Clears pending events and increments version


```typescript

```


```typescript

```


#### loadFromHistory

Core aggregate root class with event sourcing capabilities and capability system

**Business Context**: Main aggregate implementation following DDD principles with enterprise capabilities

**Parameters:**
- `events`: IExtendedDomainEvent[] - Array of historical domain events in chronological order

**Returns:** void - Reconstructs aggregate state from events


```typescript

```


```typescript

```


#### registerEventHandler

Core aggregate root class with event sourcing capabilities and capability system

**Business Context**: Main aggregate implementation following DDD principles with enterprise capabilities

**Parameters:**
- `eventType`: string - Event type to register handler for
- `handler`: IAggregateEventHandler<T> - Event handler function

**Returns:** this - Returns this for method chaining


```typescript

```


#### addCapability

Core aggregate root class with event sourcing capabilities and capability system

**Business Context**: Main aggregate implementation following DDD principles with enterprise capabilities

**Parameters:**
- `capability`: T extends Capability & IAggregateCapability - Capability instance to add to the aggregate

**Returns:** this - Returns this for method chaining


```typescript

```


```typescript

```


#### getCapability

Core aggregate root class with event sourcing capabilities and capability system

**Business Context**: Main aggregate implementation following DDD principles with enterprise capabilities

**Parameters:**
- `CapabilityClass`: CapabilityConstructor<T> - Constructor of the capability to retrieve

**Returns:** T | undefined - Capability instance or undefined if not found


```typescript

```


```typescript

```


#### hasCapability

Core aggregate root class with event sourcing capabilities and capability system

**Business Context**: Main aggregate implementation following DDD principles with enterprise capabilities

**Parameters:**
- `CapabilityClass`: CapabilityConstructor<T> - Constructor of the capability to check

**Returns:** boolean - True if capability is present


```typescript

```


#### removeCapability

Core aggregate root class with event sourcing capabilities and capability system

**Business Context**: Main aggregate implementation following DDD principles with enterprise capabilities

**Parameters:**
- `CapabilityClass`: CapabilityConstructor<T> - Constructor of the capability to remove

**Returns:** this - Returns this for method chaining


```typescript

```


#### getAllCapabilities

Core aggregate root class with event sourcing capabilities and capability system

**Business Context**: Main aggregate implementation following DDD principles with enterprise capabilities


**Returns:** Capability[] - Array of all registered capabilities


```typescript

```


#### getCapabilityTypes

Core aggregate root class with event sourcing capabilities and capability system

**Business Context**: Main aggregate implementation following DDD principles with enterprise capabilities


**Returns:** string[] - Array of capability type names


```typescript

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


```typescript

```


#### attach

Enterprise-grade auditing capability for tracking aggregate changes and events

**Business Context**: Provides comprehensive audit trails for compliance, debugging, and business intelligence

**Parameters:**
- `aggregate`: unknown - Aggregate instance to attach auditing to

**Returns:** void - No return value - modifies aggregate behavior


```typescript

```


#### detach

Enterprise-grade auditing capability for tracking aggregate changes and events

**Business Context**: Provides comprehensive audit trails for compliance, debugging, and business intelligence


**Returns:** void - No return value - restores original behavior


```typescript

```


#### getAuditLog

Enterprise-grade auditing capability for tracking aggregate changes and events

**Business Context**: Provides comprehensive audit trails for compliance, debugging, and business intelligence


**Returns:** IAuditEvent[] - Array copy of all audit events in chronological order


```typescript

```


#### clearAuditLog

Enterprise-grade auditing capability for tracking aggregate changes and events

**Business Context**: Provides comprehensive audit trails for compliance, debugging, and business intelligence


**Returns:** void - No return value - empties audit log


```typescript

```


#### getAuditStatistics

Enterprise-grade auditing capability for tracking aggregate changes and events

**Business Context**: Provides comprehensive audit trails for compliance, debugging, and business intelligence


**Returns:** { totalEvents: number; eventsByType: Record<string, number>; averageTimeBetweenEvents: number } - Statistics object with event counts, type distribution, and timing metrics


```typescript

```


#### recordEvent

Enterprise-grade auditing capability for tracking aggregate changes and events

**Business Context**: Provides comprehensive audit trails for compliance, debugging, and business intelligence

**Parameters:**
- `event`: IExtendedDomainEvent - Domain event to record with payload and metadata

**Returns:** void - No return value - adds event to audit log


```typescript

```


#### getEventsByType

Enterprise-grade auditing capability for tracking aggregate changes and events

**Business Context**: Provides comprehensive audit trails for compliance, debugging, and business intelligence

**Parameters:**
- `eventType`: string - Event type to filter by (case-sensitive)

**Returns:** IAuditEvent[] - Array of audit events matching the specified type


```typescript

```


#### getEventsByTimeRange

Enterprise-grade auditing capability for tracking aggregate changes and events

**Business Context**: Provides comprehensive audit trails for compliance, debugging, and business intelligence

**Parameters:**
- `startDate`: Date - Start of time range (inclusive)
- `endDate`: Date - End of time range (inclusive)

**Returns:** IAuditEvent[] - Array of audit events within the specified time range


```typescript

```


#### getFirstEvent

Enterprise-grade auditing capability for tracking aggregate changes and events

**Business Context**: Provides comprehensive audit trails for compliance, debugging, and business intelligence


**Returns:** IAuditEvent | null - First audit event in chronological order or null if audit log is empty


```typescript

```


#### getLastEvent

Enterprise-grade auditing capability for tracking aggregate changes and events

**Business Context**: Provides comprehensive audit trails for compliance, debugging, and business intelligence


**Returns:** IAuditEvent | null - Last audit event in chronological order or null if audit log is empty


```typescript

```



### EventSourcingCapability

Event sourcing capability that provides persistence and loading of aggregate events

**Business Context**: Enables event-driven persistence, replay capabilities, and temporal querying for aggregates


#### constructor

Event sourcing capability that provides persistence and loading of aggregate events

**Business Context**: Enables event-driven persistence, replay capabilities, and temporal querying for aggregates


**Returns:** void - 


```typescript

```


#### attach

Event sourcing capability that provides persistence and loading of aggregate events

**Business Context**: Enables event-driven persistence, replay capabilities, and temporal querying for aggregates

**Parameters:**
- `aggregate`: unknown - Aggregate instance to enable event sourcing for

**Returns:** void - No return value - capability is now attached


```typescript

```


#### detach

Event sourcing capability that provides persistence and loading of aggregate events

**Business Context**: Enables event-driven persistence, replay capabilities, and temporal querying for aggregates


**Returns:** void - No return value - capability is detached and cleaned up


```typescript

```


#### setEventStore

Event sourcing capability that provides persistence and loading of aggregate events

**Business Context**: Enables event-driven persistence, replay capabilities, and temporal querying for aggregates

**Parameters:**
- `eventStore`: IEventStore - Event store implementation for persisting and loading events

**Returns:** void - No return value - event store is configured


```typescript

```


#### getEventStore

Event sourcing capability that provides persistence and loading of aggregate events

**Business Context**: Enables event-driven persistence, replay capabilities, and temporal querying for aggregates


**Returns:** IEventStore | null - Current event store instance or null if not configured


```typescript

```


#### loadFromEventStore

Event sourcing capability that provides persistence and loading of aggregate events

**Business Context**: Enables event-driven persistence, replay capabilities, and temporal querying for aggregates

**Parameters:**
- `aggregateId`: string | number - Unique identifier of aggregate to load events for

**Returns:** Promise<void> - Promise that resolves when all events are loaded and applied


```typescript

```


```typescript

```


#### saveToEventStore

Event sourcing capability that provides persistence and loading of aggregate events

**Business Context**: Enables event-driven persistence, replay capabilities, and temporal querying for aggregates


**Returns:** Promise<void> - Promise that resolves when all events are successfully persisted


```typescript

```


#### hasEventStore

Event sourcing capability that provides persistence and loading of aggregate events

**Business Context**: Enables event-driven persistence, replay capabilities, and temporal querying for aggregates


**Returns:** boolean - True if event store is configured, false otherwise


```typescript

```


#### getStreamName

Event sourcing capability that provides persistence and loading of aggregate events

**Business Context**: Enables event-driven persistence, replay capabilities, and temporal querying for aggregates


**Returns:** string - Stream name in format 'AggregateType-aggregateId'


```typescript

```


#### loadFromVersion

Event sourcing capability that provides persistence and loading of aggregate events

**Business Context**: Enables event-driven persistence, replay capabilities, and temporal querying for aggregates

**Parameters:**
- `aggregateId`: string | number - Unique identifier of aggregate to load events for
- `fromVersion`: number - Version number to start loading from (exclusive)

**Returns:** Promise<void> - Promise that resolves when events from specified version are loaded


```typescript

```


```typescript

```



### SnapshotCapability

Performance optimization capability that creates and restores aggregate state snapshots

**Business Context**: Reduces event replay overhead for long-lived aggregates and improves system performance


#### constructor

Performance optimization capability that creates and restores aggregate state snapshots

**Business Context**: Reduces event replay overhead for long-lived aggregates and improves system performance


**Returns:** void - 


```typescript

```


#### attach

Performance optimization capability that creates and restores aggregate state snapshots

**Business Context**: Reduces event replay overhead for long-lived aggregates and improves system performance

**Parameters:**
- `aggregate`: unknown - Aggregate instance to enable snapshotting for

**Returns:** void - No return value - capability is now attached


```typescript

```


#### detach

Performance optimization capability that creates and restores aggregate state snapshots

**Business Context**: Reduces event replay overhead for long-lived aggregates and improves system performance


**Returns:** void - No return value - capability is detached and memory freed


```typescript

```


#### createSnapshot

Performance optimization capability that creates and restores aggregate state snapshots

**Business Context**: Reduces event replay overhead for long-lived aggregates and improves system performance

**Parameters:**
- `serializer`: () => TState - Function that extracts and serializes aggregate state
- `metadataCreator`: () => TMeta - Optional function that creates snapshot metadata

**Returns:** IAggregateSnapshot<TState, TMeta> - Complete snapshot object with state, metadata, and versioning information


```typescript

```


```typescript

```


#### restoreFromSnapshot

Performance optimization capability that creates and restores aggregate state snapshots

**Business Context**: Reduces event replay overhead for long-lived aggregates and improves system performance

**Parameters:**
- `snapshot`: IAggregateSnapshot<TState, TMeta> - Snapshot object containing state and metadata to restore
- `deserializer`: (state: TState) => void - Function that applies state data to aggregate
- `metadataRestorer`: (metadata: TMeta) => void - Optional function that processes snapshot metadata

**Returns:** void - No return value - aggregate state is modified in-place


```typescript

```


```typescript

```


#### saveTemporaryState

Performance optimization capability that creates and restores aggregate state snapshots

**Business Context**: Reduces event replay overhead for long-lived aggregates and improves system performance

**Parameters:**
- `state`: TState - State object to save temporarily

**Returns:** void - No return value - state is stored in memory


```typescript

```


#### getLastSnapshotTimestamp

Performance optimization capability that creates and restores aggregate state snapshots

**Business Context**: Reduces event replay overhead for long-lived aggregates and improves system performance


**Returns:** Date | null - Timestamp of last snapshot or null if no snapshots exist


```typescript

```


#### saveSnapshot

Performance optimization capability that creates and restores aggregate state snapshots

**Business Context**: Reduces event replay overhead for long-lived aggregates and improves system performance

**Parameters:**
- `serializer`: () => TState - Function that extracts and serializes aggregate state
- `metadataCreator`: () => TMeta - Optional function that creates snapshot metadata

**Returns:** void - No return value - snapshot is created and stored internally


```typescript

```


#### getPreviousState

Performance optimization capability that creates and restores aggregate state snapshots

**Business Context**: Reduces event replay overhead for long-lived aggregates and improves system performance


**Returns:** IAggregateSnapshot<TState, TMeta> | null - Previously saved snapshot or null if none exists - clears internal storage


```typescript

```



### VersioningCapability

Advanced capability that handles event schema evolution and version migration through upcasting

**Business Context**: Essential for maintaining backward compatibility in evolving event-sourced systems


#### constructor

Advanced capability that handles event schema evolution and version migration through upcasting

**Business Context**: Essential for maintaining backward compatibility in evolving event-sourced systems


**Returns:** void - 


```typescript

```


#### attach

Advanced capability that handles event schema evolution and version migration through upcasting

**Business Context**: Essential for maintaining backward compatibility in evolving event-sourced systems

**Parameters:**
- `aggregate`: unknown - Aggregate instance to enable versioning for

**Returns:** void - No return value - capability is now attached


```typescript

```


#### detach

Advanced capability that handles event schema evolution and version migration through upcasting

**Business Context**: Essential for maintaining backward compatibility in evolving event-sourced systems


**Returns:** void - No return value - capability detached and upcasters cleared


```typescript

```


#### registerUpcaster

Advanced capability that handles event schema evolution and version migration through upcasting

**Business Context**: Essential for maintaining backward compatibility in evolving event-sourced systems

**Parameters:**
- `eventType`: string - Type of event this upcaster handles
- `sourceVersion`: number - Source version number to transform from
- `upcaster`: IEventUpcaster<TFrom, TTo> - Upcaster implementation that transforms event data

**Returns:** void - No return value - upcaster is registered in internal registry


```typescript

```


```typescript

```


#### handleVersionedEvent

Advanced capability that handles event schema evolution and version migration through upcasting

**Business Context**: Essential for maintaining backward compatibility in evolving event-sourced systems

**Parameters:**
- `event`: IExtendedDomainEvent - Domain event that may need version transformation
- `handlers`: Map<string, IAggregateEventHandler> - Map of event handlers by event type

**Returns:** void - No return value - event is processed and handler is called


```typescript

```


```typescript

```


#### getRegisteredEventTypes

Advanced capability that handles event schema evolution and version migration through upcasting

**Business Context**: Essential for maintaining backward compatibility in evolving event-sourced systems


**Returns:** string[] - Array of event type names that have upcasters


```typescript

```


#### hasUpcaster

Advanced capability that handles event schema evolution and version migration through upcasting

**Business Context**: Essential for maintaining backward compatibility in evolving event-sourced systems

**Parameters:**
- `eventType`: string - Event type to check
- `version`: number - Version number to check for upcaster

**Returns:** boolean - True if upcaster exists for specified event type and version


```typescript

```


```typescript

```


#### getUpcastersForType

Advanced capability that handles event schema evolution and version migration through upcasting

**Business Context**: Essential for maintaining backward compatibility in evolving event-sourced systems

**Parameters:**
- `eventType`: string - Event type to get upcasters for

**Returns:** Map<number, IEventUpcaster> | undefined - Map of upcasters by version number, or undefined if no upcasters exist


```typescript

```


```typescript

```


#### clearUpcastersForType

Advanced capability that handles event schema evolution and version migration through upcasting

**Business Context**: Essential for maintaining backward compatibility in evolving event-sourced systems

**Parameters:**
- `eventType`: string - Event type to clear upcasters for

**Returns:** void - No return value - all upcasters for event type are removed


```typescript

```


#### getTotalUpcasterCount

Advanced capability that handles event schema evolution and version migration through upcasting

**Business Context**: Essential for maintaining backward compatibility in evolving event-sourced systems


**Returns:** number - Total count of all registered upcasters


```typescript

```





---

*Generated with @vytches/ddd-cli on 2025-08-04T12:23:37.815Z*  
*Using Enhanced Metadata System V2*