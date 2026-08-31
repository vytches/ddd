# @vytches/ddd-contracts - LLM Guide

## Purpose

Foundation package that defines all shared interfaces and contracts for the DDD
library. Every other package depends on this — it has zero dependencies itself.

## Quick Start

```typescript
import type {
  IDomainEvent,
  IEventMetadata,
  IRepository,
  ISpecification,
  IEntityId,
} from '@vytches/ddd-contracts';
import {
  EntityId,
  IEventBus,
  Capability,
  CapabilityRegistry,
} from '@vytches/ddd-contracts';

// Create a typed entity ID
const orderId: IEntityId<string> = new EntityId('abc-123', 'text');

// Define a domain event
interface OrderPlacedPayload {
  amount: number;
  customerId: string;
}
const event: IDomainEvent<OrderPlacedPayload> = {
  eventName: 'OrderPlaced',
  payload: { amount: 100, customerId: 'c-1' },
  metadata: { correlationId: 'req-1' },
};
```

## Key API

| Export                              | Kind           | Description                                                                                                                                                                   |
| ----------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `IDomainEvent<P>`                   | interface      | Base contract for all domain events; has `eventName`, `payload?`, `metadata?`                                                                                                 |
| `IEventMetadata`                    | interface      | Tracing fields: `eventId`, `correlationId`, `causationId`, `aggregateId`, `aggregateVersion`                                                                                  |
| `IEventBus<TEvent>`                 | abstract class | Publish/subscribe contract; `publish`, `subscribe`, `registerHandler`, `publishMany`                                                                                          |
| `IEntityId<T>`                      | interface      | Typed aggregate identifier; `getValue()`, `equals()`, `toString()`, `isType()`                                                                                                |
| `EntityId<T>`                       | class          | Base implementation of `IEntityId`; constructor takes `(value, type)`                                                                                                         |
| `IEntityIdFactory`                  | interface      | Factory contract: `createWithRandomUUID`, `fromUUID`, `fromInteger`, `fromBigInt`, `fromText`                                                                                 |
| `IdType`                            | type           | `'uuid' \| 'integer' \| 'text' \| 'bigint'`                                                                                                                                   |
| `IRepository<T>`                    | interface      | Base persistence contract: `save`, `findById?`, `delete?`                                                                                                                     |
| `IExtendedRepository<T>`            | interface      | Adds `exists`, `findBySpecification?`, `findOneBySpecification?`                                                                                                              |
| `IBatchRepository<T>`               | interface      | **N+1 prevention** (VP-002) — extends `IRepository` with `findByIds(ids): Promise<Array<T \| null>>`. Order-preserving result; type-narrow at call site to pick batched fetch |
| `IUnitOfWork`                       | interface      | Transaction management: `begin`, `commit`, `rollback`, `getRepository`, `getEventBus`                                                                                         |
| `IDomainFactory<TAgg, TProps>`      | interface      | **Factory pattern contract** (VF-CANON-001) — `create(props): Result<TAgg, Error>`. Sibling to `IRepository` for complex aggregate creation                                   |
| `IAsyncDomainFactory<TAgg, TProps>` | interface      | Async variant of `IDomainFactory`; `create` returns `Promise<Result<...>>` for factories that need DB lookups during creation                                                 |
| `ISpecification<T>`                 | interface      | Domain rule: `isSatisfiedBy`, `and`, `or`, `not`, `explainFailure?`                                                                                                           |
| `IAsyncSpecification<T>`            | interface      | Async version with `isSatisfiedByAsync` and context parameter                                                                                                                 |
| `Capability`                        | class          | Base for all aggregate capabilities                                                                                                                                           |
| `CapabilityRegistry`                | class          | Manages capability instances keyed by constructor                                                                                                                             |
| `IAggregateCapability`              | interface      | Marks a class as an aggregate-attachable capability                                                                                                                           |

### Event Handling & Dispatch (additional)

