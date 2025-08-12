import type { IDomainEvent } from '@vytches/ddd-contracts';
import { Logger } from '@vytches/ddd-logging';
import type {
  ISaga,
  ISagaDefinition,
  ISagaExecutionContext,
  ISagaState,
  ISagaStep,
} from '../interfaces';
import { SagaStatus } from '../interfaces';

export abstract class SagaDefinition implements ISagaDefinition {
  protected readonly logger: ReturnType<typeof Logger.forContext>;
  private readonly _steps: ISagaStep[] = [];

  constructor(
    public readonly sagaType: string,
    public readonly displayName: string,
    public readonly description = '',
    public readonly startEvents: string[] = [],
    public readonly defaultTimeout: number | undefined = undefined,
    public readonly maxInstances: number | undefined = undefined
  ) {
    this.logger = Logger.forContext(`SagaDefinition:${sagaType}`);
  }

  /**
   * Steps that comprise this saga
   */
  get steps(): ISagaStep[] {
    return [...this._steps];
  }

  /**
   * Create new saga instance
   * @param event - Starting event
   * @param context - Execution context
   */
  async createInstance(event: IDomainEvent, context: ISagaExecutionContext): Promise<ISaga> {
    this.logger.info('Creating new saga instance', {
      sagaType: this.sagaType,
      eventType: event.eventType,
      correlationId: context.correlationId,
    });

    try {
      // Generate saga ID
      const sagaId = this.generateSagaId(event, context);

      // Get correlation data
      const correlationData = this.getCorrelationData(event);

      // Create initial saga state
      const initialState: ISagaState = {
        sagaId,
        sagaType: this.sagaType,
        status: SagaStatus.STARTED,
        currentStep: this.getInitialStep(event),
        stepData: {},
        compensationData: {},
        correlationId: context.correlationId,
        metadata: {
          ...correlationData,
          startingEvent: event.eventType,
          userId: context.userId,
          tenantId: context.tenantId,
          requestId: context.requestId,
          sessionId: context.sessionId,
          ...context.metadata,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        timeoutAt: this.defaultTimeout
          ? new Date(Date.now() + this.defaultTimeout)
          : (undefined as Date | undefined),
        version: 1,
      };

      // Create saga instance
      const saga = await this.createSagaInstance(initialState, event, context);

      this.logger.info('Saga instance created successfully', {
        sagaId,
        sagaType: this.sagaType,
        initialStep: initialState.currentStep,
        timeoutAt: initialState.timeoutAt,
      });

      return saga;
    } catch (error) {
      this.logger.error(
        'Failed to create saga instance',
        error instanceof Error ? error : undefined,
        {
          saga_type: this.sagaType,
          event_type: event.eventType,
          error_message: error instanceof Error ? error.message : String(error),
          error_stack: error instanceof Error ? error.stack : undefined,
        }
      );

      throw error;
    }
  }

  /**
   * Get correlation data from starting event
   * @param event - Starting event
   */
  getCorrelationData(event: IDomainEvent): Record<string, unknown> {
    // Default implementation - extracts common correlation properties
    const correlationData: Record<string, unknown> = {};

    // Try to extract common correlation properties
    const commonProperties = [
      'aggregateId',
      'entityId',
      'orderId',
      'customerId',
      'userId',
      'tenantId',
      'requestId',
      'sessionId',
    ];

    for (const property of commonProperties) {
      const value = this.extractEventProperty(event, property);
      if (value !== undefined) {
        correlationData[property] = value;
      }
    }

    // Allow custom correlation extraction
    const customCorrelation = this.extractCustomCorrelationData(event);
    return { ...correlationData, ...customCorrelation };
  }

  /**
   * Validate saga configuration
   */
  validate(): string[] {
    const errors: string[] = [];

    // Validate basic properties
    if (!this.sagaType || this.sagaType.trim() === '') {
      errors.push('Saga type is required');
    }

    if (!this.displayName || this.displayName.trim() === '') {
      errors.push('Display name is required');
    }

    if (this.startEvents.length === 0) {
      errors.push('At least one start event is required');
    }

    // Validate steps
    if (this._steps.length === 0) {
      errors.push('At least one step is required');
    }

    // Check for duplicate step names
    const stepNames = new Set<string>();
    for (const step of this._steps) {
      if (stepNames.has(step.name)) {
        errors.push(`Duplicate step name: ${step.name}`);
      }
      stepNames.add(step.name);
    }

    // Validate step event mappings
    const allTriggerEvents = new Set<string>();
    const allCompletionEvents = new Set<string>();

    for (const step of this._steps) {
      for (const eventType of step.triggerEvents) {
        allTriggerEvents.add(eventType);
      }
      for (const eventType of step.completionEvents) {
        allCompletionEvents.add(eventType);
      }
    }

    // Check that start events are handled
    for (const startEvent of this.startEvents) {
      if (!allTriggerEvents.has(startEvent) && !allCompletionEvents.has(startEvent)) {
        errors.push(`Start event ${startEvent} is not handled by any step`);
      }
    }

    // Allow custom validation
    const customErrors = this.validateCustomRules();
    errors.push(...customErrors);

    return errors;
  }

  /**
   * Add step to saga definition
   * @param step - Step to add
   */
  protected addStep(step: ISagaStep): void {
    this._steps.push(step);
    this.logger.debug('Step added to saga definition', {
      sagaType: this.sagaType,
      stepName: step.name,
      triggerEvents: step.triggerEvents,
      compensatable: step.compensatable,
    });
  }

  /**
   * Abstract method to create concrete saga instance
   * Must be implemented by concrete saga definition classes
   * @param initialState - Initial saga state
   * @param startingEvent - Event that started the saga
   * @param context - Execution context
   */
  protected abstract createSagaInstance(
    initialState: ISagaState,
    startingEvent: IDomainEvent,
    context: ISagaExecutionContext
  ): Promise<ISaga>;

  /**
   * Get initial step name for starting event
   * Can be overridden by concrete implementations
   * @param event - Starting event
   */
  protected getInitialStep(event: IDomainEvent): string {
    // Find first step that can handle the starting event
    for (const step of this._steps) {
      if (step.triggerEvents.includes(event.eventType)) {
        return step.name;
      }
    }

    // Default to first step if no specific handler found
    return this._steps.length > 0 ? this._steps[0]!.name : 'unknown';
  }

  /**
   * Generate unique saga ID
   * Can be overridden by concrete implementations
   * @param event - Starting event
   * @param context - Execution context
   */
  protected generateSagaId(event: IDomainEvent, context: ISagaExecutionContext): string {
    // Default implementation - use timestamp + random
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${this.sagaType}-${timestamp}-${random}`;
  }

  /**
   * Extract custom correlation data from event
   * Can be overridden by concrete implementations
   * @param event - Domain event
   */
  protected extractCustomCorrelationData(event: IDomainEvent): Record<string, unknown> {
    // Default implementation - return empty object
    return {};
  }

  /**
   * Custom validation rules
   * Can be overridden by concrete implementations
   */
  protected validateCustomRules(): string[] {
    // Default implementation - no custom rules
    return [];
  }

  /**
   * Helper method to extract property from event
   * @param event - Domain event
   * @param propertyPath - Property path (e.g., 'payload.orderId')
   */
  private extractEventProperty(event: IDomainEvent, propertyPath: string): unknown {
    try {
      const parts = propertyPath.split('.');
      let current: Record<string, unknown> = event as unknown as Record<string, unknown>;

      for (const part of parts) {
        if (current == null) return undefined;
        current = current[part] as Record<string, unknown>;
      }

      return current;
    } catch (error) {
      return undefined;
    }
  }
}
