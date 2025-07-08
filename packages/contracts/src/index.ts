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
