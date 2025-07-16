import { BaseError } from '@vytches-ddd/domain-primitives';

/**
 * @llm-summary SagaError class for saga error operations
 * @llm-domain Integration
 * @llm-complexity Expert
 *
 * @description
 * SagaError class implementing integration layer component for saga error operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new SagaError();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new SagaError());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export abstract class SagaError extends BaseError {
  public readonly timestamp: Date;
  public readonly errorId: string;
  public readonly context: Record<string, unknown>;

  constructor(
    message: string,
    public readonly sagaId: string,
    public readonly sagaType?: string,
    context: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = this.constructor.name;
    this.timestamp = new Date();
    this.errorId = `${this.name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.context = {
      sagaId,
      sagaType,
      timestamp: this.timestamp.toISOString(),
      ...context,
    };
  }

  /**
   * Get structured error information for logging
   */
  toStructured(): Record<string, unknown> {
    return {
      errorId: this.errorId,
      errorType: this.name,
      message: this.message,
      sagaId: this.sagaId,
      sagaType: this.sagaType,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack,
      context: this.context,
    };
  }
}

/**
 * @llm-summary SagaExecutionError class for saga execution error operations
 * @llm-domain Integration
 * @llm-complexity Expert
 *
 * @description
 * SagaExecutionError class implementing integration layer component for saga execution error operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new SagaExecutionError();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new SagaExecutionError());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class SagaExecutionError extends SagaError {
  constructor(
    sagaId: string,
    public readonly stepName: string,
    public readonly originalError: Error,
    sagaType?: string,
    context: Record<string, unknown> = {}
  ) {
    super(
      `Saga execution failed at step '${stepName}': ${originalError.message}`,
      sagaId,
      sagaType,
      {
        stepName,
        originalErrorType: originalError.constructor.name,
        originalErrorMessage: originalError.message,
        originalErrorStack: originalError.stack,
        ...context,
      }
    );
    this.name = 'SagaExecutionError';
  }
}

/**
 * @llm-summary SagaStepError class for saga step error operations
 * @llm-domain Integration
 * @llm-complexity Expert
 *
 * @description
 * SagaStepError class implementing integration layer component for saga step error operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new SagaStepError();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new SagaStepError());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class SagaStepError extends SagaError {
  constructor(
    sagaId: string,
    public readonly stepName: string,
    message: string,
    sagaType?: string,
    public readonly stepData?: Record<string, unknown>
  ) {
    super(message, sagaId, sagaType, {
      stepName,
      stepData,
    });
    this.name = 'SagaStepError';
  }
}

/**
 * @llm-summary SagaConfigurationError class for saga configuration error operations
 * @llm-domain Integration
 * @llm-complexity Expert
 *
 * @description
 * SagaConfigurationError class implementing integration layer component for saga configuration error operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new SagaConfigurationError();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new SagaConfigurationError());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class SagaConfigurationError extends BaseError {
  public readonly timestamp: Date;
  public readonly errorId: string;

  constructor(
    public readonly sagaType: string,
    message: string,
    public readonly validationErrors: string[] = [],
    public readonly configurationContext?: Record<string, unknown>
  ) {
    super(`Saga configuration error for ${sagaType}: ${message}`);
    this.name = 'SagaConfigurationError';
    this.timestamp = new Date();
    this.errorId = `${this.name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get structured error information for logging
   */
  toStructured(): Record<string, unknown> {
    return {
      errorId: this.errorId,
      errorType: this.name,
      message: this.message,
      sagaType: this.sagaType,
      timestamp: this.timestamp.toISOString(),
      validationErrors: this.validationErrors,
      configurationContext: this.configurationContext,
      stack: this.stack,
    };
  }
}

