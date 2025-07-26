import type { ISpecification, IAsyncSpecification } from '@vytches/ddd-contracts';
import type { IBusinessPolicy } from '../core/interfaces/business-policy.interface';
import type { IPolicyGroup, IPolicyGroupStepBuilder } from './policy-builder.interface';
import {
  BaseBusinessPolicy,
  SpecificationPolicy,
  AsyncSpecificationPolicy,
} from '../core/base/base-business-policy';
import type { PolicyViolationSeverity, PolicyViolation } from '../core/models/policy-violation';
import type { PolicyRequest } from '../core/interfaces/business-policy.interface';
import type { Result } from '@vytches/ddd-utils';

/**
 * @llm-summary PolicyGroup class for policy group operations
 * @llm-domain Pattern
 * @llm-complexity Medium
 *
 * @description
 * PolicyGroup class implementing domain pattern implementation for policy group operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new PolicyGroup();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new PolicyGroup());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class PolicyGroup<T> implements IPolicyGroup<T> {
  private steps: PolicyGroupStep<T>[] = [];
  private readonly groupName?: string;

  constructor(groupName?: string) {
    if (groupName !== undefined) {
      this.groupName = groupName;
    }
  }

  /**
   * Add a specification that must be satisfied in this group
   */
  public must(specification: ISpecification<T>): IPolicyGroupStepBuilder<T> {
    const step: PolicyGroupStep<T> = {
      type: 'specification',
      specification,
      isRequired: true,
      errorCode: 'GROUP_SPECIFICATION_FAILED',
      errorMessage: 'Group specification failed',
      severity: 'ERROR',
    };

    this.steps.push(step);
    return new PolicyGroupStepBuilder(this, step);
  }

  /**
   * Add an async specification that must be satisfied in this group
   */
  public mustAsync(specification: IAsyncSpecification<T>): IPolicyGroupStepBuilder<T> {
    const step: PolicyGroupStep<T> = {
      type: 'async-specification',
      asyncSpecification: specification,
      isRequired: true,
      errorCode: 'GROUP_ASYNC_SPECIFICATION_FAILED',
      errorMessage: 'Group async specification failed',
      severity: 'ERROR',
    };

    this.steps.push(step);
    return new PolicyGroupStepBuilder(this, step);
  }

  /**
   * Add a custom predicate that must be satisfied in this group
   */
  public mustSatisfy(
    predicate: (entity: T, context?: unknown) => boolean,
    errorCode: string,
    errorMessage: string
  ): IPolicyGroupStepBuilder<T> {
    const step: PolicyGroupStep<T> = {
      type: 'predicate',
      predicate,
      isRequired: true,
      errorCode,
      errorMessage,
      severity: 'ERROR',
    };

    this.steps.push(step);
    return new PolicyGroupStepBuilder(this, step);
  }

  /**
   * Get the built policy for this group
   */
  public getPolicy(): IBusinessPolicy<T> {
    if (this.steps.length === 0) {
      throw new Error('Group must have at least one step');
    }

    if (this.steps.length === 1) {
      return this.createPolicyFromStep(this.steps[0]!);
    } else {
      return new GroupCompositePolicy(
        this.generateGroupId(),
        'group',
        this.groupName || 'Policy Group',
        this.steps
      );
    }
  }

  /**
   * Create a new policy group
   */
  public static create<T>(groupName?: string): IPolicyGroup<T> {
    return new PolicyGroup<T>(groupName);
  }

  // Private helper methods

  private generateGroupId(): string {
    return `group_${this.groupName ? this.groupName.toLowerCase().replace(/\s+/g, '_') : 'unnamed'}_${Date.now()}`;
  }

  private createPolicyFromStep(step: PolicyGroupStep<T>): IBusinessPolicy<T> {
    const stepId = `${this.generateGroupId()}_step`;
    const stepDomain = 'group';
    const stepName = `${this.groupName || 'Group'} - Step`;

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

      case 'predicate':
        return new GroupPredicatePolicy(
          stepId,
          stepDomain,
          stepName,
          step.predicate!,
          step.errorCode,
          step.errorMessage,
          step.severity
        );

      default:
        throw new Error(`Unsupported step type in group: ${(step as any).type}`);
    }
  }
}

