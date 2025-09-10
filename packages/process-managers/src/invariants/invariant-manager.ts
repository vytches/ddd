import { Logger } from '@vytches/ddd-logging';
import { Result } from '@vytches/ddd-utils';
import type { IProcessManagerState } from '../interfaces';
import type {
  IProcessInvariant,
  InvariantConfiguration,
  InvariantContext,
  InvariantResult,
  InvariantValidationResult,
  InvariantViolation,
  InvariantViolationEvent,
} from './invariant.interface';
import { InvariantSeverity, InvariantTrigger } from './invariant.interface';

/**
 * Configuration for the invariant manager
 */
export interface InvariantManagerConfiguration extends InvariantConfiguration {
  /**
   * Whether to run invariants in parallel when possible
   */
  enableParallelValidation: boolean;

  /**
   * Maximum number of invariants to run in parallel
   */
  maxParallelInvariants: number;

  /**
   * Whether to auto-register built-in invariants
   */
  autoRegisterBuiltInInvariants: boolean;

  /**
   * Global priority overrides for specific invariants
   */
  globalPriorityOverrides?: Record<string, number>;

  /**
   * Trigger-specific configurations
   */
  triggerConfigs?: Record<InvariantTrigger, Partial<InvariantConfiguration>>;

  /**
   * Event handlers for invariant violations
   */
  violationEventHandlers?: Array<(event: InvariantViolationEvent) => void | Promise<void>>;

  /**
   * Whether to track performance metrics
   */
  enablePerformanceTracking: boolean;
}

/**
 * Performance metrics for invariant validation
 */
export interface InvariantPerformanceMetrics {
  invariantId: string;
  trigger: InvariantTrigger;
  validationCount: number;
  totalValidationTimeMs: number;
  averageValidationTimeMs: number;
  violationRate: number;
  lastValidationTime: Date;
  slowestValidationMs: number;
  fastestValidationMs: number;
}

/**
 * Default configuration for invariant manager
 */
const DEFAULT_INVARIANT_MANAGER_CONFIG: InvariantManagerConfiguration = {
  failFastOnCritical: true,
  collectAllViolations: true,
  maxValidationTimeMs: 10000,
  enableAutoCorrection: true,
  minimumSeverityLevel: InvariantSeverity.INFO,
  enableLogging: true,
  enableMetrics: true,
  perInvariantTimeoutMs: 2000,
  enableParallelValidation: false,
  maxParallelInvariants: 3,
  autoRegisterBuiltInInvariants: false,
  enablePerformanceTracking: true,
};

/**
 * Central manager for all process invariants
 * Provides registration, orchestration, and monitoring capabilities
 */
export class InvariantManager<TState extends IProcessManagerState = IProcessManagerState> {
  private readonly logger = Logger.forContext('InvariantManager');
  private readonly invariants = new Map<string, IProcessInvariant<TState>>();
  private readonly triggerInvariants = new Map<InvariantTrigger, Set<string>>();
  private readonly performanceMetrics = new Map<string, InvariantPerformanceMetrics>();
  private readonly config: InvariantManagerConfiguration;

  constructor(config?: Partial<InvariantManagerConfiguration>) {
    this.config = { ...DEFAULT_INVARIANT_MANAGER_CONFIG, ...config };

    this.logger.info('Invariant manager initialized', {
      configuration: {
        enableParallelValidation: this.config.enableParallelValidation,
        maxParallelInvariants: this.config.maxParallelInvariants,
        enableAutoCorrection: this.config.enableAutoCorrection,
        maxValidationTimeMs: this.config.maxValidationTimeMs,
        minimumSeverityLevel: this.config.minimumSeverityLevel,
      },
    });
  }

