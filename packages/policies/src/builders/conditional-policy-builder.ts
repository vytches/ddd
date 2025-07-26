/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type { ISpecification, IAsyncSpecification } from '@vytches/ddd-contracts';
import type {
  IBusinessPolicy,
  PolicyContext,
  PolicyRequest,
} from '../core/interfaces/business-policy.interface';
import type {
  IPolicyBuilder,
  IConditionalPolicyBuilder,
  IConditionalPolicyElse,
  IConditionalPolicyThenStepBuilder,
  IConditionalPolicyElseStepBuilder,
} from './policy-builder.interface';
import {
  BaseBusinessPolicy,
  SpecificationPolicy,
  AsyncSpecificationPolicy,
} from '../core/base/base-business-policy';
import type { PolicyViolationSeverity } from '../core/models/policy-violation';
import type { Result } from '@vytches/ddd-utils';
import type { PolicyViolation } from '../core/models/policy-violation';

/**
 * @llm-summary ConditionalPolicyBuilder class for conditional policy builder operations
 * @llm-domain Pattern
 * @llm-complexity Medium
 *
 * @description
 * ConditionalPolicyBuilder class implementing domain pattern implementation for conditional policy builder operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new ConditionalPolicyBuilder();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new ConditionalPolicyBuilder());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class ConditionalPolicyBuilder<T> implements IConditionalPolicyBuilder<T> {
  constructor(
    private readonly parentBuilder: IPolicyBuilder<T>,
    private readonly condition: (entity: T, context?: PolicyContext) => boolean
  ) {}

  /**
   * Define what happens when condition is met
   */
  public then(policy: IBusinessPolicy<T>): IConditionalPolicyElse<T> {
    return new ConditionalPolicyElse(this.parentBuilder, this.condition, policy, null);
  }

  /**
   * Define what happens when condition is met using a builder
   */
  public thenMust(specification: ISpecification<T>): IConditionalPolicyThenStepBuilder<T> {
    const thenStep: ConditionalThenStep<T> = {
      type: 'specification',
      specification,
      errorCode: 'CONDITIONAL_THEN_FAILED',
      errorMessage: 'Conditional then clause failed',
      severity: 'ERROR',
    };

    return new ConditionalPolicyThenStepBuilder(this.parentBuilder, this.condition, thenStep);
  }

  /**
   * Define what happens when condition is met using async specification
   */
  public thenMustAsync(
    specification: IAsyncSpecification<T>
  ): IConditionalPolicyThenStepBuilder<T> {
    const thenStep: ConditionalThenStep<T> = {
      type: 'async-specification',
      asyncSpecification: specification,
      errorCode: 'CONDITIONAL_THEN_ASYNC_FAILED',
      errorMessage: 'Conditional then async clause failed',
      severity: 'ERROR',
    };

    return new ConditionalPolicyThenStepBuilder(this.parentBuilder, this.condition, thenStep);
  }
}

