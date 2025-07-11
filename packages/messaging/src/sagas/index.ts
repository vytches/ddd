// Enterprise-grade saga pattern implementation
// Provides process management and long-running business workflows

// Core interfaces and types
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
} from './interfaces';

// Enums
export {
  SagaStatus,
  SagaConcurrencyError,
  SagaNotFoundError,
  isSagaMetadata,
} from './interfaces';

// Base implementation classes
export {
  BaseSaga,
  SagaStep,
  ConcreteSagaStep,
  SagaDefinition,
} from './base';

// Repository implementations
export {
  InMemorySagaRepository,
} from './repository';

// Orchestrator implementations
export {
  SagaOrchestrator,
} from './orchestrator';

// Decorators for declarative saga definition
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
} from './decorators';

// Discovery for automatic saga registration
export type { SagaDiscoveryResult } from './discovery';
export {
  SagaDiscoveryPlugin,
  sagaDiscoveryPlugin,
} from './discovery';

// Middleware for enterprise-grade saga processing
export {
  BaseSagaMiddleware,
  PerformanceMonitoringMiddleware,
  RetryMiddleware,
  CircuitBreakerMiddleware,
  SecurityMiddleware,
  SagaMiddlewarePipeline,
} from './middleware';

// Error classes for comprehensive error handling
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
} from './errors';
