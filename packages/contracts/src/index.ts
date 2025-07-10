// Events
export type {
  IEventMetadata,
  IDomainEvent,
  IExtendedDomainEvent,
  BaseEventBusOptions,
  IEventProcessor,
  IEventHandler,
  EventHandlerMetadata,
  IEventUpcaster,
  IAuditEvent,
  IEventStore,
  EventBusMiddleware,
  EventMiddleware,
  EventHandlerFn,
  // Advanced Event Store interfaces
  IAdvancedEventStore,
  IEventStoreConfig,
  IAppendResult,
  IStoredEvent,
  IStoredDomainEvent,
  IEventStream,
  IGlobalEventStream,
  IReadStreamOptions,
  IReadAllOptions,
  IStreamMetadata,
  IEventSerializer,
  IEventStoreAdapter,
  // Event Replay interfaces
  IEventReplay,
  IAdvancedEventReplay,
  IEventReplayFactory,
  IReplaySession,
  IReplayFilter,
  IReplayConfig,
  IReplayResult,
  IReplayProgress,
  ReplayEventHandler,
  ReplayProgressHandler,
  ReplayErrorHandler,
} from './events';

export {
  IEventBus,
  IEventDispatcher,
  IEnhancedEventDispatcher,
  IEventPersistenceHandler,
  createDomainEvent,
  isEventHandler,
  EVENT_HANDLER_METADATA,
  EVENT_HANDLER_OPTIONS,
} from './events';

// Aggregates
export type { IAggregateWithEvents } from './aggregates';

// Validation
export type {
  IValidationError,
  IValidationErrors,
  IValidator,
  IValidationRule,
  ISpecification,
} from './validation';

// Capabilities
export {
  Capability,
  CapabilityRegistry,
  createCapabilityRegistry,
} from './capabilities';

export type {
  IAggregateCapability,
  IProjectionCapability,
  CapabilityType,
  CapabilityConstructor,
  CapabilityMap,
  ISnapshotCapability,
  IVersioningCapability,
  IEventSourcingCapability,
  IAuditCapability,
  ICheckpointCapability,
  ICircuitBreakerCapability,
  IDeadLetterCapability,
  IAggregateSnapshot,
} from './capabilities';

// Domain
export type {
  IEntityId,
  IEntityIdConstructorParams,
  IEntityIdFactory,
  IdType,
} from './domain';

export { EntityId } from './domain';

// Scheduling
export type {
  IScheduledEvent,
  IScheduleOptions,
  IScheduledJob,
  IJobFilter,
  IJobQueryResult,
  IEventScheduler,
  ISchedulerConfig,
  ISchedulerLifecycle,
  IRecurringPattern,
} from './scheduling';

export {
  JobStatus,
  SchedulePriority,
  BackoffStrategy,
} from './scheduling';
