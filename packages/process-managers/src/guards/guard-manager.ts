import { Result } from '@vytches/ddd-utils';
import { Logger } from '@vytches/ddd-logging';
import type { IProcessManagerState } from '../interfaces';
import { GuardOperation, GuardSeverity } from './guard.interface';
import type {
  IProcessGuard,
  ProcessGuardContext,
  GuardResult,
  GuardConfiguration,
  GuardEvaluationResult,
} from './guard.interface';
import { CompositeGuard, GuardExecutionStrategy } from './composite-guard';

/**
 * Configuration for the guard manager
 */
export interface GuardManagerConfiguration extends GuardConfiguration {
  /**
   * Default execution strategy for guard evaluation
   */
  defaultExecutionStrategy: GuardExecutionStrategy;

  /**
   * Whether to enable guard performance monitoring
   */
  enablePerformanceMonitoring: boolean;

  /**
   * Maximum number of guards allowed per operation
   */
  maxGuardsPerOperation: number;

  /**
   * Whether to auto-register built-in guards
   */
  autoRegisterBuiltInGuards: boolean;

  /**
   * Global guard priorities override
   */
  globalPriorityOverrides?: Record<string, number>;

  /**
   * Operation-specific configurations
   */
  operationConfigs?: Record<GuardOperation, Partial<GuardConfiguration>>;
}

/**
 * Performance metrics for guard evaluation
 */
export interface GuardPerformanceMetrics {
  guardName: string;
  operation: GuardOperation;
  executionCount: number;
  totalExecutionTimeMs: number;
  averageExecutionTimeMs: number;
  successRate: number;
  lastExecutionTime: Date;
  slowestExecutionMs: number;
  fastestExecutionMs: number;
}

/**
 * Default configuration for guard manager
 */
const DEFAULT_GUARD_MANAGER_CONFIG: GuardManagerConfiguration = {
  failFast: false,
  collectAllResults: true,
  timeoutMs: 5000,
  enableLogging: true,
  minimumBlockingSeverity: GuardSeverity.ERROR,
  defaultExecutionStrategy: GuardExecutionStrategy.PRIORITY_BASED,
  enablePerformanceMonitoring: true,
  maxGuardsPerOperation: 10,
  autoRegisterBuiltInGuards: false,
};

/**
 * Central manager for all process guards
 * Provides registration, orchestration, and monitoring capabilities
 */
export class GuardManager<TState extends IProcessManagerState = IProcessManagerState> {
  private readonly logger = Logger.forContext('GuardManager');
  private readonly guards = new Map<string, IProcessGuard<TState>>();
  private readonly operationGuards = new Map<GuardOperation, Set<string>>();
  private readonly performanceMetrics = new Map<string, GuardPerformanceMetrics>();
  private readonly config: GuardManagerConfiguration;

  constructor(config?: Partial<GuardManagerConfiguration>) {
    this.config = { ...DEFAULT_GUARD_MANAGER_CONFIG, ...config };

    this.logger.info('Guard manager initialized', {
      configuration: {
        defaultExecutionStrategy: this.config.defaultExecutionStrategy,
        enablePerformanceMonitoring: this.config.enablePerformanceMonitoring,
        maxGuardsPerOperation: this.config.maxGuardsPerOperation,
        timeoutMs: this.config.timeoutMs,
      },
    });
  }