  /**
   * Registers an invariant with the manager
   */
  registerInvariant(
    invariant: IProcessInvariant<TState>,
    options?: {
      priorityOverride?: number;
      triggerOverrides?: InvariantTrigger[];
    }
  ): void {
    const invariantId = invariant.getId();

    if (this.invariants.has(invariantId)) {
      throw new Error(`Invariant with ID '${invariantId}' is already registered`);
    }

    // Apply priority override if specified
    if (options?.priorityOverride || this.config.globalPriorityOverrides?.[invariantId]) {
      const newPriority =
        options?.priorityOverride ?? this.config.globalPriorityOverrides![invariantId];
      // Create a wrapper that overrides the priority
      const wrappedInvariant = this.createPriorityWrapper(invariant, newPriority!);
      this.invariants.set(invariantId, wrappedInvariant);
    } else {
      this.invariants.set(invariantId, invariant);
    }

    // Register invariant for applicable triggers
    const triggers = options?.triggerOverrides || invariant.getTriggers();
    this.registerInvariantForTriggers(invariantId, triggers);

    // Initialize performance metrics
    if (this.config.enablePerformanceTracking) {
      this.initializePerformanceMetrics(invariantId);
    }

    this.logger.debug('Invariant registered', {
      invariantId,
      description: invariant.getDescription(),
      priority: invariant.getPriority(),
      triggers,
      totalInvariants: this.invariants.size,
    });
  }

  /**
   * Unregisters an invariant from the manager
   */
  unregisterInvariant(invariantId: string): boolean {
    const invariant = this.invariants.get(invariantId);
    if (!invariant) {
      return false;
    }

    // Remove from invariants map
    this.invariants.delete(invariantId);

    // Remove from trigger mappings
    for (const [trigger, invariantSet] of this.triggerInvariants.entries()) {
      invariantSet.delete(invariantId);
      if (invariantSet.size === 0) {
        this.triggerInvariants.delete(trigger);
      }
    }

    // Remove performance metrics
    this.performanceMetrics.delete(invariantId);

    this.logger.debug('Invariant unregistered', {
      invariantId,
      remainingInvariants: this.invariants.size,
    });

    return true;
  }

  /**
   * Validates all applicable invariants for a given state and context
   */
  async validateInvariants(
    state: TState,
    context: InvariantContext
  ): Promise<Result<InvariantValidationResult, Error>> {
    const startTime = Date.now();

    // Input validation - these should throw immediately for invalid inputs
    if (!state) {
      throw new Error('State is required for invariant validation');
    }

    if (!context) {
      throw new Error('Context is required for invariant validation');
    }

    if (!context.processContext) {
      throw new Error('Process context is required for invariant validation');
    }

    try {
      this.logger.debug('Starting invariant validation', {
        trigger: context.triggeringOperation,
        processManagerId: context.processContext?.correlationId,
        currentStep: state.currentStep,
      });

      // Get invariants applicable to this trigger
      const applicableInvariantIds =
        this.triggerInvariants.get(context.triggeringOperation) || new Set();
      const applicableInvariants = Array.from(applicableInvariantIds)
        .map(id => this.invariants.get(id))
        .filter((invariant): invariant is IProcessInvariant<TState> => invariant !== undefined)
        .filter(invariant => invariant.shouldValidate(state, context));

      if (applicableInvariants.length === 0) {
        const result: InvariantValidationResult = {
          isValid: true,
          invariantsValidated: 0,
          invariantResults: [],
          allViolations: [],
          criticalViolations: [],
          totalValidationTimeMs: Date.now() - startTime,
          autoCorrectionsApplied: false,
        };

        this.logger.debug('No applicable invariants found', {
          trigger: context.triggeringOperation,
          processManagerId: context.processContext?.correlationId,
        });

        return Result.ok(result);
      }

      // Get trigger-specific config
      const triggerConfig = this.getTriggerConfig(context.triggeringOperation);

      // Execute invariants
      const validationResult = await this.executeInvariants(
        applicableInvariants,
        state,
        context,
        triggerConfig
      );

      // Update performance metrics
      if (this.config.enablePerformanceTracking) {
        this.updatePerformanceMetrics(validationResult, context.triggeringOperation);
      }

      // Emit violation events
      if (validationResult.allViolations.length > 0) {
        await this.emitViolationEvents(validationResult, state, context);
      }

      this.logger.debug('Invariant validation completed', {
        trigger: context.triggeringOperation,
        processManagerId: context.processContext?.correlationId,
        isValid: validationResult.isValid,
        invariantsValidated: validationResult.invariantsValidated,
        totalViolations: validationResult.allViolations.length,
        criticalViolations: validationResult.criticalViolations.length,
        autoCorrectionsApplied: validationResult.autoCorrectionsApplied,
        totalValidationTimeMs: validationResult.totalValidationTimeMs,
      });

      return Result.ok(validationResult);
    } catch (error) {
      const totalTime = Date.now() - startTime;

      this.logger.error('Invariant validation failed', error as Error, {
        trigger: context.triggeringOperation,
        processManagerId: context.processContext?.correlationId,
        validationTimeMs: totalTime,
      });

      return Result.fail(error as Error);
    }
  }