/**
 * @llm-summary PolicyGroupStepBuilder class for policy group step builder operations
 * @llm-domain Pattern
 * @llm-complexity Medium
 *
 * @description
 * PolicyGroupStepBuilder class implementing domain pattern implementation for policy group step builder operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new PolicyGroupStepBuilder();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new PolicyGroupStepBuilder());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class PolicyGroupStepBuilder<T> implements IPolicyGroupStepBuilder<T> {
  constructor(
    private readonly parentGroup: PolicyGroup<T>,
    private readonly step: PolicyGroupStep<T>
  ) {}

  /**
   * Set error code for this group step
   */
  public withCode(code: string): IPolicyGroupStepBuilder<T> {
    this.step.errorCode = code;
    return this;
  }

  /**
   * Set error message for this group step
   */
  public withMessage(message: string): IPolicyGroupStepBuilder<T> {
    this.step.errorMessage = message;
    return this;
  }

  /**
   * Set severity level for this group step
   */
  public withSeverity(severity: PolicyViolationSeverity): IPolicyGroupStepBuilder<T> {
    this.step.severity = severity;
    return this;
  }

  /**
   * Add another requirement to this group with AND logic
   */
  public and(): IPolicyGroup<T> {
    this.step.logicOperator = 'AND';
    return this.parentGroup;
  }

  /**
   * Add a specification that must be satisfied in this group
   */
  public must(specification: ISpecification<T>): IPolicyGroupStepBuilder<T> {
    return this.parentGroup.must(specification);
  }

  /**
   * Add an async specification that must be satisfied in this group
   */
  public mustAsync(specification: IAsyncSpecification<T>): IPolicyGroupStepBuilder<T> {
    return this.parentGroup.mustAsync(specification);
  }

  /**
   * Add a custom predicate that must be satisfied in this group
   */
  public mustSatisfy(
    predicate: (entity: T, context?: unknown) => boolean,
    errorCode: string,
    errorMessage: string
  ): IPolicyGroupStepBuilder<T> {
    return this.parentGroup.mustSatisfy(predicate, errorCode, errorMessage);
  }

  /**
   * Get the built policy for this group
   */
  public getPolicy(): IBusinessPolicy<T> {
    return this.parentGroup.getPolicy();
  }
}

/**
 * @llm-summary Contract for policy group step functionality
 * @llm-domain Pattern
 * @llm-contract Required
 *
 * @description
 * PolicyGroupStep interface implementing domain pattern implementation for policy group step operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcretePolicyGroupStep implements PolicyGroupStep {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface PolicyGroupStep<T> {
  type: 'specification' | 'async-specification' | 'predicate';
  specification?: ISpecification<T>;
  asyncSpecification?: IAsyncSpecification<T>;
  predicate?: (entity: T, context?: unknown) => boolean;
  isRequired: boolean;
  errorCode: string;
  errorMessage: string;
  severity: PolicyViolationSeverity;
  field?: string;
  details?: Record<string, unknown>;
  logicOperator?: 'AND' | 'OR';
}

// Helper policy implementations for groups

class GroupPredicatePolicy<T> extends BaseBusinessPolicy<T> {
  constructor(
    id: string,
    domain: string,
    name: string,
    private readonly predicate: (entity: T, context?: any) => boolean,
    private readonly errorCode: string,
    private readonly errorMessage: string,
    private readonly severity: PolicyViolationSeverity
  ) {
    super(id, domain, name);
  }

  public async check(request: PolicyRequest<T>): Promise<Result<T, PolicyViolation>> {
    try {
      const satisfied = this.predicate(request.entity, request.context);

      if (satisfied) {
        return this.success(request.entity);
      }

      const violation = this.createViolation(this.errorCode, this.errorMessage, this.severity, {
        context: request.context,
      });

      return this.failure(violation);
    } catch (error) {
      const violation = this.createViolation(
        'GROUP_PREDICATE_ERROR',
        `Group predicate evaluation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'ERROR',
        { context: request.context, details: { originalError: error } }
      );

      return this.failure(violation);
    }
  }
}

class GroupCompositePolicy<T> extends BaseBusinessPolicy<T> {
  constructor(
    id: string,
    domain: string,
    name: string,
    private readonly steps: PolicyGroupStep<T>[]
  ) {
    super(id, domain, name);
  }

  public async check(request: PolicyRequest<T>): Promise<Result<T, PolicyViolation>> {
    // Implement AND logic for all steps in the group
    for (const step of this.steps) {
      const stepPolicy = this.createPolicyFromStep(step);
      const result = await stepPolicy.check(request);

      if (result.isFailure && step.isRequired) {
        return result;
      }
    }

    return this.success(request.entity);
  }

  private createPolicyFromStep(step: PolicyGroupStep<T>): IBusinessPolicy<T> {
    const stepId = `${this.id}_step_${this.steps.indexOf(step)}`;

    switch (step.type) {
      case 'specification':
        return SpecificationPolicy.fromSpecification(
          stepId,
          this.domain,
          `${this.name} - Step`,
          step.specification!,
          step.errorCode,
          step.errorMessage
        );

      case 'predicate':
        return new GroupPredicatePolicy(
          stepId,
          this.domain,
          `${this.name} - Step`,
          step.predicate!,
          step.errorCode,
          step.errorMessage,
          step.severity
        );

      // TODO: Implement other step types
      default:
        throw new Error(`Unsupported step type in group composite policy: ${(step as any).type}`);
    }
  }
}