| Export                                             | Kind           | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| -------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `EventBusMiddleware`                               | type           | `(next) => (event) => Promise<void>` — intercepts/transforms events inside `IEventBus`'s pipeline; wired via `BaseEventBusOptions.middlewares`                                                                                                                                                                                                                                                                                                                                                                                              |
| `IEventDispatcher`                                 | abstract class | Dispatches events from aggregates: `dispatchEventsForAggregate(aggregate)`, `dispatchEvent(event)`, `dispatchEvents(...events)`                                                                                                                                                                                                                                                                                                                                                                                                             |
| `IEnhancedEventDispatcher`                         | abstract class | Extends `IEventDispatcher` with `use(middleware)` and `registerProcessor(processor)`                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `EventMiddleware`                                  | type           | `(event, next) => Promise<void>` — pipeline middleware registered via `IEnhancedEventDispatcher.use()`                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `IEventProcessor`                                  | interface      | `process(event)`, `canProcess(event)` — pluggable processor registered via `IEnhancedEventDispatcher.registerProcessor`                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `IEventPersistenceHandler`                         | abstract class | `handleEvent(event): Promise<number>`, `getCurrentVersion(aggregateId)` — persists one event, returns the new aggregate version. **VF-023 AC9**: implementations MUST make the version check + write atomic (CAS/conditional write) — `IBaseRepository.save()` calls `getCurrentVersion()` and `handleEvent()` as two separate, non-atomic calls, so a naive insert-only handler gives NO real optimistic-concurrency guarantee under concurrent writers. See the interface's JSDoc and `docs/security/threat-models/TM-VF-023.md` (SA-M9). |
| `IEventHandler<T>`                                 | interface      | Class-based handler contract: `handle(event: T): Promise<void> \| void`; pass an instance to `IEventBus.registerHandler`                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `EventHandlerFn<T>`                                | type           | `(event: T) => Promise<void> \| void` — function-handler signature used by `IEventBus.subscribe`                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `EventHandlerMetadata`                             | interface      | `{ eventType: Constructor }` — metadata shape stored by the `@EventHandler` decorator (in `@vytches/ddd-events`)                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `isEventHandler(obj)`                              | function       | Type guard: `obj is IEventHandler<IDomainEvent>`; true when `obj` has a callable `handle` method                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `EVENT_HANDLER_METADATA` / `EVENT_HANDLER_OPTIONS` | symbol         | `@internal` — decorator metadata keys re-exported only so sibling `@vytches/ddd-*` packages can resolve them; not part of the consumer contract                                                                                                                                                                                                                                                                                                                                                                                             |
| `IAggregateWithEvents`                             | interface      | `getDomainEvents()`, `commit()`, `hasChanges()` — parameter type of `IEventDispatcher.dispatchEventsForAggregate`                                                                                                                                                                                                                                                                                                                                                                                                                           |

### Event Store