  /**
   * Gets all registered invariants
   */
  getInvariants(): Map<string, IProcessInvariant<TState>> {
    return new Map(this.invariants);
  }

  /**
   * Gets a specific invariant by ID
   */
  getInvariant(invariantId: string): IProcessInvariant<TState> | undefined {
    return this.invariants.get(invariantId);
  }

  /**
   * Checks if an invariant is registered
   */
  hasInvariant(invariantId: string): boolean {
    return this.invariants.has(invariantId);
  }

  /**
   * Gets invariants for a specific trigger
   */
  getInvariantsForTrigger(trigger: InvariantTrigger): IProcessInvariant<TState>[] {
    const invariantIds = this.triggerInvariants.get(trigger) || new Set();
    return Array.from(invariantIds)
      .map(id => this.invariants.get(id))
      .filter((invariant): invariant is IProcessInvariant<TState> => invariant !== undefined);
  }

  /**
   * Gets invariants by trigger (alias for compatibility)
   */
  getInvariantsByTrigger(trigger: InvariantTrigger): IProcessInvariant<TState>[] {
    return this.getInvariantsForTrigger(trigger);
  }

  /**
   * Gets performance metrics for all invariants
   */
  getPerformanceMetrics(): Map<string, InvariantPerformanceMetrics> {
    return new Map(this.performanceMetrics);
  }

  /**
   * Gets performance metrics for a specific invariant
   */
  getInvariantPerformanceMetrics(invariantId: string): InvariantPerformanceMetrics | undefined {
    return this.performanceMetrics.get(invariantId);
  }

  /**
   * Resets performance metrics for all invariants
   */
  resetPerformanceMetrics(): void {
    this.performanceMetrics.clear();
    this.logger.info('Performance metrics reset');
  }

  /**
   * Gets statistics about registered invariants
   */
  getStatistics(): {
    totalInvariants: number;
    invariantsByTrigger: Record<InvariantTrigger, number>;
    averageInvariantsPerTrigger: number;
    totalValidations: number;
    averageExecutionTimeMs: number;
    overallViolationRate: number;
    invariantMetrics: Map<string, InvariantPerformanceMetrics>;
  } {
    const invariantsByTrigger: Record<InvariantTrigger, number> = {} as any;
    let totalValidations = 0;
    let totalValidationTime = 0;
    let totalViolations = 0;

    for (const [trigger, invariantSet] of this.triggerInvariants.entries()) {
      invariantsByTrigger[trigger] = invariantSet.size;
    }

    for (const metrics of this.performanceMetrics.values()) {
      totalValidations += metrics.validationCount;
      totalValidationTime += metrics.totalValidationTimeMs;
      totalViolations += Math.round(metrics.violationRate * metrics.validationCount);
    }

    const triggerCount = this.triggerInvariants.size || 1;
    const averageInvariantsPerTrigger = this.invariants.size / triggerCount;
    const averageExecutionTimeMs =
      totalValidations > 0 ? totalValidationTime / totalValidations : 0;
    const overallViolationRate = totalValidations > 0 ? totalViolations / totalValidations : 0;

    return {
      totalInvariants: this.invariants.size,
      invariantsByTrigger,
      averageInvariantsPerTrigger,
      totalValidations,
      averageExecutionTimeMs,
      overallViolationRate,
      invariantMetrics: new Map(this.performanceMetrics),
    };
  }

