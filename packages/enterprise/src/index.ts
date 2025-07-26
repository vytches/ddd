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
  IAggregateWithEvents,
  IValidationError,
  IValidationErrors,
  IValidator,
  IValidationRule,
  ISpecification,
  IAsyncSpecification,
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
  IEntityId,
  IEntityIdConstructorParams,
  IEntityIdFactory,
  IdType,
  IScheduledEvent,
  IScheduleOptions,
  IScheduledJob,
  IJobFilter,
  IJobQueryResult,
  IEventScheduler,
  ISchedulerConfig,
  ISchedulerLifecycle,
  IRecurringPattern,
  BundleGenerationOptions,
  BundleResult,
  ComplexityLevel,
  ContentConfig,
  ExampleDefinition,
  FindOptions,
  FrameworkIntegration,
  GenerateDocumentationOptions,
  GenerateDocumentationResult,
  LLMSupport,
  PackageExampleConfig,
  RelatedPackage,
  TagSystem,
  ValidationFix,
  ValidationResult,
  ValidationWarning,
} from '@vytches/ddd-contracts';

export {
  IEventBus,
  IEventDispatcher,
  IEnhancedEventDispatcher,
  IEventPersistenceHandler,
  createDomainEvent,
  isEventHandler,
  EVENT_HANDLER_METADATA,
  EVENT_HANDLER_OPTIONS,
  Capability,
  CapabilityRegistry,
  createCapabilityRegistry,
  JobStatus,
  SchedulePriority,
  BackoffStrategy,
} from '@vytches/ddd-contracts';

// Export contracts EntityId as base type
export { EntityId as BaseEntityId } from '@vytches/ddd-contracts';

// Export contracts ValidationError as foundation type
export type { ValidationError as ContractsValidationError } from '@vytches/ddd-contracts';

// Domain primitives exports
export * from '@vytches/ddd-domain-primitives';

// Enhanced value objects and repositories (inherit from contracts)
// Export value-objects EntityId as primary enhanced version
export { EntityId, EntityIdFactory } from '@vytches/ddd-value-objects';
export { BaseValueObject } from '@vytches/ddd-value-objects';
export type { ValueObjectValidator } from '@vytches/ddd-value-objects';

export * from '@vytches/ddd-repositories';
export * from '@vytches/ddd-aggregates';

// ===== PATTERN LAYER =====
export * from '@vytches/ddd-validation';
export * from '@vytches/ddd-domain-services';
export * from '@vytches/ddd-policies';

// ===== ARCHITECTURE LAYER =====
// Events exports with explicit key classes
export {
  UniversalEventDispatcher,
  UnifiedEventBus,
  BaseEventBus,
  CUSTOM_MIDDLEWARE_SYMBOL,
  DomainEvent,
  IntegrationEvent,
  IntegrationEventProcessor,
  DomainToIntegrationTransformer,
  EventHandler,
  EventDiscoveryPlugin,
  eventDiscoveryPlugin,
} from '@vytches/ddd-events';

export type {
  IDomainEventBus,
  IIntegrationEventBus,
  IAuditEventBus,
  UnifiedEventHandler,
  EventHandlerOptions,
  DIHandlerMetadata,
} from '@vytches/ddd-events';

// CQRS exports with ExecutionContext resolution
export {
  CommandBus,
  QueryBus,
  EnhancedCommandBus,
  EnhancedQueryBus,
  CommandExecutionError,
  QueryExecutionError,
  HandlerNotFoundError,
  CQRSConfigurationError,
  CqrsValidationError,
  CQRSConfiguration,
  CQRSModule,
  ICommandBus,
  IQueryBus,
  CommandHandler,
  QueryHandler,
  CQRSExecutionContext,
  LoggingMiddleware,
  CQRSDiscoveryPlugin,
} from '@vytches/ddd-cqrs';

// Export CQRS ExecutionContext as primary version
export type {
  ExecutionContext,
  ICQRSMiddleware,
  ICommand,
  IQuery,
  ICommandHandler,
  IQueryHandler,
  ICqrsValidatable,
  CQRSOptions,
} from '@vytches/ddd-cqrs';

export * from '@vytches/ddd-projections';
export * from '@vytches/ddd-event-store';

// ===== INTEGRATION LAYER =====
export * from '@vytches/ddd-acl';
export * from '@vytches/ddd-messaging';

// ===== INFRASTRUCTURE LAYER =====
// DI exports (ServiceNotFoundError conflict resolved - domain-services version takes precedence)
export {
  VytchesDDD,
  SimpleContainer,
  ContainerBuilder,
  ServiceLifetime,
  BaseContainerAdapter,
} from '@vytches/ddd-di';

export type {
  ServiceToken,
  Constructor,
  ServiceFactory,
  ServiceRegistrationOptions,
  ServiceDescriptor,
  IDependencyContainer,
  ResolutionContext,
  IContainerBuilder,
  IHandlerDiscoveryPlugin,
  IHandlerDiscoveryRegistry,
  HandlerInfo,
} from '@vytches/ddd-di';
export * from '@vytches/ddd-logging';
export * from '@vytches/ddd-resilience';
export * from '@vytches/ddd-event-scheduling';

// ===== UTILITY LAYER =====
// Utils exports with safeRun resolution
export { safeRun, Result, LibUtils } from '@vytches/ddd-utils';

// Testing utilities are now internal to library development
// Users should use production utilities from @vytches/ddd-utils

// ===== META LAYER =====
export * from '@vytches/ddd-core';

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