| Export                     | Kind      | Description                                                                                                                                                                             |
| -------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `IEventStore`              | interface | Minimal event store: `getEvents(aggregateId)`, `saveEvents(aggregateId, events, expectedVersion)`, `getEventsAfterVersion(aggregateId, version)`                                        |
| `IAdvancedEventStore`      | interface | Full-featured store — stream append/read, global log read, snapshots, stream metadata, optional subscriptions. Entry point for the combo pattern below                                  |
| `IAuditEvent`              | interface | Auditable event record: `eventId`, `timestamp`, `aggregateId`, `aggregateType`, `aggregateVersion`, `eventName`, `payload?`, `actor?`, `previousState?`                                 |
| `IEventUpcaster<TIn,TOut>` | interface | `upcast(payload, metadata?): TOut` — transforms an event payload across schema versions; registered via `IVersioningCapability.registerUpcaster`                                        |
| `IStoredDomainEvent<P>`    | interface | `IDomainEvent<P>` persisted with `eventId`, `aggregateId`, `aggregateType`, `aggregateVersion`, `timestamp` — input type for `appendToStream`                                           |
| `IAppendResult`            | interface | `{ streamId, fromVersion, toVersion, events, position }` — return value of `appendToStream`                                                                                             |
| `IStoredEvent<T>`          | interface | `IStoredDomainEvent<T>` plus `position`, `streamId`, `streamVersion`, `globalVersion`, `checksum?` — shape read back from a stream                                                      |
| `IReadStreamOptions`       | interface | `{ fromVersion?, maxCount?, direction?, resolveLinkTos? }` — options for `readStream`                                                                                                   |
| `IReadAllOptions`          | interface | `{ fromPosition?, maxCount?, direction?, filterByEventType?, filterByStreamPrefix? }` — options for `readAll`                                                                           |
| `IEventStream<T>`          | interface | A page of events from `readStream`: `{ streamId, events, fromVersion, lastVersion, isEndOfStream, nextVersion }`                                                                        |
| `IGlobalEventStream<T>`    | interface | A page of events from `readAll`: `{ events, fromPosition, nextPosition, isEndOfStream }`                                                                                                |
| `IStreamMetadata`          | interface | `{ streamId, created, updated, version, eventCount, firstEventPosition?, lastEventPosition?, deleted?, customMetadata? }` — return type of `getStreamMetadata`                          |
| `IEventSerializer`         | interface | `serialize(event)`, `deserialize(data)`, `getContentType()` — plugged into `IEventStoreConfig.serializer`                                                                               |
| `IEventStoreConfig`        | interface | Advanced-store configuration: `serializer?`, `enableSnapshots?`, `snapshotFrequency?`, `enableOptimisticConcurrency?`, `enableChecksums?`, `maxEventsPerStream?`, `eventRetentionDays?` |
| `IEventStoreAdapter`       | interface | Connection lifecycle for a store implementation: `connect()`, `disconnect()`, `isConnected()`, `clear?()`                                                                               |

### Event Replay

| Export                  | Kind      | Description                                                                                                                                                                                           |
| ----------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `IEventReplay`          | interface | Replays stored events through a handler: `replayFromStream`, `replayAll`, `replayWithFilter`, `getEventsAsIterable`, `countEvents`, `estimateReplayDuration`. Entry point for the combo pattern below |
| `IAdvancedEventReplay`  | interface | Extends `IEventReplay` with `startReplaySession()` for pausable/resumable/cancellable replay                                                                                                          |
| `IReplaySession`        | interface | Controllable session from `startReplaySession`: `sessionId`, `progress`, `status`, `pause()`, `resume()`, `cancel()`, `waitForCompletion()`, `onProgress()`, `onError()`                              |
| `IEventReplayFactory`   | interface | `createBasicReplay()`, `createAdvancedReplay()`, `createCustomReplay(strategy)` — factory for replay strategy instances                                                                               |
| `IReplayFilter`         | interface | Filter criteria: timestamp/version/position ranges, `eventTypes`, `aggregateTypes`, `aggregateIds`, `streamPrefix`, `maxEvents`, `direction`                                                          |
| `IReplayConfig`         | interface | Execution tuning: `batchSize?`, `batchDelay?`, `parallel?`, `maxWorkers?`, `skipErrors?`, `eventTimeout?`, `reportProgress?`, `progressInterval?`                                                     |
| `IReplayProgress`       | interface | Progress snapshot: `totalEvents`, `processedEvents`, `failedEvents`, `skippedEvents`, `currentPosition`, `percentComplete`, `eventsPerSecond`, `startTime`, `lastUpdate`                              |
| `IReplayResult`         | interface | Outcome of a replay run: `eventsReplayed`, `eventsFailed`, `eventsSkipped`, `duration`, `averageSpeed`, `errors`, `finalProgress`, `success`                                                          |
| `ReplayEventHandler`    | type      | `(event: IStoredEvent) => Promise<void>` — per-event callback passed to `replayFromStream`/`replayAll`                                                                                                |
| `ReplayProgressHandler` | type      | `(progress: IReplayProgress) => void` — subscribed via `IReplaySession.onProgress`                                                                                                                    |
| `ReplayErrorHandler`    | type      | `(error, event) => Promise<boolean>` — return `true` to continue past an error; subscribed via `IReplaySession.onError`                                                                               |

### Validation (additional)