/**
 * @llm-summary ConditionalPolicyThenStepBuilder class for conditional policy then step builder operations
 * @llm-domain Pattern
 * @llm-complexity Medium
 *
 * @description
 * ConditionalPolicyThenStepBuilder class implementing domain pattern implementation for conditional policy then step builder operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new ConditionalPolicyThenStepBuilder();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new ConditionalPolicyThenStepBuilder());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class ConditionalPolicyThenStepBuilder<T> implements IConditionalPolicyThenStepBuilder<T> {
  constructor(
    private readonly parentBuilder: IPolicyBuilder<T>,
    private readonly condition: (entity: T, context?: PolicyContext) => boolean,
    private readonly thenStep: ConditionalThenStep<T>
  ) {}

  /**
   * Set error code for the then clause
   */
  public withCode(code: string): IConditionalPolicyThenStepBuilder<T> {
    this.thenStep.errorCode = code;
    return this;
  }

  /**
   * Set error message for the then clause
   */
  public withMessage(message: string): IConditionalPolicyThenStepBuilder<T> {
    this.thenStep.errorMessage = message;
    return this;
  }

  /**
   * Set severity for the then clause
   */
  public withSeverity(severity: PolicyViolationSeverity): IConditionalPolicyThenStepBuilder<T> {
    this.thenStep.severity = severity;
    return this;
  }

  /**
   * Continue to else clause
   */
  public otherwise(policy: IBusinessPolicy<T>): IConditionalPolicyElse<T> {
    const thenPolicy = this.createPolicyFromStep(this.thenStep);
    return new ConditionalPolicyElse(this.parentBuilder, this.condition, thenPolicy, policy);
  }

  /**
   * Continue to else clause with specification
   */
  public otherwiseMust(specification: ISpecification<T>): IConditionalPolicyElseStepBuilder<T> {
    const thenPolicy = this.createPolicyFromStep(this.thenStep);

    const elseStep: ConditionalElseStep<T> = {
      type: 'specification',
      specification,
      errorCode: 'CONDITIONAL_ELSE_FAILED',
      errorMessage: 'Conditional else clause failed',
      severity: 'ERROR',
    };

    return new ConditionalPolicyElseStepBuilder(
      this.parentBuilder,
      this.condition,
      thenPolicy,
      elseStep
    );
  }

  /**
   * Pass if condition is not met
   */
  public otherwisePass(): IConditionalPolicyElse<T> {
    const thenPolicy = this.createPolicyFromStep(this.thenStep);
    const passPolicy = new PassPolicy<T>('conditional_pass', 'conditional', 'Pass Policy');
    return new ConditionalPolicyElse(this.parentBuilder, this.condition, thenPolicy, passPolicy);
  }

  /**
   * Emit warning if condition is not met
   */
  public otherwiseWarn(message: string): IConditionalPolicyElse<T> {
    const thenPolicy = this.createPolicyFromStep(this.thenStep);
    const warnPolicy = new WarnPolicy<T>(
      'conditional_warn',
      'conditional',
      'Warning Policy',
      message
    );
    return new ConditionalPolicyElse(this.parentBuilder, this.condition, thenPolicy, warnPolicy);
  }

  private createPolicyFromStep(step: ConditionalThenStep<T>): IBusinessPolicy<T> {
    const stepId = 'conditional_then';
    const stepDomain = 'conditional';
    const stepName = 'Conditional Then';

    switch (step.type) {
      case 'specification':
        return SpecificationPolicy.fromSpecification(
          stepId,
          stepDomain,
          stepName,
          step.specification!,
          step.errorCode,
          step.errorMessage
        );

      case 'async-specification':
        return AsyncSpecificationPolicy.fromAsyncSpecification(
          stepId,
          stepDomain,
          stepName,
          step.asyncSpecification!,
          step.errorCode,
          step.errorMessage
        );

      default:
        throw new Error(`Unsupported step type in conditional then: ${step.type}`);
    }
  }
}

/**
 * @llm-summary ConditionalPolicyElseStepBuilder class for conditional policy else step builder operations
 * @llm-domain Pattern
 * @llm-complexity Medium
 *
 * @description
 * ConditionalPolicyElseStepBuilder class implementing domain pattern implementation for conditional policy else step builder operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new ConditionalPolicyElseStepBuilder();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new ConditionalPolicyElseStepBuilder());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class ConditionalPolicyElseStepBuilder<T> implements IConditionalPolicyElseStepBuilder<T> {
  constructor(
    private readonly parentBuilder: IPolicyBuilder<T>,
    private readonly condition: (entity: T, context?: PolicyContext) => boolean,
    private readonly thenPolicy: IBusinessPolicy<T>,
    private readonly elseStep: ConditionalElseStep<T>
  ) {}

  /**
   * Set error code for the else clause
   */
  public withCode(code: string): IConditionalPolicyElseStepBuilder<T> {
    this.elseStep.errorCode = code;
    return this;
  }

  /**
   * Set error message for the else clause
   */
  public withMessage(message: string): IConditionalPolicyElseStepBuilder<T> {
    this.elseStep.errorMessage = message;
    return this;
  }

  /**
   * Set severity for the else clause
   */
  public withSeverity(severity: PolicyViolationSeverity): IConditionalPolicyElseStepBuilder<T> {
    this.elseStep.severity = severity;
    return this;
  }

  /**
   * Build the conditional policy
   */
  public build(): IBusinessPolicy<T> {
    const elsePolicy = this.createPolicyFromStep(this.elseStep);
    const conditionalPolicy = new ConditionalPolicy(
      'conditional',
      'conditional',
      'Conditional Policy',
      this.condition,
      this.thenPolicy,
      elsePolicy
    );

    // TODO: Integrate with parent builder
    return conditionalPolicy;
  }

  private createPolicyFromStep(step: ConditionalElseStep<T>): IBusinessPolicy<T> {
    const stepId = 'conditional_else';
    const stepDomain = 'conditional';
    const stepName = 'Conditional Else';

    switch (step.type) {
      case 'specification':
        return SpecificationPolicy.fromSpecification(
          stepId,
          stepDomain,
          stepName,
          step.specification!,
          step.errorCode,
          step.errorMessage
        );

      default:
        throw new Error(`Unsupported step type in conditional else: ${step.type}`);
    }
  }
}

