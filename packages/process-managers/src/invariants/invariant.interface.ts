import type { Result } from '@vytches/ddd-utils';
import type { IProcessManagerContext, IProcessManagerState } from '../interfaces';

/**
 * Severity levels for invariant violations
 */
export enum InvariantSeverity {
  /** Informational - process can continue */
  INFO = 'INFO',
  /** Warning - process can continue but should be monitored */
  WARNING = 'WARNING',
  /** Error - process should be stopped or corrected */
  ERROR = 'ERROR',
  /** Critical - process must be stopped immediately */
  CRITICAL = 'CRITICAL',
}

/**
 * Represents a violation of a process invariant
 */
export interface InvariantViolation {
  /**
   * Unique identifier for this violation type
   */
  violationId: string;

  /**
   * Human-readable description of the violation
   */
  description: string;

  /**
   * Severity of the violation
   */
  severity: InvariantSeverity;

  /**
   * The property or field that caused the violation
   */
  property?: string;

  /**
   * Expected value or condition
   */
  expected?: unknown;

  /**
   * Actual value that caused the violation
   */
  actual?: unknown;

  /**
   * Additional context about the violation
   */
  context?: Record<string, unknown>;

  /**
   * Suggested actions to resolve the violation
   */
  suggestions?: string[];

  /**
   * Whether this violation can be automatically corrected
   */
  canAutoCorrect?: boolean;

  /**
   * Function to auto-correct the violation if possible
   */
  autoCorrectFn?: (state: IProcessManagerState) => IProcessManagerState;
}

/**
 * Result of invariant validation
 */
export interface InvariantResult {
  /**
   * Whether the invariant is satisfied
   */
  isValid: boolean;

  /**
   * List of violations found (empty if valid)
   */
  violations: InvariantViolation[];

  /**
   * Time taken to validate the invariant (in milliseconds)
   */
  evaluationTimeMs: number;

  /**
   * Additional metadata about the validation
   */
  metadata?: Record<string, unknown>;

  /**
   * Whether the state was modified during validation
   */
  stateModified?: boolean;

  /**
   * The corrected state (if auto-correction was applied)
   */
  correctedState?: IProcessManagerState;
}

/**
 * Context for invariant validation
 */
export interface InvariantContext {
  /**
   * The processing context
   */
  processContext: IProcessManagerContext;

  /**
   * Operation that triggered the invariant check
   */
  triggeringOperation: InvariantTrigger;

  /**
   * Previous state (if applicable)
   */
  previousState?: IProcessManagerState;

  /**
   * Additional validation context
   */
  validationContext?: Record<string, unknown>;
}

/**
 * Events or operations that can trigger invariant validation
 */
export enum InvariantTrigger {
  /** State transition */
  STATE_CHANGE = 'STATE_CHANGE',
  /** Event processing */
  EVENT_PROCESSING = 'EVENT_PROCESSING',
  /** Process completion */
  COMPLETION = 'COMPLETION',
  /** Process initialization */
  INITIALIZATION = 'INITIALIZATION',
  /** Periodic validation */
  PERIODIC_CHECK = 'PERIODIC_CHECK',
  /** Manual validation request */
  MANUAL_CHECK = 'MANUAL_CHECK',
  /** Recovery operation */
  RECOVERY = 'RECOVERY',
  /** Snapshot creation */
  SNAPSHOT = 'SNAPSHOT',
}

/**
 * Core interface for process invariants
 * Invariants define conditions that must always be true about process state
 */
export interface IProcessInvariant<TState extends IProcessManagerState = IProcessManagerState> {
  /**
   * Validates the invariant against the given state
   * @param state - The state to validate
   * @param context - The validation context
   * @returns Promise resolving to validation result
   */
  validate(state: TState, context: InvariantContext): Promise<Result<InvariantResult, Error>>;

  /**
   * Gets a human-readable description of this invariant
   * @returns Description of what this invariant validates
   */
  getDescription(): string;

  /**
   * Gets the severity level for violations of this invariant
   * @returns Default severity for violations
   */
  getSeverity(): InvariantSeverity;

  /**
   * Gets the triggers that should cause this invariant to be checked
   * @returns Array of triggers for this invariant
   */
  getTriggers(): InvariantTrigger[];

  /**
   * Gets the priority of this invariant for ordering validation
   * Higher priority invariants are validated first
   * @returns Priority number (higher = more important)
   */
  getPriority(): number;

  /**
   * Determines if this invariant should be evaluated for the given context
   * @param state - The state to potentially validate
   * @param context - The validation context
   * @returns true if invariant should be validated
   */
  shouldValidate(state: TState, context: InvariantContext): boolean;

  /**
   * Gets a unique identifier for this invariant
   * @returns Unique identifier
   */
  getId(): string;

  /**
   * Whether this invariant supports auto-correction of violations
   * @returns true if auto-correction is supported
   */
  supportsAutoCorrection(): boolean;
}

/**
 * Configuration for invariant validation
 */
export interface InvariantConfiguration {
  /**
   * Whether to stop validation on first critical violation
   */
  failFastOnCritical: boolean;

  /**
   * Whether to collect all violations even after finding errors
   */
  collectAllViolations: boolean;

  /**
   * Maximum time allowed for all invariant validations (in milliseconds)
   */
  maxValidationTimeMs: number;

  /**
   * Whether to enable auto-correction of violations
   */
  enableAutoCorrection: boolean;

  /**
   * Minimum severity level to report violations
   */
  minimumSeverityLevel: InvariantSeverity;

  /**
   * Whether to log invariant validation results
   */
  enableLogging: boolean;

  /**
   * Whether to track performance metrics
   */
  enableMetrics: boolean;

  /**
   * Custom timeout per invariant (in milliseconds)
   */
  perInvariantTimeoutMs: number;
}

/**
 * Result of validating multiple invariants
 */
export interface InvariantValidationResult {
  /**
   * Whether all invariants passed
   */
  isValid: boolean;

  /**
   * Total number of invariants validated
   */
  invariantsValidated: number;

  /**
   * Results from individual invariants
   */
  invariantResults: Array<{
    invariantId: string;
    description: string;
    result: InvariantResult;
  }>;

  /**
   * All violations found across all invariants
   */
  allViolations: InvariantViolation[];

  /**
   * Critical violations that require immediate attention
   */
  criticalViolations: InvariantViolation[];

  /**
   * Total validation time
   */
  totalValidationTimeMs: number;

  /**
   * Any invariants that failed to execute
   */
  failedInvariants?: Array<{
    invariantId: string;
    error: Error;
  }>;

  /**
   * The final state after any auto-corrections
   */
  finalState?: IProcessManagerState;

  /**
   * Whether any auto-corrections were applied
   */
  autoCorrectionsApplied: boolean;
}

/**
 * Event emitted when an invariant violation occurs
 */
export interface InvariantViolationEvent {
  /**
   * The invariant that was violated
   */
  invariantId: string;

  /**
   * The violation details
   */
  violation: InvariantViolation;

  /**
   * The process manager ID
   */
  processManagerId: string;

  /**
   * The state when the violation occurred
   */
  state: IProcessManagerState;

  /**
   * When the violation occurred
   */
  timestamp: Date;

  /**
   * The trigger that caused the validation
   */
  trigger: InvariantTrigger;
}
