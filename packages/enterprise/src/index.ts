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
  IEventSerializer,
  IEventSourcingCapability,
  IEventStore,
  IEventStoreAdapter,
  IEventStoreConfig,
  IEventStream,
  IEventUpcaster,
  IGlobalEventStream,
  IProjectionCapability,
  IReadAllOptions,
  IReadStreamOptions,
  IReplayConfig,
  IReplayFilter,
  IReplayProgress,
  IReplayResult,
  IReplaySession,
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
  Capability,
  CapabilityRegistry,
  createCapabilityRegistry,
  createDomainEvent,
  // EVENT_HANDLER_METADATA — removed from public surface in REL-005 (was @internal)
  // EVENT_HANDLER_OPTIONS  — removed from public surface in REL-005 (was @internal)
  // Both remain accessible via direct `@vytches/ddd-contracts` import for
  // framework integrations (events decorator, nestjs explorer).
  IEnhancedEventDispatcher,
  IEventBus,
  IEventDispatcher,
  IEventPersistenceHandler,
  isEventHandler,
} from '@vytches/ddd-contracts';

// Diagnostics control API — consumers configure library diagnostic output.
// @see configureDiagnostics, DiagnosticsSink
export type { DiagnosticsLevel, DiagnosticsOptions, DiagnosticsSink } from '@vytches/ddd-contracts';
export { configureDiagnostics } from '@vytches/ddd-contracts';

// Export contracts EntityId as base type (VF-024, AC5: renamed from
// BaseEntityId for consistency with the ContractsValidationError pattern
// below).
export { EntityId as ContractsEntityId } from '@vytches/ddd-contracts';

// ValidationError removed from contracts - use IValidationError instead

// Domain primitives exports (VF-024, AC1: explicit named exports — was
// `export *`)
export {
  ActorError,
  ApplicationErrorCode,
  BaseError,
  DefaultActorType,
  DomainErrorCode,
  DuplicateError,
  FrameworkErrorCode,
  IDomainError,
  InvalidParameterError,
  MissingValueError,
  NotFoundError,
} from '@vytches/ddd-domain-primitives';
export type {
  DomainErrorOptions,
  ErrorCode,
  ErrorOptions,
  IActor,
} from '@vytches/ddd-domain-primitives';

// Enhanced value objects and repositories (inherit from contracts)
// Export value-objects EntityId as primary enhanced version
// EntityIdFactory removed (VF-024, AC3) — see CHANGELOG.md.
export { BaseValueObject, EntityId } from '@vytches/ddd-value-objects';
export type { ValueObjectValidator } from '@vytches/ddd-value-objects';

// Aggregates exports (VF-024, AC1). IAggregateCapability excluded — the
// contracts version (top of this file) is primary; see naming-conflict
// documentation at the bottom of this file.
export {
  AggregateBuilder,
  aggregateBuilder,
  AggregateError,
  AggregateRoot,
  asAuditAggregate,
  asEventSourcingAggregate,
  asSnapshotAggregate,
  AuditCapability,
  Entity,
  asVersioningAggregate,
  EventSourcingCapability,
  getAggregateCapabilities,
  hasAllCapabilities,
  SnapshotCapability,
  tryAsAuditAggregate,
  tryAsEventSourcingAggregate,
  tryAsSnapshotAggregate,
  tryAsVersioningAggregate,
  VersioningCapability,
} from '@vytches/ddd-aggregates';
export type {
  AggregateWithAuditCapability,
  AggregateWithEventSourcingCapability,
  AggregateWithSnapshotCapability,
  AggregateWithVersioningCapability,
  IAggregateConstructorParams,
  IAggregateEventHandler,
  IAggregateRoot,
} from '@vytches/ddd-aggregates';

// Repositories exports (VF-024, AC1)
export { IBaseRepository, VersionError } from '@vytches/ddd-repositories';
export type {
  IExtendedRepository,
  IRepository,
  IRepositoryAggregate,
  IRepositoryProvider,
  IUnitOfWork,
} from '@vytches/ddd-repositories';