| Export               | Kind      | Description                                                                                                                                |
| -------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `IValidator<T>`      | interface | `validate(value: T): Result<T, IValidationErrors>` — validation contract sibling to `ISpecification`, returns `Result` instead of throwing |
| `IValidationRule<T>` | interface | `{ property, validate: (value) => Result<true, IValidationError>, condition? }` — a single composable rule                                 |
| `IValidationErrors`  | interface | `{ errors: IValidationError[], length }` — the failure branch of `IValidator.validate`                                                     |
| `IValidationError`   | interface | `{ property, message, context? }` — a single validation failure                                                                            |

### Capabilities (additional)

| Export                                  | Kind      | Description                                                                                                                          |
| --------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `createCapabilityRegistry<T>()`         | function  | Factory returning `new CapabilityRegistry<T>()` — convenience constructor for typed registries                                       |
| `CapabilityConstructor<T>`              | type      | `(new (...args) => T) & { capabilityType: string }` — constructor shape required by `CapabilityRegistry.get/has/remove`              |
| `CapabilityMap`                         | type      | `Map<string, Capability>` — internal shape of a capability collection                                                                |
| `CapabilityType<T>`                     | type      | Extracts the string discriminant `U` from `Capability<U>`                                                                            |
| `IAuditCapability`                      | interface | `getAuditLog()`, `clearAuditLog()`, `getAuditStatistics?()` — aggregate capability for change history                                |
| `ICheckpointCapability<TReadModel>`     | interface | `saveCheckpoint`, `loadCheckpoint`, `getInterval()` — projection capability for resumable read-model rebuilds                        |
| `ICircuitBreakerCapability<TReadModel>` | interface | `recordSuccess`, `recordFailure`, `isOpen()`, `getState()`, `reset()` — projection capability for failure isolation                  |
| `IDeadLetterCapability<TReadModel>`     | interface | `sendToDeadLetter`, `getDeadLetterEvents`, `retryDeadLetterEvent`, `clearDeadLetterQueue` — projection capability for poison events  |
| `IEventSourcingCapability`              | interface | `loadFromEventStore`, `saveToEventStore`, `setEventStore`, `getEventStore` — aggregate capability wiring an `IEventStore`            |
| `IProjectionCapability<T,TReadModel>`   | interface | Sibling of `IAggregateCapability` for projection engines: `attach`, `detach?`, `initialize?`, `cleanup?`                             |
| `ISnapshotCapability<TState,TMeta>`     | interface | `createSnapshot`, `restoreFromSnapshot`, `saveTemporaryState?`, `getLastSnapshotTimestamp?` — produces/consumes `IAggregateSnapshot` |
| `IVersioningCapability`                 | interface | `registerUpcaster`, `handleVersionedEvent`, `getRegisteredEventTypes`, `hasUpcaster` — aggregate capability for schema evolution     |

### Domain (additional)

| Export                          | Kind      | Description                                                                                |
| ------------------------------- | --------- | ------------------------------------------------------------------------------------------ |
| `IEntityIdConstructorParams<T>` | interface | `{ value: T, type: IdType }` — constructor parameter shape for `IEntityId` implementations |

### Testing

| Export                | Kind      | Description                                                                                                         |
| --------------------- | --------- | ------------------------------------------------------------------------------------------------------------------- |
| `ITestClock`          | interface | `now()`, `advance(ms)`, `setTime(date)`, `reset()` — controllable clock for deterministic time-based tests          |
| `ITestHarness<T>`     | interface | `setup()`, `teardown()`, `execute(scenario)`, `getContext()` — wraps a test environment's lifecycle                 |
| `ISafeRunResult<T,E>` | interface | `{ error?, result?, isSuccess(), isFailure() }` — outcome of a guarded test execution                               |
| `ITestDataBuilder<T>` | interface | `build()`, `reset()`, `clone()` — fluent test-data builder contract                                                 |
| `ITestScenario`       | interface | `{ name, description?, setup?, execute, cleanup?, expectedOutcome? }` — a named, runnable test scenario             |
| `ITestFixture<T>`     | interface | `create()`, `createMany(count)`, `createWith(overrides)`, `getDefaults()` — fixture factory contract                |
| `TestClockOptions`    | interface | `{ initialTime?, frozen?, timezone?, autoAdvance? }` — configuration for `ITestClock` implementations               |
| `TestHarnessOptions`  | interface | `{ timeout?, captureErrors?, restoreState?, context?, hooks? }` — configuration for `ITestHarness` implementations  |
| `TestScenarioOptions` | interface | `{ tags?, priority?, skip?, only?, retry?, timeout?, requiredEnv?, metadata? }` — configuration for `ITestScenario` |

