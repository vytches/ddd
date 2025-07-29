import type { Constructor } from '@vytches/ddd-di';
import type { ISagaExecutionContext } from './saga.interfaces';

/**
 * @llm-summary Contract for saga decorator options functionality
 * @llm-domain Integration
 * @llm-contract Required
 *
 * @description
 * SagaDecoratorOptions interface implementing integration layer component for saga decorator options operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteSagaDecoratorOptions implements SagaDecoratorOptions {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
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
 * @llm-summary Contract for saga event handler options functionality
 * @llm-domain Integration
 * @llm-contract Required
 *
 * @description
 * SagaEventHandlerOptions interface implementing integration layer component for saga event handler options operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteSagaEventHandlerOptions implements SagaEventHandlerOptions {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
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
 * @llm-summary Contract for compensation handler options functionality
 * @llm-domain Integration
 * @llm-contract Required
 *
 * @description
 * CompensationHandlerOptions interface implementing integration layer component for compensation handler options operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteCompensationHandlerOptions implements CompensationHandlerOptions {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
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
 * @llm-summary Contract for start saga options functionality
 * @llm-domain Integration
 * @llm-contract Required
 *
 * @description
 * StartSagaOptions interface implementing integration layer component for start saga options operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteStartSagaOptions implements StartSagaOptions {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
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
 * @llm-summary Contract for end saga options functionality
 * @llm-domain Integration
 * @llm-contract Required
 *
 * @description
 * EndSagaOptions interface implementing integration layer component for end saga options operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteEndSagaOptions implements EndSagaOptions {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
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
 * @llm-summary Contract for timeout handler options functionality
 * @llm-domain Integration
 * @llm-contract Required
 *
 * @description
 * TimeoutHandlerOptions interface implementing integration layer component for timeout handler options operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteTimeoutHandlerOptions implements TimeoutHandlerOptions {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
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
 * @llm-summary Contract for saga step options functionality
 * @llm-domain Integration
 * @llm-contract Required
 *
 * @description
 * SagaStepOptions interface implementing integration layer component for saga step options operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteSagaStepOptions implements SagaStepOptions {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
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
 * @llm-summary Contract for saga correlation options functionality
 * @llm-domain Integration
 * @llm-contract Required
 *
 * @description
 * SagaCorrelationOptions interface implementing integration layer component for saga correlation options operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteSagaCorrelationOptions implements SagaCorrelationOptions {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
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
 * @llm-summary Contract for saga middleware options functionality
 * @llm-domain Integration
 * @llm-contract Required
 *
 * @description
 * SagaMiddlewareOptions interface implementing integration layer component for saga middleware options operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteSagaMiddlewareOptions implements SagaMiddlewareOptions {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
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
 * @llm-summary Contract for saga middleware functionality
 * @llm-domain Integration
 * @llm-contract Required
 *
 * @description
 * SagaMiddleware interface implementing integration layer component for saga middleware operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteSagaMiddleware implements ISagaMiddleware {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
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
 * @llm-summary Contract for saga middleware context functionality
 * @llm-domain Integration
 * @llm-contract Required
 *
 * @description
 * SagaMiddlewareContext interface implementing integration layer component for saga middleware context operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteSagaMiddlewareContext implements ISagaMiddlewareContext {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
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
 * @llm-summary Contract for saga validation options functionality
 * @llm-domain Integration
 * @llm-contract Required
 *
 * @description
 * SagaValidationOptions interface implementing integration layer component for saga validation options operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteSagaValidationOptions implements SagaValidationOptions {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
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
 * @llm-summary Contract for saga metadata functionality
 * @llm-domain Integration
 * @llm-contract Required
 *
 * @description
 * SagaMetadata interface implementing integration layer component for saga metadata operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteSagaMetadata implements SagaMetadata {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
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
 * @llm-summary is saga metadata function
 * @llm-domain Integration
 * @llm-pure true
 *
 * @description
 * isSagaMetadata function implementing integration layer component for is saga metadata operations.
 *
 * @param {unknown} metadata - metadata parameter
 * @returns {metadata is SagaMetadata} Returns metadata is SagaMetadata
 * @throws {Error} When validation fails
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = isSagaMetadata(metadata);
 * ```
 * *
 * @since 1.0.0
 * @public
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
