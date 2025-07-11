import type { Constructor } from '@vytches-ddd/di';
import type { ISagaExecutionContext } from './saga.interfaces';

/**
 * Saga decorator configuration
 * Used to mark classes as saga definitions
 */
export interface SagaDecoratorOptions {
  /** Type identifier for the saga */
  sagaType: string;

  /** Display name for monitoring and debugging */
  displayName?: string;

  /** Description of saga purpose */
  description?: string;

  /** Default timeout for saga completion (milliseconds) */
  defaultTimeout?: number;

  /** Maximum number of concurrent instances */
  maxInstances?: number;

  /** Events that can start this saga */
  startEvents?: string[];

  /** Auto-register with DI container */
  autoRegister?: boolean;

  /** Service lifetime for DI registration */
  lifetime?: 'transient' | 'singleton' | 'scoped';

  /** Bounded context for DI isolation */
  context?: string;
}

/**
 * Saga event handler decorator configuration
 * Used to mark methods that handle specific events
 */
export interface SagaEventHandlerOptions {
  /** Event type(s) this handler processes */
  eventType: string | string[];

  /** Whether this handler can start a new saga */
  canStartSaga?: boolean;

  /** Whether this handler can complete a saga */
  canCompleteSaga?: boolean;

  /** Correlation property paths for event matching */
  correlationProperties?: string[];

  /** Step name for this handler */
  stepName?: string;

  /** Maximum execution time (milliseconds) */
  timeout?: number;

  /** Maximum retry attempts */
  maxRetries?: number;

  /** Retry delay configuration */
  retryDelay?: {
    initial: number;
    multiplier: number;
    maximum: number;
  };

  /** Whether execution should be idempotent */
  idempotent?: boolean;

  /** Execution order (lower numbers execute first) */
  order?: number;
}

/**
 * Compensation handler decorator configuration
 * Used to mark methods that provide compensation logic
 */
export interface CompensationHandlerOptions {
  /** Step name this compensation handler is for */
  stepName: string;

  /** Maximum execution time (milliseconds) */
  timeout?: number;

  /** Maximum retry attempts */
  maxRetries?: number;

  /** Whether compensation is critical (saga fails if compensation fails) */
  critical?: boolean;

  /** Compensation execution order (lower numbers execute first) */
  order?: number;
}

/**
 * Start saga decorator configuration
 * Used to mark event handlers that can initiate new sagas
 */
export interface StartSagaOptions {
  /** Properties to use for correlation */
  correlationProperties?: string[];

  /** Maximum number of saga instances for this correlation */
  maxInstancesPerCorrelation?: number;

  /** Whether to create new instance if one already exists */
  createIfExists?: boolean;

  /** Custom saga ID generation function */
  sagaIdGenerator?: (event: unknown, context: ISagaExecutionContext) => string;
}

/**
 * End saga decorator configuration
 * Used to mark event handlers that complete sagas
 */
export interface EndSagaOptions {
  /** Whether to execute compensation on saga completion */
  compensateOnEnd?: boolean;

  /** Custom completion validation function */
  completionValidator?: (sagaState: unknown) => boolean;

  /** Events to publish on saga completion */
  publishEvents?: string[];
}

/**
 * Timeout handler decorator configuration
 * Used to mark methods that handle saga timeouts
 */
export interface TimeoutHandlerOptions {
  /** Timeout duration (milliseconds) */
  timeout: number;

  /** Action to take on timeout */
  action: 'compensate' | 'retry' | 'fail' | 'custom';

  /** Maximum retry attempts before giving up */
  maxRetries?: number;

  /** Whether timeout is relative to saga start or last activity */
  timeoutType?: 'absolute' | 'sliding';
}

/**
 * Saga step decorator configuration
 * Used to mark methods as saga steps with execution metadata
 */
export interface SagaStepOptions {
  /** Unique step name */
  name: string;

  /** Display name for monitoring */
  displayName?: string;

  /** Step description */
  description?: string;

  /** Whether this step can be compensated */
  compensatable?: boolean;

  /** Events that trigger this step */
  triggerEvents?: string[];

  /** Events that complete this step */
  completionEvents?: string[];

  /** Maximum execution time (milliseconds) */
  timeout?: number;

  /** Maximum retry attempts */
  maxRetries?: number;

  /** Step execution order */
  order?: number;

  /** Prerequisites for step execution */
  prerequisites?: string[];
}

