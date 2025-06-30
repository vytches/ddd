import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Result } from '@vytches-ddd/utils';
import { CompositePolicy, ConditionalPolicy, ConditionalPolicyBuilder } from './composite-policy';
import { PolicyViolation, PolicyViolationCollection } from './policy-violation';
import { PolicyContextBuilder, PolicyRequestBuilder } from './policy-context';
import type { IBusinessPolicy, PolicyRequest, PolicyCondition } from './business-policy-interface';

describe('CompositePolicy', () => {
  interface TestEntity {
    id: string;
    value: number;
    isValid: boolean;
  }

  let mockPolicy1: IBusinessPolicy<TestEntity>;
  let mockPolicy2: IBusinessPolicy<TestEntity>;
  let mockPolicy3: IBusinessPolicy<TestEntity>;
  let testEntity: TestEntity;
  let testRequest: PolicyRequest<TestEntity>;

  beforeEach(() => {
    mockPolicy1 = {
      id: 'policy-1',
      domain: 'test-domain',
      version: '1.0.0',
      check: vi.fn(),
      isSatisfiedBy: vi.fn(),
      and: vi.fn(),
      or: vi.fn(),
      not: vi.fn(),
      when: vi.fn(),
    };

    mockPolicy2 = {
      id: 'policy-2',
      domain: 'test-domain',
      version: '1.1.0',
      check: vi.fn(),
      isSatisfiedBy: vi.fn(),
      and: vi.fn(),
      or: vi.fn(),
      not: vi.fn(),
      when: vi.fn(),
    };

    mockPolicy3 = {
      id: 'policy-3',
      domain: 'other-domain',
      version: '2.0.0',
      check: vi.fn(),
      isSatisfiedBy: vi.fn(),
      and: vi.fn(),
      or: vi.fn(),
      not: vi.fn(),
      when: vi.fn(),
    };

    testEntity = { id: 'test-1', value: 10, isValid: true };

    const context = PolicyContextBuilder.forUser('user-123', 'test');
    testRequest = PolicyRequestBuilder.create<TestEntity>()
      .withEntity(testEntity)
      .withContext(context)
      .build();
  });

  describe('constructor and properties', () => {
    it('should create AND composite policy', () => {
      const composite = new CompositePolicy('AND', [mockPolicy1, mockPolicy2]);

      expect(composite.id).toBe('COMPOSITE_AND_policy-1_policy-2');
      expect(composite.domain).toBe('test-domain');
      expect(composite.version).toBe('1.1.0'); // Latest version
    });

    it('should create OR composite policy', () => {
      const composite = new CompositePolicy('OR', [mockPolicy1, mockPolicy2]);

      expect(composite.id).toBe('COMPOSITE_OR_policy-1_policy-2');
      expect(composite.getOperator()).toBe('OR');
    });

    it('should use custom ID when provided', () => {
      const composite = new CompositePolicy('AND', [mockPolicy1, mockPolicy2], 'custom-composite');

      expect(composite.id).toBe('custom-composite');
    });

    it('should handle mixed domains', () => {
      const composite = new CompositePolicy('AND', [mockPolicy1, mockPolicy3]);

      expect(composite.domain).toBe('composite');
    });

    it('should return policies', () => {
      const composite = new CompositePolicy('AND', [mockPolicy1, mockPolicy2]);
      const policies = composite.getPolicies();

      expect(policies).toHaveLength(2);
      expect(policies[0]).toBe(mockPolicy1);
      expect(policies[1]).toBe(mockPolicy2);
    });
  });

  describe('isSatisfiedBy - AND logic', () => {
    it('should return true when all policies pass', async () => {
      vi.mocked(mockPolicy1.isSatisfiedBy).mockResolvedValue(true);
      vi.mocked(mockPolicy2.isSatisfiedBy).mockResolvedValue(true);

      const composite = new CompositePolicy('AND', [mockPolicy1, mockPolicy2]);
      const result = await composite.isSatisfiedBy(testRequest);

      expect(result).toBe(true);
    });

    it('should return false and stop early when first policy fails', async () => {
      vi.mocked(mockPolicy1.isSatisfiedBy).mockResolvedValue(false);
      vi.mocked(mockPolicy2.isSatisfiedBy).mockResolvedValue(true);

      const composite = new CompositePolicy('AND', [mockPolicy1, mockPolicy2]);
      const result = await composite.isSatisfiedBy(testRequest);

      expect(result).toBe(false);
      expect(mockPolicy1.isSatisfiedBy).toHaveBeenCalled();
      expect(mockPolicy2.isSatisfiedBy).not.toHaveBeenCalled(); // Early exit
    });

    it('should return false when any policy fails', async () => {
      vi.mocked(mockPolicy1.isSatisfiedBy).mockResolvedValue(true);
      vi.mocked(mockPolicy2.isSatisfiedBy).mockResolvedValue(false);

      const composite = new CompositePolicy('AND', [mockPolicy1, mockPolicy2]);
      const result = await composite.isSatisfiedBy(testRequest);

      expect(result).toBe(false);
    });
  });

  describe('isSatisfiedBy - OR logic', () => {
    it('should return true when first policy passes', async () => {
      vi.mocked(mockPolicy1.isSatisfiedBy).mockResolvedValue(true);
      vi.mocked(mockPolicy2.isSatisfiedBy).mockResolvedValue(false);

      const composite = new CompositePolicy('OR', [mockPolicy1, mockPolicy2]);
      const result = await composite.isSatisfiedBy(testRequest);

      expect(result).toBe(true);
      expect(mockPolicy1.isSatisfiedBy).toHaveBeenCalled();
      expect(mockPolicy2.isSatisfiedBy).not.toHaveBeenCalled(); // Early exit
    });

    it('should return true when any policy passes', async () => {
      vi.mocked(mockPolicy1.isSatisfiedBy).mockResolvedValue(false);
      vi.mocked(mockPolicy2.isSatisfiedBy).mockResolvedValue(true);

      const composite = new CompositePolicy('OR', [mockPolicy1, mockPolicy2]);
      const result = await composite.isSatisfiedBy(testRequest);

      expect(result).toBe(true);
    });

    it('should return false when all policies fail', async () => {
      vi.mocked(mockPolicy1.isSatisfiedBy).mockResolvedValue(false);
      vi.mocked(mockPolicy2.isSatisfiedBy).mockResolvedValue(false);

      const composite = new CompositePolicy('OR', [mockPolicy1, mockPolicy2]);
      const result = await composite.isSatisfiedBy(testRequest);

      expect(result).toBe(false);
    });
  });

  describe('check - AND logic', () => {
    it('should return success when all policies pass', async () => {
      vi.mocked(mockPolicy1.check).mockResolvedValue(Result.ok(testEntity));
      vi.mocked(mockPolicy2.check).mockResolvedValue(Result.ok(testEntity));

      const composite = new CompositePolicy('AND', [mockPolicy1, mockPolicy2]);
      const result = await composite.check(testRequest);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(testEntity);
    });

    it('should return failure and stop early when first policy fails', async () => {
      const violation = new PolicyViolation('POLICY_1_FAILED', 'Policy 1 failed');
      vi.mocked(mockPolicy1.check).mockResolvedValue(Result.fail(violation));
      vi.mocked(mockPolicy2.check).mockResolvedValue(Result.ok(testEntity));

      const composite = new CompositePolicy('AND', [mockPolicy1, mockPolicy2]);
      const result = await composite.check(testRequest);

      expect(result.isFailure).toBe(true);
      expect(mockPolicy1.check).toHaveBeenCalled();
      expect(mockPolicy2.check).not.toHaveBeenCalled(); // Early exit
    });

    it('should create composite violation with proper code', async () => {
      const violation = new PolicyViolation('POLICY_1_FAILED', 'Policy 1 failed');
      vi.mocked(mockPolicy1.check).mockResolvedValue(Result.fail(violation));

      const composite = new CompositePolicy('AND', [mockPolicy1, mockPolicy2]);
      const result = await composite.check(testRequest);

      expect(result.isFailure).toBe(true);
      expect(result.error.code).toBe('POLICY_1_FAILED');
      expect(result.error.message).toContain('Composite policy failed');
      expect(result.error.details?.operator).toBe('AND');
    });
  });

  describe('check - OR logic', () => {
    it('should return success when first policy passes', async () => {
      vi.mocked(mockPolicy1.check).mockResolvedValue(Result.ok(testEntity));
      vi.mocked(mockPolicy2.check).mockResolvedValue(Result.fail(new PolicyViolation('FAIL', 'Failed')));

      const composite = new CompositePolicy('OR', [mockPolicy1, mockPolicy2]);
      const result = await composite.check(testRequest);

      expect(result.isSuccess).toBe(true);
      expect(mockPolicy2.check).not.toHaveBeenCalled(); // Early exit
    });

    it('should return failure when all policies fail', async () => {
      const violation1 = new PolicyViolation('POLICY_1_FAILED', 'Policy 1 failed');
      const violation2 = new PolicyViolation('POLICY_2_FAILED', 'Policy 2 failed');
      vi.mocked(mockPolicy1.check).mockResolvedValue(Result.fail(violation1));
      vi.mocked(mockPolicy2.check).mockResolvedValue(Result.fail(violation2));

      const composite = new CompositePolicy('OR', [mockPolicy1, mockPolicy2]);
      const result = await composite.check(testRequest);

      expect(result.isFailure).toBe(true);
      expect(result.error.code).toBe('POLICY_1_FAILED/POLICY_2_FAILED');
      expect(result.error.message).toContain('Policy 1 failed OR Policy 2 failed');
    });
  });

  describe('error handling', () => {
    it('should handle policy evaluation errors in AND logic', async () => {
      const error = new Error('Policy evaluation error');
      vi.mocked(mockPolicy1.check).mockRejectedValue(error);

      const composite = new CompositePolicy('AND', [mockPolicy1, mockPolicy2]);
      const result = await composite.check(testRequest);

      expect(result.isFailure).toBe(true);
      expect(result.error.code).toBe('policy-1_EVALUATION_ERROR');
      expect(result.error.details?.originalError).toBe(error);
    });

    it('should handle policy evaluation errors in OR logic', async () => {
      const error = new Error('Policy evaluation error');
      vi.mocked(mockPolicy1.check).mockRejectedValue(error);
      vi.mocked(mockPolicy2.check).mockResolvedValue(Result.fail(new PolicyViolation('FAIL', 'Failed')));

      const composite = new CompositePolicy('OR', [mockPolicy1, mockPolicy2]);
      const result = await composite.check(testRequest);

      expect(result.isFailure).toBe(true);
      expect(result.error.message).toContain('Composite policy failed');
    });
  });

  describe('composition methods', () => {
    let composite: CompositePolicy<TestEntity>;

    beforeEach(() => {
      composite = new CompositePolicy('AND', [mockPolicy1, mockPolicy2]);
    });

    it('should support chaining with and()', () => {
      const result = composite.and(mockPolicy3);

      expect(result).toBeDefined();
    });

    it('should support chaining with or()', () => {
      const result = composite.or(mockPolicy3);

      expect(result).toBeDefined();
    });

    it('should support not()', () => {
      const notPolicy = composite.not();

      expect(notPolicy).toBeDefined();
      expect(notPolicy.id).toBe(`NOT_${composite.id}`);
    });

    it('should support when() for conditional logic', () => {
      const condition: PolicyCondition<TestEntity> = () => true;
      const conditionalBuilder = composite.when(condition);

      expect(conditionalBuilder).toBeDefined();
    });

    it('should support build() method', () => {
      const built = composite.build();

      expect(built).toBe(composite);
    });
  });
});

