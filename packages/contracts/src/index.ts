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
  EVENT_HANDLER_METADATA,
  EVENT_HANDLER_OPTIONS,
  IEnhancedEventDispatcher,
  IEventBus,
  IEventDispatcher,
  IEventPersistenceHandler,
  isEventHandler,
} from './events';

// Aggregates
// Deprecated: Use EntityId instead of IAggregateId
// export { areAggregateIdsEqual, isAggregateId } from './aggregates';
// export type { IAggregateId } from './aggregates';
export type { IAggregateWithEvents } from './aggregates';

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

// Scheduling
export type {
  IEventScheduler,
  IJobFilter,
  IJobQueryResult,
  IRecurringPattern,
  IScheduledEvent,
  IScheduledJob,
  IScheduleOptions,
  ISchedulerConfig,
  ISchedulerLifecycle,
} from './scheduling';

export { BackoffStrategy, JobStatus, SchedulePriority } from './scheduling';

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
