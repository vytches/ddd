import { Result } from '@vytches-ddd/utils';

import { PolicyViolation, PolicyViolationCollection } from './policy-violation';
import type {
  IBusinessPolicy,
  IPolicyComposer,
  IConditionalPolicyBuilder,
  PolicyRequest,
  PolicyCondition,
} from './business-policy-interface';

/**
 * Composite policy that combines multiple policies with AND/OR logic
 * Supports complex policy compositions with performance optimizations
 */
export class CompositePolicy<T> implements IBusinessPolicy<T> {
  constructor(
    private readonly operator: 'AND' | 'OR',
    private readonly policies: IBusinessPolicy<T>[],
    private readonly compositeId?: string | undefined
  ) {}

  get id(): string {
    return (
      this.compositeId || `COMPOSITE_${this.operator}_${this.policies.map(p => p.id).join('_')}`
    );
  }

  get domain(): string {
    // Use the first policy's domain, or 'composite' if policies from different domains
    const domains = Array.from(new Set(this.policies.map(p => p.domain)));
    return domains.length === 1 ? (domains[0] as string) : 'composite';
  }

  get version(): string {
    // Use latest version from all policies
    const versions = this.policies.map(p => p.version).sort();
    return versions[versions.length - 1] || '1.0.0';
  }

  /**
   * Quick boolean check with early exit optimization
   */
  async isSatisfiedBy(request: PolicyRequest<T>): Promise<boolean> {
    if (this.operator === 'AND') {
      // For AND: stop at first failure
      for (const policy of this.policies) {
        const result = await policy.isSatisfiedBy(request);
        if (!result) return false;
      }
      return true;
    } else {
      // For OR: stop at first success
      for (const policy of this.policies) {
        const result = await policy.isSatisfiedBy(request);
        if (result) return true;
      }
      return false;
    }
  }