  /**
   * Validates the current invariant configuration
   */
  validateConfiguration(): {
    isValid: boolean;
    issues: string[];
    warnings: string[];
  } {
    const issues: string[] = [];
    const warnings: string[] = [];

    // Check for invalid invariant IDs
    for (const [id, invariant] of this.invariants.entries()) {
      if (!id || id.trim() === '') {
        issues.push('Invariant with empty or invalid ID detected');
      }
    }

    // Check for duplicate priorities
    const priorityMap = new Map<number, string[]>();
    for (const [id, invariant] of this.invariants.entries()) {
      const priority = invariant.getPriority();
      if (!priorityMap.has(priority)) {
        priorityMap.set(priority, []);
      }
      priorityMap.get(priority)!.push(id);
    }

    for (const [priority, invariantIds] of priorityMap.entries()) {
      if (invariantIds.length > 1) {
        issues.push(
          `Multiple invariants have the same priority ${priority}: ${invariantIds.join(', ')}`
        );
      }
    }

    // Only check for triggers without invariants if manager has invariants registered
    if (this.invariants.size > 0) {
      const registeredTriggers = Array.from(this.triggerInvariants.keys());
      if (registeredTriggers.length < Object.values(InvariantTrigger).length / 2) {
        // Only warn if less than half of available triggers are covered
        const uncoveredTriggers = Object.values(InvariantTrigger).filter(
          trigger => !this.triggerInvariants.has(trigger)
        );
        if (uncoveredTriggers.length === Object.values(InvariantTrigger).length) {
          warnings.push('No invariants registered for any triggers');
        }
      }
    }

    // Check timeout configurations
    if (this.config.perInvariantTimeoutMs > this.config.maxValidationTimeMs) {
      issues.push(
        `Per-invariant timeout (${this.config.perInvariantTimeoutMs}ms) exceeds max validation time (${this.config.maxValidationTimeMs}ms)`
      );
    }

    return {
      isValid: issues.length === 0,
      issues,
      warnings,
    };
  }

  /**
   * Executes invariants based on configuration
   */
  private async executeInvariants(
    invariants: IProcessInvariant<TState>[],
    state: TState,
    context: InvariantContext,
    triggerConfig: Partial<InvariantConfiguration>
  ): Promise<InvariantValidationResult> {
    const startTime = Date.now();

    // Sort invariants by priority (lower priority number = higher priority, execute first)
    const sortedInvariants = [...invariants].sort((a, b) => a.getPriority() - b.getPriority());

    if (this.config.enableParallelValidation && sortedInvariants.length > 1) {
      return this.executeInvariantsInParallel(sortedInvariants, state, context, triggerConfig);
    } else {
      return this.executeInvariantsSequentially(sortedInvariants, state, context, triggerConfig);
    }
  }

