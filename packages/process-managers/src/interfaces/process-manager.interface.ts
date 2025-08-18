import type { IDomainEvent, IEventMetadata } from '@vytches/ddd-contracts';
import type { IProcessManagerContext } from './process-manager-context.interface';
import type { IProcessManagerState } from './process-manager-state.interface';

/**
 * Extended domain event interface with additional properties needed for process management
 */
export interface IProcessManagerEvent extends IDomainEvent {
  /** Unique identifier for the event */
  id: string;

  /** Display name for the event */
  eventName: string;

  /** ID of the aggregate that generated the event */
  aggregateId: string;

  /** Type of the aggregate that generated the event */
  aggregateType: string;

  /** Version of the aggregate after applying the event */
  aggregateVersion: number;

  /** When the event occurred */
  timestamp: Date;

  /** Correlation ID for related events */
  correlationId?: string;

  /** ID of the event that caused this event */
  causationId?: string;

  /** Additional event metadata */
  metadata: IEventMetadata;
}

/**
 * Core interface for all process managers in the VytchesDDD system.
 * Process managers orchestrate complex business workflows by coordinating
 * between multiple aggregates and bounded contexts.
 */
export interface IProcessManager<TState extends IProcessManagerState = IProcessManagerState> {
  /**
   * Unique identifier for this process manager instance
   */
  readonly id: string;

  /**
   * Type identifier for this process manager class
   */
  readonly type: string;

  /**
   * Current state of the process manager
   */
  readonly state: TState;

  /**
   * Current status of the process manager
   */
  readonly status: ProcessManagerStatus;

  /**
   * Timestamp when this process manager was created
   */
  readonly createdAt: Date;

  /**
   * Timestamp when this process manager was last updated
   */
  readonly updatedAt: Date;

  /**
   * Optional timeout for the entire process
   */
  readonly timeout?: number | undefined;

  /**
   * Determines if this process manager can handle the given event
   * @param event - The domain event to check
   * @returns true if this process manager can handle the event
   */
  canHandle(event: IProcessManagerEvent): boolean;

  /**
   * Handles an incoming domain event and potentially updates state
   * @param event - The domain event to handle
   * @param context - The processing context
   * @returns Promise resolving to commands/events to emit
   */
  handle(
    event: IProcessManagerEvent,
    context: IProcessManagerContext
  ): Promise<ProcessManagerResult>;

  /**
   * Checks if the process is complete and can be finalized
   * @returns true if the process is complete
   */
  isComplete(): boolean;

  /**
   * Checks if the process has timed out
   * @returns true if the process has exceeded its timeout
   */
  isTimedOut(): boolean;

  /**
   * Gets correlation data used to route events to this process manager
   * @returns correlation data object
   */
  getCorrelationData(): Record<string, unknown>;

  /**
   * Updates the internal state of the process manager
   * @param newState - The new state to apply
   */
  updateState(newState: Partial<TState>): Promise<void>;

  /**
   * Marks the process as complete
   */
  complete(): void;

  /**
   * Marks the process as failed with an error
   * @param error - The error that caused the failure
   */
  fail(error: Error): void;
}

/**
 * Status enumeration for process managers
 */
export enum ProcessManagerStatus {
  CREATED = 'CREATED',
  RUNNING = 'RUNNING',
  WAITING = 'WAITING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  TIMED_OUT = 'TIMED_OUT',
}

/**
 * Result of processing an event in a process manager
 */
export interface ProcessManagerResult {
  /**
   * Whether the processing was successful
   */
  success: boolean;

  /**
   * Commands to emit as a result of processing
   */
  commands?:
    | Array<{
        type: string;
        payload: unknown;
        targetBoundedContext?: string;
      }>
    | undefined;

  /**
   * Events to emit as a result of processing
   */
  events?:
    | Array<{
        eventType: string;
        payload: unknown;
        targetBoundedContext?: string;
      }>
    | undefined;

  /**
   * Whether the process manager should continue processing
   */
  shouldContinue?: boolean;

  /**
   * Error information if processing failed
   */
  error?:
    | {
        message: string;
        code?: string | undefined;
        details?: unknown;
      }
    | undefined;
}
