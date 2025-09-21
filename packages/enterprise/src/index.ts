/**
 * @file VytchesDDD - Complete Domain-Driven Design framework
 * @module @vytches/ddd
 */

// Main entry point for VytchesDDD framework
// Explicit exports with conflict resolution for enterprise-grade stability

// ===== FOUNDATION LAYER =====
// Core contracts and primitives (export first to establish base types)
// Selective exports from contracts to avoid conflicts
export type {
  BaseEventBusOptions,
  CapabilityConstructor,
  CapabilityMap,
  CapabilityType,
  EventBusMiddleware,
  EventHandlerFn,
  EventHandlerMetadata,
  EventMiddleware,
  IAdvancedEventReplay,
  IAdvancedEventStore,
  IAggregateCapability,
  IAggregateSnapshot,
  IAggregateWithEvents,
  IAppendResult,
  IAsyncSpecification,
  IAuditCapability,
  IAuditEvent,
  ICheckpointCapability,
  ICircuitBreakerCapability,
  IDeadLetterCapability,
  IDomainEvent,
  IdType,
  IEntityId,
  IEntityIdConstructorParams,
  IEntityIdFactory,
  IEventHandler,
  IEventMetadata,
  IEventProcessor,
  IEventReplay,
  IEventReplayFactory,
  IEventScheduler,
  IEventSerializer,
  IEventSourcingCapability,
  IEventStore,
  IEventStoreAdapter,
  IEventStoreConfig,
  IEventStream,
  IEventUpcaster,
  IGlobalEventStream,
  IJobFilter,
  IJobQueryResult,
  IProjectionCapability,
  IReadAllOptions,
  IReadStreamOptions,
  IRecurringPattern,
  IReplayConfig,
  IReplayFilter,
  IReplayProgress,
  IReplayResult,
  IReplaySession,
  IScheduledEvent,
  IScheduledJob,
  IScheduleOptions,
  ISchedulerConfig,
  ISchedulerLifecycle,
  ISnapshotCapability,
  ISpecification,
  IStoredDomainEvent,
  IStoredEvent,
  IStreamMetadata,
  IValidationError,
  IValidationErrors,
  IValidationRule,
  IValidator,
  IVersioningCapability,
  ReplayErrorHandler,
  ReplayEventHandler,
  ReplayProgressHandler,
} from '@vytches/ddd-contracts';

export {
  BackoffStrategy,
  Capability,
  CapabilityRegistry,
  createCapabilityRegistry,
  createDomainEvent,
  EVENT_HANDLER_METADATA,
  EVENT_HANDLER_OPTIONS,
  IEnhancedEventDispatcher,
  IEventBus,
  IEventDispatcher,
  IEventPersistenceHandler,
  isEventHandler,
  JobStatus,
  SchedulePriority,
} from '@vytches/ddd-contracts';

// Export contracts EntityId as base type
export { EntityId as BaseEntityId } from '@vytches/ddd-contracts';

// ValidationError removed from contracts - use IValidationError instead

// Domain primitives exports
export * from '@vytches/ddd-domain-primitives';

// Enhanced value objects and repositories (inherit from contracts)
// Export value-objects EntityId as primary enhanced version
export { BaseValueObject, EntityId, EntityIdFactory } from '@vytches/ddd-value-objects';
export type { ValueObjectValidator } from '@vytches/ddd-value-objects';

export * from '@vytches/ddd-aggregates';
export * from '@vytches/ddd-repositories';

// ===== PATTERN LAYER =====
export * from '@vytches/ddd-domain-services';
export * from '@vytches/ddd-policies';
export * from '@vytches/ddd-validation';

// ===== ARCHITECTURE LAYER =====
// Events exports with explicit key classes
export {
  BaseEventBus,
  CUSTOM_MIDDLEWARE_SYMBOL,
  DomainEvent,
  DomainToIntegrationTransformer,
  EventDiscoveryPlugin,
  eventDiscoveryPlugin,
  EventHandler,
  IntegrationEvent,
  IntegrationEventProcessor,
  UnifiedEventBus,
  UniversalEventDispatcher,
} from '@vytches/ddd-events';

