import { BaseError } from '@vytches/ddd-domain-primitives';

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
