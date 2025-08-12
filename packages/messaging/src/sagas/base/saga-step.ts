import type { IDomainEvent } from '@vytches/ddd-contracts';
import { Logger } from '@vytches/ddd-logging';
import type {
  ISagaActionResult,
  ISagaExecutionContext,
  ISagaState,
  ISagaStep,
} from '../interfaces';

export abstract class SagaStep implements ISagaStep {
  protected readonly logger: ReturnType<typeof Logger.forContext>;

  constructor(
    public readonly name: string,
    public readonly displayName: string,
    public readonly description = '',
    public readonly compensatable = true,
    public readonly timeout: number | undefined,
    public readonly maxRetries = 0,
    public readonly triggerEvents: string[] = [],
    public readonly completionEvents: string[] = []
  ) {
    this.logger = Logger.forContext(`SagaStep:${name}`);
  }

  /**
   * Execute the step logic
   * @param event - Triggering event
   * @param state - Current saga state
   * @param context - Execution context
   */
  async execute(
    event: IDomainEvent,
    state: ISagaState,
    context: ISagaExecutionContext
  ): Promise<ISagaActionResult> {
    this.logger.info('Executing saga step', {
      stepName: this.name,
      sagaId: state.sagaId,
      eventType: event.eventType,
      correlationId: context.correlationId,
    });

    try {
      const result = await this.executeImpl(event, state, context);

      this.logger.info('Saga step execution completed', {
        stepName: this.name,
        sagaId: state.sagaId,
        success: result.success,
        completesSaga: result.completesSaga || false,
        nextStep: result.nextStep,
      });

      return result;
    } catch (error) {
      this.logger.error('Saga step execution failed', error instanceof Error ? error : undefined, {
        step_name: this.name,
        saga_id: state.sagaId,
        error_message: error instanceof Error ? error.message : String(error),
        error_stack: error instanceof Error ? error.stack : undefined,
      });

      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : String(error),
          code: 'STEP_EXECUTION_ERROR',
          details: {
            stepName: this.name,
            eventType: event.eventType,
          },
        },
        requiresCompensation: this.compensatable,
      };
    }
  }

  /**
   * Execute compensation logic for this step
   * @param state - Current saga state
   * @param context - Execution context
   */
  async compensate(state: ISagaState, context: ISagaExecutionContext): Promise<ISagaActionResult> {
    if (!this.compensatable) {
      this.logger.warn('Compensation requested for non-compensatable step', {
        stepName: this.name,
        sagaId: state.sagaId,
      });

      return {
        success: true, // Consider successful if no compensation needed
      };
    }

    this.logger.info('Executing step compensation', {
      stepName: this.name,
      sagaId: state.sagaId,
      correlationId: context.correlationId,
    });

    try {
      const result = await this.compensateImpl(state, context);

      this.logger.info('Step compensation completed', {
        stepName: this.name,
        sagaId: state.sagaId,
        success: result.success,
      });

      return result;
    } catch (error) {
      this.logger.error('Step compensation failed', error instanceof Error ? error : undefined, {
        step_name: this.name,
        saga_id: state.sagaId,
        error_message: error instanceof Error ? error.message : String(error),
        error_stack: error instanceof Error ? error.stack : undefined,
      });

      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : String(error),
          code: 'COMPENSATION_ERROR',
          details: {
            stepName: this.name,
          },
        },
      };
    }
  }

  /**
   * Validate that step can be executed
   * @param event - Triggering event
   * @param state - Current saga state
   */
  canExecute(event: IDomainEvent, state: ISagaState): boolean {
    // Check if event type is supported
    if (
      !this.triggerEvents.includes(event.eventType) &&
      !this.completionEvents.includes(event.eventType)
    ) {
      return false;
    }

    // Allow custom validation in derived classes
    return this.canExecuteImpl(event, state);
  }

  /**
   * Abstract method for step execution implementation
   * Must be implemented by concrete step classes
   * @param event - Triggering event
   * @param state - Current saga state
   * @param context - Execution context
   */
  protected abstract executeImpl(
    event: IDomainEvent,
    state: ISagaState,
    context: ISagaExecutionContext
  ): Promise<ISagaActionResult>;

  /**
   * Default compensation implementation - can be overridden
   * @param state - Current saga state
   * @param context - Execution context
   */
  protected async compensateImpl(
    state: ISagaState,
    context: ISagaExecutionContext
  ): Promise<ISagaActionResult> {
    // Default implementation - no compensation needed
    return { success: true };
  }

  /**
   * Default execution validation - can be overridden
   * @param event - Triggering event
   * @param state - Current saga state
   */
  protected canExecuteImpl(event: IDomainEvent, state: ISagaState): boolean {
    // Default implementation - always allow execution
    return true;
  }

  /**
   * Helper method to extract data from event payload
   * @param event - Domain event
   * @param path - Property path (e.g., 'payload.orderId')
   */
  protected getEventData<T = unknown>(event: IDomainEvent, path: string): T | undefined {
    try {
      const parts = path.split('.');
      let current: Record<string, unknown> = event as unknown as Record<string, unknown>;

      for (const part of parts) {
        if (current == null) return undefined;
        current = current[part] as Record<string, unknown>;
      }

      return current as T;
    } catch (error) {
      this.logger.warn('Failed to extract event data', {
        stepName: this.name,
        path,
        eventType: event.eventType,
        error: error instanceof Error ? error.message : String(error),
      });

      return undefined;
    }
  }

  /**
   * Helper method to extract data from saga state
   * @param state - Saga state
   * @param path - Property path (e.g., 'stepData.orderId')
   */
  protected getStateData<T = unknown>(state: ISagaState, path: string): T | undefined {
    try {
      const parts = path.split('.');
      let current: Record<string, unknown> = state as unknown as Record<string, unknown>;

      for (const part of parts) {
        if (current == null) return undefined;
        current = current[part] as Record<string, unknown>;
      }

      return current as T;
    } catch (error) {
      this.logger.warn('Failed to extract state data', {
        stepName: this.name,
        path,
        sagaId: state.sagaId,
        error: error instanceof Error ? error.message : String(error),
      });

      return undefined;
    }
  }

  /**
   * Helper method to create successful result
   * @param options - Result options
   */
  protected createSuccessResult(
    options: {
      commands?: unknown[];
      events?: IDomainEvent[];
      completesSaga?: boolean;
      compensationData?: Record<string, unknown>;
      nextStep?: string;
      delay?: number;
    } = {}
  ): ISagaActionResult {
    return {
      success: true,
      ...options,
    };
  }

  /**
   * Helper method to create failure result
   * @param error - Error information
   * @param requiresCompensation - Whether compensation is required
   */
  protected createFailureResult(
    error: { message: string; code: string; details?: Record<string, unknown> },
    requiresCompensation: boolean = this.compensatable
  ): ISagaActionResult {
    return {
      success: false,
      error,
      requiresCompensation,
    };
  }

  /**
   * Helper method to validate required event data
   * @param event - Domain event
   * @param requiredPaths - Array of required property paths
   */
  protected validateEventData(event: IDomainEvent, requiredPaths: string[]): string[] {
    const errors: string[] = [];

    for (const path of requiredPaths) {
      const value = this.getEventData(event, path);
      if (value === undefined || value === null) {
        errors.push(`Required event data missing: ${path}`);
      }
    }

    return errors;
  }

  /**
   * Helper method to validate required state data
   * @param state - Saga state
   * @param requiredPaths - Array of required property paths
   */
  protected validateStateData(state: ISagaState, requiredPaths: string[]): string[] {
    const errors: string[] = [];

    for (const path of requiredPaths) {
      const value = this.getStateData(state, path);
      if (value === undefined || value === null) {
        errors.push(`Required state data missing: ${path}`);
      }
    }

    return errors;
  }
}