describe('ConditionalPolicy', () => {
  interface TestEntity {
    id: string;
    value: number;
  }

  let mockThenPolicy: IBusinessPolicy<TestEntity>;
  let mockOtherwisePolicy: IBusinessPolicy<TestEntity>;
  let testEntity: TestEntity;
  let testRequest: PolicyRequest<TestEntity>;

  beforeEach(() => {
    mockThenPolicy = {
      id: 'then-policy',
      domain: 'test',
      version: '1.0.0',
      check: vi.fn(),
      isSatisfiedBy: vi.fn(),
      and: vi.fn(),
      or: vi.fn(),
      not: vi.fn(),
      when: vi.fn(),
    };

    mockOtherwisePolicy = {
      id: 'otherwise-policy',
      domain: 'test',
      version: '1.0.0',
      check: vi.fn(),
      isSatisfiedBy: vi.fn(),
      and: vi.fn(),
      or: vi.fn(),
      not: vi.fn(),
      when: vi.fn(),
    };

    testEntity = { id: 'test-1', value: 10 };

    const context = PolicyContextBuilder.forUser('user-123', 'test');
    testRequest = PolicyRequestBuilder.create<TestEntity>()
      .withEntity(testEntity)
      .withContext(context)
      .build();
  });

  describe('constructor and properties', () => {
    it('should create conditional policy with then and otherwise policies', () => {
      const condition = vi.fn().mockReturnValue(true);

      const conditional = new ConditionalPolicy(
        condition,
        [mockThenPolicy],
        [mockOtherwisePolicy]
      );

      expect(conditional.id).toBe('CONDITIONAL_POLICY');
      expect(conditional.domain).toBe('conditional');
      expect(conditional.version).toBe('1.0.0');
    });
  });

  describe('isSatisfiedBy', () => {
    it('should execute then policies when condition is true', async () => {
      const condition = vi.fn().mockReturnValue(true);
      vi.mocked(mockThenPolicy.isSatisfiedBy).mockResolvedValue(true);

      const conditional = new ConditionalPolicy(
        condition,
        [mockThenPolicy],
        [mockOtherwisePolicy]
      );

      const result = await conditional.isSatisfiedBy(testRequest);

      expect(result).toBe(true);
      expect(condition).toHaveBeenCalledWith(testRequest);
      expect(mockThenPolicy.isSatisfiedBy).toHaveBeenCalledWith(testRequest);
      expect(mockOtherwisePolicy.isSatisfiedBy).not.toHaveBeenCalled();
    });

    it('should execute otherwise policies when condition is false', async () => {
      const condition = vi.fn().mockReturnValue(false);
      vi.mocked(mockOtherwisePolicy.isSatisfiedBy).mockResolvedValue(true);

      const conditional = new ConditionalPolicy(
        condition,
        [mockThenPolicy],
        [mockOtherwisePolicy]
      );

      const result = await conditional.isSatisfiedBy(testRequest);

      expect(result).toBe(true);
      expect(condition).toHaveBeenCalledWith(testRequest);
      expect(mockOtherwisePolicy.isSatisfiedBy).toHaveBeenCalledWith(testRequest);
      expect(mockThenPolicy.isSatisfiedBy).not.toHaveBeenCalled();
    });

    it('should handle async conditions', async () => {
      const condition = vi.fn().mockResolvedValue(true);
      vi.mocked(mockThenPolicy.isSatisfiedBy).mockResolvedValue(true);

      const conditional = new ConditionalPolicy(
        condition,
        [mockThenPolicy],
        [mockOtherwisePolicy]
      );

      const result = await conditional.isSatisfiedBy(testRequest);

      expect(result).toBe(true);
    });

    it('should return false if any then policy fails', async () => {
      const condition = vi.fn().mockReturnValue(true);
      vi.mocked(mockThenPolicy.isSatisfiedBy).mockResolvedValue(false);

      const conditional = new ConditionalPolicy(
        condition,
        [mockThenPolicy],
        [mockOtherwisePolicy]
      );

      const result = await conditional.isSatisfiedBy(testRequest);

      expect(result).toBe(false);
    });
  });

  describe('check', () => {
    it('should execute then policies when condition is true', async () => {
      const condition = vi.fn().mockReturnValue(true);
      vi.mocked(mockThenPolicy.check).mockResolvedValue(Result.ok(testEntity));

      const conditional = new ConditionalPolicy(
        condition,
        [mockThenPolicy],
        [mockOtherwisePolicy]
      );

      const result = await conditional.check(testRequest);

      expect(result.isSuccess).toBe(true);
      expect(mockThenPolicy.check).toHaveBeenCalledWith(testRequest);
      expect(mockOtherwisePolicy.check).not.toHaveBeenCalled();
    });

    it('should execute otherwise policies when condition is false', async () => {
      const condition = vi.fn().mockReturnValue(false);
      vi.mocked(mockOtherwisePolicy.check).mockResolvedValue(Result.ok(testEntity));

      const conditional = new ConditionalPolicy(
        condition,
        [mockThenPolicy],
        [mockOtherwisePolicy]
      );

      const result = await conditional.check(testRequest);

      expect(result.isSuccess).toBe(true);
      expect(mockOtherwisePolicy.check).toHaveBeenCalledWith(testRequest);
      expect(mockThenPolicy.check).not.toHaveBeenCalled();
    });

    it('should return failure if any policy fails', async () => {
      const condition = vi.fn().mockReturnValue(true);
      const violation = new PolicyViolation('THEN_FAILED', 'Then policy failed');
      vi.mocked(mockThenPolicy.check).mockResolvedValue(Result.fail(violation));

      const conditional = new ConditionalPolicy(
        condition,
        [mockThenPolicy],
        [mockOtherwisePolicy]
      );

      const result = await conditional.check(testRequest);

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(violation);
    });
  });

  describe('composition methods', () => {
    let conditional: ConditionalPolicy<TestEntity>;

    beforeEach(() => {
      const condition = vi.fn().mockReturnValue(true);
      conditional = new ConditionalPolicy(
        condition,
        [mockThenPolicy],
        [mockOtherwisePolicy]
      );
    });

    it('should support and() composition', () => {
      const result = conditional.and(mockThenPolicy);

      expect(result).toBeDefined();
    });

    it('should support or() composition', () => {
      const result = conditional.or(mockThenPolicy);

      expect(result).toBeDefined();
    });

    it('should support not()', () => {
      const notPolicy = conditional.not();

      expect(notPolicy).toBeDefined();
    });

    it('should throw error for nested when()', () => {
      const nestedCondition = vi.fn();

      expect(() => {
        conditional.when(nestedCondition);
      }).toThrow('Nested conditional policies are not supported');
    });
  });
});

