import type { IExtendedDomainEvent } from '@vytches-ddd/contracts';

/**
 * Enterprise-grade saga state interface
 * Provides comprehensive state management for long-running business processes
 */
export interface ISagaState {
  /** Unique identifier for the saga instance */
  readonly sagaId: string;

  /** Type identifier for the saga definition */
  readonly sagaType: string;

  /** Current status of the saga */
  status: SagaStatus;

  /** Current step being executed */
  currentStep: string;

  /** Data associated with the current step */
  stepData: Record<string, unknown>;

  /** Data needed for compensation actions */
  compensationData: Record<string, unknown>;

  /** Correlation identifier for related events/commands */
  correlationId: string;

  /** Additional metadata for the saga */
  metadata: Record<string, unknown>;

  /** Timestamp when saga was created */
  readonly createdAt: Date;

  /** Timestamp when saga was last updated */
  updatedAt: Date;

  /** Optional timeout for saga completion */
  timeoutAt: Date | undefined;

  /** Version for optimistic concurrency control */
  version: number;

  /** Error information if saga failed */
  error?: {
    message: string;
    stack?: string;
    step: string;
    timestamp: Date;
  };
}

/**
 * Enhanced saga status enumeration
 * Covers all possible states in saga lifecycle
 */
export enum SagaStatus {
  /** Saga has been started and is in progress */
  STARTED = 'STARTED',

  /** Saga is currently executing a step */
  EXECUTING = 'EXECUTING',

  /** Saga is waiting for an event or timeout */
  WAITING = 'WAITING',

  /** Saga completed successfully */
  COMPLETED = 'COMPLETED',

  /** Saga failed and requires compensation */
  FAILED = 'FAILED',

  /** Saga is executing compensation actions */
  COMPENSATING = 'COMPENSATING',

  /** Saga compensation completed successfully */
  COMPENSATED = 'COMPENSATED',

  /** Saga was cancelled */
  CANCELLED = 'CANCELLED',

  /** Saga timed out */
  TIMED_OUT = 'TIMED_OUT',
}

/**
 * Core saga interface - minimal contract for all sagas
 */
export interface ISaga {
  /** Unique identifier for the saga instance */
  readonly sagaId: string;

  /** Type identifier for the saga definition */
  readonly sagaType: string;

  /** Current status of the saga */
  readonly status: SagaStatus;

  /** Current saga state */
  readonly state: ISagaState;

  /**
   * Handle incoming domain event
   * @param event - Domain event to process
   * @param context - Execution context
   */
  handleEvent(event: IExtendedDomainEvent, context: ISagaExecutionContext): Promise<ISagaActionResult>;

  /**
   * Execute compensation for a specific step
   * @param stepName - Name of the step to compensate
   * @param context - Execution context
   */
  compensate(stepName: string, context: ISagaExecutionContext): Promise<ISagaActionResult>;

  /**
   * Check if saga can handle the given event
   * @param event - Domain event to check
   */
  canHandle(event: IExtendedDomainEvent): boolean;

  /**
   * Get correlation data for event filtering
   */
  getCorrelationData(): Record<string, unknown>;
}

/**
 * Saga execution context
 * Provides runtime environment and services for saga execution
 */
export interface ISagaExecutionContext {
  /** Correlation identifier for tracing */
  correlationId: string;

  /** User identifier if available */
  userId?: string;

  /** Tenant identifier for multi-tenancy */
  tenantId?: string;

  /** Request identifier for tracing */
  requestId?: string;

  /** Session identifier */
  sessionId?: string;

  /** Additional context metadata */
  metadata: Record<string, unknown>;

  /** Timestamp when context was created */
  timestamp: Date;

  /** Timeout for saga step execution */
  timeout?: number;
}

/**
 * Result of saga action execution
 */
export interface ISagaActionResult {
  /** Whether the action was successful */
  success: boolean;

  /** Error information if action failed */
  error?: {
    message: string;
    code: string;
    details?: Record<string, unknown>;
  };

  /** Commands to execute as result of this action */
  commands?: unknown[];

  /** Events to publish as result of this action */
  events?: IExtendedDomainEvent[];

  /** Whether this action should trigger saga completion */
  completesSaga?: boolean;

  /** Whether this action should trigger compensation */
  requiresCompensation?: boolean;

  /** Data to store for future compensation */
  compensationData?: Record<string, unknown>;

  /** Next step to execute (if different from natural flow) */
  nextStep?: string;

  /** Delay before executing next step (in milliseconds) */
  delay?: number;
}

/**
 * Saga step definition
 * Represents a single step in saga execution flow
 */
export interface ISagaStep {
  /** Unique name of the step */
  readonly name: string;

  /** Display name for monitoring */
  readonly displayName: string;

  /** Step description */
  readonly description?: string;

  /** Whether this step can be compensated */
  readonly compensatable: boolean;

  /** Timeout for step execution (milliseconds) */
  readonly timeout: number | undefined;

  /** Maximum retry attempts for this step */
  readonly maxRetries?: number;

  /** Events that can trigger this step */
  readonly triggerEvents: string[];

  /** Events that can complete this step */
  readonly completionEvents: string[];

  /**
   * Execute the step logic
   * @param event - Triggering event
   * @param state - Current saga state
   * @param context - Execution context
   */
  execute(
    event: IExtendedDomainEvent,
    state: ISagaState,
    context: ISagaExecutionContext
  ): Promise<ISagaActionResult>;

  /**
   * Execute compensation logic for this step
   * @param state - Current saga state
   * @param context - Execution context
   */
  compensate?(
    state: ISagaState,
    context: ISagaExecutionContext
  ): Promise<ISagaActionResult>;

  /**
   * Validate that step can be executed
   * @param event - Triggering event
   * @param state - Current saga state
   */
  canExecute(event: IExtendedDomainEvent, state: ISagaState): boolean;
}

/**
 * Saga definition interface
 * Defines the structure and behavior of a saga type
 */
export interface ISagaDefinition {
  /** Type identifier for this saga */
  readonly sagaType: string;

  /** Display name for monitoring */
  readonly displayName: string;

  /** Description of saga purpose */
  readonly description?: string;

  /** Events that can start this saga */
  readonly startEvents: string[];

  /** Default timeout for saga completion (milliseconds) */
  readonly defaultTimeout: number | undefined;

  /** Maximum number of saga instances */
  readonly maxInstances: number | undefined;

  /** Steps that comprise this saga */
  readonly steps: ISagaStep[];

  /**
   * Create new saga instance
   * @param event - Starting event
   * @param context - Execution context
   */
  createInstance(
    event: IExtendedDomainEvent,
    context: ISagaExecutionContext
  ): Promise<ISaga>;

  /**
   * Get correlation data from starting event
   * @param event - Starting event
   */
  getCorrelationData(event: IExtendedDomainEvent): Record<string, unknown>;

  /**
   * Validate saga configuration
   */
  validate(): string[];
}

/**
 * Factory interface for creating saga instances
 */
export interface ISagaFactory {
  /**
   * Create saga instance of specified type
   * @param sagaType - Type of saga to create
   * @param event - Starting event
   * @param context - Execution context
   */
  createSaga(
    sagaType: string,
    event: IExtendedDomainEvent,
    context: ISagaExecutionContext
  ): Promise<ISaga>;

  /**
   * Check if factory can create saga of specified type
   * @param sagaType - Type to check
   */
  canCreate(sagaType: string): boolean;

  /**
   * Get available saga types
   */
  getAvailableTypes(): string[];
}