// ===== PATTERN LAYER =====
// Domain services exports (VF-024, AC1). ServiceNotFoundError here is the
// domain-services variant (DDD error hierarchy) — no longer collides with
// DI's ServiceNotFoundError, which was renamed to ContainerServiceNotFoundError
// (VF-024, AC2).
export {
  AsyncDomainService,
  DomainService,
  EventAwareDomainService,
  getDIDomainServiceMetadata,
  getDomainServiceMetadata,
  IBaseDomainService,
  isDomainServicePendingDIRegistration,
  PlainDomainService,
  ServiceCircularError,
  ServiceDuplicateError,
  ServiceNotFoundError,
  UnitOfWorkAwareDomainService,
} from '@vytches/ddd-domain-services';
export type {
  DIServiceMetadata,
  DomainServiceOptions,
  EnhancedDomainServiceOptions,
  IAsyncDomainService,
  IDomainService,
  IEventBusAware,
  IUnitOfWorkAware,
} from '@vytches/ddd-domain-services';

// Policies exports (VF-024, AC1 + AC9). globalPolicyEventBus removed
// upstream (SA-M11) — construct your own `new PolicyEventBus(...)`.
// IAsyncSpecification/ISpecification excluded — already exported from
// contracts above.
export {
  AsyncSpecificationPolicy,
  BaseBusinessPolicy,
  BaseCompositePolicy,
  BusinessRuleValidatorAdapter,
  BusinessRuleValidatorPolicy,
  ConditionalPolicyBuilder,
  ConditionalPolicyElse,
  ConditionalPolicyElseStepBuilder,
  ConditionalPolicyThenStepBuilder,
  EventDrivenPolicy,
  EventDrivenPolicyFactory,
  PolicyBuilder,
  PolicyContextBuilder,
  PolicyContextFactory,
  PolicyDefinitionBuilder,
  PolicyEventBuilder,
  PolicyEventBus,
  PolicyEventHandlers,
  PolicyGroup,
  PolicyGroupStepBuilder,
  PolicyMetadataBuilder,
  PolicyMetricsAggregator,
  PolicyRegistry,
  PolicyRequestBuilder,
  PolicyRequestFactory,
  PolicySpecificationFactory,
  PolicyStepBuilder,
  PolicyCachingBehavior,
  PolicyCachingBehaviorFactory,
  PolicyRetryBehavior,
  PolicyRetryBehaviorFactory,
  PolicyTemporalBehavior,
  PolicyTemporalBehaviorBuilder,
  PolicyTemporalBehaviorFactory,
  PolicyViolation,
  PolicyViolationCollection,
  SpecificationPolicy,
  withEvents,
} from '@vytches/ddd-policies';
export type {
  BusinessCalendar,
  EventDrivenPolicyConfig,
  IBusinessPolicy,
  IConditionalPolicyBuilder,
  IConditionalPolicyElse,
  IConditionalPolicyElseStepBuilder,
  IConditionalPolicyThenStepBuilder,
  IGroupedPolicyComposer,
  IPolicyBuilder,
  IPolicyComposer,
  IPolicyGroup,
  IPolicyGroupStepBuilder,
  IPolicyRegistry,
  IPolicyStepBuilder,
  IUnifiedRegistry,
  PolicyBuilderConfig,
  PolicyBuildStep,
  PolicyCacheConfig,
  PolicyCacheMetrics,
  PolicyCondition,
  PolicyContext,
  PolicyDefinition,
  PolicyEvaluationErrorEvent,
  PolicyEvaluationEvent,
  PolicyEvaluationStartedEvent,
  PolicyEvent,
  PolicyEventBusConfig,
  PolicyEventBusMetrics,
  PolicyEventHandler,
  PolicyEventSubscription,
  PolicyExecutionMetrics,
  PolicyGroupStep,
  PolicyMetadata,
  PolicyQuery,
  PolicyRegistryStatistics,
  PolicyRequest,
  PolicyRetryConfig,
  PolicyViolationData,
  PolicyViolationOptions,
  PolicyViolationSeverity,
  RetryAttempt,
  RetryMetrics,
  TemporalCondition,
  TemporalInfo,
  TemporalPolicyConfig,
} from '@vytches/ddd-policies';

