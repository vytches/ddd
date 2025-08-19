import { Result } from '@vytches/ddd-utils';
import { Logger } from '@vytches/ddd-logging';
import type { IProcessManagerState } from '../interfaces';
import { GuardOperation, GuardSeverity } from './guard.interface';
import type { IProcessGuard, ProcessGuardContext, GuardResult } from './guard.interface';

/**
 * Abstract base class for process guards providing common functionality
 */
export abstract class BaseProcessGuard<TState extends IProcessManagerState = IProcessManagerState>
  implements IProcessGuard<TState>
{
  protected readonly logger = Logger.forContext(this.constructor.name);

  constructor(
    protected readonly name: string,
    protected readonly priority = 100,
    protected readonly applicableOperations: GuardOperation[] = Object.values(GuardOperation)
  ) {}

  /**
   * Template method for guard execution with logging and error handling
   */
  async canExecute(context: ProcessGuardContext<TState>): Promise<Result<GuardResult, Error>> {
    const startTime = Date.now();

    try {
      this.logger.debug('Evaluating guard', {
        guardName: this.name,
        operation: context.operation,
        processManagerId: context.context.correlationId,
        currentStep: context.currentState.currentStep,
      });

      // Check if guard should evaluate for this context
      if (!this.shouldEvaluate(context)) {
        const result = this.createAllowedResult('Guard not applicable to this context');
        this.logGuardResult(result, Date.now() - startTime, context);
        return Result.ok(result);
      }

      // Perform the actual guard evaluation
      const result = await this.evaluate(context);

      this.logGuardResult(result, Date.now() - startTime, context);
      return Result.ok(result);
    } catch (error) {
      const evaluationTime = Date.now() - startTime;

      this.logger.error('Guard evaluation failed', error as Error, {
        guardName: this.name,
        operation: context?.operation,
        processManagerId: context?.context?.correlationId,
        evaluationTimeMs: evaluationTime,
      });

      return Result.fail(error as Error);
    }
  }

  /**
   * Abstract method that concrete guards must implement
   */
  protected abstract evaluate(context: ProcessGuardContext<TState>): Promise<GuardResult>;

  /**
   * Gets the name of this guard
   */
  getName(): string {
    return this.name;
  }

  /**
   * Gets the priority of this guard
   */
  getPriority(): number {
    return this.priority;
  }

  /**
   * Gets the operations this guard applies to
   */
  getApplicableOperations(): GuardOperation[] {
    return [...this.applicableOperations];
  }

  /**
   * Default implementation checks if operation is in applicable operations
   * Subclasses can override for more sophisticated logic
   */
  shouldEvaluate(context: ProcessGuardContext<TState>): boolean {
    return this.applicableOperations.includes(context.operation);
  }

  /**
   * Helper method to create an allowed result
   */
  protected createAllowedResult(reason?: string, details?: Record<string, unknown>): GuardResult {
    return {
      allowed: true,
      severity: GuardSeverity.WARNING,
      ...(reason && { reason }),
      ...(details && { details }),
    };
  }

  /**
   * Helper method to create a denied result
   */
  protected createDeniedResult(
    reason: string,
    severity: GuardSeverity = GuardSeverity.ERROR,
    code?: string,
    details?: Record<string, unknown>,
    suggestions?: string[]
  ): GuardResult {
    return {
      allowed: false,
      reason,
      severity,
      ...(code && { code }),
      ...(details && { details }),
      ...(suggestions && { suggestions }),
    };
  }

  /**
   * Helper method to validate guard context
   */
  protected validateContext(context: ProcessGuardContext<TState>): void {
    if (!context) {
      throw new Error('Guard context is required');
    }

    if (!context.currentState) {
      throw new Error('Current state is required in guard context');
    }

    if (!context.context) {
      throw new Error('Processing context is required in guard context');
    }

    if (!context.operation) {
      throw new Error('Operation is required in guard context');
    }
  }

  /**
   * Helper method to check if a state transition is valid
   */
  protected isValidStateTransition(
    fromStep: string,
    toStep: string,
    validTransitions: Record<string, string[]>
  ): boolean {
    const allowedNextSteps = validTransitions[fromStep];
    return allowedNextSteps ? allowedNextSteps.includes(toStep) : false;
  }

  /**
   * Helper method to check timeout conditions
   */
  protected isWithinTimeLimit(startTime: Date, currentTime: Date, limitMs: number): boolean {
    const elapsed = currentTime.getTime() - startTime.getTime();
    return elapsed <= limitMs;
  }

  /**
   * Helper method to check resource limits
   */
  protected isWithinResourceLimit(currentUsage: number, limit: number, threshold = 0.9): boolean {
    return currentUsage <= limit * threshold;
  }

  /**
   * Logs the guard result for observability
   */
  private logGuardResult(
    result: GuardResult,
    evaluationTimeMs: number,
    context: ProcessGuardContext<TState>
  ): void {
    const logLevel = result.allowed
      ? 'debug'
      : result.severity === GuardSeverity.CRITICAL
        ? 'error'
        : result.severity === GuardSeverity.ERROR
          ? 'warn'
          : 'debug';

    const logData = {
      guardName: this.name,
      operation: context.operation,
      processManagerId: context.context.correlationId,
      allowed: result.allowed,
      severity: result.severity,
      reason: result.reason,
      code: result.code,
      evaluationTimeMs,
      currentStep: context.currentState.currentStep,
      proposedStep: context.proposedState?.currentStep,
    };

    if (logLevel === 'error') {
      this.logger.error('Guard evaluation completed', undefined, logData);
    } else if (logLevel === 'warn') {
      this.logger.warn('Guard evaluation completed', logData);
    } else {
      this.logger.debug('Guard evaluation completed', logData);
    }
  }
}