  /**
   * Executes invariants sequentially
   */
  private async executeInvariantsSequentially(
    invariants: IProcessInvariant<TState>[],
    state: TState,
    context: InvariantContext,
    triggerConfig: Partial<InvariantConfiguration>
  ): Promise<InvariantValidationResult> {
    const startTime = Date.now();
    const invariantResults: InvariantValidationResult['invariantResults'] = [];
    const failedInvariants: InvariantValidationResult['failedInvariants'] = [];
    const allViolations: InvariantViolation[] = [];
    let currentState = state;
    let autoCorrectionsApplied = false;

    const config = { ...this.config, ...triggerConfig };

    for (const invariant of invariants) {
      const invariantStartTime = Date.now();

      try {
        const result = await this.executeInvariantWithTimeout(
          invariant,
          currentState,
          context,
          config
        );
        const evaluationTime = Date.now() - invariantStartTime;

        invariantResults.push({
          invariantId: invariant.getId(),
          description: invariant.getDescription(),
          result,
        });

        // Collect violations that meet the minimum severity level
        const severityLevels = {
          [InvariantSeverity.INFO]: 0,
          [InvariantSeverity.WARNING]: 1,
          [InvariantSeverity.ERROR]: 2,
          [InvariantSeverity.CRITICAL]: 3,
        };
        const significantViolations = result.violations.filter(
          v => severityLevels[v.severity] >= severityLevels[config.minimumSeverityLevel]
        );
        allViolations.push(...significantViolations);

        // Apply auto-corrections if enabled and result indicates corrections were applied
        if (
          config.enableAutoCorrection &&
          (result as any).autoCorrectionsApplied &&
          (result as any).finalState
        ) {
          // Merge the corrections with the current state, carefully handling nested objects
          const finalState = (result as any).finalState;

          // Debug logging to understand the merging process
          this.logger.debug('Applying auto-correction', {
            invariantId: invariant.getId(),
            currentStateStepData: currentState.stepData,
            finalStateStepData: finalState.stepData,
            autoCorrectionsApplied: (result as any).autoCorrectionsApplied,
          });

          currentState = {
            ...currentState,
            ...finalState,
            // Special handling for stepData to merge nested properties
            ...(finalState.stepData &&
              currentState.stepData && {
                stepData: {
                  ...currentState.stepData,
                  ...finalState.stepData,
                },
              }),
            ...(finalState.stepData &&
              !currentState.stepData && {
                stepData: finalState.stepData,
              }),
          } as TState;
          autoCorrectionsApplied = true;

          this.logger.debug('Auto-correction applied', {
            invariantId: invariant.getId(),
            mergedStepData: currentState.stepData,
            overallAutoCorrectionsApplied: autoCorrectionsApplied,
          });
        }

        // Check for critical violations that should stop validation
        const criticalViolations = result.violations.filter(
          v => v.severity === InvariantSeverity.CRITICAL
        );

        if (config.failFastOnCritical && criticalViolations.length > 0) {
          this.logger.warn('Stopping validation due to critical violations', {
            invariantId: invariant.getId(),
            criticalViolations: criticalViolations.length,
          });
          break;
        }
      } catch (error) {
        const evaluationTime = Date.now() - invariantStartTime;

        failedInvariants.push({
          invariantId: invariant.getId(),
          error: error as Error,
        });

        this.logger.error('Invariant execution failed', error as Error, {
          invariantId: invariant.getId(),
          evaluationTimeMs: evaluationTime,
        });

        // If fail fast is enabled for critical issues, treat execution errors as critical
        if (config.failFastOnCritical) {
          break;
        }
      }
    }

    const criticalViolations = allViolations.filter(v => v.severity === InvariantSeverity.CRITICAL);

    return {
      isValid: allViolations.length === 0 && (!failedInvariants || failedInvariants.length === 0),
      invariantsValidated: invariantResults.length,
      invariantResults,
      allViolations,
      criticalViolations,
      totalValidationTimeMs: Date.now() - startTime,
      ...(failedInvariants.length > 0 && { failedInvariants }),
      ...(autoCorrectionsApplied && { finalState: currentState }),
      autoCorrectionsApplied,
    };
  }