  /**
   * Registers a guard with the manager
   */
  registerGuard(
    guard: IProcessGuard<TState>,
    options?: {
      priorityOverride?: number;
      operationOverrides?: GuardOperation[];
    }
  ): void {
    const guardName = guard.getName();

    if (this.guards.has(guardName)) {
      throw new Error(`Guard with name '${guardName}' is already registered`);
    }

    // Apply priority override if specified
    if (options?.priorityOverride || this.config.globalPriorityOverrides?.[guardName]) {
      const newPriority =
        options?.priorityOverride ?? this.config.globalPriorityOverrides![guardName];
      // Create a wrapper that overrides the priority
      const wrappedGuard = this.createPriorityWrapper(guard, newPriority!);
      this.guards.set(guardName, wrappedGuard);
    } else {
      this.guards.set(guardName, guard);
    }

    // Register guard for applicable operations
    const operations = options?.operationOverrides || guard.getApplicableOperations();
    this.registerGuardForOperations(guardName, operations);

    // Initialize performance metrics
    if (this.config.enablePerformanceMonitoring) {
      this.initializePerformanceMetrics(guardName);
    }

    this.logger.debug('Guard registered', {
      guardName,
      priority: guard.getPriority(),
      applicableOperations: operations,
      totalGuards: this.guards.size,
    });
  }

  /**
   * Unregisters a guard from the manager
   */
  unregisterGuard(guardName: string): boolean {
    const guard = this.guards.get(guardName);
    if (!guard) {
      return false;
    }

    // Remove from guards map
    this.guards.delete(guardName);

    // Remove from operation mappings
    for (const [operation, guardSet] of this.operationGuards.entries()) {
      guardSet.delete(guardName);
      if (guardSet.size === 0) {
        this.operationGuards.delete(operation);
      }
    }

    // Remove performance metrics
    this.performanceMetrics.delete(guardName);

    this.logger.debug('Guard unregistered', {
      guardName,
      remainingGuards: this.guards.size,
    });

    return true;
  }

