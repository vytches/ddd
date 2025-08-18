import type { Result } from '@vytches/ddd-utils';
import type { PolicyMetadata } from '../models/policy-metadata';
import type { PolicyViolation } from '../models/policy-violation';
import type { PolicyContext } from '../shared';

export interface IBusinessPolicy<T> {
  /**
   * Unique identifier for this policy
   */
  readonly id: string;

  /**
   * Domain this policy belongs to
   */
  readonly domain: string;

  /**
   * Descriptive name for this policy
   */
  readonly name: string;

  /**
   * Check if the entity satisfies this policy
   * Returns Promise<Result> for unified async/sync handling
   */
  check(request: PolicyRequest<T>): Promise<Result<T, PolicyViolation>>;

  /**
   * Combine this policy with another using AND logic
   * Both policies must pass for the combination to pass
   */
  and(other: IBusinessPolicy<T>): IPolicyComposer<T>;

  /**
   * Combine this policy with another using OR logic
   * At least one policy must pass for the combination to pass
   */
  or(other: IBusinessPolicy<T>): IPolicyComposer<T>;

  /**
   * Negate this policy
   * Policy passes when original would fail, and vice versa
   */
  not(): IBusinessPolicy<T>;

  /**
   * Add conditional logic to this policy
   * Policy is only evaluated when condition is met
   */
  when(condition: PolicyCondition<T>): IPolicyConditionalBuilder<T>;
}

export interface PolicyRequest<T> {
  /**
   * The entity to evaluate against the policy
   */
  readonly entity: T;

  /**
   * Required evaluation context for audit, multi-tenancy, and compliance
   */
  readonly context: PolicyContext;

  /**
   * Optional metadata for additional context
   */
  readonly metadata?: PolicyMetadata;
}

export interface IPolicyComposer<T> extends IBusinessPolicy<T> {
  /**
   * Continue composing with AND logic
   */
  and(other: IBusinessPolicy<T>): IPolicyComposer<T>;

  /**
   * Continue composing with OR logic
   */
  or(other: IBusinessPolicy<T>): IPolicyComposer<T>;

  /**
   * Group policies for precedence control
   */
  group(): IGroupedPolicyComposer<T>;
}

export interface IGroupedPolicyComposer<T> extends IPolicyComposer<T> {
  /**
   * End the current group
   */
  endGroup(): IPolicyComposer<T>;
}

export interface IPolicyConditionalBuilder<T> {
  /**
   * Define what happens when condition is met
   */
  then(policy: IBusinessPolicy<T>): IPolicyConditionalElse<T>;

  /**
   * Define what happens when condition is met (with policy builder)
   */
  thenMust(specification: unknown): IPolicyConditionalElse<T>; // TODO: Type this properly
}

export interface IPolicyConditionalElse<T> {
  /**
   * Define what happens when condition is not met
   */
  otherwise(policy: IBusinessPolicy<T>): IBusinessPolicy<T>;

  /**
   * Define what happens when condition is not met (with policy builder)
   */
  otherwiseMust(specification: unknown): IBusinessPolicy<T>; // TODO: Type this properly

  /**
   * No action when condition is not met (policy passes)
   */
  otherwisePass(): IBusinessPolicy<T>;

  /**
   * Emit warning when condition is not met but don't fail
   */
  otherwiseWarn(message: string): IBusinessPolicy<T>;
}

export type PolicyCondition<T> = (entity: T, context: PolicyContext) => boolean | Promise<boolean>;

export interface PolicyDefinition<T> {
  readonly id: string;
  readonly domain: string;
  readonly name: string;
  readonly description?: string;
  readonly version?: string;
  readonly policy: IBusinessPolicy<T>;
  readonly tags?: string[];
  readonly metadata?: Record<string, unknown>;
  readonly createdAt?: Date;
  readonly createdBy?: string;
  readonly isActive?: boolean;
  readonly priority?: number;
}
