import { Logger } from '@vytches/ddd-logging';
import { Result } from '@vytches/ddd-utils';
import type { IProcessManagerState } from '../interfaces';
import type {
  IProcessInvariant,
  InvariantContext,
  InvariantResult,
  InvariantViolation,
} from './invariant.interface';
import { InvariantSeverity, InvariantTrigger } from './invariant.interface';

/**
 * Abstract base class for process invariants providing common functionality
 */
export abstract class BaseProcessInvariant<
  TState extends IProcessManagerState = IProcessManagerState,
> implements IProcessInvariant<TState>
{
  protected readonly logger = Logger.forContext(this.constructor.name);

  constructor(
    protected readonly id: string,
    protected readonly description: string,
    protected readonly severity: InvariantSeverity = InvariantSeverity.ERROR,
    protected readonly triggers: InvariantTrigger[] = Object.values(InvariantTrigger),
    protected readonly priority = 100
  ) {}

  /**
   * Template method for invariant validation with logging and error handling
   */
  async validate(
    state: TState,
    context: InvariantContext
  ): Promise<Result<InvariantResult, Error>> {
    const startTime = Date.now();

    try {
      // Check for null state early
      if (!state) {
        throw new Error('State is required for invariant validation');
      }

      this.logger.debug('Validating invariant', {
        invariantId: this.id,
        description: this.description,
        trigger: context.triggeringOperation,
        processManagerId: context.processContext.correlationId,
        currentStep: state.currentStep,
      });

      // Check if invariant should be validated for this context
      if (!this.shouldValidate(state, context)) {
        const result: InvariantResult = {
          isValid: true,
          violations: [],
          evaluationTimeMs: Date.now() - startTime,
          metadata: { skipped: true, reason: 'Invariant not applicable to this context' },
        };

        this.logValidationResult(result, context);
        return Result.ok(result);
      }

      // Perform the actual validation
      const violations = await this.validateInvariant(state, context);
      const evaluationTime = Date.now() - startTime;

      // Apply auto-corrections if enabled and supported
      let correctedState: TState | undefined;
      let stateModified = false;

      if (violations.length > 0 && this.supportsAutoCorrection()) {
        const correctionResult = this.attemptAutoCorrection(state, violations);
        if (correctionResult.corrected && correctionResult.correctedState) {
          correctedState = correctionResult.correctedState;
          stateModified = true;

          // Re-validate after correction to ensure it worked
          const revalidationViolations = await this.validateInvariant(correctedState, context);

          // Update violations list (should be empty or reduced after correction)
          violations.splice(0, violations.length, ...revalidationViolations);
        }
      }

      const result: InvariantResult = {
        isValid: violations.length === 0,
        violations,
        evaluationTimeMs: evaluationTime,
        stateModified,
        ...(correctedState && { correctedState }),
        metadata: {
          invariantId: this.id,
          severity: this.severity,
          autoCorreectionAttempted: stateModified,
        },
      };

      this.logValidationResult(result, context);
      return Result.ok(result);
    } catch (error) {
      const evaluationTime = Date.now() - startTime;

      this.logger.error('Invariant validation failed', error as Error, {
        invariantId: this.id,
        trigger: context.triggeringOperation,
        processManagerId: context.processContext.correlationId,
        evaluationTimeMs: evaluationTime,
      });

      return Result.fail(error as Error);
    }
  }

  /**
   * Abstract method that concrete invariants must implement
   */
  protected abstract validateInvariant(
    state: TState,
    context: InvariantContext
  ): Promise<InvariantViolation[]>;

  getDescription(): string {
    return this.description;
  }

  getSeverity(): InvariantSeverity {
    return this.severity;
  }

  getTriggers(): InvariantTrigger[] {
    return [...this.triggers];
  }

  getPriority(): number {
    return this.priority;
  }

  getId(): string {
    return this.id;
  }

  /**
   * Default implementation - override in subclasses that support auto-correction
   */
  supportsAutoCorrection(): boolean {
    return false;
  }

  /**
   * Default implementation checks if trigger is in the triggers list
   * Subclasses can override for more sophisticated logic
   */
  shouldValidate(state: TState, context: InvariantContext): boolean {
    return this.triggers.includes(context.triggeringOperation);
  }

  /**
   * Helper method to create a violation
   */
  protected createViolation(
    violationId: string,
    description: string,
    options?: {
      severity?: InvariantSeverity;
      property?: string;
      expected?: unknown;
      actual?: unknown;
      context?: Record<string, unknown>;
      suggestions?: string[];
      canAutoCorrect?: boolean;
      autoCorrectFn?: (state: IProcessManagerState) => IProcessManagerState;
    }
  ): InvariantViolation {
    const violation: any = {
      violationId,
      description,
      severity: options?.severity || this.severity,
      canAutoCorrect: options?.canAutoCorrect || false,
    };

    if (options?.property) violation.property = options.property;
    if (options?.expected !== undefined) violation.expected = options.expected;
    if (options?.actual !== undefined) violation.actual = options.actual;
    if (options?.context) violation.context = options.context;
    if (options?.suggestions) violation.suggestions = options.suggestions;
    if (options?.autoCorrectFn) violation.autoCorrectFn = options.autoCorrectFn;

    return violation;
  }

  /**
   * Helper method to validate that a value is not null or undefined
   */
  protected validateRequired(
    value: unknown,
    fieldName: string,
    violationId?: string
  ): InvariantViolation | null {
    if (value === null || value === undefined) {
      return this.createViolation(
        violationId || `${this.id}_REQUIRED_FIELD_MISSING`,
        `Required field '${fieldName}' is missing or null`,
        {
          property: fieldName,
          expected: 'non-null value',
          actual: value,
          suggestions: [`Ensure ${fieldName} is properly initialized`],
        }
      );
    }
    return null;
  }

  /**
   * Helper method to validate that a string is not empty
   */
  protected validateNotEmpty(
    value: string | undefined | null,
    fieldName: string,
    violationId?: string
  ): InvariantViolation | null {
    if (!value || value.trim().length === 0) {
      return this.createViolation(
        violationId || `${this.id}_EMPTY_STRING`,
        `Field '${fieldName}' cannot be empty`,
        {
          property: fieldName,
          expected: 'non-empty string',
          actual: value,
          suggestions: [`Provide a valid value for ${fieldName}`],
        }
      );
    }
    return null;
  }

  /**
   * Helper method to validate numeric ranges
   */
  protected validateRange(
    value: number,
    min: number,
    max: number,
    fieldName: string,
    violationId?: string
  ): InvariantViolation | null {
    if (value < min || value > max) {
      return this.createViolation(
        violationId || `${this.id}_OUT_OF_RANGE`,
        `Field '${fieldName}' is out of valid range`,
        {
          property: fieldName,
          expected: `value between ${min} and ${max}`,
          actual: value,
          suggestions: [`Set ${fieldName} to a value between ${min} and ${max}`],
        }
      );
    }
    return null;
  }

  /**
   * Helper method to validate that a date is not in the future
   */
  protected validateNotFuture(
    date: Date,
    fieldName: string,
    violationId?: string
  ): InvariantViolation | null {
    const now = new Date();
    if (date > now) {
      return this.createViolation(
        violationId || `${this.id}_FUTURE_DATE`,
        `Field '${fieldName}' cannot be in the future`,
        {
          property: fieldName,
          expected: `date not later than ${now.toISOString()}`,
          actual: date.toISOString(),
          suggestions: [`Correct the timestamp for ${fieldName}`],
        }
      );
    }
    return null;
  }

  /**
   * Helper method to validate object structure
   */
  protected validateObjectStructure(
    obj: unknown,
    requiredFields: string[],
    fieldName: string,
    violationId?: string
  ): InvariantViolation[] {
    const violations: InvariantViolation[] = [];

    if (!obj || typeof obj !== 'object') {
      violations.push(
        this.createViolation(
          violationId || `${this.id}_INVALID_OBJECT`,
          `Field '${fieldName}' must be a valid object`,
          {
            property: fieldName,
            expected: 'object',
            actual: typeof obj,
            suggestions: [`Ensure ${fieldName} is properly initialized as an object`],
          }
        )
      );
      return violations;
    }

    const objectRecord = obj as Record<string, unknown>;
    for (const field of requiredFields) {
      if (!(field in objectRecord) || objectRecord[field] === undefined) {
        violations.push(
          this.createViolation(
            `${violationId || this.id}_MISSING_FIELD`,
            `Required field '${field}' is missing from '${fieldName}'`,
            {
              property: `${fieldName}.${field}`,
              expected: 'defined value',
              actual: undefined,
              suggestions: [`Add the required field '${field}' to ${fieldName}`],
            }
          )
        );
      }
    }

    return violations;
  }

  /**
   * Attempts to auto-correct violations if supported
   */
  private attemptAutoCorrection(
    state: TState,
    violations: InvariantViolation[]
  ): { corrected: boolean; correctedState?: TState } {
    let correctedState = { ...state };
    let anyCorrections = false;

    for (const violation of violations) {
      if (violation.canAutoCorrect && violation.autoCorrectFn) {
        try {
          correctedState = violation.autoCorrectFn(correctedState) as TState;
          anyCorrections = true;

          this.logger.debug('Auto-correction applied', {
            invariantId: this.id,
            violationId: violation.violationId,
            property: violation.property,
          });
        } catch (error) {
          this.logger.warn('Auto-correction failed', {
            invariantId: this.id,
            violationId: violation.violationId,
            error: (error as Error).message,
          });
        }
      }
    }

    return {
      corrected: anyCorrections,
      ...(anyCorrections && { correctedState }),
    };
  }

  /**
   * Logs the validation result for observability
   */
  private logValidationResult(result: InvariantResult, context: InvariantContext): void {
    const logLevel = result.isValid
      ? 'debug'
      : result.violations.some(v => v.severity === InvariantSeverity.CRITICAL)
        ? 'error'
        : result.violations.some(v => v.severity === InvariantSeverity.ERROR)
          ? 'warn'
          : 'debug';

    const logData = {
      invariantId: this.id,
      description: this.description,
      trigger: context.triggeringOperation,
      processManagerId: context.processContext.correlationId,
      isValid: result.isValid,
      violationCount: result.violations.length,
      evaluationTimeMs: result.evaluationTimeMs,
      stateModified: result.stateModified,
      autoCorrectionsApplied: result.stateModified,
      violations: result.violations.map(v => ({
        violationId: v.violationId,
        severity: v.severity,
        property: v.property,
      })),
    };

    if (logLevel === 'error') {
      this.logger.error('Invariant validation completed', undefined, logData);
    } else if (logLevel === 'warn') {
      this.logger.warn('Invariant validation completed', logData);
    } else {
      this.logger.debug('Invariant validation completed', logData);
    }
  }
}
