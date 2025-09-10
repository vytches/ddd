import { Result } from '@vytches/ddd-utils';
import { Logger } from '@vytches/ddd-logging';
import type { IProcessManagerState } from '../interfaces';
import { GuardSeverity } from './guard.interface';
import type {
  IProcessGuard,
  ProcessGuardContext,
  GuardResult,
  GuardConfiguration,
  GuardEvaluationResult,
  GuardOperation,
} from './guard.interface';

/**
 * Execution strategy for composite guard evaluation
 */
export enum GuardExecutionStrategy {
  /** Execute all guards regardless of failures */
  ALL = 'ALL',
  /** Stop on first failure */
  FAIL_FAST = 'FAIL_FAST',
  /** Execute critical guards first, then others */
  PRIORITY_BASED = 'PRIORITY_BASED',
  /** Execute only guards applicable to the operation */
  OPERATION_SPECIFIC = 'OPERATION_SPECIFIC',
}

/**
 * Configuration for composite guard behavior
 */
export interface CompositeGuardConfiguration extends GuardConfiguration {
  /**
   * Execution strategy for guard evaluation
   */
  executionStrategy: GuardExecutionStrategy;

  /**
   * Whether to run guards in parallel when possible
   */
  enableParallelExecution: boolean;

  /**
   * Maximum number of guards to run in parallel
   */
  maxParallelGuards: number;

  /**
   * Custom guard ordering function
   */
  customOrderingFn?: (
    guards: IProcessGuard<IProcessManagerState>[],
    context: ProcessGuardContext<IProcessManagerState>
  ) => IProcessGuard<IProcessManagerState>[];
}

/**
 * Default configuration for composite guard
 */
const DEFAULT_COMPOSITE_CONFIG: CompositeGuardConfiguration = {
  failFast: false,
  collectAllResults: true,
  timeoutMs: 5000,
  enableLogging: true,
  minimumBlockingSeverity: GuardSeverity.ERROR,
  executionStrategy: GuardExecutionStrategy.PRIORITY_BASED,
  enableParallelExecution: false,
  maxParallelGuards: 3,
};

/**
 * Composite guard that manages and orchestrates multiple guards
 */
