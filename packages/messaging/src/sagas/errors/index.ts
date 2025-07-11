// Enterprise-grade saga error handling
// Provides comprehensive error classes for all saga operations

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
} from './saga-errors';