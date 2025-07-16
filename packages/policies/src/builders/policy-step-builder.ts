import type { IBusinessPolicy } from '../core/interfaces/business-policy.interface';
import type { IPolicyBuilder, IPolicyStepBuilder } from './policy-builder.interface';
import type { PolicyBuildStep } from './policy-builder';
import type { PolicyViolationSeverity } from '../core/models/policy-violation';

/**
 * @llm-summary PolicyStepBuilder class for policy step builder operations
 * @llm-domain Pattern
 * @llm-complexity Medium
 *
 * @description
 * PolicyStepBuilder class implementing domain pattern implementation for policy step builder operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new PolicyStepBuilder();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new PolicyStepBuilder());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class PolicyStepBuilder<T> implements IPolicyStepBuilder<T> {
  constructor(
    private readonly parentBuilder: IPolicyBuilder<T>,
    private readonly step: PolicyBuildStep<T>
  ) {}

  /**
   * Set error code for this step
   */
  public withCode(code: string): IPolicyStepBuilder<T> {
    this.step.errorCode = code;
    return this;
  }

  /**
   * Set error message for this step
   */
  public withMessage(message: string): IPolicyStepBuilder<T> {
    this.step.errorMessage = message;
    return this;
  }

  /**
   * Set severity level for this step
   */
  public withSeverity(severity: PolicyViolationSeverity): IPolicyStepBuilder<T> {
    this.step.severity = severity;
    return this;
  }

  /**
   * Set field name for field-specific validation
   */
  public withField(field: string): IPolicyStepBuilder<T> {
    this.step.field = field;
    return this;
  }

  /**
   * Add additional details to the violation
   */
  public withDetails(details: Record<string, unknown>): IPolicyStepBuilder<T> {
    this.step.details = { ...this.step.details, ...details };
    return this;
  }

  /**
   * Add another requirement with AND logic
   */
  public and(): IPolicyBuilder<T> {
    this.step.logicOperator = 'AND';
    return this.parentBuilder;
  }

  /**
   * Add another requirement with OR logic
   */
  public or(): IPolicyBuilder<T> {
    this.step.logicOperator = 'OR';
    return this.parentBuilder;
  }

  /**
   * Build the final policy
   */
  public build(): IBusinessPolicy<T> {
    return this.parentBuilder.build();
  }
}
