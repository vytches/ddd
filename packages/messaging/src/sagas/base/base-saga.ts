import type { IExtendedDomainEvent } from '@vytches/ddd-contracts';
import { Logger } from '@vytches/ddd-logging';
import type {
  ISaga,
  ISagaState,
  ISagaExecutionContext,
  ISagaActionResult,
  ISagaStep,
  ISagaMiddleware,
} from '../interfaces';
import { SagaStatus } from '../interfaces';
import { SagaMiddlewarePipeline } from '../middleware';

/**
 * @llm-summary BaseSaga class for base saga operations
 * @llm-domain Integration
 * @llm-complexity Expert
 *
 * @description
 * BaseSaga class implementing integration layer component for base saga operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new BaseSaga();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new BaseSaga());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export abstract class BaseSaga implements ISaga {
  protected readonly logger: ReturnType<typeof Logger.forContext>;
  protected readonly steps: Map<string, ISagaStep> = new Map();
  protected readonly middlewarePipeline: SagaMiddlewarePipeline = new SagaMiddlewarePipeline();

  constructor(
    protected _state: ISagaState,
    protected readonly sagaTypeName: string
  ) {
    this.logger = Logger.forContext(`${this.constructor.name}`);
    this.initializeSteps();
  }

  /**
   * Unique identifier for the saga instance
   */
  get sagaId(): string {
    return this._state.sagaId;
  }

  /**
   * Type identifier for the saga definition
   */
  get sagaType(): string {
    return this._state.sagaType;
  }

  /**
   * Current status of the saga
   */
  get status(): SagaStatus {
    return this._state.status;
  }

  /**
   * Current saga state (immutable copy)
   */
  get state(): ISagaState {
    return { ...this._state };
  }

  /**
   * Handle incoming domain event
   * @param event - Domain event to process
   * @param context - Execution context
   */
  async handleEvent(
    event: IExtendedDomainEvent,
    context: ISagaExecutionContext
  ): Promise<ISagaActionResult> {
    this.logger.info('Handling event in saga', {
      sagaId: this.sagaId,
      sagaType: this.sagaType,
      eventType: event.eventType,
      currentStep: this._state.currentStep,
      status: this._state.status,
      correlationId: context.correlationId,
    });

    // Execute through middleware pipeline
    return await this.middlewarePipeline.execute(
      this,
      event,
      context,
      this._state.currentStep,
      () => this.executeEventHandling(event, context)
    );
  }

  /**
   * Internal event handling logic (called through middleware pipeline)
   * @param event - Domain event to process
   * @param context - Execution context
   */
  private async executeEventHandling(
    event: IExtendedDomainEvent,
    context: ISagaExecutionContext
  ): Promise<ISagaActionResult> {
    try {
      // Update saga state with event processing timestamp
      this.updateState({
        updatedAt: new Date(),
        status: SagaStatus.EXECUTING,
      });

      // Find appropriate step to handle the event
      const step = this.findStepForEvent(event);
      if (!step) {
        this.logger.warn('No step found to handle event', {
          sagaId: this.sagaId,
          eventType: event.eventType,
          availableSteps: Array.from(this.steps.keys()),
        });

        return {
          success: false,
          error: {
            message: `No step found to handle event ${event.eventType}`,
            code: 'STEP_NOT_FOUND',
            details: { eventType: event.eventType },
          },
        };
      }

      // Validate step can be executed
      if (!step.canExecute(event, this._state)) {
        this.logger.warn('Step cannot be executed', {
          sagaId: this.sagaId,
          stepName: step.name,
          eventType: event.eventType,
          currentStatus: this._state.status,
        });

        return {
          success: false,
          error: {
            message: `Step ${step.name} cannot be executed`,
            code: 'STEP_EXECUTION_BLOCKED',
            details: { stepName: step.name, eventType: event.eventType },
          },
        };
      }

      // Execute the step
      const result = await this.executeStep(step, event, context);

      // Update saga state based on step result
      await this.updateStateFromResult(result, step.name);

      this.logger.info('Event handled successfully', {
        sagaId: this.sagaId,
        stepName: step.name,
        success: result.success,
        sagaCompleted: result.completesSaga || false,
      });

      return result;
    } catch (error) {
      this.logger.error(
        'Error handling event in saga',
        error instanceof Error ? error : undefined,
        {
          saga_id: this.sagaId,
          event_type: event.eventType,
          error_message: error instanceof Error ? error.message : String(error),
          error_stack: error instanceof Error ? error.stack : undefined,
        }
      );

      // Update saga state with error
      this.updateState({
        updatedAt: new Date(),
        status: SagaStatus.FAILED,
        error: {
          message: error instanceof Error ? error.message : String(error),
          ...(error instanceof Error && error.stack ? { stack: error.stack } : {}),
          step: this._state.currentStep,
          timestamp: new Date(),
        },
      });

      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : String(error),
          code: 'SAGA_EXECUTION_ERROR',
        },
        requiresCompensation: true,
      };
    }
  }

  /**
   * Execute compensation for a specific step
   * @param stepName - Name of the step to compensate
   * @param context - Execution context
   */
  async compensate(stepName: string, context: ISagaExecutionContext): Promise<ISagaActionResult> {
    this.logger.info('Starting compensation for step', {
      sagaId: this.sagaId,
      stepName,
      correlationId: context.correlationId,
    });

    try {
      // Update saga status to compensating
      this.updateState({
        status: SagaStatus.COMPENSATING,
        updatedAt: new Date(),
      });

      const step = this.steps.get(stepName);
      if (!step) {
        this.logger.error('Step not found for compensation', undefined, {
          saga_id: this.sagaId,
          step_name: stepName,
          available_steps: Array.from(this.steps.keys()),
        });

        return {
          success: false,
          error: {
            message: `Step ${stepName} not found for compensation`,
            code: 'COMPENSATION_STEP_NOT_FOUND',
          },
        };
      }

      if (!step.compensate) {
        this.logger.warn('Step does not have compensation logic', {
          sagaId: this.sagaId,
          stepName,
        });

        return {
          success: true, // Consider it successful if no compensation needed
        };
      }

      // Execute compensation
      const result = await step.compensate(this._state, context);

      this.logger.info('Compensation completed', {
        sagaId: this.sagaId,
        stepName,
        success: result.success,
      });

      return result;
    } catch (error) {
      this.logger.error('Error during compensation', error instanceof Error ? error : undefined, {
        saga_id: this.sagaId,
        step_name: stepName,
        error_message: error instanceof Error ? error.message : String(error),
        error_stack: error instanceof Error ? error.stack : undefined,
      });

      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : String(error),
          code: 'COMPENSATION_ERROR',
        },
      };
    }
  }

  /**
   * Check if saga can handle the given event
   * @param event - Domain event to check
   */
  canHandle(event: IExtendedDomainEvent): boolean {
    // Check if any step can handle this event
    for (const step of this.steps.values()) {
      if (
        step.triggerEvents.includes(event.eventType) ||
        step.completionEvents.includes(event.eventType)
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get correlation data for event filtering
   */
  getCorrelationData(): Record<string, unknown> {
    return {
      sagaId: this.sagaId,
      sagaType: this.sagaType,
      correlationId: this._state.correlationId,
      ...this._state.metadata,
    };
  }

  /**
   * Initialize saga steps - must be implemented by concrete sagas
   */
  protected abstract initializeSteps(): void;

  /**
   * Add a step to the saga
   * @param step - Step to add
   */
  protected addStep(step: ISagaStep): void {
    this.steps.set(step.name, step);
    this.logger.debug('Step added to saga', {
      sagaType: this.sagaType,
      stepName: step.name,
      triggerEvents: step.triggerEvents,
      compensatable: step.compensatable,
    });
  }

  /**
   * Update saga state
   * @param updates - Partial state updates
   */
  protected updateState(updates: Partial<ISagaState>): void {
    this._state = {
      ...this._state,
      ...updates,
      version: this._state.version + 1,
    };
  }

  /**
   * Add middleware to the saga pipeline
   * @param middleware - Middleware to add
   */
  protected addMiddleware(
    middleware: ISagaMiddleware & { getName?(): string; shouldApply?(context: unknown): boolean }
  ): void {
    this.middlewarePipeline.use(middleware);
    this.logger.debug('Middleware added to saga', {
      sagaType: this.sagaType,
      middlewareName: middleware.getName ? middleware.getName() : 'Unknown',
    });
  }

  /**
   * Get list of configured middleware names
   */
  protected getMiddlewareNames(): string[] {
    return this.middlewarePipeline.getMiddlewareNames();
  }

  /**
   * Configure default middleware for enterprise-grade features
   */
  protected configureDefaultMiddleware(): void {
    // Override in concrete sagas to add specific middleware
  }

  /**
   * Find appropriate step to handle the event
   * @param event - Domain event to process
   */
  private findStepForEvent(event: IExtendedDomainEvent): ISagaStep | null {
    // First try to find step by trigger events
    for (const step of this.steps.values()) {
      if (step.triggerEvents.includes(event.eventType)) {
        return step;
      }
    }

    // Then try completion events
    for (const step of this.steps.values()) {
      if (step.completionEvents.includes(event.eventType)) {
        return step;
      }
    }

    return null;
  }

  /**
   * Execute a saga step with proper error handling and logging
   * @param step - Step to execute
   * @param event - Triggering event
   * @param context - Execution context
   */
  private async executeStep(
    step: ISagaStep,
    event: IExtendedDomainEvent,
    context: ISagaExecutionContext
  ): Promise<ISagaActionResult> {
    const startTime = Date.now();

    try {
      // Update current step
      this.updateState({
        currentStep: step.name,
        updatedAt: new Date(),
      });

      this.logger.debug('Executing saga step', {
        sagaId: this.sagaId,
        stepName: step.name,
        eventType: event.eventType,
        timeout: step.timeout,
      });

      // Execute step with timeout if specified
      let result: ISagaActionResult;
      if (step.timeout) {
        result = await this.executeWithTimeout(
          () => step.execute(event, this._state, context),
          step.timeout
        );
      } else {
        result = await step.execute(event, this._state, context);
      }

      const executionTime = Date.now() - startTime;

      this.logger.debug('Step execution completed', {
        sagaId: this.sagaId,
        stepName: step.name,
        success: result.success,
        executionTime,
        nextStep: result.nextStep,
        completesSaga: result.completesSaga,
      });

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;

      this.logger.error('Step execution failed', error instanceof Error ? error : undefined, {
        saga_id: this.sagaId,
        step_name: step.name,
        execution_time: executionTime,
        error_message: error instanceof Error ? error.message : String(error),
        error_stack: error instanceof Error ? error.stack : undefined,
      });

      throw error;
    }
  }

  /**
   * Execute function with timeout
   * @param fn - Function to execute
   * @param timeoutMs - Timeout in milliseconds
   */
  private async executeWithTimeout<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs);
    });

    return Promise.race([fn(), timeoutPromise]);
  }

  /**
   * Update saga state based on step execution result
   * @param result - Step execution result
   * @param stepName - Name of executed step
   */
  private async updateStateFromResult(result: ISagaActionResult, stepName: string): Promise<void> {
    const updates: Partial<ISagaState> = {
      updatedAt: new Date(),
    };

    // Store compensation data if provided
    if (result.compensationData) {
      updates.compensationData = {
        ...this._state.compensationData,
        [stepName]: result.compensationData,
      };
    }

    // Update step data if successful
    if (result.success) {
      updates.status = SagaStatus.WAITING;

      // Set next step if specified
      if (result.nextStep) {
        updates.currentStep = result.nextStep;
      }

      // Mark as completed if specified
      if (result.completesSaga) {
        updates.status = SagaStatus.COMPLETED;
      }
    } else {
      // Mark as failed if step failed
      updates.status = SagaStatus.FAILED;

      if (result.error) {
        updates.error = {
          message: result.error.message,
          step: stepName,
          timestamp: new Date(),
        };
      }
    }

    this.updateState(updates);
  }
}
