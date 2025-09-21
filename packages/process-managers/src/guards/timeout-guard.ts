import type { IProcessManagerState } from '../interfaces';
import { BaseProcessGuard } from './base-guard';
import { GuardOperation, GuardSeverity } from './guard.interface';
import type { ProcessGuardContext, GuardResult } from './guard.interface';

/**
 * Configuration for timeout guard validation
 */
export interface TimeoutGuardConfiguration {
  /**
   * Global timeout for the entire process (in milliseconds)
   */
  globalTimeoutMs?: number;

  /**
   * Step-specific timeouts (in milliseconds)
   */
  stepTimeouts?: Record<string, number>;

  /**
   * Default timeout for steps not explicitly configured (in milliseconds)
   */
  defaultStepTimeoutMs?: number;

  /**
   * Operations that should have their own timeouts (in milliseconds)
   */
  operationTimeouts?: Record<GuardOperation, number>;

  /**
   * Buffer time before timeout to issue warnings (in milliseconds)
   */
  warningBufferMs?: number;

  /**
   * Whether to allow operations near timeout (within warning buffer)
   */
  allowOperationsNearTimeout?: boolean;

  /**
   * Custom timeout calculation function
   */
  customTimeoutCalculator?: (context: ProcessGuardContext<IProcessManagerState>) => {
    timeoutMs: number;
    reason: string;
  };
}

/**
 * Guard that validates timeout conditions for process operations
 */
export class TimeoutGuard<
  TState extends IProcessManagerState = IProcessManagerState,