  /**
   * Detailed policy evaluation with violation collection
   */
  async check(request: PolicyRequest<T>): Promise<Result<T, PolicyViolation>> {
    const violations = new PolicyViolationCollection();

    for (const policy of this.policies) {
      try {
        const result = await policy.check(request);

        if (result.isFailure) {
          violations.add(result.error);

          // For AND: stop at first failure for performance
          if (this.operator === 'AND') {
            break;
          }
        } else if (this.operator === 'OR') {
          // For OR: one success is enough
          return Result.ok(request.entity);
        }
      } catch (error) {
        // Handle policy evaluation errors
        const errorViolation = new PolicyViolation(
          `${policy.id}_EVALUATION_ERROR`,
          `Policy ${policy.id} evaluation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'ERROR',
          undefined,
          { originalError: error, policyId: policy.id },
          request.context
        );
        violations.add(errorViolation);

        if (this.operator === 'AND') {
          // For AND logic, return evaluation error immediately
          return Result.fail(errorViolation);
        }
      }
    }

    // Determine if composite policy failed
    const hasFailed =
      this.operator === 'AND'
        ? violations.hasViolations()
        : violations.count() === this.policies.length;

    if (hasFailed) {
      const compositeViolation = this.createCompositeViolation(violations, request);
      return Result.fail(compositeViolation);
    }

    return Result.ok(request.entity);
  }

  /**
   * Create a composite violation from multiple violations
   */
  private createCompositeViolation(
    violations: PolicyViolationCollection,
    request: PolicyRequest<T>
  ): PolicyViolation {
    const codes = violations.getAll().map(v => v.code);
    const messages = violations.getAll().map(v => v.message);

    const code = codes.join(this.operator === 'AND' ? '.' : '/');
    const message = messages.join(this.operator === 'AND' ? ' AND ' : ' OR ');

    // Determine severity: ERROR if any error, WARNING if any warning, otherwise INFO
    const severity = violations.hasErrors()
      ? 'ERROR'
      : violations.getWarnings().length > 0
        ? 'WARNING'
        : 'INFO';

    return new PolicyViolation(
      code,
      `Composite policy failed: ${message}`,
      severity,
      undefined,
      {
        operator: this.operator,
        violationCount: violations.count(),
        policyIds: this.policies.map(p => p.id),
        violations: violations.toJSON(),
      },
      request.context
    );
  }

  /**
   * Combine with another policy using AND logic
   */
  and(other: IBusinessPolicy<T>): IPolicyComposer<T> {
    if (this.operator === 'AND') {
      return new PolicyComposer<T>([...this.policies, other], 'AND');
    }
    return new PolicyComposer<T>([this, other], 'AND');
  }

  /**
   * Combine with another policy using OR logic
   */
  or(other: IBusinessPolicy<T>): IPolicyComposer<T> {
    if (this.operator === 'OR') {
      return new PolicyComposer<T>([...this.policies, other], 'OR');
    }
    return new PolicyComposer<T>([this, other], 'OR');
  }

  /**
   * Negate this composite policy
   */
  not(): IBusinessPolicy<T> {
    return new NotCompositePolicy<T>(this);
  }

  /**
   * Add conditional logic
   */
  when(condition: PolicyCondition<T>): IConditionalPolicyBuilder<T> {
    return new ConditionalPolicyBuilder<T>(this, condition);
  }

  /**
   * Build method for IPolicyComposer compatibility
   */
  build(): IBusinessPolicy<T> {
    return this;
  }

  /**
   * Get all composed policies
   */
  getPolicies(): readonly IBusinessPolicy<T>[] {
    return this.policies;
  }

  /**
   * Get the logical operator
   */
  getOperator(): 'AND' | 'OR' {
    return this.operator;
  }
}

/**
 * NOT composite policy - negates the entire composite
 */
class NotCompositePolicy<T> implements IBusinessPolicy<T> {
  constructor(private readonly innerComposite: CompositePolicy<T>) {}

  get id(): string {
    return `NOT_${this.innerComposite.id}`;
  }
  get domain(): string {
    return this.innerComposite.domain;
  }
  get version(): string {
    return this.innerComposite.version;
  }

  async isSatisfiedBy(request: PolicyRequest<T>): Promise<boolean> {
    return !(await this.innerComposite.isSatisfiedBy(request));
  }

  async check(request: PolicyRequest<T>): Promise<Result<T, PolicyViolation>> {
    const result = await this.innerComposite.check(request);

    if (result.isFailure) {
      // Inner composite failed, so NOT composite succeeds
      return Result.ok(request.entity);
    } else {
      // Inner composite succeeded, so NOT composite fails
      const violation = new PolicyViolation(
        `NOT_${this.innerComposite.id}`,
        `Composite policy ${this.innerComposite.id} must not be satisfied`,
        'ERROR',
        undefined,
        {
          negatedComposite: this.innerComposite.id,
          operator: this.innerComposite.getOperator(),
          policyCount: this.innerComposite.getPolicies().length,
        },
        request.context
      );
      return Result.fail(violation);
    }
  }

  and(other: IBusinessPolicy<T>): IPolicyComposer<T> {
    return new PolicyComposer<T>([this, other], 'AND');
  }

  or(other: IBusinessPolicy<T>): IPolicyComposer<T> {
    return new PolicyComposer<T>([this, other], 'OR');
  }

  not(): IBusinessPolicy<T> {
    return this.innerComposite; // Double negation
  }

  when(_condition: PolicyCondition<T>): IConditionalPolicyBuilder<T> {
    throw new Error('ConditionalPolicyBuilder implementation needed');
  }
}

/**
 * Policy composer implementation - creates CompositePolicy instances
 */
class PolicyComposer<T> implements IPolicyComposer<T> {
  constructor(
    private readonly policies: IBusinessPolicy<T>[],
    private readonly operator: 'AND' | 'OR'
  ) {}

  and(other: IBusinessPolicy<T>): IPolicyComposer<T> {
    if (this.operator === 'AND') {
      return new PolicyComposer<T>([...this.policies, other], 'AND');
    }
    return new PolicyComposer<T>([this.build(), other], 'AND');
  }

  or(other: IBusinessPolicy<T>): IPolicyComposer<T> {
    if (this.operator === 'OR') {
      return new PolicyComposer<T>([...this.policies, other], 'OR');
    }
    return new PolicyComposer<T>([this.build(), other], 'OR');
  }

  when(condition: PolicyCondition<T>): IConditionalPolicyBuilder<T> {
    return new ConditionalPolicyBuilder<T>(this.build(), condition);
  }

  build(): IBusinessPolicy<T> {
    if (this.policies.length === 1) {
      return this.policies[0] as IBusinessPolicy<T>;
    }
    return new CompositePolicy<T>(this.operator, this.policies);
  }
}

/**
 * Conditional policy implementation
 */
export class ConditionalPolicy<T> implements IBusinessPolicy<T> {
  constructor(
    private readonly condition: (request: PolicyRequest<T>) => boolean | Promise<boolean>,
    private readonly thenPolicies: IBusinessPolicy<T>[],
    private readonly otherwisePolicies: IBusinessPolicy<T>[]
  ) {}

  get id(): string {
    return 'CONDITIONAL_POLICY';
  }

  get domain(): string {
    return 'conditional';
  }

  get version(): string {
    return '1.0.0';
  }

  async isSatisfiedBy(request: PolicyRequest<T>): Promise<boolean> {
    const conditionResult = await this.condition(request);
    const policiesToCheck = conditionResult ? this.thenPolicies : this.otherwisePolicies;

    for (const policy of policiesToCheck) {
      const result = await policy.isSatisfiedBy(request);
      if (!result) return false;
    }

    return true;
  }

  async check(request: PolicyRequest<T>): Promise<Result<T, PolicyViolation>> {
    const conditionResult = await this.condition(request);
    const policiesToCheck = conditionResult ? this.thenPolicies : this.otherwisePolicies;

    for (const policy of policiesToCheck) {
      const result = await policy.check(request);
      if (result.isFailure) return result;
    }

    return Result.ok(request.entity);
  }

  and(other: IBusinessPolicy<T>): IPolicyComposer<T> {
    return new CompositePolicy<T>('AND', [this, other]);
  }

  or(other: IBusinessPolicy<T>): IPolicyComposer<T> {
    return new CompositePolicy<T>('OR', [this, other]);
  }

  not(): IBusinessPolicy<T> {
    // NOT of conditional negates the entire conditional logic
    return new NotBusinessPolicy<T>(this);
  }

  when(_condition: PolicyCondition<T>): IConditionalPolicyBuilder<T> {
    throw new Error('Nested conditional policies are not supported');
  }
}

/**
 * Conditional policy builder implementation
 */
export class ConditionalPolicyBuilder<T> implements IConditionalPolicyBuilder<T> {
  private thenPolicy?: IBusinessPolicy<T>;
  private otherwisePolicy?: IBusinessPolicy<T>;

  constructor(
    private readonly basePolicy: IBusinessPolicy<T>,
    private readonly condition: PolicyCondition<T>
  ) {}

  then(policy: IBusinessPolicy<T>): IConditionalPolicyBuilder<T> {
    this.thenPolicy = policy;
    return this;
  }

  otherwise(policy: IBusinessPolicy<T>): IConditionalPolicyBuilder<T> {
    this.otherwisePolicy = policy;
    return this;
  }

  and(other: IBusinessPolicy<T>): IPolicyComposer<T> {
    const conditionalPolicy = this.buildConditional();
    return new CompositePolicy<T>('AND', [this.basePolicy, conditionalPolicy, other]);
  }

  or(other: IBusinessPolicy<T>): IPolicyComposer<T> {
    const conditionalPolicy = this.buildConditional();
    return new CompositePolicy<T>('OR', [this.basePolicy, conditionalPolicy, other]);
  }

  build(): IBusinessPolicy<T> {
    const conditionalPolicy = this.buildConditional();
    return new CompositePolicy<T>('AND', [this.basePolicy, conditionalPolicy]);
  }

  private buildConditional(): IBusinessPolicy<T> {
    const thenPolicies = this.thenPolicy ? [this.thenPolicy] : [];
    const otherwisePolicies = this.otherwisePolicy ? [this.otherwisePolicy] : [];

    return new ConditionalPolicy<T>(this.condition, thenPolicies, otherwisePolicies);
  }
}

/**
 * NOT wrapper for any business policy
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
      return Result.ok(request.entity);
    } else {
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

  when(_condition: PolicyCondition<T>): IConditionalPolicyBuilder<T> {
    throw new Error('Conditional logic on NOT policies is not supported');
  }
}
