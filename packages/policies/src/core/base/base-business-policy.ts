import { Result } from '@vytches/ddd-utils';
import type { ISpecification, IAsyncSpecification } from '@vytches/ddd-contracts';
import type {
  IBusinessPolicy,
  IPolicyComposer,
  IPolicyConditionalBuilder,
  IPolicyConditionalElse,
  IGroupedPolicyComposer,
  PolicyRequest,
  PolicyCondition,
  PolicyContext,
} from '../interfaces/business-policy.interface';
import { PolicyViolation } from '../models/policy-violation';

/**
 * @llm-summary BaseBusinessPolicy class for base business policy operations
 * @llm-domain Pattern
 * @llm-complexity Medium
 *
 * @description
 * BaseBusinessPolicy class implementing domain pattern implementation for base business policy operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new BaseBusinessPolicy();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new BaseBusinessPolicy());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export abstract class BaseBusinessPolicy<T> implements IBusinessPolicy<T> {
  /**
   * Unique identifier for this policy
   */
  public readonly id: string;

  /**
   * Domain this policy belongs to
   */
  public readonly domain: string;

  /**
   * Descriptive name for this policy
   */
  public readonly name: string;

  constructor(id: string, domain: string, name: string) {
    this.id = id;
    this.domain = domain;
    this.name = name;
  }

  /**
   * Abstract method that subclasses must implement
   * Contains the actual policy evaluation logic
   */
  public abstract check(request: PolicyRequest<T>): Promise<Result<T, PolicyViolation>>;

  /**
   * Combine this policy with another using AND logic
   */
  public and(other: IBusinessPolicy<T>): IPolicyComposer<T> {
    return new AndPolicyComposer<T>(this, other);
  }

  /**
   * Combine this policy with another using OR logic
   */
  public or(other: IBusinessPolicy<T>): IPolicyComposer<T> {
    return new OrPolicyComposer<T>(this, other);
  }

  /**
   * Negate this policy
   */
  public not(): IBusinessPolicy<T> {
    return new NotPolicy<T>(this);
  }

  /**
   * Add conditional logic to this policy
   */
  public when(condition: PolicyCondition<T>): IPolicyConditionalBuilder<T> {
    return new ConditionalPolicyBuilder<T>(this, condition);
  }

  /**
   * Helper method to create success result
   */
  protected success(entity: T): Promise<Result<T, PolicyViolation>> {
    return Promise.resolve(Result.ok(entity));
  }

  /**
   * Helper method to create failure result
   */
  protected failure(violation: PolicyViolation): Promise<Result<T, PolicyViolation>> {
    return Promise.resolve(Result.fail(violation));
  }

  /**
   * Helper method to create violation with policy context
   */
  protected createViolation(
    code: string,
    message: string,
    severity: 'ERROR' | 'WARNING' | 'INFO' = 'ERROR',
    options: Partial<{
      field: string;
      details: Record<string, unknown>;
      context: unknown;
    }> = {}
  ): PolicyViolation {
    return new PolicyViolation({
      code,
      message,
      severity,
      ...(options.field ? { field: options.field } : {}),
      ...(options.details ? { details: options.details } : {}),
      ...(options.context ? { context: options.context as PolicyContext } : {}),
      policyId: this.id,
      domain: this.domain,
    });
  }
}

/**
 * @llm-summary SpecificationPolicy class for specification policy operations
 * @llm-domain Pattern
 * @llm-complexity Medium
 *
 * @description
 * SpecificationPolicy class implementing domain pattern implementation for specification policy operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new SpecificationPolicy();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new SpecificationPolicy());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class SpecificationPolicy<T> extends BaseBusinessPolicy<T> {
  constructor(
    id: string,
    domain: string,
    name: string,
    private readonly specification: ISpecification<T>,
    private readonly errorCode = 'SPECIFICATION_FAILED',
    private readonly errorMessage = 'Specification failed'
  ) {
    super(id, domain, name);
  }

  public async check(request: PolicyRequest<T>): Promise<Result<T, PolicyViolation>> {
    try {
      const satisfied = this.specification.isSatisfiedBy(request.entity);

      if (satisfied) {
        return this.success(request.entity);
      }

      const explanation = this.specification.explainFailure?.(request.entity);
      const message = explanation || this.errorMessage;

      const violation = this.createViolation(this.errorCode, message, 'ERROR', {
        context: request.context,
      });

      return this.failure(violation);
    } catch (error) {
      const violation = this.createViolation(
        'SPECIFICATION_ERROR',
        `Specification evaluation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'ERROR',
        { context: request.context, details: { originalError: error } }
      );

      return this.failure(violation);
    }
  }

  /**
   * Create a policy from a specification
   */
  public static fromSpecification<T>(
    id: string,
    domain: string,
    name: string,
    specification: ISpecification<T>,
    errorCode?: string,
    errorMessage?: string
  ): SpecificationPolicy<T> {
    return new SpecificationPolicy(id, domain, name, specification, errorCode, errorMessage);
  }
}