// Validation exports (VF-024, AC1)
export {
  AdapterUtils,
  AlwaysFalseSpecification,
  AlwaysTrueSpecification,
  AndAsyncSpecification,
  AndSpecification,
  AsyncCompositeSpecification,
  BaseValidationAdapter,
  BusinessRuleValidator,
  CompositeSpecification,
  MemoizedSpecification,
  NotAsyncSpecification,
  NotSpecification,
  OrAsyncSpecification,
  OrSpecification,
  PredicateSpecification,
  PropertyBetweenSpecification,
  PropertyEqualsSpecification,
  PropertyInSpecification,
  RulesRegistry,
  Specification,
  SpecificationValidator,
  ValidationError,
  ValidationErrors,
  ValidationFacade,
} from '@vytches/ddd-validation';

// ===== ARCHITECTURE LAYER =====
// Events exports with explicit key classes.
// Note: CUSTOM_MIDDLEWARE_SYMBOL was removed from this public surface in
// REL-005 (was @internal). It remains accessible via a direct
// `@vytches/ddd-events` import for custom bus implementations.
export {
  BaseEventBus,
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
  BusRetryOptions,
  CQRSOptions,
  ExecutionContext,
  ICommand,
  ICommandHandler,
  ICQRSMiddleware,
  ICqrsValidatable,
  IQuery,
  IQueryHandler,
} from '@vytches/ddd-cqrs';

// Projections exports (VF-024, AC1). IProjectionCapability excluded —
// already exported from contracts above.
export {
  BaseIntervalCapability,
  BaseProjection,
  CheckpointCapability,
  CircuitBreakerCapability,
  createProjectionRebuilder,
  DeadLetterCapability,
  ProjectionBuilder,
  ProjectionEngine,
  ProjectionError,
  ProjectionRebuilder,
  SnapshotProjectionCapability,
} from '@vytches/ddd-projections';
export type {
  ErrorProjectionState,
  ICapabilityContext,
  IProjection,
  IProjectionEngine,
  IProjectionRebuildConfig,
  IProjectionRebuilder,
  IProjectionStore,
} from '@vytches/ddd-projections';

// ===== INTEGRATION LAYER =====
// ACL exports (VF-024, AC1)
export {
  ACLError,
  ACLRegistry,
  AdapterNotFoundError,
  ApplicationError,
  BaseACLAdapter,
  BaseACLMiddleware,
  BaseACLRegistry,
  BaseApplicationService,
  BaseModelTranslator,
  ContextACLRegistry,
  defineACLAdapter,
  EnhancedACLAdapter,
  SimpleACLAdapter,
  TranslationError,
  TypedOperation,
  VersionedACLAdapter,
  VersionedACLRegistry,
} from '@vytches/ddd-acl';
export type {
  ACLContextInfo,
  ACLMiddleware,
  ACLRegistrationMetadata,
  AdapterDefinition,
  ExecuteOptions,
  IACLAdapter,
  IApplicationService,
  IEnhancedACLAdapter,
  IExternalAPI,
  ImportOptions,
  IModelTranslator,
} from '@vytches/ddd-acl';

// Messaging exports (VF-024, AC1)
export {
  comparePriority,
  EventBusOutboxHandler,
  IOutboxRepository,
  MessagePriority,
  MessageStatus,
  OutboxMessageFactory,
  OutboxProcessor,
  OutboxService,
} from '@vytches/ddd-messaging';
export type {
  IOutboxMessage,
  IOutboxMessageHandler,
  OutboxMessageOptions,
  OutboxMiddleware,
  OutboxProcessorHooks,
  OutboxProcessorOptions,
  OutboxServiceOptions,
  RetryBackoffConfig,
} from '@vytches/ddd-messaging';