/**
 * @llm-summary ConditionalPolicyElse class for conditional policy else operations
 * @llm-domain Pattern
 * @llm-complexity Medium
 *
 * @description
 * ConditionalPolicyElse class implementing domain pattern implementation for conditional policy else operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new ConditionalPolicyElse();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new ConditionalPolicyElse());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class ConditionalPolicyElse<T> implements IConditionalPolicyElse<T> {
  constructor(
    private readonly parentBuilder: IPolicyBuilder<T>,
    private readonly condition: (entity: T, context?: PolicyContext) => boolean,
    private readonly thenPolicy: IBusinessPolicy<T>,
    private readonly elsePolicy: IBusinessPolicy<T> | null
  ) {}

  /**
   * Build the conditional policy
   */
  public build(): IBusinessPolicy<T> {
    const conditionalPolicy = new ConditionalPolicy(
      'conditional',
      'conditional',
      'Conditional Policy',
      this.condition,
      this.thenPolicy,
      this.elsePolicy
    );

    // TODO: Integrate with parent builder
    return conditionalPolicy;
  }
}

// Internal step representations

interface ConditionalThenStep<T> {
  type: 'specification' | 'async-specification' | 'predicate';
  specification?: ISpecification<T>;
  asyncSpecification?: IAsyncSpecification<T>;
  predicate?: (entity: T, context?: PolicyContext) => boolean;
  errorCode: string;
  errorMessage: string;
  severity: PolicyViolationSeverity;
}

interface ConditionalElseStep<T> {
  type: 'specification' | 'predicate';
  specification?: ISpecification<T>;
  predicate?: (entity: T, context?: PolicyContext) => boolean;
  errorCode: string;
  errorMessage: string;
  severity: PolicyViolationSeverity;
}

// Helper policy implementations

class ConditionalPolicy<T> extends BaseBusinessPolicy<T> {
  constructor(
    id: string,
    domain: string,
    name: string,
    private readonly condition: (entity: T, context?: PolicyContext) => boolean,
    private readonly thenPolicy: IBusinessPolicy<T>,
    private readonly elsePolicy: IBusinessPolicy<T> | null
  ) {
    super(id, domain, name);
  }

  public async check(request: PolicyRequest<T>): Promise<Result<T, PolicyViolation>> {
    try {
      const conditionMet = this.condition(request.entity, request.context);

      if (conditionMet) {
        return await this.thenPolicy.check(request);
      } else if (this.elsePolicy) {
        return await this.elsePolicy.check(request);
      } else {
        // No else clause, condition not met - pass
        return this.success(request.entity);
      }
    } catch (error) {
      const violation = this.createViolation(
        'CONDITIONAL_ERROR',
        `Conditional policy evaluation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'ERROR',
        { context: request.context, details: { originalError: error } }
      );

      return this.failure(violation);
    }
  }
}

class PassPolicy<T> extends BaseBusinessPolicy<T> {
  public async check(request: PolicyRequest<T>): Promise<Result<T, PolicyViolation>> {
    return this.success(request.entity);
  }
}

class WarnPolicy<T> extends BaseBusinessPolicy<T> {
  constructor(
    id: string,
    domain: string,
    name: string,
    private readonly warningMessage: string
  ) {
    super(id, domain, name);
  }

  public async check(request: PolicyRequest<T>): Promise<Result<T, PolicyViolation>> {
    const violation = this.createViolation('CONDITIONAL_WARNING', this.warningMessage, 'WARNING', {
      context: request.context,
    });

    return this.failure(violation);
  }
}
