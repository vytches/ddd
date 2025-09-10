/**
 * Base interface for all process manager state objects.
 * Process manager state represents the current position and data
 * within a business workflow.
 */
export interface IProcessManagerState {
  /**
   * Current step or phase in the process
   */
  currentStep: string;

  /**
   * Arbitrary data associated with the current step
   */
  stepData: Record<string, unknown>;

  /**
   * Version number for optimistic concurrency control
   */
  version: number;

  /**
   * Timestamp when the state was last modified
   */
  lastModified: Date;

  /**
   * Correlation data used for event routing
   */
  correlationData: Record<string, unknown>;

  /**
   * Additional metadata for the process
   */
  metadata?: Record<string, unknown> | undefined;
}

/**
 * Extended state interface for process managers that need
 * to track complex workflow states
 */
export interface IExtendedProcessManagerState extends IProcessManagerState {
  /**
   * History of completed steps
   */
  completedSteps: Array<{
    stepName: string;
    completedAt: Date;
    data?: Record<string, unknown>;
  }>;

  /**
   * Pending operations or events expected
   */
  pendingOperations: Array<{
    operationType: string;
    operationId: string;
    expectedBy?: Date;
    data?: Record<string, unknown>;
  }>;

  /**
   * Errors encountered during processing
   */
  errors?: Array<{
    error: string;
    occurredAt: Date;
    step: string;
    recoverable: boolean;
  }>;

  /**
   * Compensation data for rollback scenarios
   */
  compensationData?: Record<string, unknown> | undefined;
}
