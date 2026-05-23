# @vytches/ddd-contracts

> Foundation interfaces, types, and the `Result<T,E>` primitive for the entire
> VytchesDDD ecosystem.

[![npm version](https://badge.fury.io/js/%40vytches%2Fddd-contracts.svg)](https://badge.fury.io/js/%40vytches%2Fddd-contracts)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Installation

```bash
pnpm add @vytches/ddd-contracts
```

## What's included

- **`Result<T,E>`** — explicit success/failure container used across all
  packages
- **`EntityId`** — base identity implementation for domain entities
- **Event contracts** — `IDomainEvent`, `IEventStore`, `IEventBus`, and related
  interfaces
- **Capability system** — `Capability`, `CapabilityRegistry`, and opt-in
  capability interfaces
- **Validation contracts** — `ISpecification`, `IValidator`, `IValidationError`
- **Repository contracts** — `IRepository`, `IUnitOfWork`, and variants
- **Testing contracts** — `ITestHarness`, `ITestClock`, `ITestDataBuilder`
- **Factory contracts** — `IDomainFactory`, `IAsyncDomainFactory`

## Usage

```typescript
import { Result, EntityId } from '@vytches/ddd-contracts';

// Result pattern for explicit error handling
function divide(a: number, b: number): Result<number> {
  if (b === 0) return Result.fail(new Error('Division by zero'));
  return Result.ok(a / b);
}

const result = divide(10, 2);
if (result.isSuccess) {
  console.log(result.value); // 5
}

// Entity identity
const id = EntityId.create<string>();
```

```typescript
import type { IDomainEvent, IEventStore } from '@vytches/ddd-contracts';
import { createDomainEvent } from '@vytches/ddd-contracts';

// Create a domain event
const event = createDomainEvent({
  eventType: 'OrderCreated',
  aggregateId: 'order-123',
  aggregateVersion: 1,
  eventData: { customerId: 'c1' },
});

// Implement your own event store adapter
class MyEventStore implements IEventStore {
  async appendToStream(
    streamId: string,
    events: IDomainEvent[]
  ): Promise<void> {
    // your storage logic
  }
}
```

## API Reference

### Result

| Member               | Description                           |
| -------------------- | ------------------------------------- |
| `Result.ok(value)`   | Create a successful result            |
| `Result.fail(error)` | Create a failure result               |
| `Result.empty()`     | Create a successful void result       |
| `Result.try(fn)`     | Wrap a throwing function in a Result  |
| `.isSuccess`         | `true` if success                     |
| `.isFailure`         | `true` if failure                     |
| `.value`             | The success value (throws if failure) |
| `.error`             | The error value (throws if success)   |

### Domain Identity

| Export                       | Kind      | Description                     |
| ---------------------------- | --------- | ------------------------------- | ------ | --------- | --------- |
| `EntityId`                   | class     | Base identity implementation    |
| `IEntityId`                  | interface | Entity identity contract        |
| `IEntityIdFactory`           | interface | Factory for creating entity ids |
| `IEntityIdConstructorParams` | interface | Constructor parameter shape     |
| `IdType`                     | type      | `'text'                         | 'uuid' | 'integer' | 'bigint'` |

### Domain Events

| Export                                   | Kind           | Description                                |
| ---------------------------------------- | -------------- | ------------------------------------------ |
| `IDomainEvent`                           | interface      | Base domain event contract                 |
| `IEventMetadata`                         | interface      | Metadata carried on every event            |
| `IEventStore`                            | interface      | Append-only event storage port             |
| `IEventStoreAdapter`                     | interface      | Lower-level storage adapter                |
| `IEventStoreConfig`                      | interface      | Event store configuration                  |
| `IEventBus`                              | interface      | Publish/subscribe bus contract             |
| `IEventDispatcher`                       | interface      | Synchronous event dispatch                 |
| `IEnhancedEventDispatcher`               | interface      | Extended dispatcher with persistence       |
| `IEventPersistenceHandler`               | interface      | Handles persisting events                  |
| `IEventHandler`                          | interface      | Handles a specific event type              |
| `IStoredEvent` / `IStoredDomainEvent`    | interface      | Persisted event shapes                     |
| `IEventStream` / `IGlobalEventStream`    | interface      | Stream read/write contracts                |
| `IEventSerializer`                       | interface      | Event serialization port                   |
| `IEventUpcaster`                         | interface      | Schema migration for stored events         |
| `IAdvancedEventStore`                    | interface      | Full event store with streams and metadata |
| `IEventProcessor`                        | interface      | Event processing contract                  |
| `IReadStreamOptions` / `IReadAllOptions` | interface      | Read operation options                     |
| `IStreamMetadata` / `IAppendResult`      | interface      | Stream metadata and append result          |
| `createDomainEvent`                      | function       | Factory for `IDomainEvent` instances       |
| `isEventHandler`                         | function       | Type guard for event handler objects       |
| `IEventBus` (class)                      | abstract class | Re-exported for DI tokens                  |
| `IEventDispatcher` (class)               | abstract class | Re-exported for DI tokens                  |
| `IEnhancedEventDispatcher` (class)       | abstract class | Re-exported for DI tokens                  |
| `IEventPersistenceHandler` (class)       | abstract class | Re-exported for DI tokens                  |

### Event Replay

| Export                                                                | Kind      | Description                   |
| --------------------------------------------------------------------- | --------- | ----------------------------- |
| `IEventReplay` / `IAdvancedEventReplay`                               | interface | Replay session contracts      |
| `IEventReplayFactory`                                                 | interface | Creates replay sessions       |
| `IReplayConfig` / `IReplayFilter`                                     | interface | Replay configuration          |
| `IReplayProgress` / `IReplayResult`                                   | interface | Progress tracking and results |
| `IReplaySession`                                                      | interface | Active replay session         |
| `ReplayEventHandler` / `ReplayErrorHandler` / `ReplayProgressHandler` | type      | Replay callback types         |

### Capabilities

| Export                                                       | Kind      | Description                              |
| ------------------------------------------------------------ | --------- | ---------------------------------------- |
| `Capability`                                                 | class     | Base capability marker                   |
| `CapabilityRegistry`                                         | class     | Manages capabilities on an aggregate     |
| `createCapabilityRegistry`                                   | function  | Factory for `CapabilityRegistry`         |
| `IAggregateCapability`                                       | interface | Base capability contract                 |
| `IAuditCapability`                                           | interface | Audit trail capability                   |
| `ISnapshotCapability`                                        | interface | State snapshot capability                |
| `IVersioningCapability`                                      | interface | Optimistic locking capability            |
| `IEventSourcingCapability`                                   | interface | Event sourcing reconstruction capability |
| `IProjectionCapability`                                      | interface | Projection management capability         |
| `ICircuitBreakerCapability`                                  | interface | Circuit breaker capability               |
| `ICheckpointCapability`                                      | interface | Processing checkpoint capability         |
| `IDeadLetterCapability`                                      | interface | Dead-letter queue capability             |
| `CapabilityConstructor` / `CapabilityMap` / `CapabilityType` | type      | Capability type helpers                  |

### Validation

| Export                   | Kind      | Description                         |
| ------------------------ | --------- | ----------------------------------- |
| `ISpecification<T>`      | interface | Synchronous specification contract  |
| `IAsyncSpecification<T>` | interface | Asynchronous specification contract |
| `IValidator<T>`          | interface | Validator contract                  |
| `IValidationError`       | interface | Single validation error             |
| `IValidationErrors`      | interface | Collection of validation errors     |
| `IValidationRule`        | interface | A single validation rule            |

### Repositories

| Export                   | Kind      | Description                              |
| ------------------------ | --------- | ---------------------------------------- |
| `IRepository<T>`         | interface | Core CRUD repository                     |
| `IWriteRepository<T>`    | interface | Write-only repository                    |
| `IQueryRepository<T>`    | interface | Read-only repository                     |
| `IExtendedRepository<T>` | interface | Repository with pagination and filtering |
| `IBatchRepository<T>`    | interface | Batch operations                         |
| `ICQRSRepository<T>`     | interface | Separate read/write sides                |
| `IRepositoryProvider`    | interface | Repository factory                       |
| `IUnitOfWork`            | interface | Transactional boundary                   |
| `IRepositoryEntity`      | interface | Entity shape required by repositories    |

### Aggregates

| Export                   | Kind      | Description                         |
| ------------------------ | --------- | ----------------------------------- |
| `IAggregateWithEvents`   | interface | Aggregate that tracks domain events |
| `IAggregateSnapshot`     | interface | Snapshot contract                   |
| `IDomainFactory<T>`      | interface | Synchronous aggregate factory       |
| `IAsyncDomainFactory<T>` | interface | Asynchronous aggregate factory      |

### Testing Contracts

| Export                                                            | Kind      | Description                      |
| ----------------------------------------------------------------- | --------- | -------------------------------- |
| `ITestHarness`                                                    | interface | Test environment setup/teardown  |
| `ITestClock`                                                      | interface | Controllable time in tests       |
| `ITestDataBuilder<T>`                                             | interface | Fluent test data construction    |
| `ITestFixture`                                                    | interface | Shared test state                |
| `ITestScenario`                                                   | interface | Named test scenario              |
| `ISafeRunResult<T>`                                               | interface | Result shape from safe execution |
| `TestClockOptions` / `TestHarnessOptions` / `TestScenarioOptions` | interface | Configuration types              |

### Event Bus Middleware

| Export                 | Kind      | Description                                |
| ---------------------- | --------- | ------------------------------------------ |
| `EventBusMiddleware`   | type      | Middleware function for event buses        |
| `EventMiddleware`      | type      | Alias for event bus middleware             |
| `BaseEventBusOptions`  | interface | Base options for event bus implementations |
| `EventHandlerFn`       | type      | Event handler function signature           |
| `EventHandlerMetadata` | interface | Metadata attached to event handlers        |

## Package boundaries

`@vytches/ddd-contracts` has **zero runtime dependencies**. It is the leaf node
of the dependency graph — every other package in the VytchesDDD ecosystem
depends on it, directly or transitively. Do not import other `@vytches/ddd-*`
packages from consumer code in this package.

## License

MIT