### Repositories (additional)

| Export                | Kind      | Description                                                                                                                              |
| --------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `IRepositoryProvider` | interface | `getRepository<T>(name): T \| undefined` — registry/factory lookup contract, simpler than `IUnitOfWork.getRepository` (no throw on miss) |
| `IQueryRepository<T>` | interface | Read-side of CQRS: `findAll()`, `findWithPagination(limit, offset)`, `count()`                                                           |
| `IWriteRepository<T>` | interface | Write-side of CQRS: `create(entity)`, `update(entity)`, `deleteById(id)`                                                                 |

### Shared (additional)

| Export                             | Kind      | Description                                                                                                                                                                                                                                                                                                                             |
| ---------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `IAggregateSnapshot<TState,TMeta>` | interface | `{ aggregateId, version, aggregateType, state, timestamp, metadata?, lastEventId?, checksum? }` — used by `ISnapshotCapability` and `IAdvancedEventStore.getSnapshot`/`saveSnapshot`                                                                                                                                                    |
| `Result<TValue, TError = Error>`   | class     | Outcome wrapper. Constructors: `ok`/`fail`/`empty`/`try`/`tryAsync`. Chainable: `map`/`flatMap`/`match`/`tap`/`tapError`/`mapError`/`mapAsync`/`flatMapAsync`. Aggregation across several `Result`s: `combine`/`combineWithAllErrors`. Canonical home — `@vytches/ddd-utils` re-exports the same class. See "Result combinators" below. |

### Diagnostics

| Export                          | Kind      | Description                                                                                                                                                                       |
| ------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DiagnosticsSink`               | interface | Consumer-implemented sink: `warn(message, context?)`, `error(message, error?, context?)` — passed to `configureDiagnostics({ sink })`                                             |
| `DiagnosticsLevel`              | type      | `'silent' \| 'error' \| 'warn'` — verbosity passed to `configureDiagnostics({ level })`                                                                                           |
| `DiagnosticsOptions`            | interface | `{ sink?, level? }` — argument shape for `configureDiagnostics`                                                                                                                   |
| `configureDiagnostics(options)` | function  | Configures the library's internal diagnostics channel (sink + level). See pattern below                                                                                           |
| `internalLogger`                | const     | `@internal` — library-internal diagnostics shim (`warn`/`error`) delegating to the configured `DiagnosticsSink`; not an application logging layer, do not import in consumer code |

## Patterns

### Implementing a repository

```typescript
import type {
  IExtendedRepository,
  IRepositoryEntity,
} from '@vytches/ddd-contracts';

interface Order extends IRepositoryEntity {
  getId(): string;
}

class InMemoryOrderRepository implements IExtendedRepository<Order> {
  private store = new Map<string, Order>();

  async save(entity: Order): Promise<void> {
    this.store.set(entity.getId() as string, entity);
  }

  async exists(id: unknown): Promise<boolean> {
    return this.store.has(id as string);
  }
}
```

### Implementing a specification

```typescript
import type { ISpecification } from '@vytches/ddd-contracts';

class ActiveOrderSpec implements ISpecification<Order> {
  isSatisfiedBy(candidate: Order): boolean {
    return candidate.status === 'active';
  }
  and(other: ISpecification<Order>): ISpecification<Order> {
    return {
      isSatisfiedBy: c => this.isSatisfiedBy(c) && other.isSatisfiedBy(c),
      and: () => {
        throw new Error();
      },
      or: () => {
        throw new Error();
      },
      not: () => {
        throw new Error();
      },
    };
  }
  or(other: ISpecification<Order>): ISpecification<Order> {
    /* ... */ return this;
  }
  not(): ISpecification<Order> {
    /* ... */ return this;
  }
}
```

### Using IEventBus with generics

```typescript
import { IEventBus } from '@vytches/ddd-contracts';
import type { IDomainEvent } from '@vytches/ddd-contracts';

