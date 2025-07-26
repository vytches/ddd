import type { ISpecification, IAsyncSpecification } from '@vytches/ddd-contracts';
import type { IBusinessPolicy } from '../core/interfaces/business-policy.interface';
import {
  BaseBusinessPolicy,
  SpecificationPolicy,
  AsyncSpecificationPolicy,
} from '../core/base/base-business-policy';
import type {
  IPolicyBuilder,
  IPolicyStepBuilder,
  IPolicyGroup,
  IConditionalPolicyBuilder,
  PolicyBuilderConfig,
} from './policy-builder.interface';
import { PolicyStepBuilder } from './policy-step-builder';
import { PolicyGroup } from './policy-group';
import { ConditionalPolicyBuilder } from './conditional-policy-builder';
import type { PolicyViolationSeverity, PolicyViolation } from '../core/models/policy-violation';
import type { PolicyRequest } from '../core/interfaces/business-policy.interface';
import type { Result } from '@vytches/ddd-utils';

/**
 * @llm-summary PolicyBuilder class for policy builder operations
 * @llm-domain Pattern
 * @llm-complexity Medium
 *
 * @description
 * PolicyBuilder class implementing domain pattern implementation for policy builder operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new PolicyBuilder();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new PolicyBuilder());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class PolicyBuilder<T> implements IPolicyBuilder<T> {
  private id?: string;
  private domain?: string;
  private name?: string;
  private description?: string;
  private steps: PolicyBuildStep<T>[] = [];
  private readonly config: PolicyBuilderConfig<T>;

  constructor(config: PolicyBuilderConfig<T> = {}) {
    this.config = config;
  }

  /**
   * Set unique identifier for this policy
   */
  public withId(id: string): IPolicyBuilder<T> {
    this.id = id;
    return this;
  }

  /**
   * Set domain this policy belongs to
   */
  public withDomain(domain: string): IPolicyBuilder<T> {
    this.domain = domain;
    return this;
  }

  /**
   * Set descriptive name for this policy
   */
  public withName(name: string): IPolicyBuilder<T> {
    this.name = name;
    return this;
  }

  /**
   * Set description for this policy
   */
  public withDescription(description: string): IPolicyBuilder<T> {
    this.description = description;
    return this;
  }

  /**
   * Add a synchronous specification that must be satisfied
   */
  public must(specification: ISpecification<T>): IPolicyStepBuilder<T> {
    const step: PolicyBuildStep<T> = {
      type: 'specification',
      specification,
      isRequired: true,
      errorCode: this.generateErrorCode('SPECIFICATION_FAILED'),
      errorMessage: 'Specification failed',
      severity: this.config.defaultSeverity || 'ERROR',
    };

    this.steps.push(step);
    return new PolicyStepBuilder(this, step);
  }

  /**
   * Add an asynchronous specification that must be satisfied
   */
  public mustAsync(specification: IAsyncSpecification<T>): IPolicyStepBuilder<T> {
    const step: PolicyBuildStep<T> = {
      type: 'async-specification',
      asyncSpecification: specification,
      isRequired: true,
      errorCode: this.generateErrorCode('ASYNC_SPECIFICATION_FAILED'),
      errorMessage: 'Async specification failed',
      severity: this.config.defaultSeverity || 'ERROR',
    };

    this.steps.push(step);
    return new PolicyStepBuilder(this, step);
  }

  /**
   * Add a specification that should be satisfied (warning if not)
   */
  public should(specification: ISpecification<T>): IPolicyStepBuilder<T> {
    const step: PolicyBuildStep<T> = {
      type: 'specification',
      specification,
      isRequired: false,
      errorCode: this.generateErrorCode('SPECIFICATION_WARNING'),
      errorMessage: 'Specification warning',
      severity: 'WARNING',
    };

    this.steps.push(step);
    return new PolicyStepBuilder(this, step);
  }

  /**
   * Add an async specification that should be satisfied (warning if not)
   */
  public shouldAsync(specification: IAsyncSpecification<T>): IPolicyStepBuilder<T> {
    const step: PolicyBuildStep<T> = {
      type: 'async-specification',
      asyncSpecification: specification,
      isRequired: false,
      errorCode: this.generateErrorCode('ASYNC_SPECIFICATION_WARNING'),
      errorMessage: 'Async specification warning',
      severity: 'WARNING',
    };

    this.steps.push(step);
    return new PolicyStepBuilder(this, step);
  }

  /**
   * Add a custom predicate that must be satisfied
   */
  public mustSatisfy(
    predicate: (entity: T, context?: unknown) => boolean,
    errorCode: string,
    errorMessage: string
  ): IPolicyStepBuilder<T> {
    const step: PolicyBuildStep<T> = {
      type: 'predicate',
      predicate,
      isRequired: true,
      errorCode: this.generateErrorCode(errorCode),
      errorMessage,
      severity: this.config.defaultSeverity || 'ERROR',
    };

    this.steps.push(step);
    return new PolicyStepBuilder(this, step);
  }

  /**
   * Add a custom async predicate that must be satisfied
   */
  public mustSatisfyAsync(
    predicate: (entity: T, context?: unknown) => Promise<boolean>,
    errorCode: string,
    errorMessage: string
  ): IPolicyStepBuilder<T> {
    const step: PolicyBuildStep<T> = {
      type: 'async-predicate',
      asyncPredicate: predicate,
      isRequired: true,
      errorCode: this.generateErrorCode(errorCode),
      errorMessage,
      severity: this.config.defaultSeverity || 'ERROR',
    };

    this.steps.push(step);
    return new PolicyStepBuilder(this, step);
  }

  /**
   * Add business rule validation using fluent rules
   */
  public mustSatisfyRules(
    rulesBuilder: (entity: T) => boolean,
    errorCode?: string,
    errorMessage?: string
  ): IPolicyStepBuilder<T> {
    const step: PolicyBuildStep<T> = {
      type: 'rules',
      rulesBuilder,
      isRequired: true,
      errorCode: this.generateErrorCode(errorCode || 'RULES_FAILED'),
      errorMessage: errorMessage || 'Business rules validation failed',
      severity: this.config.defaultSeverity || 'ERROR',
    };

    this.steps.push(step);
    return new PolicyStepBuilder(this, step);
  }

  /**
   * Define complex OR group logic - at least one group must pass
   */
  public shouldSatisfyAny(...groups: IPolicyGroup<T>[]): IPolicyBuilder<T> {
    const step: PolicyBuildStep<T> = {
      type: 'group-or',
      groups,
      isRequired: true,
      errorCode: this.generateErrorCode('GROUP_OR_FAILED'),
      errorMessage: 'None of the required groups were satisfied',
      severity: this.config.defaultSeverity || 'ERROR',
    };

    this.steps.push(step);
    return this;
  }

  /**
   * Add conditional logic to the policy
   */
  public when(condition: (entity: T, context?: unknown) => boolean): IConditionalPolicyBuilder<T> {
    return new ConditionalPolicyBuilder(this, condition);
  }

  /**
   * Add a step to this builder (used by step builders)
   */
  public addStep(step: PolicyBuildStep<T>): IPolicyBuilder<T> {
    this.steps.push(step);
    return this;
  }

  /**
   * Build the final policy
   */
  public build(): IBusinessPolicy<T> {
    this.validateBuilder();

    if (this.steps.length === 1) {
      // Single step policy
      return this.createPolicyFromStep(this.steps[0]!);
    } else {
      // Composite policy
      return this.createCompositePolicy();
    }
  }

  /**
   * Create a new policy builder
   */
  public static create<T>(config?: PolicyBuilderConfig<T>): IPolicyBuilder<T> {
    return new PolicyBuilder<T>(config);
  }

  /**
   * Create a new policy builder for a specific domain
   */
  public static forDomain<T>(domain: string, config?: PolicyBuilderConfig<T>): IPolicyBuilder<T> {
    const builder = new PolicyBuilder<T>(config);
    return builder.withDomain(domain);
  }

  // Private helper methods

  private validateBuilder(): void {
    if (!this.id) {
      throw new Error('Policy ID is required. Use .withId() to set it.');
    }

    if (!this.domain && !this.config.defaultDomain) {
      throw new Error(
        'Policy domain is required. Use .withDomain() to set it or provide defaultDomain in config.'
      );
    }

    if (!this.name) {
      throw new Error('Policy name is required. Use .withName() to set it.');
    }

    if (this.steps.length === 0) {
      throw new Error(
        'At least one policy step is required. Use .must(), .should(), or other step methods.'
      );
    }
  }

  private generateErrorCode(code: string): string {
    const prefix = this.config.defaultErrorCodePrefix;
    return prefix ? `${prefix}_${code}` : code;
  }

  private createPolicyFromStep(step: PolicyBuildStep<T>): IBusinessPolicy<T> {
    const policyId = this.id!;
    const policyDomain = this.domain || this.config.defaultDomain!;
    const policyName = this.name!;

    switch (step.type) {
      case 'specification':
        return SpecificationPolicy.fromSpecification(
          policyId,
          policyDomain,
          policyName,
          step.specification!,
          step.errorCode,
          step.errorMessage
        );

      case 'async-specification':
        return AsyncSpecificationPolicy.fromAsyncSpecification(
          policyId,
          policyDomain,
          policyName,
          step.asyncSpecification!,
          step.errorCode,
          step.errorMessage
        );

      case 'predicate':
        return new PredicatePolicy(
          policyId,
          policyDomain,
          policyName,
          step.predicate!,
          step.errorCode,
          step.errorMessage,
          step.severity
        );

      case 'async-predicate':
        return new AsyncPredicatePolicy(
          policyId,
          policyDomain,
          policyName,
          step.asyncPredicate!,
          step.errorCode,
          step.errorMessage,
          step.severity
        );

      case 'rules':
        return new RulesPolicy(
          policyId,
          policyDomain,
          policyName,
          step.rulesBuilder!,
          step.errorCode,
          step.errorMessage,
          step.severity
        );

      default:
        throw new Error(
          `Unsupported step type for single policy: ${(step as { type: string }).type}`
        );
    }
  }

  private createCompositePolicy(): IBusinessPolicy<T> {
    return new BuiltCompositePolicy(
      this.id!,
      this.domain || this.config.defaultDomain!,
      this.name!,
      this.steps,
      this.config
    );
  }
}