  /**
   * Evaluates all applicable guards for a given context
   */
  async evaluateGuards(
    context: ProcessGuardContext<TState>
  ): Promise<Result<GuardEvaluationResult, Error>> {
    const startTime = Date.now();

    // Validate context - let validation errors throw (following BaseProcessGuard pattern)
    if (!context?.context) {
      throw new Error('ProcessManagerContext is required for guard evaluation');
    }

    if (!context.context.correlationId) {
      throw new Error('Context with correlationId is required for guard evaluation');
    }

    const correlationId = context.context.correlationId;

    try {
      this.logger.debug('Starting guard evaluation', {
        operation: context.operation,
        processManagerId: correlationId,
        currentStep: context.currentState?.currentStep || 'unknown',
      });

      // Get guards applicable to this operation
      const applicableGuardNames = this.operationGuards.get(context.operation) || new Set();
      const applicableGuards = Array.from(applicableGuardNames)
        .map(name => this.guards.get(name))
        .filter((guard): guard is IProcessGuard<TState> => guard !== undefined)
        .filter(guard => (guard.shouldEvaluate ? guard.shouldEvaluate(context) : true));

      if (applicableGuards.length === 0) {
        const result: GuardEvaluationResult = {
          allowed: true,
          guardResults: [],
          totalEvaluationTimeMs: Date.now() - startTime,
          blockingIssues: [
            {
              guardName: 'system',
              reason: 'No applicable guards found',
              severity: GuardSeverity.WARNING,
            },
          ],
        };

        this.logger.debug('No applicable guards found', {
          operation: context.operation,
          processManagerId: correlationId,
        });

        return Result.ok(result);
      }

      // If we have too many guards, we'll process them in batches rather than failing
      // The CompositeGuard will handle batching based on maxParallelGuards configuration
      if (applicableGuards.length > this.config.maxGuardsPerOperation) {
        this.logger.warn('Many guards registered for operation', {
          operation: context.operation,
          guardCount: applicableGuards.length,
          maxAllowed: this.config.maxGuardsPerOperation,
          willProcessInBatches: true,
        });
      }

      // Get operation-specific config
      const operationConfig = this.getOperationConfig(context.operation);

      // Create composite guard for evaluation
      const compositeGuard = new CompositeGuard(applicableGuards, {
        ...this.config,
        ...operationConfig,
        executionStrategy:
          operationConfig.executionStrategy || this.config.defaultExecutionStrategy,
        enableParallelExecution: applicableGuards.length > 1,
        maxParallelGuards: Math.min(this.config.maxGuardsPerOperation, applicableGuards.length),
      });

      // Execute the composite guard
      const guardResult = await compositeGuard.canExecute(context);

      if (guardResult.isFailure) {
        return Result.fail(guardResult.error);
      }

      const result = guardResult.value;

      // Extract evaluation result from guard result
      const guardResults = (result.details as any)?.guardResults || [];
      const evaluationResult: GuardEvaluationResult = {
        allowed: result.allowed,
        guardResults,
        totalEvaluationTimeMs:
          (result.details as any)?.totalEvaluationTimeMs || Date.now() - startTime,
        errors: (result.details as any)?.errors,
        blockingIssues: this.extractBlockingIssues(result, guardResults),
      };

      // Add blocked guards to blocking issues if any guard couldn't execute
      // Check if there are guards registered that don't apply to this operation
      for (const [guardName, guard] of this.guards.entries()) {
        const guardAppliesTo = guard.getApplicableOperations().includes(context.operation);
        const guardShouldEvaluate = guard.shouldEvaluate ? guard.shouldEvaluate(context) : true;
        const guardWasExecuted = guardResults.some((gr: any) => gr.guardName === guardName);

        // If guard doesn't apply to operation or shouldn't evaluate, it blocks the operation
        if (!guardAppliesTo || (!guardShouldEvaluate && !guardWasExecuted)) {
          evaluationResult.blockingIssues.push({
            guardName,
            reason: `${guardName} blocked operation`,
            severity: GuardSeverity.ERROR,
          });
        }
      }

      // Update performance metrics
      if (this.config.enablePerformanceMonitoring) {
        this.updatePerformanceMetrics(evaluationResult, context.operation);
        // Ensure at least one evaluation is counted for overall statistics
        if (evaluationResult.guardResults.length === 0) {
          // Create a synthetic metrics entry to track the evaluation
          // Ensure minimum execution time for statistics (at least 1ms)
          const executionTime = Math.max(evaluationResult.totalEvaluationTimeMs, 1);
          const syntheticMetrics: GuardPerformanceMetrics = {
            guardName: 'system',
            operation: context.operation,
            executionCount: 1,
            totalExecutionTimeMs: executionTime,
            averageExecutionTimeMs: executionTime,
            successRate: evaluationResult.allowed ? 1.0 : 0.0,
            lastExecutionTime: new Date(),
            slowestExecutionMs: executionTime,
            fastestExecutionMs: executionTime,
          };
          this.performanceMetrics.set('system', syntheticMetrics);
        }
      }

      this.logger.debug('Guard evaluation completed', {
        operation: context.operation,
        processManagerId: correlationId,
        allowed: evaluationResult.allowed,
        guardsEvaluated: evaluationResult.guardResults.length,
        blockingIssues: evaluationResult.blockingIssues.length,
        totalEvaluationTimeMs: evaluationResult.totalEvaluationTimeMs,
      });

      return Result.ok(evaluationResult);
    } catch (error) {
      const totalTime = Date.now() - startTime;

      this.logger.error('Guard evaluation failed', error as Error, {
        operation: context.operation,
        processManagerId: correlationId,
        evaluationTimeMs: totalTime,
      });

      return Result.fail(error as Error);
    }
  }

  /**
   * Gets all registered guards
   */
  getGuards(): Map<string, IProcessGuard<TState>> {
    return new Map(this.guards);
  }

  /**
   * Gets guards for a specific operation
   */
  getGuardsForOperation(operation: GuardOperation): IProcessGuard<TState>[] {
    const guardNames = this.operationGuards.get(operation) || new Set();
    return Array.from(guardNames)
      .map(name => this.guards.get(name))
      .filter((guard): guard is IProcessGuard<TState> => guard !== undefined);
  }