  /**
   * Executes invariants in parallel (when safe to do so)
   */
  private async executeInvariantsInParallel(
    invariants: IProcessInvariant<TState>[],
    state: TState,
    context: InvariantContext,
    triggerConfig: Partial<InvariantConfiguration>
  ): Promise<InvariantValidationResult> {
    const startTime = Date.now();
    const config = { ...this.config, ...triggerConfig };

    // Split invariants into batches for parallel execution
    const batchSize = this.config.maxParallelInvariants;
    const batches = this.chunkArray(invariants, batchSize);

    const invariantResults: InvariantValidationResult['invariantResults'] = [];
    const failedInvariants: InvariantValidationResult['failedInvariants'] = [];
    const allViolations: InvariantViolation[] = [];
    let autoCorrectionsApplied = false;
    let currentState = state;

    for (const batch of batches) {
      const batchPromises = batch.map(async invariant => {
        const invariantStartTime = Date.now();

        try {
          const result = await this.executeInvariantWithTimeout(invariant, state, context, config);
          return {
            success: true,
            invariantId: invariant.getId(),
            description: invariant.getDescription(),
            result,
            evaluationTimeMs: Date.now() - invariantStartTime,
          };
        } catch (error) {
          return {
            success: false,
            invariantId: invariant.getId(),
            error: error as Error,
            evaluationTimeMs: Date.now() - invariantStartTime,
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);

      // Collect auto-corrections from this batch
      const batchCorrections: any[] = [];

      for (const batchResult of batchResults) {
        if (batchResult.success && batchResult.result && batchResult.description) {
          invariantResults.push({
            invariantId: batchResult.invariantId,
            description: batchResult.description,
            result: batchResult.result,
          });

          // Collect violations that meet the minimum severity level
          const significantViolations = batchResult.result.violations.filter(
            v => v.severity >= config.minimumSeverityLevel
          );
          allViolations.push(...significantViolations);

          // Collect auto-corrections if enabled and available
          if (
            config.enableAutoCorrection &&
            (batchResult.result as any).autoCorrectionsApplied &&
            (batchResult.result as any).finalState
          ) {
            batchCorrections.push({
              invariantId: batchResult.invariantId,
              finalState: (batchResult.result as any).finalState,
            });
          }
        } else {
          failedInvariants.push({
            invariantId: batchResult.invariantId,
            error: batchResult.error || new Error('Unknown invariant error'),
          });
        }
      }

      // Merge auto-corrections from this batch (parallel correction merging)
      if (config.enableAutoCorrection && batchCorrections.length > 0) {
        // Start with base state and accumulate corrections
        let mergedStepData = {};

        for (const correction of batchCorrections) {
          const finalState = correction.finalState;

          // Merge the finalState with current state, but handle stepData specially
          currentState = {
            ...currentState,
            ...finalState,
          } as TState;

          // For stepData, merge all corrections together (not with original state)
          if (finalState.stepData) {
            mergedStepData = {
              ...mergedStepData,
              ...finalState.stepData,
            };
          }

          autoCorrectionsApplied = true;

          this.logger.debug('Auto-correction applied in parallel mode', {
            invariantId: correction.invariantId,
            correctionStepData: finalState.stepData,
          });
        }

        // Apply the merged stepData corrections
        if (Object.keys(mergedStepData).length > 0) {
          currentState = {
            ...currentState,
            stepData: mergedStepData,
          } as TState;

          this.logger.debug('Merged auto-corrections applied', {
            mergedStepData,
          });
        }
      }

      // Check for critical violations that should stop validation
      const criticalViolations = allViolations.filter(
        v => v.severity === InvariantSeverity.CRITICAL
      );

      if (config.failFastOnCritical && criticalViolations.length > 0) {
        this.logger.warn('Stopping validation due to critical violations', {
          criticalViolations: criticalViolations.length,
        });
        break;
      }
    }

    const criticalViolations = allViolations.filter(v => v.severity === InvariantSeverity.CRITICAL);

    return {
      isValid: allViolations.length === 0 && failedInvariants.length === 0,
      invariantsValidated: invariantResults.length,
      invariantResults,
      allViolations,
      criticalViolations,
      totalValidationTimeMs: Date.now() - startTime,
      ...(failedInvariants.length > 0 && { failedInvariants }),
      ...(autoCorrectionsApplied && { finalState: currentState }),
      autoCorrectionsApplied,
    };
  }

  /**
   * Executes a single invariant with timeout
   */
  private async executeInvariantWithTimeout(
    invariant: IProcessInvariant<TState>,
    state: TState,
    context: InvariantContext,
    config: InvariantConfiguration
  ): Promise<InvariantResult> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(
          new Error(
            `Invariant '${invariant.getId()}' timed out after ${config.perInvariantTimeoutMs}ms`
          )
        );
      }, config.perInvariantTimeoutMs);

      invariant
        .validate(state, context)
        .then(result => {
          clearTimeout(timeoutId);
          if (result.isSuccess) {
            // Handle malformed results gracefully
            if (!result.value || typeof result.value !== 'object') {
              reject(new Error('Invariant returned malformed result'));
              return;
            }
            resolve(result.value);
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
   * Registers an invariant for specific triggers
   */
  private registerInvariantForTriggers(invariantId: string, triggers: InvariantTrigger[]): void {
    for (const trigger of triggers) {
      if (!this.triggerInvariants.has(trigger)) {
        this.triggerInvariants.set(trigger, new Set());
      }
      this.triggerInvariants.get(trigger)!.add(invariantId);
    }
  }

  /**
   * Gets trigger-specific configuration
   */
  private getTriggerConfig(trigger: InvariantTrigger): Partial<InvariantConfiguration> {
    return this.config.triggerConfigs?.[trigger] || {};
  }

  /**
   * Initializes performance metrics for an invariant
   */
  private initializePerformanceMetrics(invariantId: string): void {
    this.performanceMetrics.set(invariantId, {
      invariantId,
      trigger: InvariantTrigger.STATE_CHANGE, // Will be updated during execution
      validationCount: 0,
      totalValidationTimeMs: 0,
      averageValidationTimeMs: 0,
      violationRate: 0,
      lastValidationTime: new Date(),
      slowestValidationMs: 0,
      fastestValidationMs: Number.MAX_SAFE_INTEGER,
    });
  }

  /**
   * Updates performance metrics based on validation results
   */
  private updatePerformanceMetrics(
    validationResult: InvariantValidationResult,
    trigger: InvariantTrigger
  ): void {
    for (const invariantResult of validationResult.invariantResults) {
      const metrics = this.performanceMetrics.get(invariantResult.invariantId);
      if (!metrics) continue;

      metrics.trigger = trigger;
      metrics.validationCount++;
      metrics.totalValidationTimeMs += invariantResult.result.evaluationTimeMs;
      metrics.averageValidationTimeMs = metrics.totalValidationTimeMs / metrics.validationCount;
      metrics.lastValidationTime = new Date();

      if (invariantResult.result.evaluationTimeMs > metrics.slowestValidationMs) {
        metrics.slowestValidationMs = invariantResult.result.evaluationTimeMs;
      }

      if (invariantResult.result.evaluationTimeMs < metrics.fastestValidationMs) {
        metrics.fastestValidationMs = invariantResult.result.evaluationTimeMs;
      }

      // Update violation rate
      const hasViolations = invariantResult.result.violations.length > 0;
      const previousViolations = Math.round(metrics.violationRate * (metrics.validationCount - 1));
      const newViolations = previousViolations + (hasViolations ? 1 : 0);
      metrics.violationRate = newViolations / metrics.validationCount;
    }
  }

  /**
   * Emits violation events for registered handlers
   */
  private async emitViolationEvents(
    validationResult: InvariantValidationResult,
    state: TState,
    context: InvariantContext
  ): Promise<void> {
    if (!this.config.violationEventHandlers || this.config.violationEventHandlers.length === 0) {
      return;
    }

    const processManagerId = context.processContext?.correlationId;
    const timestamp = new Date();

    for (const invariantResult of validationResult.invariantResults) {
      for (const violation of invariantResult.result.violations) {
        const event: InvariantViolationEvent = {
          invariantId: invariantResult.invariantId,
          violation,
          processManagerId,
          state,
          timestamp,
          trigger: context.triggeringOperation,
        };

        for (const handler of this.config.violationEventHandlers) {
          try {
            await handler(event);
          } catch (error) {
            this.logger.error('Violation event handler failed', error as Error, {
              invariantId: invariantResult.invariantId,
              violationId: violation.violationId,
            });
          }
        }
      }
    }
  }

  /**
   * Creates a wrapper that overrides an invariant's priority
   */
  private createPriorityWrapper(
    invariant: IProcessInvariant<TState>,
    newPriority: number
  ): IProcessInvariant<TState> {
    return {
      ...invariant,
      getPriority: () => newPriority,
    };
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