/**
 * @llm-summary Contract for policy build step functionality
 * @llm-domain Pattern
 * @llm-contract Required
 *
 * @description
 * PolicyBuildStep interface implementing domain pattern implementation for policy build step operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcretePolicyBuildStep implements PolicyBuildStep {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface PolicyBuildStep<T> {
  type:
    | 'specification'
    | 'async-specification'
    | 'predicate'
    | 'async-predicate'
    | 'rules'
    | 'group-or'
    | 'conditional';
  specification?: ISpecification<T>;
  asyncSpecification?: IAsyncSpecification<T>;
  predicate?: (entity: T, context?: unknown) => boolean;
  asyncPredicate?: (entity: T, context?: unknown) => Promise<boolean>;
  rulesBuilder?: (entity: T) => boolean;
  groups?: IPolicyGroup<T>[];
  isRequired: boolean;
  errorCode: string;
  errorMessage: string;
  severity: PolicyViolationSeverity;
  field?: string;
  details?: Record<string, unknown>;
  logicOperator?: 'AND' | 'OR';
}

// Helper policy implementations

class PredicatePolicy<T> extends BaseBusinessPolicy<T> {
  constructor(
    id: string,
    domain: string,
    name: string,
    private readonly predicate: (entity: T, context?: unknown) => boolean,
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
        'PREDICATE_ERROR',
        `Predicate evaluation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'ERROR',
        { context: request.context, details: { originalError: error } }
      );

      return this.failure(violation);
    }
  }
}

class AsyncPredicatePolicy<T> extends BaseBusinessPolicy<T> {
  constructor(
    id: string,
    domain: string,
    name: string,
    private readonly predicate: (entity: T, context?: unknown) => Promise<boolean>,
    private readonly errorCode: string,
    private readonly errorMessage: string,
    private readonly severity: PolicyViolationSeverity
  ) {
    super(id, domain, name);
  }

  public async check(request: PolicyRequest<T>): Promise<Result<T, PolicyViolation>> {
    try {
      const satisfied = await this.predicate(request.entity, request.context);

      if (satisfied) {
        return this.success(request.entity);
      }

      const violation = this.createViolation(this.errorCode, this.errorMessage, this.severity, {
        context: request.context,
      });

      return this.failure(violation);
    } catch (error) {
      const violation = this.createViolation(
        'ASYNC_PREDICATE_ERROR',
        `Async predicate evaluation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'ERROR',
        { context: request.context, details: { originalError: error } }
      );

      return this.failure(violation);
    }
  }
}

class RulesPolicy<T> extends BaseBusinessPolicy<T> {
  constructor(
    id: string,
    domain: string,
    name: string,
    private readonly rulesBuilder: (entity: T) => boolean,
    private readonly errorCode: string,
    private readonly errorMessage: string,
    private readonly severity: PolicyViolationSeverity
  ) {
    super(id, domain, name);
  }

  public async check(request: PolicyRequest<T>): Promise<Result<T, PolicyViolation>> {
    try {
      const satisfied = this.rulesBuilder(request.entity);

      if (satisfied) {
        return this.success(request.entity);
      }

      const violation = this.createViolation(this.errorCode, this.errorMessage, this.severity, {
        context: request.context,
      });

      return this.failure(violation);
    } catch (error) {
      const violation = this.createViolation(
        'RULES_ERROR',
        `Rules evaluation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'ERROR',
        { context: request.context, details: { originalError: error } }
      );

      return this.failure(violation);
    }
  }
}

class BuiltCompositePolicy<T> extends BaseBusinessPolicy<T> {
  constructor(
    id: string,
    domain: string,
    name: string,
    private readonly steps: PolicyBuildStep<T>[],
    private readonly config: PolicyBuilderConfig<T>
  ) {
    super(id, domain, name);
  }

  public async check(request: PolicyRequest<T>): Promise<Result<T, PolicyViolation>> {
    // For now, implement simple AND logic for all steps
    // TODO: Implement proper logic operators based on step configuration

    for (const step of this.steps) {
      const stepPolicy = this.createPolicyFromStep(step);
      const result = await stepPolicy.check(request);

      if (result.isFailure && step.isRequired) {
        return result;
      }
    }

    return this.success(request.entity);
  }

  private createPolicyFromStep(step: PolicyBuildStep<T>): IBusinessPolicy<T> {
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
        return new PredicatePolicy(
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
        throw new Error(
          `Unsupported step type in composite policy: ${(step as { type: string }).type}`
        );
    }
  }
}