export class CompositeGuard<TState extends IProcessManagerState = IProcessManagerState>
  implements IProcessGuard<TState>
{
  private readonly logger = Logger.forContext('CompositeGuard');
  private readonly guards = new Map<string, IProcessGuard<TState>>();
  private readonly config: CompositeGuardConfiguration;

  constructor(
    guards?: IProcessGuard<TState>[],
    config?: Partial<CompositeGuardConfiguration>,
    private readonly name = 'CompositeGuard',
    private readonly priority = 1000
  ) {
    this.config = { ...DEFAULT_COMPOSITE_CONFIG, ...config };

    if (guards) {
      this.addGuards(guards);
    }
  }

  /**
   * Adds a guard to the composite
   */
  addGuard(guard: IProcessGuard<TState>): void {
    if (this.guards.has(guard.getName())) {
      throw new Error(`Guard with name '${guard.getName()}' already exists`);
    }

    this.guards.set(guard.getName(), guard);

    this.logger.debug('Guard added to composite', {
      guardName: guard.getName(),
      priority: guard.getPriority(),
      applicableOperations: guard.getApplicableOperations(),
      totalGuards: this.guards.size,
    });
  }

  /**
   * Adds multiple guards to the composite
   */
  addGuards(guards: IProcessGuard<TState>[]): void {
    for (const guard of guards) {
      this.addGuard(guard);
    }
  }

  /**
   * Removes a guard from the composite
   */
  removeGuard(guardName: string): boolean {
    const removed = this.guards.delete(guardName);

    if (removed) {
      this.logger.debug('Guard removed from composite', {
        guardName,
        remainingGuards: this.guards.size,
      });
    }

    return removed;
  }

  /**
   * Gets a guard by name
   */
  getGuard(guardName: string): IProcessGuard<TState> | undefined {
    return this.guards.get(guardName);
  }

  /**
   * Gets all guards
   */
  getGuards(): IProcessGuard<TState>[] {
    return Array.from(this.guards.values());
  }

  /**
   * Executes all applicable guards
   */
  async canExecute(context: ProcessGuardContext<TState>): Promise<Result<GuardResult, Error>> {
    const startTime = Date.now();

    try {
      this.logger.debug('Starting composite guard evaluation', {
        operation: context.operation,
        processManagerId: context.context.correlationId,
        totalGuards: this.guards.size,
        executionStrategy: this.config.executionStrategy,
        enableParallelExecution: this.config.enableParallelExecution,
      });

      // Get applicable guards for this context
      const applicableGuards = this.getApplicableGuards(context);

      if (applicableGuards.length === 0) {
        // No applicable guards - allow by default with a specific message
        const result: GuardResult = {
          allowed: true,
          severity: GuardSeverity.WARNING,
          reason: 'No applicable guards for this operation',
          code: 'NO_GUARDS',
          details: {
            guardResults: [],
            totalEvaluationTimeMs: 0,
            guardsExecuted: 0,
            guardsFailed: 0,
          },
        };
        return Result.ok(result);
      }

      // Order guards based on strategy
      const orderedGuards = this.orderGuards(applicableGuards, context);

      // Execute guards based on strategy
      const evaluationResult = await this.executeGuards(orderedGuards, context);

      const totalTime = Date.now() - startTime;
      const compositeResult = this.createCompositeResult(
        evaluationResult.allowed,
        evaluationResult.guardResults,
        totalTime,
        evaluationResult.errors || []
      );

      this.logCompositeResult(compositeResult, context);

      return Result.ok(compositeResult);
    } catch (error) {
      const totalTime = Date.now() - startTime;

      this.logger.error('Composite guard evaluation failed', error as Error, {
        operation: context.operation,
        processManagerId: context.context.correlationId,
        evaluationTimeMs: totalTime,
      });

      return Result.fail(error as Error);
    }
  }

  getName(): string {
    return this.name;
  }

  getPriority(): number {
    return this.priority;
  }

  getApplicableOperations(): GuardOperation[] {
    // Return all operations that any child guard handles
    const allOperations = new Set<GuardOperation>();

    for (const guard of this.guards.values()) {
      guard.getApplicableOperations().forEach(op => allOperations.add(op));
    }

    return Array.from(allOperations);
  }

  shouldEvaluate(context: ProcessGuardContext<TState>): boolean {
    // Should evaluate if any child guard should evaluate
    return Array.from(this.guards.values()).some(
      guard => guard.shouldEvaluate && guard.shouldEvaluate(context)
    );
  }

  /**
   * Gets guards applicable to the current context
   */
  private getApplicableGuards(context: ProcessGuardContext<TState>): IProcessGuard<TState>[] {
    const applicable: IProcessGuard<TState>[] = [];

    for (const guard of this.guards.values()) {
      try {
        if (guard.shouldEvaluate ? guard.shouldEvaluate(context) : true) {
          if (guard.getApplicableOperations().includes(context.operation)) {
            applicable.push(guard);
          }
        }
      } catch (error) {
        this.logger.warn('Error checking guard applicability', {
          guardName: guard.getName(),
          error: (error as Error).message,
        });
      }
    }

    return applicable;
  }

  /**
   * Orders guards based on the execution strategy
   */
  private orderGuards(
    guards: IProcessGuard<TState>[],
    context: ProcessGuardContext<TState>
  ): IProcessGuard<TState>[] {
    // Use custom ordering function if provided
    if (this.config.customOrderingFn) {
      return this.config.customOrderingFn(guards, context);
    }

    switch (this.config.executionStrategy) {
      case GuardExecutionStrategy.PRIORITY_BASED:
        // Lower priority number = higher priority (priority 1 is highest)
        return guards.sort((a, b) => a.getPriority() - b.getPriority());

      case GuardExecutionStrategy.OPERATION_SPECIFIC:
        // For operation-specific, we could order by relevance to the operation
        return guards.sort((a, b) => {
          const aOps = a.getApplicableOperations();
          const bOps = b.getApplicableOperations();

          // Guards with fewer applicable operations are more specific
          if (aOps.length !== bOps.length) {
            return aOps.length - bOps.length;
          }

          // Fall back to priority (lower number = higher priority)
          return a.getPriority() - b.getPriority();
        });

      default:
        // ALL and FAIL_FAST use priority ordering (lower number = higher priority)
        return guards.sort((a, b) => a.getPriority() - b.getPriority());
    }
  }

  /**
   * Executes guards based on the configuration strategy
   */
  private async executeGuards(
    guards: IProcessGuard<TState>[],
    context: ProcessGuardContext<TState>
  ): Promise<GuardEvaluationResult> {
    if (this.config.enableParallelExecution && guards.length > 1) {
      return this.executeGuardsInParallel(guards, context);
    } else {
      return this.executeGuardsSequentially(guards, context);
    }
  }

  /**
   * Executes guards sequentially
   */
  private async executeGuardsSequentially(
    guards: IProcessGuard<TState>[],
    context: ProcessGuardContext<TState>
  ): Promise<GuardEvaluationResult> {
    const startTime = Date.now();
    const guardResults: GuardEvaluationResult['guardResults'] = [];
    const errors: GuardEvaluationResult['errors'] = [];
    const blockingIssues: GuardEvaluationResult['blockingIssues'] = [];
    let overallAllowed = true;

    for (const guard of guards) {
      const guardStartTime = Date.now();

      try {
        const result = await this.executeGuardWithTimeout(guard, context);
        const evaluationTime = Date.now() - guardStartTime;

        guardResults.push({
          guardName: guard.getName(),
          result,
          evaluationTimeMs: evaluationTime,
        });

        // Check if this result blocks the operation
        if (!result.allowed && result.severity >= this.config.minimumBlockingSeverity) {
          overallAllowed = false;
          blockingIssues.push({
            guardName: guard.getName(),
            reason: result.reason || 'Guard denied operation',
            severity: result.severity,
          });

          // If fail fast is enabled and this is a blocking failure, stop here
          if (this.config.failFast) {
            break;
          }
        }
      } catch (error) {
        const evaluationTime = Date.now() - guardStartTime;
        const errorMessage = (error as Error).message || 'Unknown error';

        errors.push({
          guardName: guard.getName(),
          error: error as Error,
        });

        // Create a failed result for timeout or other errors
        guardResults.push({
          guardName: guard.getName(),
          result: {
            allowed: false,
            severity: GuardSeverity.ERROR,
            reason: errorMessage,
            code: errorMessage.includes('timeout') ? 'GUARD_TIMEOUT' : 'GUARD_ERROR',
          },
          evaluationTimeMs: evaluationTime,
        });

        // Guard execution error is treated as blocking
        overallAllowed = false;
        blockingIssues.push({
          guardName: guard.getName(),
          reason: errorMessage,
          severity: GuardSeverity.ERROR,
        });

        if (this.config.failFast) {
          break;
        }
      }
    }

    const result: GuardEvaluationResult = {
      allowed: overallAllowed,
      guardResults,
      totalEvaluationTimeMs: Date.now() - startTime,
      blockingIssues,
    };

    if (errors.length > 0) {
      result.errors = errors;
    }

    return result;
  }

  /**
   * Executes guards in parallel (when safe to do so)
   */
  private async executeGuardsInParallel(
    guards: IProcessGuard<TState>[],
    context: ProcessGuardContext<TState>
  ): Promise<GuardEvaluationResult> {
    const startTime = Date.now();
    const guardResults: GuardEvaluationResult['guardResults'] = [];
    const errors: GuardEvaluationResult['errors'] = [];
    const blockingIssues: GuardEvaluationResult['blockingIssues'] = [];

    // Split guards into batches for parallel execution
    const batchSize = this.config.maxParallelGuards;
    const batches = this.chunkArray(guards, batchSize);

    for (const batch of batches) {
      const batchPromises = batch.map(async guard => {
        const guardStartTime = Date.now();

        try {
          const result = await this.executeGuardWithTimeout(guard, context);
          return {
            success: true,
            guardName: guard.getName(),
            result,
            evaluationTimeMs: Date.now() - guardStartTime,
          };
        } catch (error) {
          return {
            success: false,
            guardName: guard.getName(),
            error: error as Error,
            evaluationTimeMs: Date.now() - guardStartTime,
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);

      for (const batchResult of batchResults) {
        if (batchResult.success && batchResult.result) {
          guardResults.push({
            guardName: batchResult.guardName,
            result: batchResult.result,
            evaluationTimeMs: batchResult.evaluationTimeMs,
          });

          // Check if this result blocks the operation
          if (
            !batchResult.result.allowed &&
            batchResult.result.severity >= this.config.minimumBlockingSeverity
          ) {
            blockingIssues.push({
              guardName: batchResult.guardName,
              reason: batchResult.result.reason || 'Guard denied operation',
              severity: batchResult.result.severity,
            });
          }
        } else {
          errors.push({
            guardName: batchResult.guardName,
            error: batchResult.error || new Error('Unknown guard error'),
          });

          // Create a failed result for errors
          const errorMessage = batchResult.error?.message || 'Unknown error';
          guardResults.push({
            guardName: batchResult.guardName,
            result: {
              allowed: false,
              severity: GuardSeverity.ERROR,
              reason: errorMessage,
              code: errorMessage.includes('timeout') ? 'GUARD_TIMEOUT' : 'GUARD_ERROR',
            },
            evaluationTimeMs: batchResult.evaluationTimeMs,
          });

          blockingIssues.push({
            guardName: batchResult.guardName,
            reason: errorMessage,
            severity: GuardSeverity.ERROR,
          });
        }
      }

      // If fail fast and we have blocking issues, stop processing
      if (this.config.failFast && blockingIssues.length > 0) {
        break;
      }
    }

    const result: GuardEvaluationResult = {
      allowed: blockingIssues.length === 0,
      guardResults,
      totalEvaluationTimeMs: Date.now() - startTime,
      blockingIssues,
    };

    if (errors.length > 0) {
      result.errors = errors;
    }

    return result;
  }

  /**
   * Executes a single guard with timeout
   */
  private async executeGuardWithTimeout(
    guard: IProcessGuard<TState>,
    context: ProcessGuardContext<TState>
  ): Promise<GuardResult> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Guard '${guard.getName()}' timed out after ${this.config.timeoutMs}ms`));
      }, this.config.timeoutMs);

      guard
        .canExecute(context)
        .then(result => {
          clearTimeout(timeoutId);
          if (result.isSuccess) {
            // Validate the result value
            if (!result.value || typeof result.value.allowed !== 'boolean') {
              reject(
                new Error(`Guard '${guard.getName()}' returned malformed or invalid response`)
              );
            } else {
              resolve(result.value);
            }
          } else {
            reject(result.error);
          }
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  /**
   * Creates a composite result that summarizes all guard results
   */
  private createCompositeResult(
    allowed: boolean,
    guardResults: GuardEvaluationResult['guardResults'],
    totalTime: number,
    errors: GuardEvaluationResult['errors']
  ): GuardResult {
    const allReasons = guardResults
      .filter(gr => !gr.result.allowed && gr.result.reason)
      .map(gr => `${gr.guardName}: ${gr.result.reason}`);

    const allSuggestions = guardResults
      .filter(gr => gr.result.suggestions && gr.result.suggestions.length > 0)
      .flatMap(gr => gr.result.suggestions!);

    // Determine overall severity
    const severities = guardResults.filter(gr => !gr.result.allowed).map(gr => gr.result.severity);

    const overallSeverity = severities.includes(GuardSeverity.CRITICAL)
      ? GuardSeverity.CRITICAL
      : severities.includes(GuardSeverity.ERROR)
        ? GuardSeverity.ERROR
        : GuardSeverity.WARNING;

    const result: any = {
      allowed,
      severity: allowed ? GuardSeverity.WARNING : overallSeverity,
      details: {
        guardResults,
        totalEvaluationTimeMs: totalTime,
        guardsExecuted: guardResults.length,
        guardsFailed: guardResults.filter(gr => !gr.result.allowed).length,
        ...(errors && errors.length > 0 && { errors }),
      },
    };

    if (allReasons.length > 0) {
      result.reason = allReasons.join('; ');
    }

    if (!allowed) {
      result.code = 'COMPOSITE_GUARD_FAILED';
    }

    if (allSuggestions.length > 0) {
      result.suggestions = Array.from(new Set(allSuggestions));
    }

    return result;
  }

  /**
   * Logs the composite result
   */
  private logCompositeResult(result: GuardResult, context: ProcessGuardContext<TState>): void {
    const logLevel = result.allowed
      ? 'debug'
      : result.severity === GuardSeverity.CRITICAL
        ? 'error'
        : result.severity === GuardSeverity.ERROR
          ? 'warn'
          : 'debug';

    const logData = {
      operation: context.operation,
      processManagerId: context.context.correlationId,
      allowed: result.allowed,
      severity: result.severity,
      guardsExecuted: (result.details as any)?.guardsExecuted,
      guardsFailed: (result.details as any)?.guardsFailed,
      totalEvaluationTimeMs: (result.details as any)?.totalEvaluationTimeMs,
      executionStrategy: this.config.executionStrategy,
    };

    if (logLevel === 'error') {
      this.logger.error('Composite guard evaluation completed', undefined, logData);
    } else if (logLevel === 'warn') {
      this.logger.warn('Composite guard evaluation completed', logData);
    } else {
      this.logger.debug('Composite guard evaluation completed', logData);
    }
  }

  /**
   * Utility function to chunk an array into smaller arrays
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }
}
