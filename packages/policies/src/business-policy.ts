/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ISpecification, IValidator } from '@vytches-ddd/contracts';
import { Result } from '@vytches-ddd/utils';

import type {
  IBusinessPolicy,
  IPolicyComposer,
  IConditionalPolicyBuilder,
  PolicyRequest,
  PolicyCondition,
  PolicyContext,
  IAsyncSpecification,
} from './business-policy-interface';
import type { PolicyViolationSeverity } from './policy-violation';
import { PolicyViolation } from './policy-violation';
import { AndSpecification, NotSpecification, OrSpecification } from '@vytches-ddd/validation';
import { CompositePolicy, ConditionalPolicyBuilder } from './composite-policy';

/**
 * Base implementation of a business policy based on specifications
 * Provides foundation for all policy implementations with specification integration
 */
export class BusinessPolicy<T> implements IBusinessPolicy<T> {
  constructor(
    public readonly id: string,
    public readonly domain: string,
    public readonly version: string,
    private readonly specification: ISpecification<T>,
    private readonly violationCode: string,
    private readonly violationMessage: string,
    private readonly violationSeverity: PolicyViolationSeverity = 'ERROR',
    private readonly violationField?: string,
    private readonly violationDetails?: (entity: T, context: PolicyContext) => Record<string, any>
  ) {}

  /**
   * Quick boolean check if entity satisfies the policy
   */
  async isSatisfiedBy(request: PolicyRequest<T>): Promise<boolean> {
    return this.specification.isSatisfiedBy(request.entity);
  }

  /**
   * Primary method for policy evaluation with detailed result
   */
  async check(request: PolicyRequest<T>): Promise<Result<T, PolicyViolation>> {
    try {
      const isSatisfied = await this.isSatisfiedBy(request);

      if (isSatisfied) {
        return Result.ok(request.entity);
      }

      // Create violation with context
      const details = this.violationDetails
        ? this.violationDetails(request.entity, request.context)
        : undefined;

      const violation = new PolicyViolation(
        this.violationCode,
        this.violationMessage,
        this.violationSeverity,
        this.violationField,
        details,
        request.context
      );

      return Result.fail(violation);
    } catch (error) {
      // Handle specification evaluation errors
      const errorViolation = new PolicyViolation(
        `${this.violationCode}_EVALUATION_ERROR`,
        `Policy evaluation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'ERROR',
        this.violationField,
        { originalError: error },
        request.context
      );

      return Result.fail(errorViolation);
    }
  }

  /**
   * Combine this policy with another using AND logic
   */
  and(other: IBusinessPolicy<T>): IPolicyComposer<T> {
    return new CompositePolicy<T>('AND', [this, other]);
  }

  /**
   * Combine this policy with another using OR logic
   */
  or(other: IBusinessPolicy<T>): IPolicyComposer<T> {
    return new CompositePolicy<T>('OR', [this, other]);
  }

  /**
   * Negate this policy (NOT logic)
   */
  not(): IBusinessPolicy<T> {
    return new NotBusinessPolicy<T>(this);
  }

  /**
   * Add conditional logic to policy evaluation
   */
  when(condition: PolicyCondition<T>): IConditionalPolicyBuilder<T> {
    return new ConditionalPolicyBuilder<T>(this, condition);
  }

  /**
   * Create a business policy from a specification
   */
  static fromSpecification<T>(
    id: string,
    domain: string,
    specification: ISpecification<T>,
    violationCode: string,
    violationMessage: string,
    options?:
      | {
          version?: string | undefined;
          severity?: PolicyViolationSeverity | undefined;
          field?: string | undefined;
          detailsProvider?: (entity: T, context: PolicyContext) => Record<string, any>;
        }
      | undefined
  ): BusinessPolicy<T> {
    return new BusinessPolicy<T>(
      id,
      domain,
      options?.version || '1.0.0',
      specification,
      violationCode,
      violationMessage,
      options?.severity || 'ERROR',
      options?.field,
      options?.detailsProvider
    );
  }

  /**
   * Create a business policy from a validator
   */
  static fromValidator<T>(
    id: string,
    domain: string,
    validator: IValidator<T>,
    violationCode: string,
    violationMessage: string,
    options?: {
      version?: string;
      severity?: PolicyViolationSeverity;
      field?: string;
    }
  ): BusinessPolicy<T> {
    const spec: ISpecification<T> = {
      isSatisfiedBy(candidate: T): boolean {
        return validator.validate(candidate).isSuccess;
      },
      and(other) {
        return new AndSpecification(this, other);
      },
      or(other) {
        return new OrSpecification(this, other);
      },
      not() {
        return new NotSpecification(this);
      },
    };

    const detailsProvider = (entity: T, _context: PolicyContext) => {
      const result = validator.validate(entity);
      if (result.isFailure) {
        return {
          validationErrors: result.error.errors.map(e => ({
            property: e.property,
            message: e.message,
          })),
        };
      }
      return {};
    };

    return new BusinessPolicy<T>(
      id,
      domain,
      options?.version || '1.0.0',
      spec,
      violationCode,
      violationMessage,
      options?.severity || 'ERROR',
      options?.field,
      detailsProvider
    );
  }

  /**
   * Create a business policy from an async specification
   */
  static fromAsyncSpecification<T>(
    id: string,
    domain: string,
    specification: IAsyncSpecification<T>,
    violationCode: string,
    violationMessage: string,
    options?:
      | {
          version?: string | undefined;
          severity?: PolicyViolationSeverity | undefined;
          field?: string | undefined;
          detailsProvider?: (entity: T, context: PolicyContext) => Record<string, any> | undefined;
        }
      | undefined
  ): AsyncBusinessPolicy<T> {
    return new AsyncBusinessPolicy<T>(
      id,
      domain,
      options?.version || '1.0.0',
      specification,
      violationCode,
      violationMessage,
      options?.severity || 'ERROR',
      options?.field,
      options?.detailsProvider
    );
  }

  /**
   * Create a simple policy from a predicate function
   */
  static fromPredicate<T>(
    id: string,
    domain: string,
    predicate: (entity: T, context?: PolicyContext) => boolean,
    violationCode: string,
    violationMessage: string,
    options?: {
      version?: string;
      severity?: PolicyViolationSeverity;
      field?: string;
    }
  ): BusinessPolicy<T> {
    const spec: ISpecification<T> = {
      isSatisfiedBy(candidate: T): boolean {
        return predicate(candidate);
      },
      and(other) {
        return new AndSpecification(this, other);
      },
      or(other) {
        return new OrSpecification(this, other);
      },
      not() {
        return new NotSpecification(this);
      },
    };

    return new BusinessPolicy<T>(
      id,
      domain,
      options?.version || '1.0.0',
      spec,
      violationCode,
      violationMessage,
      options?.severity || 'ERROR',
      options?.field
    );
  }
}

/**
 * Async business policy for external service integrations
 */
export class AsyncBusinessPolicy<T> implements IBusinessPolicy<T> {
  constructor(
    public readonly id: string,
    public readonly domain: string,
    public readonly version: string,
    private readonly specification: IAsyncSpecification<T>,
    private readonly violationCode: string,
    private readonly violationMessage: string,
    private readonly violationSeverity: PolicyViolationSeverity = 'ERROR',
    private readonly violationField?: string | undefined,
    private readonly violationDetails?: (
      entity: T,
      context: PolicyContext
    ) => Record<string, any> | undefined
  ) {}

  async isSatisfiedBy(request: PolicyRequest<T>): Promise<boolean> {
    try {
      return await this.specification.isSatisfiedByAsync(request.entity, request.context);
    } catch (_error) {
      return false;
    }
  }

  async check(request: PolicyRequest<T>): Promise<Result<T, PolicyViolation>> {
    try {
      const isSatisfied = await this.specification.isSatisfiedByAsync(request.entity, request.context);

      if (isSatisfied) {
        return Result.ok(request.entity);
      }

      const details = this.violationDetails
        ? this.violationDetails(request.entity, request.context)
        : undefined;

      const violation = new PolicyViolation(
        this.violationCode,
        this.violationMessage,
        this.violationSeverity,
        this.violationField,
        details,
        request.context
      );

      return Result.fail(violation);
    } catch (error) {
      const errorViolation = new PolicyViolation(
        `${this.violationCode}_EVALUATION_ERROR`,
        `Async policy evaluation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'ERROR',
        this.violationField,
        { originalError: error },
        request.context
      );

      return Result.fail(errorViolation);
    }
  }