describe('ConditionalPolicyBuilder', () => {
  interface TestEntity {
    id: string;
    value: number;
  }

  let mockBasePolicy: IBusinessPolicy<TestEntity>;
  let mockThenPolicy: IBusinessPolicy<TestEntity>;
  let mockOtherwisePolicy: IBusinessPolicy<TestEntity>;
  let condition: PolicyCondition<TestEntity>;

  beforeEach(() => {
    mockBasePolicy = {
      id: 'base-policy',
      domain: 'test',
      version: '1.0.0',
      check: vi.fn(),
      isSatisfiedBy: vi.fn(),
      and: vi.fn(),
      or: vi.fn(),
      not: vi.fn(),
      when: vi.fn(),
    };

    mockThenPolicy = {
      id: 'then-policy',
      domain: 'test',
      version: '1.0.0',
      check: vi.fn(),
      isSatisfiedBy: vi.fn(),
      and: vi.fn(),
      or: vi.fn(),
      not: vi.fn(),
      when: vi.fn(),
    };

    mockOtherwisePolicy = {
      id: 'otherwise-policy',
      domain: 'test',
      version: '1.0.0',
      check: vi.fn(),
      isSatisfiedBy: vi.fn(),
      and: vi.fn(),
      or: vi.fn(),
      not: vi.fn(),
      when: vi.fn(),
    };

    condition = vi.fn().mockReturnValue(true);
  });

  describe('builder pattern', () => {
    it('should build conditional policy with then clause', () => {
      const builder = new ConditionalPolicyBuilder(mockBasePolicy, condition);

      const policy = builder.then(mockThenPolicy).build();

      expect(policy).toBeDefined();
    });

    it('should build conditional policy with then and otherwise clauses', () => {
      const builder = new ConditionalPolicyBuilder(mockBasePolicy, condition);

      const policy = builder
        .then(mockThenPolicy)
        .otherwise(mockOtherwisePolicy)
        .build();

      expect(policy).toBeDefined();
    });

    it('should support chaining with and()', () => {
      const builder = new ConditionalPolicyBuilder(mockBasePolicy, condition);

      const composer = builder.then(mockThenPolicy).and(mockOtherwisePolicy);

      expect(composer).toBeDefined();
    });

    it('should support chaining with or()', () => {
      const builder = new ConditionalPolicyBuilder(mockBasePolicy, condition);

      const composer = builder.then(mockThenPolicy).or(mockOtherwisePolicy);

      expect(composer).toBeDefined();
    });
  });

  describe('fluent API', () => {
    it('should return builder for method chaining', () => {
      const builder = new ConditionalPolicyBuilder(mockBasePolicy, condition);

      const result = builder.then(mockThenPolicy);

      expect(result).toBe(builder);
    });

    it('should return builder for otherwise chaining', () => {
      const builder = new ConditionalPolicyBuilder(mockBasePolicy, condition);

      const result = builder.otherwise(mockOtherwisePolicy);

      expect(result).toBe(builder);
    });
  });
});