/**
 * @llm-summary AsyncSpecificationPolicy class for async specification policy operations
 * @llm-domain Pattern
 * @llm-complexity Medium
 *
 * @description
 * AsyncSpecificationPolicy class implementing domain pattern implementation for async specification policy operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new AsyncSpecificationPolicy();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new AsyncSpecificationPolicy());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class AsyncSpecificationPolicy<T> extends BaseBusinessPolicy<T> {
  constructor(
    id: string,
    domain: string,
    name: string,
    private readonly specification: IAsyncSpecification<T>,
    private readonly errorCode = 'ASYNC_SPECIFICATION_FAILED',
    private readonly errorMessage = 'Async specification failed'
  ) {
    super(id, domain, name);
  }

  public async check(request: PolicyRequest<T>): Promise<Result<T, PolicyViolation>> {
    try {
      const satisfied = await this.specification.isSatisfiedByAsync(
        request.entity,
        request.context.metadata
      );

      if (satisfied) {
        return this.success(request.entity);
      }

      const explanation = await this.specification.explainFailureAsync?.(
        request.entity,
        request.context.metadata
      );
      const message = explanation || this.errorMessage;

      const violation = this.createViolation(this.errorCode, message, 'ERROR', {
        context: request.context,
      });

      return this.failure(violation);
    } catch (error) {
      const violation = this.createViolation(
        'ASYNC_SPECIFICATION_ERROR',
        `Async specification evaluation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'ERROR',
        { context: request.context, details: { originalError: error } }
      );

      return this.failure(violation);
    }
  }

  /**
   * Create a policy from an async specification
   */
  public static fromAsyncSpecification<T>(
    id: string,
    domain: string,
    name: string,
    specification: IAsyncSpecification<T>,
    errorCode?: string,
    errorMessage?: string
  ): AsyncSpecificationPolicy<T> {
    return new AsyncSpecificationPolicy(id, domain, name, specification, errorCode, errorMessage);
  }
}

/**
 * @llm-summary BaseCompositePolicy class for base composite policy operations
 * @llm-domain Pattern
 * @llm-complexity Medium
 *
 * @description
 * BaseCompositePolicy class implementing domain pattern implementation for base composite policy operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new BaseCompositePolicy();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new BaseCompositePolicy());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export abstract class BaseCompositePolicy<T> extends BaseBusinessPolicy<T> {
  protected readonly policies: IBusinessPolicy<T>[];

  constructor(id: string, domain: string, name: string, policies: IBusinessPolicy<T>[]) {
    super(id, domain, name);
    this.policies = [...policies];
  }

  /**
   * Get all child policies
   */
  public getChildPolicies(): readonly IBusinessPolicy<T>[] {
    return [...this.policies];
  }
}

// Helper classes for policy composition

class AndPolicyComposer<T> extends BaseCompositePolicy<T> implements IPolicyComposer<T> {
  constructor(left: IBusinessPolicy<T>, right: IBusinessPolicy<T>) {
    super(`${left.id}_AND_${right.id}`, left.domain, `${left.name} AND ${right.name}`, [
      left,
      right,
    ]);
  }

  public async check(request: PolicyRequest<T>): Promise<Result<T, PolicyViolation>> {
    for (const policy of this.policies) {
      const result = await policy.check(request);
      if (result.isFailure) {
        return result;
      }
    }
    return this.success(request.entity);
  }

  public group(): IGroupedPolicyComposer<T> {
    // TODO: Implement grouping
    throw new Error('Grouping not yet implemented');
  }
}

class OrPolicyComposer<T> extends BaseCompositePolicy<T> implements IPolicyComposer<T> {
  constructor(left: IBusinessPolicy<T>, right: IBusinessPolicy<T>) {
    super(`${left.id}_OR_${right.id}`, left.domain, `${left.name} OR ${right.name}`, [left, right]);
  }

  public async check(request: PolicyRequest<T>): Promise<Result<T, PolicyViolation>> {
    const violations: PolicyViolation[] = [];

    for (const policy of this.policies) {
      const result = await policy.check(request);
      if (result.isSuccess) {
        return result;
      }
      violations.push(result.error);
    }

    // All policies failed, return the first violation
    if (violations.length === 0) {
      const violation = this.createViolation(
        'OR_POLICY_ALL_FAILED',
        'All OR policy conditions failed',
        'ERROR'
      );
      return this.failure(violation);
    }
    return this.failure(violations[0]!);
  }

  public group(): IGroupedPolicyComposer<T> {
    // TODO: Implement grouping
    throw new Error('Grouping not yet implemented');
  }
}

class NotPolicy<T> extends BaseBusinessPolicy<T> {
  constructor(private readonly innerPolicy: IBusinessPolicy<T>) {
    super(`NOT_${innerPolicy.id}`, innerPolicy.domain, `NOT ${innerPolicy.name}`);
  }

  public async check(request: PolicyRequest<T>): Promise<Result<T, PolicyViolation>> {
    const result = await this.innerPolicy.check(request);

    if (result.isSuccess) {
      const violation = this.createViolation(
        'NEGATED_POLICY_PASSED',
        `Negated policy passed when it should have failed: ${this.innerPolicy.name}`,
        'ERROR',
        { context: request.context }
      );
      return this.failure(violation);
    } else {
      return this.success(request.entity);
    }
  }
}

class ConditionalPolicyBuilder<T> implements IPolicyConditionalBuilder<T> {
  constructor(
    private readonly policy: IBusinessPolicy<T>,
    private readonly condition: PolicyCondition<T>
  ) {}

  public then(policy: IBusinessPolicy<T>): IPolicyConditionalElse<T> {
    // TODO: Implement conditional policy
    throw new Error('Conditional policies not yet implemented');
  }

  public thenMust(specification: unknown): IPolicyConditionalElse<T> {
    // TODO: Implement conditional policy with specification
    throw new Error('Conditional policies not yet implemented');
  }
}