// IEventBus is an abstract class used as both type and DI token
class MyEventBus extends IEventBus<IDomainEvent> {
  async publish(event: IDomainEvent): Promise<void> {
    /* ... */
  }
  subscribe<T extends IDomainEvent>(
    eventType: string | (new (...args: any[]) => T),
    handler: (event: T) => Promise<void> | void
  ): void {
    /* ... */
  }
  registerHandler<T extends IDomainEvent>(
    eventType: string | (new (...args: any[]) => T),
    handler: { handle(event: T): Promise<void> | void }
  ): void {
    /* ... */
  }
  unsubscribe(
    eventType: string | (new (...args: any[]) => IDomainEvent),
    handler: any
  ): void {
    /* ... */
  }
  async publishMany(events: IDomainEvent[]): Promise<void> {
    /* ... */
  }
}
```

### Using `createDomainEvent`

```typescript
import { createDomainEvent } from '@vytches/ddd-contracts';

// eventId + timestamp are generated automatically; only pass what varies
const event = createDomainEvent(
  'OrderPlaced',
  { orderId: 'o-1', amount: 100 },
  { correlationId: 'req-42' }
);
// event.metadata.eventId and event.metadata.timestamp are already filled in
await eventBus.publish(event);
```

### Implementing `IValidator`

```typescript
import type { IValidator, IValidationErrors } from '@vytches/ddd-contracts';
import { Result } from '@vytches/ddd-contracts';

interface CreateOrderInput {
  customerId: string;
  items: unknown[];
}

class CreateOrderValidator implements IValidator<CreateOrderInput> {
  validate(
    value: CreateOrderInput
  ): Result<CreateOrderInput, IValidationErrors> {
    const errors = [];
    if (!value.customerId) {
      errors.push({
        property: 'customerId',
        message: 'customerId is required',
      });
    }
    if (value.items.length === 0) {
      errors.push({
        property: 'items',
        message: 'at least one item is required',
      });
    }
    if (errors.length > 0) {
      return Result.fail({ errors, length: errors.length });
    }
    return Result.ok(value);
  }
}
```

### Event-sourcing workflow: append → read → replay → snapshot

Chains `IAdvancedEventStore`, `IEventReplay`, and `IAggregateSnapshot` — the
layers a typical event-sourced aggregate combines to persist its history and
rehydrate state, instead of using any one of them in isolation.

```typescript
import type {
  IAdvancedEventStore,
  IEventReplay,
  IStoredDomainEvent,
  IAggregateSnapshot,
} from '@vytches/ddd-contracts';

declare const eventStore: IAdvancedEventStore;
declare const eventReplay: IEventReplay;
declare const order: { apply(e: IStoredDomainEvent): void; toState(): unknown };

const streamId = `order-${orderId}`;

// 1. Append events to a stream (produced when an aggregate is saved)
const events: IStoredDomainEvent[] = [
  {
    eventId: crypto.randomUUID(),
    eventName: 'OrderPlaced',
    aggregateId: orderId,
    aggregateType: 'Order',
    aggregateVersion: 1,
    timestamp: new Date(),
    payload: { amount: 100 },
  },
];
const appendResult = await eventStore.appendToStream(streamId, events);
// appendResult: { streamId, fromVersion, toVersion, events, position }

// 2. Read the stream back directly (e.g. to feed a read model)
const page = await eventStore.readStream(streamId, { fromVersion: 0 });
console.log(page.events.length, page.isEndOfStream);

// 3. Or replay it through a handler to rehydrate an aggregate
const replayResult = await eventReplay.replayFromStream(
  streamId,
  async storedEvent => order.apply(storedEvent),
  { fromStreamVersion: 0 },
  { batchSize: 100 }
);
console.log(replayResult.success, replayResult.eventsReplayed);

// 4. Periodically snapshot so future loads skip replaying from event 0
const snapshot: IAggregateSnapshot = {
  aggregateId: orderId,
  version: appendResult.toVersion,
  aggregateType: 'Order',
  state: order.toState(),
  timestamp: new Date(),
};
await eventStore.saveSnapshot(streamId, snapshot);

