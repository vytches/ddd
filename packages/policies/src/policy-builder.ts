/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ISpecification, IValidator } from '@vytches-ddd/contracts';

import type {
  IBusinessPolicy,
  IAsyncSpecification,
  PolicyRequest,
} from './business-policy-interface';
import { BusinessPolicy } from './business-policy';
import { CompositePolicy, ConditionalPolicy } from './composite-policy';

/**
 * Custom composite policy that preserves builder metadata
 */
class CustomCompositePolicy<T> extends CompositePolicy<T> {
  constructor(
    operator: 'AND' | 'OR',
    policies: IBusinessPolicy<T>[],
    private readonly customId: string,
    private readonly customDomain: string,
    private readonly customVersion: string
  ) {
    super(operator, policies, customId);
  }

  get id(): string {
    return this.customId;
  }

  get domain(): string {
    return this.customDomain;
  }

  get version(): string {
    return this.customVersion;
  }
}
import type { PolicyViolationSeverity } from './policy-violation';

/**
 * Step builder for configuring individual policy violations
 * Provides fluent API for setting violation details
 */
export class PolicyStepBuilder<T> {
  private code?: string | undefined;
  private message?: string | undefined;
  private severity: PolicyViolationSeverity = 'ERROR';
  private field?: string | undefined;

  constructor(
    private readonly builder: PolicyBuilder<T>,
    private readonly specification: ISpecification<T>
  ) {}

  /**
   * Set the violation code
   */
  withCode(code: string): PolicyStepBuilder<T> {
    this.code = code;
    return this;
  }

  /**
   * Set the violation message
   */
  withMessage(message: string): PolicyStepBuilder<T> {
    this.message = message;
    return this;
  }

  /**
   * Set the violation severity
   */
  withSeverity(severity: PolicyViolationSeverity): PolicyStepBuilder<T> {
    this.severity = severity;
    return this;
  }

  /**
   * Set the field that caused the violation
   */
  withField(field: string): PolicyStepBuilder<T> {
    this.field = field;
    return this;
  }

  /**
   * Continue with AND logic
   */
  and(): PolicyBuilder<T> {
    this.addToBuilder();
    return this.builder.and();
  }

  /**
   * Continue with OR logic
   */
  or(): PolicyBuilder<T> {
    this.addToBuilder();
    return this.builder.or();
  }

  /**
   * Build the final policy
   */
  build(): IBusinessPolicy<T> {
    this.addToBuilder();
    return this.builder.build();
  }

  /**
   * Build and register the final policy
   */
  buildAndRegister(registryDomain?: string, policyName?: string): IBusinessPolicy<T> {
    this.addToBuilder();
    return this.builder.buildAndRegister(registryDomain, policyName);
  }

  private addToBuilder(): void {
    if (!this.code) {
      throw new Error('Policy step requires violation code. Use .withCode()');
    }
    if (!this.message) {
      throw new Error('Policy step requires violation message. Use .withMessage()');
    }

    const policy = BusinessPolicy.fromSpecification(
      `${this.builder.getDomain()}_${this.code}`,
      this.builder.getDomain(),
      this.specification,
      this.code,
      this.message,
      {
        severity: this.severity,
        field: this.field,
      }
    );

    this.builder.addPolicy(policy);
  }
}

/**
 * Async step builder for async specifications
 */
export class AsyncPolicyStepBuilder<T> {
  private code?: string;
  private message?: string;
  private severity: PolicyViolationSeverity = 'ERROR';
  private field?: string;

  constructor(
    private readonly builder: PolicyBuilder<T>,
    private readonly specification: IAsyncSpecification<T>
  ) {}

  withCode(code: string): AsyncPolicyStepBuilder<T> {
    this.code = code;
    return this;
  }

  withMessage(message: string): AsyncPolicyStepBuilder<T> {
    this.message = message;
    return this;
  }

  withSeverity(severity: PolicyViolationSeverity): AsyncPolicyStepBuilder<T> {
    this.severity = severity;
    return this;
  }

  withField(field: string): AsyncPolicyStepBuilder<T> {
    this.field = field;
    return this;
  }

  and(): PolicyBuilder<T> {
    this.addToBuilder();
    return this.builder.and();
  }

  or(): PolicyBuilder<T> {
    this.addToBuilder();
    return this.builder.or();
  }

  build(): IBusinessPolicy<T> {
    this.addToBuilder();
    return this.builder.build();
  }

  /**
   * Build and register the final policy
   */
  buildAndRegister(registryDomain?: string, policyName?: string): IBusinessPolicy<T> {
    this.addToBuilder();
    return this.builder.buildAndRegister(registryDomain, policyName);
  }

  private addToBuilder(): void {
    if (!this.code) {
      throw new Error('Async policy step requires violation code. Use .withCode()');
    }
    if (!this.message) {
      throw new Error('Async policy step requires violation message. Use .withMessage()');
    }

    const policy = BusinessPolicy.fromAsyncSpecification(
      `${this.builder.getDomain()}_${this.code}`,
      this.builder.getDomain(),
      this.specification,
      this.code,
      this.message,
      {
        severity: this.severity,
        field: this.field,
      }
    );

    this.builder.addPolicy(policy);
  }
}