/**
 * @llm-summary SagaEventProcessingError class for saga event processing error operations
 * @llm-domain Integration
 * @llm-complexity Complex
 *
 * @description
 * SagaEventProcessingError class implementing integration layer component for saga event processing error operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new SagaEventProcessingError();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new SagaEventProcessingError());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class SagaEventProcessingError extends SagaError {
  constructor(
    sagaId: string,
    public readonly eventType: string,
    message: string,
    sagaType?: string,
    public readonly eventData?: Record<string, unknown>,
    public readonly processingContext?: Record<string, unknown>
  ) {
    super(`Event processing failed for ${eventType}: ${message}`, sagaId, sagaType, {
      eventType,
      eventData,
      processingContext,
    });
    this.name = 'SagaEventProcessingError';
  }
}

/**
 * @llm-summary SagaCompensationError class for saga compensation error operations
 * @llm-domain Integration
 * @llm-complexity Expert
 *
 * @description
 * SagaCompensationError class implementing integration layer component for saga compensation error operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new SagaCompensationError();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new SagaCompensationError());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class SagaCompensationError extends SagaError {
  constructor(
    sagaId: string,
    public readonly stepName: string,
    public readonly originalError: Error,
    sagaType?: string,
    public readonly compensationData?: Record<string, unknown>
  ) {
    super(
      `Saga compensation failed at step '${stepName}': ${originalError.message}`,
      sagaId,
      sagaType,
      {
        stepName,
        originalErrorType: originalError.constructor.name,
        originalErrorMessage: originalError.message,
        originalErrorStack: originalError.stack,
        compensationData,
      }
    );
    this.name = 'SagaCompensationError';
  }
}

/**
 * @llm-summary SagaDiscoveryError class for saga discovery error operations
 * @llm-domain Integration
 * @llm-complexity Simple
 *
 * @description
 * SagaDiscoveryError class implementing integration layer component for saga discovery error operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new SagaDiscoveryError();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new SagaDiscoveryError());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class SagaDiscoveryError extends BaseError {
  public readonly timestamp: Date;
  public readonly errorId: string;

  constructor(
    message: string,
    public readonly className?: string,
    public readonly discoveryContext?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'SagaDiscoveryError';
    this.timestamp = new Date();
    this.errorId = `${this.name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get structured error information for logging
   */
  toStructured(): Record<string, unknown> {
    return {
      errorId: this.errorId,
      errorType: this.name,
      message: this.message,
      className: this.className,
      timestamp: this.timestamp.toISOString(),
      discoveryContext: this.discoveryContext,
      stack: this.stack,
    };
  }
}

/**
 * @llm-summary SagaOrchestrationError class for saga orchestration error operations
 * @llm-domain Integration
 * @llm-complexity Expert
 *
 * @description
 * SagaOrchestrationError class implementing integration layer component for saga orchestration error operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new SagaOrchestrationError();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new SagaOrchestrationError());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class SagaOrchestrationError extends SagaError {
  constructor(
    sagaId: string,
    message: string,
    sagaType?: string,
    public readonly operation?: string,
    public readonly orchestrationContext?: Record<string, unknown>
  ) {
    super(message, sagaId, sagaType, {
      operation,
      orchestrationContext,
    });
    this.name = 'SagaOrchestrationError';
  }
}

/**
 * @llm-summary SagaInstanceLimitExceededError class for saga instance limit exceeded error operations
 * @llm-domain Integration
 * @llm-complexity Expert
 *
 * @description
 * SagaInstanceLimitExceededError class implementing integration layer component for saga instance limit exceeded error operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new SagaInstanceLimitExceededError();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new SagaInstanceLimitExceededError());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class SagaInstanceLimitExceededError extends SagaError {
  constructor(
    sagaType: string,
    public readonly maxInstances: number,
    public readonly currentCount: number
  ) {
    super(`Maximum instances reached for saga type: ${sagaType}`, 'N/A', sagaType, {
      maxInstances,
      currentCount,
    });
    this.name = 'SagaInstanceLimitExceededError';
  }
}

/**
 * @llm-summary SagaDefinitionNotFoundError class for saga definition not found error operations
 * @llm-domain Integration
 * @llm-complexity Expert
 *
 * @description
 * SagaDefinitionNotFoundError class implementing integration layer component for saga definition not found error operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new SagaDefinitionNotFoundError();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new SagaDefinitionNotFoundError());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class SagaDefinitionNotFoundError extends BaseError {
  public readonly timestamp: Date;
  public readonly errorId: string;

  constructor(
    public readonly eventType: string,
    public readonly availableDefinitions: string[] = []
  ) {
    super(`No saga definition found for start event: ${eventType}`);
    this.name = 'SagaDefinitionNotFoundError';
    this.timestamp = new Date();
    this.errorId = `${this.name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get structured error information for logging
   */
  toStructured(): Record<string, unknown> {
    return {
      errorId: this.errorId,
      errorType: this.name,
      message: this.message,
      eventType: this.eventType,
      availableDefinitions: this.availableDefinitions,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack,
    };
  }
}
