// Events - Updated for dependency sync 2025-07-27
export type {
  BaseEventBusOptions,
  EventBusMiddleware,
  EventHandlerFn,
  EventHandlerMetadata,
  EventMiddleware,
  IAdvancedEventReplay,
  // Advanced Event Store interfaces
  IAdvancedEventStore,
  IAppendResult,
  IAuditEvent,
  IDomainEvent,
  IEventHandler,
  IEventMetadata,
  IEventProcessor,
  // Event Replay interfaces
  IEventReplay,
  IEventReplayFactory,
  IEventSerializer,
  IEventStore,
  IEventStoreAdapter,
  IEventStoreConfig,
  IEventStream,
  IEventUpcaster,
  IGlobalEventStream,
  IReadAllOptions,
  IReadStreamOptions,
  IReplayConfig,
  IReplayFilter,
  IReplayProgress,
  IReplayResult,
  IReplaySession,
  IStoredDomainEvent,
  IStoredEvent,
  IStreamMetadata,
  ReplayErrorHandler,
  ReplayEventHandler,
  ReplayProgressHandler,
} from './events';

export {
  createDomainEvent,
  enrichEvent,
  IEnhancedEventDispatcher,
  IEventBus,
  IEventDispatcher,
  IEventPersistenceHandler,
  isEventHandler,
} from './events';
// EVENT_HANDLER_METADATA / EVENT_HANDLER_OPTIONS — moved to the
// `@vytches/ddd-contracts/internal` subpath (VF-024, AC4). Framework-only
// metadata symbols (events decorator, nestjs explorer service); not part of
// the public consumer API.

// Aggregates
// Deprecated: Use EntityId instead of IAggregateId
// export { areAggregateIdsEqual, isAggregateId } from './aggregates';
// export type { IAggregateId } from './aggregates';
export type { IAggregateWithEvents } from './aggregates';

// Factory contracts (VF-CANON-001)
export type { IDomainFactory, IAsyncDomainFactory } from './aggregates';

// Validation
export type {
  IAsyncSpecification,
  ISpecification,
  IValidationError,
  IValidationErrors,
  IValidationRule,
  IValidator,
} from './validation';

// Capabilities
export { Capability, CapabilityRegistry, createCapabilityRegistry } from './capabilities';

export type {
  CapabilityConstructor,
  CapabilityMap,
  CapabilityType,
  IAggregateCapability,
  IAuditCapability,
  ICheckpointCapability,
  ICircuitBreakerCapability,
  IDeadLetterCapability,
  IEventSourcingCapability,
  IProjectionCapability,
  ISnapshotCapability,
  IVersioningCapability,
} from './capabilities';

// Domain
export type { IdType, IEntityId, IEntityIdConstructorParams, IEntityIdFactory } from './domain';

export { EntityId } from './domain';

// Testing
export type {
  ISafeRunResult,
  ITestClock,
  ITestDataBuilder,
  ITestFixture,
  ITestHarness,
  ITestScenario,
  TestClockOptions,
  TestHarnessOptions,
  TestScenarioOptions,
} from './testing';

// Repositories
export type {
  IBatchRepository,
  ICQRSRepository,
  IExtendedRepository,
  IQueryRepository,
  IRepository,
  IRepositoryEntity,
  IRepositoryProvider,
  IUnitOfWork,
  IWriteRepository,
} from './repositories';

// Shared types (to avoid circular dependencies)
export type { IAggregateSnapshot } from './shared';

// Result<T,E> primitive — moved from @vytches/ddd-utils in REL-008
// to keep contracts as the dependency-free foundation layer.
// utils re-exports this Result via shim for backwards compatibility.
export { Result } from './shared';

// Diagnostics control API (VS-014, ADR-0037). Public — consumers use this
// to silence or redirect library diagnostics.
export type {
  DiagnosticsSink,
  DiagnosticsLevel,
  DiagnosticsOptions,
} from './diagnostics/diagnostics-sink';
export { configureDiagnostics } from './diagnostics/diagnostics-sink';

// internalLogger — moved to the `@vytches/ddd-contracts/internal` subpath
// (VF-024, AC4). @internal diagnostics shim shared by sibling
// @vytches/ddd-* packages; NOT an application logging layer, not for
// consumer use. Import via `@vytches/ddd-contracts/internal`.