// 5. On next load: restore the snapshot, then replay only events after it
const restored = await eventStore.getSnapshot(streamId);
if (restored) {
  await eventReplay.replayFromStream(
    streamId,
    async storedEvent => order.apply(storedEvent),
    { fromStreamVersion: restored.version }
  );
}
```

### Advanced replay: pausable session

Builds on the workflow above using `IAdvancedEventReplay` when a replay needs to
be monitored, paused under load, or cancelled — e.g. rebuilding a large
projection during business hours.

```typescript
import type {
  IAdvancedEventReplay,
  IReplaySession,
} from '@vytches/ddd-contracts';

declare const advancedReplay: IAdvancedEventReplay;

const session: IReplaySession = await advancedReplay.startReplaySession(
  async event => rebuildProjection(event),
  { aggregateTypes: ['Order'] },
  { batchSize: 200, reportProgress: true }
);

session.onProgress(progress => {
  console.log(
    `${progress.percentComplete}% (${progress.processedEvents}/${progress.totalEvents})`
  );
});
session.onError(async (error, event) => {
  logger.warn('replay error', { eventId: event.eventId, error });
  return true; // continue past this event
});

// Pause under load, resume later
await session.pause();
await session.resume();

const result = await session.waitForCompletion();
console.log(result.success, result.eventsReplayed);
```

### Configuring diagnostics

```typescript
import { configureDiagnostics } from '@vytches/ddd-contracts';

// Silence all library-internal diagnostics (useful in tests or production)
configureDiagnostics({ level: 'silent' });

// Route to a structured logger instead of console
configureDiagnostics({
  sink: {
    warn: (m, c) => pino.warn(c, m),
    error: (m, e, c) => pino.error({ ...c, err: e }, m),
  },
});
```

### Result combinators: chaining instead of repeated `isFailure` checks

`Result<TValue, TError>` (this package's `shared/result.ts` — canonical home;
`@vytches/ddd-utils` re-exports the same class) carries chainable combinators
beyond the `ok`/`fail`/`empty`/`try`/`tryAsync` constructors, for composing
several fallible steps without a manual `isFailure` check after each one:

```typescript
import { Result } from '@vytches/ddd-contracts';

function createOrder(dto: OrderDto): Result<Order, ValidationError> {
  return Email.create(dto.email)
    .flatMap(email => FullName.create(dto.name).map(name => ({ email, name })))
    .flatMap(({ email, name }) => Order.create(email, name, dto.amount))
    .mapError(error => new ValidationError(error.message))
    .tap(order => logger.info(`Order ${order.getId()} created`))
    .tapError(error => logger.warn('Order creation failed', error));
}
```

**Anti-pattern — manually re-checking `isFailure` after every step:**

```typescript
// Avoid: this block repeats once per fallible step
if (x.isFailure) return Result.fail(x.error);
```

Replace it with `flatMap` (chain another `Result`-returning step) or `match`
(collapse to a single non-`Result` value at a boundary):

```typescript
// Prefer: chain instead of manually re-checking isFailure
return x.flatMap(value => nextStep(value));

// Or, at a boundary that must return something other than a Result:
return x.match(
  value => ({ status: 200, body: value }),
  error => ({ status: 400, body: error.message })
);
```

### Combining multiple Results

`Result.combine` and `Result.combineWithAllErrors` replace the pattern of
checking `isFailure` once per field when constructing several value objects at
once — both require every input `Result` to share the same error type `TError`:

```typescript
import { Result } from '@vytches/ddd-contracts';

// First error wins — stops at the first failure; success is a tuple, in order
const combined = Result.combine([
  Email.create(dto.email),
  FullName.create(dto.name),
  Address.create(dto.address),
]);
if (combined.isFailure) return Result.fail(combined.error);
const [email, name, address] = combined.value;