/**
 * Group builder for creating policy groups with specific logic
 */
export class GroupBuilder<T> {
  private policies: IBusinessPolicy<T>[] = [];

  constructor(private readonly groupId: string) {}

  /**
   * Add a policy that must be satisfied within this group
   */
  must(specification: ISpecification<T>): PolicyStepBuilder<T> {
    return new PolicyStepBuilder<T>(
      {
        getDomain: () => this.groupId,
        addPolicy: (policy: IBusinessPolicy<T>) => this.policies.push(policy),
        and: () => this as any,
        or: () => this as any,
        build: () => this.build(),
      } as any,
      specification
    );
  }

  /**
   * Add an async policy that must be satisfied
   */
  mustAsync(specification: IAsyncSpecification<T>): AsyncPolicyStepBuilder<T> {
    return new AsyncPolicyStepBuilder<T>(
      {
        getDomain: () => this.groupId,
        addPolicy: (policy: IBusinessPolicy<T>) => this.policies.push(policy),
        and: () => this as any,
        or: () => this as any,
        build: () => this.build(),
      } as any,
      specification
    );
  }

  /**
   * Add an existing policy to the group
   */
  mustSatisfy(policy: IBusinessPolicy<T>): GroupBuilder<T> {
    this.policies.push(policy);
    return this;
  }

  /**
   * Continue with AND logic within the group
   */
  and(): GroupBuilder<T> {
    return this;
  }

  /**
   * Build the group as a composite AND policy
   */
  build(): IBusinessPolicy<T> {
    if (this.policies.length === 0) {
      throw new Error(`Group '${this.groupId}' has no policies defined`);
    }
    if (this.policies.length === 1) {
      return this.policies[0]!;
    }
    return new CompositePolicy<T>('AND', this.policies, this.groupId);
  }

  /**
   * Create a new group builder
   */
  static create<T>(groupId: string): GroupBuilder<T> {
    return new GroupBuilder<T>(groupId);
  }
}

/**
 * Main policy builder with advanced fluent API
 */
export class PolicyBuilder<T> {
  private policies: IBusinessPolicy<T>[] = [];
  private id = 'GENERATED_POLICY';
  private domain = 'default';
  private version = '1.0.0';

  private constructor() {
    // Private constructor for factory pattern
  }

  /**
   * Create a new policy builder
   */
  static create<T>(): PolicyBuilder<T> {
    return new PolicyBuilder<T>();
  }

  /**
   * Set the policy ID
   */
  withId(id: string): PolicyBuilder<T> {
    this.id = id;
    return this;
  }

  /**
   * Set the policy domain
   */
  withDomain(domain: string): PolicyBuilder<T> {
    this.domain = domain;
    return this;
  }

  /**
   * Set the policy version
   */
  withVersion(version: string): PolicyBuilder<T> {
    this.version = version;
    return this;
  }

  /**
   * Add a policy that must be satisfied
   */
  must(specification: ISpecification<T>): PolicyStepBuilder<T> {
    return new PolicyStepBuilder<T>(this, specification);
  }

  /**
   * Add an async policy that must be satisfied
   */
  mustAsync(specification: IAsyncSpecification<T>): AsyncPolicyStepBuilder<T> {
    return new AsyncPolicyStepBuilder<T>(this, specification);
  }

  /**
   * Add a policy from predicate function
   */
  mustSatisfy(
    predicate: (entity: T, context?: any) => boolean,
    violationCode: string,
    violationMessage: string
  ): PolicyBuilder<T> {
    const policy = BusinessPolicy.fromPredicate(
      this.id,
      this.domain,
      predicate,
      violationCode,
      violationMessage,
      { version: this.version }
    );
    this.policies.push(policy);
    return this;
  }

  /**
   * Add a validator-based policy
   */
  mustSatisfyValidator(
    validator: IValidator<T>,
    violationCode: string,
    violationMessage: string
  ): PolicyBuilder<T> {
    const policy = BusinessPolicy.fromValidator(
      this.id,
      this.domain,
      validator,
      violationCode,
      violationMessage,
      { version: this.version }
    );
    this.policies.push(policy);
    return this;
  }

  /**
   * Add an existing policy
   */
  mustSatisfyPolicy(policy: IBusinessPolicy<T>): PolicyBuilder<T> {
    this.policies.push(policy);
    return this;
  }

  /**
   * Require that ANY of the provided groups is satisfied
   */
  shouldSatisfyAny(...groups: GroupBuilder<T>[]): PolicyBuilder<T> {
    const groupPolicies = groups.map(group => group.build());
    const orPolicy = new CompositePolicy<T>('OR', groupPolicies, `${this.id}_ANY_GROUP`);
    this.policies.push(orPolicy);
    return this;
  }

