import type { Result } from '@vytches-ddd/utils';
import type { PolicyViolation } from '../models/policy-violation';
import type { PolicyMetadata } from '../models/policy-metadata';

/**
 * @llm-summary Contract for business policy functionality
 * @llm-domain Pattern
 * @llm-contract Required
 *
 * @description
 * BusinessPolicy interface implementing domain pattern implementation for business policy operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteBusinessPolicy implements IBusinessPolicy {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
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

/**
 * @llm-summary Contract for policy request functionality
 * @llm-domain Pattern
 * @llm-contract Required
 *
 * @description
 * PolicyRequest interface implementing domain pattern implementation for policy request operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcretePolicyRequest implements PolicyRequest {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
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

/**
 * @llm-summary Contract for policy context functionality
 * @llm-domain Pattern
 * @llm-contract Required
 *
 * @description
 * PolicyContext interface implementing domain pattern implementation for policy context operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcretePolicyContext implements PolicyContext {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface PolicyContext {
  /**
   * User ID performing the operation
   */
  readonly userId: string;

  /**
   * Optional tenant ID for multi-tenant applications
   */
  readonly tenantId?: string;

  /**
   * Optional session ID for request correlation
   */
  readonly sessionId?: string;

  /**
   * Timestamp when evaluation was requested
   */
  readonly timestamp: Date;

  /**
   * Environment where evaluation is happening (dev, staging, prod)
   */
  readonly environment: string;

  /**
   * Feature flags or toggles affecting policy behavior
   */
  readonly features: Record<string, boolean>;

  /**
   * Additional metadata for extensibility
   */
  readonly metadata: Record<string, unknown>;
}

/**
 * @llm-summary Contract for policy composer functionality
 * @llm-domain Pattern
 * @llm-contract Required
 *
 * @description
 * PolicyComposer interface implementing domain pattern implementation for policy composer operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcretePolicyComposer implements IPolicyComposer {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
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

/**
 * @llm-summary Contract for grouped policy composer functionality
 * @llm-domain Pattern
 * @llm-contract Required
 *
 * @description
 * GroupedPolicyComposer interface implementing domain pattern implementation for grouped policy composer operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteGroupedPolicyComposer implements IGroupedPolicyComposer {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface IGroupedPolicyComposer<T> extends IPolicyComposer<T> {
  /**
   * End the current group
   */
  endGroup(): IPolicyComposer<T>;
}

/**
 * @llm-summary Contract for policy conditional builder functionality
 * @llm-domain Pattern
 * @llm-contract Required
 *
 * @description
 * PolicyConditionalBuilder interface implementing domain pattern implementation for policy conditional builder operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcretePolicyConditionalBuilder implements IPolicyConditionalBuilder {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
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

/**
 * @llm-summary Contract for policy conditional else functionality
 * @llm-domain Pattern
 * @llm-contract Required
 *
 * @description
 * PolicyConditionalElse interface implementing domain pattern implementation for policy conditional else operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcretePolicyConditionalElse implements IPolicyConditionalElse {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
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

/**
 * @llm-summary Type definition for policy condition
 * @llm-domain Pattern
 * @llm-usage Frequent
 *
 * @description
 * PolicyCondition type implementing domain pattern implementation for policy condition operations.
 *
 * @example
 * ```typescript
 * // Usage example
 * const value: PolicyCondition = {} as PolicyCondition;
 * ```
 *
 * @since 1.0.0
 * @public
 */
export type PolicyCondition<T> = (entity: T, context: PolicyContext) => boolean | Promise<boolean>;

/**
 * @llm-summary Contract for policy definition functionality
 * @llm-domain Pattern
 * @llm-contract Required
 *
 * @description
 * PolicyDefinition interface implementing domain pattern implementation for policy definition operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcretePolicyDefinition implements PolicyDefinition {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
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
