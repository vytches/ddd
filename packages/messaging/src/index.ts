// Outbox Pattern - Interfaces and Types
export type {
  IOutboxMessage,
  OutboxMessageOptions,
  IOutboxMessageHandler,
  OutboxMiddleware,
  OutboxProcessorOptions,
  OutboxServiceOptions,
} from './outbox';

// Outbox Pattern - Enums
export { MessageStatus, MessagePriority } from './outbox';

// Outbox Pattern - Classes
export {
  IOutboxRepository,
  OutboxMessageFactory,
  OutboxProcessor,
  EventBusOutboxHandler,
  OutboxService,
} from './outbox';

// Sagas - Enterprise-grade process management and long-running workflows
export type {
  ISaga,
  ISagaState,
  ISagaExecutionContext,
  ISagaActionResult,
  ISagaStep,
  ISagaDefinition,
  ISagaFactory,
  ISagaRepository,
  ISagaQuery,
  ISagaQueryResult,
  ISagaRepositoryConfig,
  ISagaRepositoryFactory,
  ISagaOrchestrator,
  ISagaProcessingResult,
  ISagaOrchestratorConfig,
  ISagaOrchestratorStatistics,
  ISagaMonitor,
  ISagaMetricsFilter,
  ISagaMetrics,
  SagaDecoratorOptions,
  SagaEventHandlerOptions,
  CompensationHandlerOptions,
  StartSagaOptions,
  EndSagaOptions,
  TimeoutHandlerOptions,
  SagaStepOptions,
  SagaCorrelationOptions,
  SagaMiddlewareOptions,
  ISagaMiddleware,
  ISagaMiddlewareContext,
  SagaValidationOptions,
  SagaMetadata,
  SagaDiscoveryResult,
} from './sagas';

// Sagas - Enums and Errors
export {
  SagaStatus,
  SagaConcurrencyError,
  SagaNotFoundError,
  isSagaMetadata,
} from './sagas';

// Sagas - Base Classes
export {
  BaseSaga,
  SagaStep,
  ConcreteSagaStep,
  SagaDefinition,
} from './sagas';

// Sagas - Infrastructure
export {
  InMemorySagaRepository,
  SagaOrchestrator,
} from './sagas';

// Sagas - Decorators
export {
  Saga,
  SagaEventHandler,
  StartSaga,
  EndSaga,
  CompensationHandler,
  getSagaMetadata,
  getSagaType,
  isSagaClass,
  getAllSagaTypes,
  getEventHandlerMetadata,
  getEventHandlerMethods,
  isEventHandlerMethod,
  getCompensationHandlerMetadata,
  getCompensationHandlerMethods,
  isCompensationHandlerMethod,
  getCompensationHandlerForStep,
  getOrderedCompensationHandlers,
  SAGA_METADATA_KEY,
  SAGA_TYPE_METADATA_KEY,
} from './sagas';

// Sagas - Discovery
export {
  SagaDiscoveryPlugin,
  sagaDiscoveryPlugin,
} from './sagas';

// Saga Middleware
export {
  BaseSagaMiddleware,
  PerformanceMonitoringMiddleware,
  RetryMiddleware,
  CircuitBreakerMiddleware,
  SecurityMiddleware,
  SagaMiddlewarePipeline,
} from './sagas';

// Saga Error Classes
export {
  SagaError,
  SagaExecutionError,
  SagaStepError,
  SagaConfigurationError,
  SagaEventProcessingError,
  SagaCompensationError,
  SagaDiscoveryError,
  SagaOrchestrationError,
  SagaInstanceLimitExceededError,
  SagaDefinitionNotFoundError,
} from './sagas';
