import type { IAsyncSpecification, ISpecification } from '@vytches/ddd-contracts';
import type { Result } from '@vytches/ddd-utils';
import { BaseBusinessPolicy } from '../core/base/base-business-policy';
import type { IBusinessPolicy, PolicyRequest } from '../core/interfaces/business-policy.interface';
import type { PolicyViolation } from '../core/models/policy-violation';
import { ConditionalPolicyBuilder } from './conditional-policy-builder';
import type { PolicyBuildStep } from './policy-builder-types';
import type {
  IConditionalPolicyBuilder,
  IPolicyBuilder,
  IPolicyGroup,
  IPolicyStepBuilder,
  PolicyBuilderConfig,
} from './policy-builder.interface';
import { PolicyStepBuilder } from './policy-step-builder';
import { computeErrorCode, createStepPolicy } from './step-policy-factory';

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
    const unsupportedStepErrorCode = this.generateErrorCode('UNSUPPORTED_STEP_TYPE');

    return createStepPolicy(step, policyId, policyDomain, policyName, unsupportedStepErrorCode);
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

// Helper policy implementations

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
    // Currently implements AND logic - all required steps must pass
    // For OR/complex logic, use PolicyGroup or compose policies manually

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
    const unsupportedStepErrorCode = computeErrorCode(
      this.config.defaultErrorCodePrefix,
      'UNSUPPORTED_STEP_TYPE'
    );

    return createStepPolicy(
      step,
      stepId,
      this.domain,
      `${this.name} - Step`,
      unsupportedStepErrorCode
    );
  }
}
