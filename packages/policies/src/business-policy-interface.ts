import type { Result } from '@vytches-ddd/utils';

import type { PolicyViolation } from './policy-violation';

/**
 * Request object for policy evaluation containing entity and required context
 */
export interface PolicyRequest<T> {
  /** The entity to validate */
  entity: T;
  /** Required context for audit trail and business logic */
  context: PolicyContext;
  /** Optional metadata for the request */
  metadata?: PolicyMetadata;
}

/**
 * Context information required for all policy evaluations
 * Provides audit trail, multi-tenancy, and business context
 */
export interface PolicyContext {
  /** User ID initiating the policy check */
  userId: string;
  /** Tenant/organization ID for multi-tenant systems */
  tenantId?: string;
  /** Session ID for request tracing */
  sessionId?: string;
  /** Timestamp of policy evaluation */
  timestamp: Date;
  /** Environment context (dev, test, prod) */
  environment: string;
  /** Feature flags affecting policy behavior */
  features: Record<string, boolean>;
  /** Additional context metadata */
  metadata: Record<string, unknown>;
}

/**
 * Additional metadata for policy requests
 */
export interface PolicyMetadata {
  /** Request source/origin */
  source?: string;
  /** Correlation ID for distributed tracing */
  correlationId?: string;
  /** Additional custom metadata */
  custom?: Record<string, unknown>;
}

/**
 * Unified interface for business policies (async-first design)
 * All policies return Promises for consistent API and future-proofing
 */
export interface IBusinessPolicy<T> {
  /** Unique identifier for the policy */
  readonly id: string;
  /** Domain/bounded context the policy belongs to */
  readonly domain: string;
  /** Version of the policy for tracking changes */
  readonly version: string;

  /**
   * Validate entity against the policy and return detailed result
   * This is the primary method for policy evaluation
   */
  check(request: PolicyRequest<T>): Promise<Result<T, PolicyViolation>>;

  /**
   * Quick boolean check if entity satisfies the policy
   * Convenience method for simple true/false checks
   */
  isSatisfiedBy(request: PolicyRequest<T>): Promise<boolean>;

  /**
   * Combine this policy with another using AND logic
   * Returns a composer for fluent API chaining
   */
  and(other: IBusinessPolicy<T>): IPolicyComposer<T>;

  /**
   * Combine this policy with another using OR logic
   * Returns a composer for fluent API chaining
   */
  or(other: IBusinessPolicy<T>): IPolicyComposer<T>;

  /**
   * Negate this policy (NOT logic)
   * Returns a new policy that succeeds when this one fails
   */
  not(): IBusinessPolicy<T>;

  /**
   * Add conditional logic to policy evaluation
   * Policy is only evaluated if condition is met
   */
  when(condition: PolicyCondition<T>): IConditionalPolicyBuilder<T>;
}

/**
 * Policy composer for building complex policy combinations
 * Supports fluent API for readable policy composition
 */
export interface IPolicyComposer<T> {
  /**
   * Continue with AND logic
   */
  and(other: IBusinessPolicy<T>): IPolicyComposer<T>;

  /**
   * Continue with OR logic
   */
  or(other: IBusinessPolicy<T>): IPolicyComposer<T>;

  /**
   * Add conditional evaluation
   */
  when(condition: PolicyCondition<T>): IConditionalPolicyBuilder<T>;

  /**
   * Build the final composed policy
   */
  build(): IBusinessPolicy<T>;
}

/**
 * Builder for conditional policy logic
 * Enables .when().then().otherwise() patterns
 */
export interface IConditionalPolicyBuilder<T> {
  /**
   * Policy to apply when condition is true
   */
  then(policy: IBusinessPolicy<T>): IConditionalPolicyBuilder<T>;

  /**
   * Policy to apply when condition is false
   */
  otherwise(policy: IBusinessPolicy<T>): IConditionalPolicyBuilder<T>;

  /**
   * Continue building the policy
   */
  and(other: IBusinessPolicy<T>): IPolicyComposer<T>;

  /**
   * Continue building the policy
   */
  or(other: IBusinessPolicy<T>): IPolicyComposer<T>;

  /**
   * Build the final conditional policy
   */
  build(): IBusinessPolicy<T>;
}

/**
 * Condition function for conditional policy evaluation
 */
export type PolicyCondition<T> = (request: PolicyRequest<T>) => boolean | Promise<boolean>;

/**
 * Extended specification interface for async operations
 * Builds on existing ISpecification from @vytches-ddd/contracts
 */
export interface IAsyncSpecification<T> {
  /**
   * Asynchronously check if candidate satisfies the specification
   */
  isSatisfiedByAsync(candidate: T, context?: PolicyContext): Promise<boolean>;
}