export type {
  DIHandlerMetadata,
  EventHandlerOptions,
  IAuditEventBus,
  IDomainEventBus,
  IIntegrationEventBus,
  UnifiedEventHandler,
} from '@vytches/ddd-events';

// CQRS exports with ExecutionContext resolution
export {
  CommandBus,
  CommandExecutionError,
  CommandHandler,
  CQRSConfiguration,
  CQRSConfigurationError,
  CQRSDiscoveryPlugin,
  CQRSExecutionContext,
  CQRSModule,
  CqrsValidationError,
  EnhancedCommandBus,
  EnhancedQueryBus,
  HandlerNotFoundError,
  ICommandBus,
  IQueryBus,
  LoggingMiddleware,
  QueryBus,
  QueryExecutionError,
  QueryHandler,
} from '@vytches/ddd-cqrs';

// Export CQRS ExecutionContext as primary version
export type {
  CQRSOptions,
  ExecutionContext,
  ICommand,
  ICommandHandler,
  ICQRSMiddleware,
  ICqrsValidatable,
  IQuery,
  IQueryHandler,
} from '@vytches/ddd-cqrs';

export * from '@vytches/ddd-projections';

// ===== INTEGRATION LAYER =====
export * from '@vytches/ddd-acl';
export * from '@vytches/ddd-messaging';

// ===== INFRASTRUCTURE LAYER =====
// DI exports (ServiceNotFoundError conflict resolved - domain-services version takes precedence)
export {
  BaseContainerAdapter,
  ContainerBuilder,
  ServiceLifetime,
  SimpleContainer,
  VytchesDDD,
} from '@vytches/ddd-di';

export type {
  Constructor,
  HandlerInfo,
  IContainerBuilder,
  IDependencyContainer,
  IHandlerDiscoveryPlugin,
  IHandlerDiscoveryRegistry,
  ResolutionContext,
  ServiceDescriptor,
  ServiceFactory,
  ServiceRegistrationOptions,
  ServiceToken,
} from '@vytches/ddd-di';
export * from '@vytches/ddd-logging';
export * from '@vytches/ddd-resilience';

// ===== UTILITY LAYER =====
// Utils exports with safeRun resolution
export { LibUtils, Result, safeRun } from '@vytches/ddd-utils';

// Testing utilities are now internal to library development
// Users should use production utilities from @vytches/ddd-utils

// ===== META LAYER =====
// Core package is now documentation-only meta-package
// All exports are handled by individual packages above

// ===== NAMING CONFLICT RESOLUTION DOCUMENTATION =====
/**
 * RESOLVED NAMING CONFLICTS:
 *
 * 1. EntityId:
 *    - Primary: EntityId (from @vytches/ddd-value-objects) - Enhanced implementation with LibUtils
 *    - Alternative: BaseEntityId (from @vytches/ddd-contracts) - Foundation interface
 *
 * 2. ValidationError:
 *    - Primary: ValidationError (from @vytches/ddd-domain-primitives) - Main error type
 *    - Aliases: ContractsValidationError, CqrsValidationError - Specific variants
 *
 * 3. ExecutionContext:
 *    - Primary: ExecutionContext (from @vytches/ddd-cqrs) - Most commonly used
 *
 * 4. safeRun:
 *    - Primary: safeRun (from @vytches/ddd-utils) - Core utility function
 *    - Testing version is excluded from main exports
 *
 * 5. IAggregateCapability:
 *    - Primary: IAggregateCapability (from @vytches/ddd-contracts) - Foundation interface
 *
 * For explicit access to alternative versions:
 * import { BaseEntityId } from '@vytches/ddd';
 * import { CqrsValidationError } from '@vytches/ddd';
 * import { safeRun as TestingSafeRun } from '@vytches/ddd-testing';
 */