  and(other: IBusinessPolicy<T>): IPolicyComposer<T> {
    return new CompositePolicy<T>('AND', [this, other]);
  }

  or(other: IBusinessPolicy<T>): IPolicyComposer<T> {
    return new CompositePolicy<T>('OR', [this, other]);
  }

  not(): IBusinessPolicy<T> {
    return new NotBusinessPolicy<T>(this);
  }

  when(condition: PolicyCondition<T>): IConditionalPolicyBuilder<T> {
    return new ConditionalPolicyBuilder<T>(this, condition);
  }
}

/**
 * NOT policy wrapper - negates another policy
 */
class NotBusinessPolicy<T> implements IBusinessPolicy<T> {
  constructor(private readonly innerPolicy: IBusinessPolicy<T>) {}

  get id(): string {
    return `NOT_${this.innerPolicy.id}`;
  }
  get domain(): string {
    return this.innerPolicy.domain;
  }
  get version(): string {
    return this.innerPolicy.version;
  }

  async isSatisfiedBy(request: PolicyRequest<T>): Promise<boolean> {
    return !(await this.innerPolicy.isSatisfiedBy(request));
  }

  async check(request: PolicyRequest<T>): Promise<Result<T, PolicyViolation>> {
    const result = await this.innerPolicy.check(request);

    if (result.isFailure) {
      // Inner policy failed, so NOT policy succeeds
      return Result.ok(request.entity);
    } else {
      // Inner policy succeeded, so NOT policy fails
      const violation = new PolicyViolation(
        `NOT_${this.innerPolicy.id}`,
        `Policy ${this.innerPolicy.id} must not be satisfied`,
        'ERROR',
        undefined,
        undefined,
        request.context
      );
      return Result.fail(violation);
    }
  }

  and(other: IBusinessPolicy<T>): IPolicyComposer<T> {
    return new CompositePolicy<T>('AND', [this, other]);
  }

  or(other: IBusinessPolicy<T>): IPolicyComposer<T> {
    return new CompositePolicy<T>('OR', [this, other]);
  }

  not(): IBusinessPolicy<T> {
    return this.innerPolicy; // Double negation
  }

  when(condition: PolicyCondition<T>): IConditionalPolicyBuilder<T> {
    return new ConditionalPolicyBuilder<T>(this, condition);
  }
}

// PolicyComposer and ConditionalPolicy implementations moved to composite-policy.ts to avoid circular dependencies