// ===== INFRASTRUCTURE LAYER =====
// DI exports. ServiceNotFoundError renamed to ContainerServiceNotFoundError
// (VF-024, AC2) — no longer collides with domain-services' ServiceNotFoundError.
export {
  BaseContainerAdapter,
  CircularDependencyError,
  ContainerBuilder,
  ContainerConfigurationError,
  ContainerDisposedError,
  ContainerServiceNotFoundError,
  DIError,
  InvalidRegistrationError,
  ServiceAlreadyRegisteredError,
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
  IServiceLocator,
  ResolutionContext,
  ServiceDescriptor,
  ServiceFactory,
  ServiceRegistrationOptions,
  ServiceToken,
} from '@vytches/ddd-di';
// @vytches/ddd-logging removed (VS-010): the application-logging layer is gone.
// The library logs only its own diagnostics internally; consumers use their own logger.

// Resilience exports (VF-024, AC1)
export {
  Bulkhead,
  BulkheadDecorator,
  BulkheadMetricCollector,
  BulkheadRejectedException,
  BulkheadStrategy,
  CircuitBreaker,
  CircuitBreakerDecorator,
  CircuitBreakerHalfOpenLimitError,
  CircuitBreakerMetricCollector,
  CircuitBreakerOpenError,
  CircuitBreakerState,
  CircuitBreakerStrategy,
  CompositeMetricExporter,
  CompositeResilienceStrategy,
  CsvMetricExporter,
  DefaultMetricRegistry,
  DefaultObservabilityEventBus,
  DefaultResilienceContext,
  getResilienceMetrics,
  GlobalMetricRegistry,
  GlobalObservabilityEventBus,
  JsonMetricExporter,
  MaxRetriesExceededError,
  MetricExporterFactory,
  ObservabilityEventFactory,
  OperationCancelledError,
  PrometheusMetricExporter,
  ResilienceDecorator,
  ResiliencePolicyBuilder,
  RetryDecorator,
  RetryMetricCollector,
  RetryPolicy,
  RetryStrategy,
  TextMetricExporter,
  TimeoutDecorator,
  TimeoutError,
  TimeoutMetricCollector,
  TimeoutStrategy,
} from '@vytches/ddd-resilience';
export type {
  BulkheadDecoratorConfig,
  CircuitBreakerConfig,
  CircuitBreakerDecoratorConfig,
  CircuitBreakerMetrics,
  CompositeResilienceConfig,
  HistogramBucket,
  HistogramMetric,
  Metric,
  MetricCollector,
  MetricExporter,
  MetricLabels,
  MetricRegistry,
  MetricType,
  MetricValue,
  ObservabilityEvent,
  ObservabilityEventBus,
  ObservabilityEventListener,
  ResilienceDecoratorConfig,
  ResilienceStrategy,
  RetryDecoratorConfig,
  TimeoutDecoratorConfig,
  TimerMetric,
} from '@vytches/ddd-resilience';

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
 *    - Alternative: ContractsEntityId (from @vytches/ddd-contracts) - Foundation interface
 *
 * 2. ValidationError:
 *    - Primary: ValidationError (from @vytches/ddd-validation) - Main error type
 *    - Alias: CqrsValidationError - CQRS-specific variant
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
 *    - Excluded from @vytches/ddd-aggregates and @vytches/ddd-projections
 *      explicit export lists to avoid a duplicate-identifier collision.
 *
 * 6. ServiceNotFoundError:
 *    - Primary: ServiceNotFoundError (from @vytches/ddd-domain-services) - DDD error hierarchy
 *    - DI variant renamed to ContainerServiceNotFoundError (VF-024, AC2) —
 *      no longer collides.
 *
 * For explicit access to alternative versions:
 * import { ContractsEntityId } from '@vytches/ddd';
 * import { CqrsValidationError } from '@vytches/ddd';
 * import { safeRun as TestingSafeRun } from '@vytches/ddd-testing';
 */