> extends BaseProcessGuard<TState> {
  constructor(
    private readonly config: TimeoutGuardConfiguration,
    name = 'TimeoutGuard',
    priority = 150
  ) {
    super(name, priority, Object.values(GuardOperation));
  }

  protected async evaluate(context: ProcessGuardContext<TState>): Promise<GuardResult> {
    this.validateContext(context);

    const currentTime = new Date();

    // Check global timeout
    const globalTimeoutResult = this.checkGlobalTimeout(context, currentTime);
    if (!globalTimeoutResult.allowed) {
      return globalTimeoutResult;
    }

    // Check step timeout
    const stepTimeoutResult = this.checkStepTimeout(context, currentTime);
    if (!stepTimeoutResult.allowed) {
      return stepTimeoutResult;
    }

    // Check operation timeout
    const operationTimeoutResult = this.checkOperationTimeout(context, currentTime);
    if (!operationTimeoutResult.allowed) {
      return operationTimeoutResult;
    }

    // Check for warnings (near timeout)
    const warningResult = this.checkTimeoutWarnings(context, currentTime);
    if (warningResult.severity === GuardSeverity.WARNING) {
      return warningResult;
    }

    return this.createAllowedResult('All timeout conditions satisfied');
  }

  /**
   * Checks if the process has exceeded its global timeout
   */
  private checkGlobalTimeout(context: ProcessGuardContext<TState>, currentTime: Date): GuardResult {
    let globalTimeoutMs = this.config.globalTimeoutMs;

    // Use custom timeout calculator if provided
    if (this.config.customTimeoutCalculator) {
      const customResult = this.config.customTimeoutCalculator(context);
      globalTimeoutMs = customResult.timeoutMs;
    }

    if (!globalTimeoutMs) {
      return this.createAllowedResult('No global timeout configured');
    }

    const processStartTime = this.getProcessStartTime(context);
    const elapsedMs = currentTime.getTime() - processStartTime.getTime();

    if (elapsedMs > globalTimeoutMs) {
      return this.createDeniedResult(
        `Process has exceeded global timeout of ${globalTimeoutMs}ms`,
        GuardSeverity.CRITICAL,
        'GLOBAL_TIMEOUT_EXCEEDED',
        {
          globalTimeoutMs,
          elapsedMs,
          exceededBy: elapsedMs - globalTimeoutMs,
          processStartTime: processStartTime.toISOString(),
        },
        ['Consider increasing global timeout or optimizing process execution']
      );
    }

    return this.createAllowedResult('Global timeout not exceeded', {
      globalTimeoutMs,
      elapsedMs,
      remainingMs: globalTimeoutMs - elapsedMs,
    });
  }

  /**
   * Checks if the current step has exceeded its timeout
   */
  private checkStepTimeout(context: ProcessGuardContext<TState>, currentTime: Date): GuardResult {
    const currentStep = context.currentState.currentStep;
    const stepTimeoutMs = this.getStepTimeout(currentStep);

    if (!stepTimeoutMs) {
      return this.createAllowedResult('No step timeout configured');
    }

    const stepStartTime = this.getStepStartTime(context);
    const elapsedMs = currentTime.getTime() - stepStartTime.getTime();

    if (elapsedMs > stepTimeoutMs) {
      return this.createDeniedResult(
        `Step '${currentStep}' has exceeded timeout of ${stepTimeoutMs}ms`,
        GuardSeverity.ERROR,
        'STEP_TIMEOUT_EXCEEDED',
        {
          currentStep,
          stepTimeoutMs,
          elapsedMs,
          exceededBy: elapsedMs - stepTimeoutMs,
          stepStartTime: stepStartTime.toISOString(),
        },
        [
          'Consider increasing step timeout',
          'Review step implementation for performance issues',
          'Break down step into smaller sub-steps',
        ]
      );
    }

    return this.createAllowedResult('Step timeout not exceeded', {
      currentStep,
      stepTimeoutMs,
      elapsedMs,
      remainingMs: stepTimeoutMs - elapsedMs,
    });
  }

  /**
   * Checks operation-specific timeouts
   */
  private checkOperationTimeout(
    context: ProcessGuardContext<TState>,
    currentTime: Date
  ): GuardResult {
    const operationTimeoutMs = this.config.operationTimeouts?.[context.operation];

    if (!operationTimeoutMs) {
      return this.createAllowedResult('No operation timeout configured');
    }

    // For operation timeout, we use the context processedAt as start time
    const operationStartTime = context.context.processedAt;
    const elapsedMs = currentTime.getTime() - operationStartTime.getTime();

    if (elapsedMs > operationTimeoutMs) {
      return this.createDeniedResult(
        `Operation '${context.operation}' has exceeded timeout of ${operationTimeoutMs}ms`,
        GuardSeverity.ERROR,
        'OPERATION_TIMEOUT_EXCEEDED',
        {
          operation: context.operation,
          operationTimeoutMs,
          elapsedMs,
          exceededBy: elapsedMs - operationTimeoutMs,
          operationStartTime: operationStartTime.toISOString(),
        },
        ['Optimize operation implementation', 'Consider increasing operation timeout']
      );
    }

    return this.createAllowedResult('Operation timeout not exceeded', {
      operation: context.operation,
      operationTimeoutMs,
      elapsedMs,
      remainingMs: operationTimeoutMs - elapsedMs,
    });
  }

  /**
   * Checks for timeout warnings
   */
  private checkTimeoutWarnings(
    context: ProcessGuardContext<TState>,
    currentTime: Date
  ): GuardResult {
    const warningBufferMs = this.config.warningBufferMs || 30000; // Default 30 seconds
    const warnings: string[] = [];
    const details: Record<string, unknown> = {};

    // Check global timeout warning
    if (this.config.globalTimeoutMs) {
      const processStartTime = this.getProcessStartTime(context);
      const elapsedMs = currentTime.getTime() - processStartTime.getTime();
      const remainingMs = this.config.globalTimeoutMs - elapsedMs;

      if (remainingMs <= warningBufferMs && remainingMs > 0) {
        warnings.push(`Global timeout approaching (${remainingMs}ms remaining)`);
        details.globalTimeoutWarning = {
          remainingMs,
          warningBufferMs,
        };

        if (!this.config.allowOperationsNearTimeout) {
          return this.createDeniedResult(
            `Operation not allowed near global timeout (${remainingMs}ms remaining)`,
            GuardSeverity.WARNING,
            'NEAR_GLOBAL_TIMEOUT',
            details,
            ['Complete operation quickly', 'Consider extending timeout']
          );
        }
      }
    }

    // Check step timeout warning
    const currentStep = context.currentState.currentStep;
    const stepTimeoutMs = this.getStepTimeout(currentStep);

    if (stepTimeoutMs) {
      const stepStartTime = this.getStepStartTime(context);
      const elapsedMs = currentTime.getTime() - stepStartTime.getTime();
      const remainingMs = stepTimeoutMs - elapsedMs;

      if (remainingMs <= warningBufferMs && remainingMs > 0) {
        warnings.push(`Step '${currentStep}' timeout approaching (${remainingMs}ms remaining)`);
        details.stepTimeoutWarning = {
          currentStep,
          remainingMs,
          warningBufferMs,
        };

        if (!this.config.allowOperationsNearTimeout) {
          return this.createDeniedResult(
            `Operation not allowed near step timeout (${remainingMs}ms remaining)`,
            GuardSeverity.WARNING,
            'NEAR_STEP_TIMEOUT',
            details,
            ['Complete operation quickly', 'Consider extending step timeout']
          );
        }
      }
    }

    if (warnings.length > 0) {
      return {
        allowed: true,
        reason: warnings.join('; '),
        severity: GuardSeverity.WARNING,
        details,
        suggestions: ['Monitor remaining time closely', 'Prepare for potential timeout'],
      };
    }

    return this.createAllowedResult('No timeout warnings');
  }

  /**
   * Gets the timeout for a specific step
   */
  private getStepTimeout(step: string): number | undefined {
    return this.config.stepTimeouts?.[step] || this.config.defaultStepTimeoutMs;
  }

  /**
   * Gets the process start time (creation time)
   */
  private getProcessStartTime(context: ProcessGuardContext<TState>): Date {
    // Try to get from correlation data first
    const processStartTime = context.currentState.correlationData?.processStartTime as string;
    if (processStartTime) {
      return new Date(processStartTime);
    }

    // Fall back to last modified time (not ideal but better than nothing)
    return context.currentState.lastModified;
  }

  /**
   * Gets the current step start time
   */
  private getStepStartTime(context: ProcessGuardContext<TState>): Date {
    // Try to get from step data first
    const stepStartTime = context.currentState.stepData?.stepStartTime as string;
    if (stepStartTime) {
      return new Date(stepStartTime);
    }

    // Fall back to last modified time
    return context.currentState.lastModified;
  }

  /**
   * Override shouldEvaluate to skip evaluation for certain operations when appropriate
   */
  override shouldEvaluate(context: ProcessGuardContext<TState>): boolean {
    // Always evaluate timeout for timeout operations
    if (context.operation === GuardOperation.TIMEOUT) {
      return true;
    }

    // Skip evaluation if no timeouts are configured
    const hasTimeouts =
      this.config.globalTimeoutMs ||
      this.config.stepTimeouts ||
      this.config.defaultStepTimeoutMs ||
      this.config.operationTimeouts;

    return !!hasTimeouts;
  }
}
