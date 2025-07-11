// Core saga interfaces
export type {
  ISaga,
  ISagaState,
  ISagaExecutionContext,
  ISagaActionResult,
  ISagaStep,
  ISagaDefinition,
  ISagaFactory,
} from './saga.interfaces';

export { SagaStatus } from './saga.interfaces';

// Repository interfaces
export type {
  ISagaRepository,
  ISagaQuery,
  ISagaQueryResult,
  ISagaRepositoryConfig,
  ISagaRepositoryFactory,
} from './repository.interfaces';

export { SagaConcurrencyError, SagaNotFoundError } from './repository.interfaces';

// Orchestrator interfaces
export type {
  ISagaOrchestrator,
  ISagaProcessingResult,
  ISagaOrchestratorConfig,
  ISagaOrchestratorStatistics,
  ISagaMonitor,
  ISagaMetricsFilter,
  ISagaMetrics,
} from './orchestrator.interfaces';

// Decorator interfaces
export type {
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
} from './decorators.interfaces';

export { isSagaMetadata } from './decorators.interfaces';

// Error classes
export {
  SagaError,
  SagaExecutionError,
  SagaStepError,
  SagaConfigurationError,
  SagaEventProcessingError,
  SagaCompensationError,
} from '../errors/saga-errors';