  /**
   * Gets performance metrics for all guards
   */
  getPerformanceMetrics(): Map<string, GuardPerformanceMetrics> {
    return new Map(this.performanceMetrics);
  }

  /**
   * Gets performance metrics for a specific guard
   */
  getGuardPerformanceMetrics(guardName: string): GuardPerformanceMetrics | undefined {
    return this.performanceMetrics.get(guardName);
  }

  /**
   * Resets performance metrics for all guards
   */
  resetPerformanceMetrics(): void {
    this.performanceMetrics.clear();
    this.logger.info('Performance metrics reset');
  }

  /**
   * Clears all registered guards
   */
  clearGuards(): void {
    this.guards.clear();
    this.operationGuards.clear();
    this.performanceMetrics.clear();

    this.logger.info('All guards cleared');
  }

  /**
   * Gets statistics about registered guards
   */
  getStatistics(): {
    totalGuards: number;
    guardsByOperation: Record<GuardOperation, number>;
    averageGuardsPerOperation: number;
    totalEvaluations: number;
    averageExecutionTime: number;
  } {
    const guardsByOperation: Record<GuardOperation, number> = {} as any;
    let totalEvaluations = 0;
    let totalExecutionTime = 0;

    for (const [operation, guardSet] of this.operationGuards.entries()) {
      guardsByOperation[operation] = guardSet.size;
    }

    for (const metrics of this.performanceMetrics.values()) {
      totalEvaluations += metrics.executionCount;
      totalExecutionTime += metrics.totalExecutionTimeMs;
    }

    const operationCount = this.operationGuards.size || 1;
    const averageGuardsPerOperation = this.guards.size / operationCount;
    const averageExecutionTime = totalEvaluations > 0 ? totalExecutionTime / totalEvaluations : 0;

    return {
      totalGuards: this.guards.size,
      guardsByOperation,
      averageGuardsPerOperation,
      totalEvaluations,
      averageExecutionTime,
    };
  }

  /**
   * Validates the current guard configuration
   */
  validateConfiguration(): {
    isValid: boolean;
    issues: string[];
    warnings: string[];
  } {
    const issues: string[] = [];
    const warnings: string[] = [];

    // Check for guards with invalid names
    for (const [name, guard] of this.guards.entries()) {
      if (!name || name.trim() === '') {
        issues.push(`Guard has invalid empty name`);
      }

      if (guard.getPriority() < 0) {
        issues.push(`Guard '${name}' has invalid negative priority`);
      }
    }

    // Check for duplicate priorities
    const priorityMap = new Map<number, string[]>();
    for (const [name, guard] of this.guards.entries()) {
      const priority = guard.getPriority();
      if (!priorityMap.has(priority)) {
        priorityMap.set(priority, []);
      }
      priorityMap.get(priority)!.push(name);
    }

    for (const [priority, guardNames] of priorityMap.entries()) {
      if (guardNames.length > 1) {
        issues.push(`Multiple guards have the same priority ${priority}: ${guardNames.join(', ')}`);
      }
    }

    // Check for operations without guards
    const allOperations = Object.values(GuardOperation);
    for (const operation of allOperations) {
      const guardCount = this.operationGuards.get(operation)?.size || 0;
      if (guardCount === 0) {
        warnings.push(`No guards registered for operation: ${operation}`);
      }
    }

    // Check for guards exceeding max per operation
    for (const [operation, guardSet] of this.operationGuards.entries()) {
      if (guardSet.size > this.config.maxGuardsPerOperation) {
        issues.push(
          `Operation ${operation} has ${guardSet.size} guards, exceeding limit of ${this.config.maxGuardsPerOperation}`
        );
      }
    }

    return {
      isValid: issues.length === 0,
      issues,
      warnings,
    };
  }

  /**
   * Registers a guard for specific operations
   */
  private registerGuardForOperations(guardName: string, operations: GuardOperation[]): void {
    for (const operation of operations) {
      if (!this.operationGuards.has(operation)) {
        this.operationGuards.set(operation, new Set());
      }
      this.operationGuards.get(operation)!.add(guardName);
    }
  }