/**
 * Saga correlation decorator configuration
 * Used to define how sagas correlate with events
 */
export interface SagaCorrelationOptions {
  /** Property paths for correlation matching */
  properties: string[];

  /** Correlation strategy */
  strategy?: 'exact' | 'partial' | 'custom';

  /** Custom correlation function */
  correlationFunction?: (event: unknown, sagaState: unknown) => boolean;

  /** Whether correlation is case-sensitive */
  caseSensitive?: boolean;
}

/**
 * Saga middleware decorator configuration
 * Used to apply middleware to saga execution
 */
export interface SagaMiddlewareOptions {
  /** Middleware classes to apply */
  middleware: Constructor<ISagaMiddleware>[];

  /** Execution order for middleware */
  order?: number;

  /** Whether middleware applies to all steps */
  applyToAllSteps?: boolean;

  /** Specific steps to apply middleware to */
  steps?: string[];
}

/**
 * Saga middleware interface
 * Provides cross-cutting concerns for saga execution
 */
export interface ISagaMiddleware {
  /**
   * Execute before saga step
   * @param context - Execution context
   * @param next - Next middleware in chain
   */
  before(context: ISagaMiddlewareContext, next: () => Promise<void>): Promise<void>;

  /**
   * Execute after saga step
   * @param context - Execution context
   * @param result - Step execution result
   * @param next - Next middleware in chain
   */
  after(
    context: ISagaMiddlewareContext,
    result: unknown,
    next: (result: unknown) => Promise<void>
  ): Promise<void>;

  /**
   * Handle saga step error
   * @param context - Execution context
   * @param error - Error that occurred
   * @param next - Next error handler in chain
   */
  onError(
    context: ISagaMiddlewareContext,
    error: Error,
    next: (error: Error) => Promise<void>
  ): Promise<void>;
}

/**
 * Saga middleware execution context
 */
export interface ISagaMiddlewareContext {
  /** Saga identifier */
  sagaId: string;

  /** Saga type */
  sagaType: string;

  /** Current step name */
  stepName: string;

  /** Triggering event */
  event: unknown;

  /** Execution context */
  executionContext: ISagaExecutionContext;

  /** Saga state */
  sagaState: unknown;

  /** Middleware metadata */
  metadata: Record<string, unknown>;

  /** Start time for performance tracking */
  startTime: Date;
}

/**
 * Saga validation decorator configuration
 * Used to add validation to saga steps
 */
export interface SagaValidationOptions {
  /** Validation rules for input */
  inputValidation?: {
    schema?: object;
    validator?: (input: unknown) => boolean | string[];
  };

  /** Validation rules for saga state */
  stateValidation?: {
    schema?: object;
    validator?: (state: unknown) => boolean | string[];
  };

  /** Validation rules for output */
  outputValidation?: {
    schema?: object;
    validator?: (output: unknown) => boolean | string[];
  };

  /** Whether validation failures should fail the saga */
  failOnValidationError?: boolean;

  /** Custom error messages */
  errorMessages?: Record<string, string>;
}

/**
 * Metadata stored by decorators
 * Used internally for saga configuration and execution
 */
export interface SagaMetadata {
  /** Saga configuration */
  saga?: SagaDecoratorOptions;

  /** Event handler configurations */
  eventHandlers?: Map<string, SagaEventHandlerOptions>;

  /** Compensation handler configurations */
  compensationHandlers?: Map<string, CompensationHandlerOptions>;

  /** Step configurations */
  steps?: Map<string, SagaStepOptions>;

  /** Correlation configurations */
  correlations?: Map<string, SagaCorrelationOptions>;

  /** Middleware configurations */
  middleware?: SagaMiddlewareOptions[];

  /** Timeout configurations */
  timeouts?: Map<string, TimeoutHandlerOptions>;

  /** Validation configurations */
  validations?: Map<string, SagaValidationOptions>;

  /** Start saga configurations */
  startSaga?: Map<string, StartSagaOptions>;

  /** End saga configurations */
  endSaga?: Map<string, EndSagaOptions>;
}

/**
 * Type guard for saga metadata
 */
export function isSagaMetadata(metadata: unknown): metadata is SagaMetadata {
  return (
    typeof metadata === 'object' &&
    metadata !== null &&
    ('saga' in metadata ||
      'eventHandlers' in metadata ||
      'compensationHandlers' in metadata ||
      'steps' in metadata)
  );
}
