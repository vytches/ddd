import type { IAsyncSpecification, ISpecification } from '@vytches/ddd-contracts';
import type { IBusinessPolicy } from '../core/interfaces/business-policy.interface';
import type { PolicyViolationSeverity } from '../core/models/policy-violation';

export interface IPolicyBuilder<T> {
  /**
   * Set unique identifier for this policy
   */
  withId(id: string): IPolicyBuilder<T>;

  /**
   * Set domain this policy belongs to
   */
  withDomain(domain: string): IPolicyBuilder<T>;

  /**
   * Set descriptive name for this policy
   */
  withName(name: string): IPolicyBuilder<T>;

  /**
   * Set description for this policy
   */
  withDescription(description: string): IPolicyBuilder<T>;

  /**
   * Add a synchronous specification that must be satisfied
   */
  must(specification: ISpecification<T>): IPolicyStepBuilder<T>;

  /**
   * Add an asynchronous specification that must be satisfied
   */
  mustAsync(specification: IAsyncSpecification<T>): IPolicyStepBuilder<T>;

  /**
   * Add a specification that should be satisfied (warning if not)
   */
  should(specification: ISpecification<T>): IPolicyStepBuilder<T>;

  /**
   * Add an async specification that should be satisfied (warning if not)
   */
  shouldAsync(specification: IAsyncSpecification<T>): IPolicyStepBuilder<T>;

  /**
   * Add a custom predicate that must be satisfied
   */
  mustSatisfy(
    predicate: (entity: T, context?: unknown) => boolean,
    errorCode: string,
    errorMessage: string
  ): IPolicyStepBuilder<T>;

  /**
   * Add a custom async predicate that must be satisfied
   */
  mustSatisfyAsync(
    predicate: (entity: T, context?: unknown) => Promise<boolean>,
    errorCode: string,
    errorMessage: string
  ): IPolicyStepBuilder<T>;

  /**
   * Add business rule validation using fluent rules
   */
  mustSatisfyRules(
    rulesBuilder: (entity: T) => boolean,
    errorCode?: string,
    errorMessage?: string
  ): IPolicyStepBuilder<T>;

  /**
   * Define complex OR group logic - at least one group must pass
   */
  shouldSatisfyAny(...groups: IPolicyGroup<T>[]): IPolicyBuilder<T>;

  /**
   * Add conditional logic to the policy
   */
  when(condition: (entity: T, context?: unknown) => boolean): IConditionalPolicyBuilder<T>;

  /**
   * Build the final policy
   */
  build(): IBusinessPolicy<T>;
}

export interface IPolicyStepBuilder<T> {
  /**
   * Set error code for this step
   */
  withCode(code: string): IPolicyStepBuilder<T>;

  /**
   * Set error message for this step
   */
  withMessage(message: string): IPolicyStepBuilder<T>;

  /**
   * Set severity level for this step
   */
  withSeverity(severity: PolicyViolationSeverity): IPolicyStepBuilder<T>;

  /**
   * Set field name for field-specific validation
   */
  withField(field: string): IPolicyStepBuilder<T>;

  /**
   * Add additional details to the violation
   */
  withDetails(details: Record<string, unknown>): IPolicyStepBuilder<T>;

  /**
   * Add another requirement with AND logic
   */
  and(): IPolicyBuilder<T>;

  /**
   * Add another requirement with OR logic
   */
  or(): IPolicyBuilder<T>;

  /**
   * Build the final policy
   */
  build(): IBusinessPolicy<T>;
}

export interface IPolicyGroup<T> {
  /**
   * Add a specification that must be satisfied in this group
   */
  must(specification: ISpecification<T>): IPolicyGroupStepBuilder<T>;

  /**
   * Add an async specification that must be satisfied in this group
   */
  mustAsync(specification: IAsyncSpecification<T>): IPolicyGroupStepBuilder<T>;