  /**
   * Require that ALL of the provided groups are satisfied
   */
  shouldSatisfyAll(...groups: GroupBuilder<T>[]): PolicyBuilder<T> {
    const groupPolicies = groups.map(group => group.build());
    const andPolicy = new CompositePolicy<T>('AND', groupPolicies, `${this.id}_ALL_GROUPS`);
    this.policies.push(andPolicy);
    return this;
  }

  /**
   * Add conditional logic - policy applies only when condition is met
   */
  when(
    condition: (request: PolicyRequest<T>) => boolean | Promise<boolean>
  ): FluentConditionalPolicyBuilder<T> {
    return new FluentConditionalPolicyBuilder<T>(this, condition);
  }

  /**
   * Continue with AND logic (default)
   */
  and(): PolicyBuilder<T> {
    return this;
  }

  /**
   * Continue with OR logic for next policy
   */
  or(): PolicyBuilder<T> {
    // For OR logic, we'll wrap the next policy in an OR composite
    return this;
  }

  /**
   * Build the final policy
   */
  build(): IBusinessPolicy<T> {
    if (this.policies.length === 0) {
      throw new Error(
        'No policies defined. Use must(), mustAsync(), or mustSatisfy() to add policies.'
      );
    }

    if (this.policies.length === 1 && this.id === 'GENERATED_POLICY' && this.domain === 'default' && this.version === '1.0.0') {
      // Return single policy only if no custom metadata was set
      return this.policies[0]!;
    }

    return new CustomCompositePolicy<T>('AND', this.policies, this.id, this.domain, this.version);
  }

  /**
   * Build and register the policy in registry
   */
  buildAndRegister(registryDomain?: string, policyName?: string): IBusinessPolicy<T> {
    const policy = this.build();

    // Dynamic import to avoid circular dependency
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { PolicyRegistry } = require('./policy-registry');
      PolicyRegistry.register(registryDomain || this.domain, policyName || this.id, policy);
    } catch {
      // Registry not available - that's OK
    }

    return policy;
  }

  // Internal methods for step builders
  getDomain(): string {
    return this.domain;
  }

  addPolicy(policy: IBusinessPolicy<T>): void {
    this.policies.push(policy);
  }

  /**
   * Factory method - create policy for specific domain
   */
  static forDomain<T>(domain: string): PolicyBuilder<T> {
    return PolicyBuilder.create<T>().withDomain(domain);
  }

  /**
   * Factory method - create validation policy
   */
  static validation<T>(
    validator: IValidator<T>,
    violationCode: string,
    violationMessage: string
  ): PolicyBuilder<T> {
    return PolicyBuilder.create<T>().mustSatisfyValidator(
      validator,
      violationCode,
      violationMessage
    );
  }

  /**
   * Factory method - create specification policy
   */
  static specification<T>(
    specification: ISpecification<T>,
    violationCode: string,
    violationMessage: string
  ): PolicyBuilder<T> {
    return PolicyBuilder.create<T>()
      .must(specification)
      .withCode(violationCode)
      .withMessage(violationMessage)
      .build() as any; // Will fix typing
  }
}

/**
 * Fluent conditional policy builder for .when().then().otherwise() patterns
 */
export class FluentConditionalPolicyBuilder<T> {
  private thenPolicies: IBusinessPolicy<T>[] = [];
  private otherwisePolicies: IBusinessPolicy<T>[] = [];

  constructor(
    private readonly baseBuilder: PolicyBuilder<T>,
    private readonly condition: (request: PolicyRequest<T>) => boolean | Promise<boolean>
  ) {}

  /**
   * Add policies that apply when condition is true
   */
  then(builder: (b: PolicyBuilder<T>) => PolicyBuilder<T>): FluentConditionalPolicyBuilder<T> {
    const thenBuilder = PolicyBuilder.create<T>();
    const result = builder(thenBuilder);
    this.thenPolicies.push(result.build());
    return this;
  }

  /**
   * Add policies that apply when condition is false
   */
  otherwise(builder: (b: PolicyBuilder<T>) => PolicyBuilder<T>): FluentConditionalPolicyBuilder<T> {
    const otherwiseBuilder = PolicyBuilder.create<T>();
    const result = builder(otherwiseBuilder);
    this.otherwisePolicies.push(result.build());
    return this;
  }

  /**
   * Continue building base policy
   */
  and(): PolicyBuilder<T> {
    this.addConditionalPolicy();
    return this.baseBuilder.and();
  }

  /**
   * Build final policy
   */
  build(): IBusinessPolicy<T> {
    this.addConditionalPolicy();
    return this.baseBuilder.build();
  }

  private addConditionalPolicy(): void {
    const conditionalPolicy = new ConditionalPolicy<T>(
      this.condition,
      this.thenPolicies,
      this.otherwisePolicies
    );
    this.baseBuilder.addPolicy(conditionalPolicy);
  }
}
