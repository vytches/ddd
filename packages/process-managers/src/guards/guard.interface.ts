import type { Result } from '@vytches/ddd-utils';
import type { IProcessManagerContext, IProcessManagerState } from '../interfaces';

/**
 * Context for guard evaluation containing state and processing context
 */
export interface ProcessGuardContext<TState extends IProcessManagerState = IProcessManagerState> {
  /**
   * Current state of the process manager
   */
  currentState: TState;

  /**
   * Proposed new state (if available)
   */
  proposedState?: Partial<TState>;

  /**
   * Processing context
   */
  context: IProcessManagerContext;

  /**
   * Operation being guarded
   */
  operation: GuardOperation;

  /**
   * Additional metadata for guard evaluation
   */
  metadata?: Record<string, unknown>;
}

/**
 * Types of operations that can be guarded
 */
export enum GuardOperation {
  STATE_TRANSITION = 'STATE_TRANSITION',
  EVENT_HANDLING = 'EVENT_HANDLING',
  COMMAND_EXECUTION = 'COMMAND_EXECUTION',
  COMPLETION = 'COMPLETION',
  TIMEOUT = 'TIMEOUT',
  RECOVERY = 'RECOVERY',
}

/**
 * Result of guard evaluation
 */
export interface GuardResult {
  /**
   * Whether the guard allows the operation
   */
  allowed: boolean;

  /**
   * Reason for denial (if not allowed)
   */
  reason?: string;

  /**
   * Error code for programmatic handling
   */
  code?: string;

  /**
   * Additional context about the guard decision
   */
  details?: Record<string, unknown>;

  /**
   * Suggested actions to make the operation valid
   */
  suggestions?: string[];

  /**
   * Whether this is a soft or hard failure
   * Soft failures might be retryable
   */
  severity: GuardSeverity;
}

/**
 * Severity levels for guard failures
 */
export enum GuardSeverity {
  /** Operation can proceed with warnings */
  WARNING = 'WARNING',
  /** Operation should be blocked but might be retryable */
  ERROR = 'ERROR',
  /** Operation must be blocked and is not retryable */
  CRITICAL = 'CRITICAL',
}

/**
 * Core interface for process guards
 * Guards determine whether operations can proceed based on business rules
 */
export interface IProcessGuard<TState extends IProcessManagerState = IProcessManagerState> {
  /**
   * Evaluates whether an operation can proceed
   * @param context - The guard evaluation context
   * @returns Promise resolving to guard result
   */
  canExecute(context: ProcessGuardContext<TState>): Promise<Result<GuardResult, Error>>;

  /**
   * Gets the name of this guard for identification and logging
   * @returns Guard name
   */
  getName(): string;

  /**
   * Gets the priority of this guard for ordering evaluation
   * Higher priority guards are evaluated first
   * @returns Priority number (higher = more important)
   */
  getPriority(): number;

  /**
   * Gets the operations this guard applies to
   * @returns Array of operations this guard evaluates
   */
  getApplicableOperations(): GuardOperation[];

  /**
   * Determines if this guard should be evaluated for the given context
   * @param context - The guard evaluation context
   * @returns true if guard should be evaluated
   */
  shouldEvaluate(context: ProcessGuardContext<TState>): boolean;
}

/**
 * Configuration for guard evaluation
 */
export interface GuardConfiguration {
  /**
   * Whether to fail fast on first guard failure
   */
  failFast: boolean;

  /**
   * Whether to collect all guard results even after failures
   */
  collectAllResults: boolean;

  /**
   * Timeout for guard evaluation in milliseconds
   */
  timeoutMs: number;

  /**
   * Whether to log guard evaluations
   */
  enableLogging: boolean;

  /**
   * Minimum severity level to block operations
   */
  minimumBlockingSeverity: GuardSeverity;
}

/**
 * Result of evaluating multiple guards
 */
export interface GuardEvaluationResult {
  /**
   * Whether all applicable guards passed
   */
  allowed: boolean;

  /**
   * Results from individual guards
   */
  guardResults: Array<{
    guardName: string;
    result: GuardResult;
    evaluationTimeMs: number;
  }>;

  /**
   * Overall evaluation time
   */
  totalEvaluationTimeMs: number;

  /**
   * Any guards that failed to evaluate
   */
  errors?: Array<{
    guardName: string;
    error: Error;
  }>;

  /**
   * Summary of blocking issues
   */
  blockingIssues: Array<{
    guardName: string;
    reason: string;
    severity: GuardSeverity;
  }>;
}