// All errors — every failing input is reported, not just the first
const validated = Result.combineWithAllErrors([
  Email.create(dto.email),
  FullName.create(dto.name),
  Address.create(dto.address),
]);
```

`combineWithAllErrors` returns the **original error objects** on failure — never
flattened to messages or strings. The error array is also **compacted**: it
contains only the positions that actually failed, in input order. Position N in
the error array does NOT correspond to input N — if only input index 3 fails,
the error array has length 1 at index 0, not a sparse array with a value at
index 3. Carry the input's own identity inside the error object itself if the
caller needs to know which field produced which error.

An empty input array succeeds with an empty tuple for both variants.

The shared error type `TError` is inferred from the input tuple, with two
gotchas. An entry typed exactly `Error` — the default when `Result.ok(x)` is
written without an explicit error type — is treated as a placeholder and
ignored, not as a real error type competing for `TError`; this only matters in a
mixed tuple, since an all-`Error` tuple still infers `Error`. And when the
remaining (non-placeholder) error types don't reduce to one common type — e.g.
sibling classes `ValidationError` and `NotFoundError` that both extend a common
`DomainError` base but don't extend each other — `TError` infers as `never`, so
`combined.error.field` fails to compile. Fix it at the source: declare one
shared error type across the combined factories (for example, widen them to a
common base type) instead of relying on inference to find one.

There is no `combineAsync`. Resolve the promises first, then combine the settled
`Result`s:

```typescript
const combined = Result.combine(
  await Promise.all([createEmail(dto), createName(dto)])
);
```

## Anti-Patterns

**Using `any` instead of generic parameters.** Every interface is generic.
`IDomainEvent` without a type parameter loses payload type safety. Always
specify: `IDomainEvent<MyPayload>`.

**Importing concrete implementations from contracts.** The only concrete class
in contracts is `EntityId` (base) and `CapabilityRegistry`. Do not try to
instantiate `IEventBus` directly — it is abstract. Use implementations from
`@vytches/ddd-events`.

**Implementing `IRepository` without `IRepositoryEntity`.** The `T` constraint
requires `getId(): unknown`. Forgetting this causes a type error that is
difficult to trace.

**Confusing `IRepository` with `ICQRSRepository`.** `IRepository` is for
write-side aggregates. `ICQRSRepository` combines `IQueryRepository` and
`IWriteRepository` for CQRS read/write separation. Do not use `ICQRSRepository`
as the default repository type for aggregates.

**Using `new EntityId(value, type)` without understanding `IdType`.** The base
`EntityId` in contracts does not validate the value — that is done by the
extended `EntityId` in `@vytches/ddd-value-objects`. Always use the
value-objects package's `EntityId` in application code.

**Importing `internalLogger`, `EVENT_HANDLER_METADATA`, or
`EVENT_HANDLER_OPTIONS` in application code.** These are `@internal` —
re-exported from contracts only so sibling `@vytches/ddd-*` packages (events
decorator, NestJS explorer service) can resolve them via the standard import
path. They carry no semver guarantee and may be reshaped or removed without
notice. Use `configureDiagnostics` to control diagnostics output instead of
touching `internalLogger` directly.

**Writing a manual `if (x.isFailure) return Result.fail(x.error)` block for
every field of a multi-field construction.** Use `Result.combine` (first error
wins) or `Result.combineWithAllErrors` (every error, as original error objects,
in a compacted array) instead — see "Combining multiple Results" above.

## Hidden Features

`IEventMetadata` has an open index signature (`[key: string]: unknown`) — you
can attach arbitrary application-specific data to any event without casting.

`ISpecification<T>` declares `explainFailure?(candidate: T): string | null` —
implement this to get human-readable validation messages from domain rules
without throwing.

`IUnitOfWork.getRepository<T>()` is generic and returns a typed repository,
enabling type-safe multi-aggregate transactions without casting.

`BaseEventBusOptions` (exported from contracts) contains an `onError` callback —
wire this to your structured logger to capture event processing failures without
crashing the bus.

## Package Dependencies

**Depends on:** nothing (zero dependencies — this is the foundation).

**Depended on by:** every package in the monorepo (`@vytches/ddd-aggregates`,
`@vytches/ddd-events`, `@vytches/ddd-cqrs`, `@vytches/ddd-value-objects`,
`@vytches/ddd-domain-primitives`, etc.).