  /**
   * Add a custom predicate that must be satisfied in this group
   */
  mustSatisfy(
    predicate: (entity: T, context?: unknown) => boolean,
    errorCode: string,
    errorMessage: string
  ): IPolicyGroupStepBuilder<T>;

  /**
   * Get the built policy for this group
   */
  getPolicy(): IBusinessPolicy<T>;
}

export interface IPolicyGroupStepBuilder<T> extends IPolicyGroup<T> {
  /**
   * Set error code for this group step
   */
  withCode(code: string): IPolicyGroupStepBuilder<T>;

  /**
   * Set error message for this group step
   */
  withMessage(message: string): IPolicyGroupStepBuilder<T>;

  /**
   * Set severity level for this group step
   */
  withSeverity(severity: PolicyViolationSeverity): IPolicyGroupStepBuilder<T>;

  /**
   * Add another requirement to this group with AND logic
   */
  and(): IPolicyGroup<T>;
}

export interface IConditionalPolicyBuilder<T> {
  /**
   * Define what happens when condition is met
   */
  then(policy: IBusinessPolicy<T>): IConditionalPolicyElse<T>;

  /**
   * Define what happens when condition is met using a builder
   */
  thenMust(specification: ISpecification<T>): IConditionalPolicyThenStepBuilder<T>;

  /**
   * Define what happens when condition is met using async specification
   */
  thenMustAsync(specification: IAsyncSpecification<T>): IConditionalPolicyThenStepBuilder<T>;
}

export interface IConditionalPolicyThenStepBuilder<T> {
  /**
   * Set error code for the then clause
   */
  withCode(code: string): IConditionalPolicyThenStepBuilder<T>;

  /**
   * Set error message for the then clause
   */
  withMessage(message: string): IConditionalPolicyThenStepBuilder<T>;

  /**
   * Set severity for the then clause
   */
  withSeverity(severity: PolicyViolationSeverity): IConditionalPolicyThenStepBuilder<T>;

  /**
   * Continue to else clause
   */
  otherwise(policy: IBusinessPolicy<T>): IConditionalPolicyElse<T>;

  /**
   * Continue to else clause with specification
   */
  otherwiseMust(specification: ISpecification<T>): IConditionalPolicyElseStepBuilder<T>;

  /**
   * Pass if condition is not met
   */
  otherwisePass(): IConditionalPolicyElse<T>;

  /**
   * Emit warning if condition is not met
   */
  otherwiseWarn(message: string): IConditionalPolicyElse<T>;
}

export interface IConditionalPolicyElse<T> {
  /**
   * Build the conditional policy
   */
  build(): IBusinessPolicy<T>;
}

export interface IConditionalPolicyElseStepBuilder<T> {
  /**
   * Set error code for the else clause
   */
  withCode(code: string): IConditionalPolicyElseStepBuilder<T>;

  /**
   * Set error message for the else clause
   */
  withMessage(message: string): IConditionalPolicyElseStepBuilder<T>;

  /**
   * Set severity for the else clause
   */
  withSeverity(severity: PolicyViolationSeverity): IConditionalPolicyElseStepBuilder<T>;

  /**
   * Build the conditional policy
   */
  build(): IBusinessPolicy<T>;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- T is a phantom type for type safety at usage sites
export interface PolicyBuilderConfig<T> {
  /**
   * Default domain for policies created by this builder
   */
  defaultDomain?: string;

  /**
   * Default error code prefix
   */
  defaultErrorCodePrefix?: string;

  /**
   * Default severity level
   */
  defaultSeverity?: PolicyViolationSeverity;

  /**
   * Whether to enable caching for built policies
   */
  enableCaching?: boolean;

  /**
   * Cache TTL in seconds
   */
  cacheTtl?: number;

  /**
   * Whether to enable events for built policies
   */
  enableEvents?: boolean;

  /**
   * Custom metadata for all policies created by this builder
   */
  metadata?: Record<string, unknown>;
}