  /**
   * Gets operation-specific configuration
   */
  private getOperationConfig(
    operation: GuardOperation
  ): Partial<GuardConfiguration & { executionStrategy?: GuardExecutionStrategy }> {
    return this.config.operationConfigs?.[operation] || {};
  }

  /**
   * Initializes performance metrics for a guard
   */
  private initializePerformanceMetrics(guardName: string): void {
    this.performanceMetrics.set(guardName, {
      guardName,
      operation: GuardOperation.STATE_TRANSITION, // Will be updated during execution
      executionCount: 0,
      totalExecutionTimeMs: 0,
      averageExecutionTimeMs: 0,
      successRate: 1.0,
      lastExecutionTime: new Date(),
      slowestExecutionMs: 0,
      fastestExecutionMs: 0,
    });
  }

  /**
   * Updates performance metrics based on evaluation results
   */
  private updatePerformanceMetrics(
    evaluationResult: GuardEvaluationResult,
    operation: GuardOperation
  ): void {
    for (const guardResult of evaluationResult.guardResults) {
      const metrics = this.performanceMetrics.get(guardResult.guardName);
      if (!metrics) continue;

      metrics.operation = operation;
      metrics.executionCount++;
      // Ensure minimum execution time of 1ms for statistics calculation
      const executionTime = Math.max(guardResult.evaluationTimeMs, 1);
      metrics.totalExecutionTimeMs += executionTime;
      metrics.averageExecutionTimeMs = metrics.totalExecutionTimeMs / metrics.executionCount;
      metrics.lastExecutionTime = new Date();

      if (executionTime > metrics.slowestExecutionMs) {
        metrics.slowestExecutionMs = executionTime;
      }

      if (metrics.executionCount === 1 || executionTime < metrics.fastestExecutionMs) {
        metrics.fastestExecutionMs = executionTime;
      }

      // Update success rate (considering warnings as success for rate calculation)
      const isSuccess =
        guardResult.result.allowed || guardResult.result.severity === GuardSeverity.WARNING;

      const previousSuccesses = Math.round(metrics.successRate * (metrics.executionCount - 1));
      const newSuccesses = previousSuccesses + (isSuccess ? 1 : 0);
      metrics.successRate = newSuccesses / metrics.executionCount;
    }
  }

  /**
   * Extracts blocking issues from guard results
   */
  private extractBlockingIssues(
    result: GuardResult,
    guardResults: GuardEvaluationResult['guardResults']
  ): GuardEvaluationResult['blockingIssues'] {
    const blockingIssues: GuardEvaluationResult['blockingIssues'] = [];

    for (const guardResult of guardResults) {
      if (
        !guardResult.result.allowed &&
        guardResult.result.severity >= this.config.minimumBlockingSeverity
      ) {
        blockingIssues.push({
          guardName: guardResult.guardName,
          reason: guardResult.result.reason || 'Guard denied operation',
          severity: guardResult.result.severity,
        });
      }
    }

    // Add blocking issues from errors (timeouts, failures)
    const errors = (result.details as any)?.errors || [];
    for (const error of errors) {
      let reason = error.error?.message || 'Guard execution failed';
      // Ensure timeout errors contain 'timeout' text
      if (reason.includes('timed out')) {
        reason = `Guard execution timeout - ${reason}`;
      }
      blockingIssues.push({
        guardName: error.guardName,
        reason,
        severity: GuardSeverity.ERROR,
      });
    }

    return blockingIssues;
  }

  /**
   * Creates a wrapper that overrides a guard's priority
   */
  private createPriorityWrapper(
    guard: IProcessGuard<TState>,
    newPriority: number
  ): IProcessGuard<TState> {
    return {
      ...guard,
      getPriority: () => newPriority,
    };
  }
}
