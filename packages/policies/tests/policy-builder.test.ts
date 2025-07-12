import { describe, it, expect, beforeEach, vi } from 'vitest';
import { safeRun } from '@vytches-ddd/utils';
import type { ISpecification, IValidator } from '@vytches-ddd/contracts';
import type { IAsyncSpecification, PolicyRequest } from '../src/business-policy-interface';
import { PolicyContextBuilder, PolicyRequestBuilder } from '../src/policy-context';
import { BusinessPolicy } from '../src/business-policy';
import {
  PolicyBuilder,
  PolicyStepBuilder,
  AsyncPolicyStepBuilder,
  GroupBuilder,
  FluentConditionalPolicyBuilder,
} from '../src/policy-builder';

describe('Policy Builder', () => {
  interface TestEntity {
    id: string;
    value: number;
    isValid: boolean;
  }

  let mockSpecification: ISpecification<TestEntity>;
  let mockAsyncSpecification: IAsyncSpecification<TestEntity>;
  let mockValidator: IValidator<TestEntity>;
  let testEntity: TestEntity;
  let testRequest: PolicyRequest<TestEntity>;

  beforeEach(() => {
    mockSpecification = {
      isSatisfiedBy: vi.fn().mockReturnValue(true),
      and: vi.fn(),
      or: vi.fn(),
      not: vi.fn(),
    };

    mockAsyncSpecification = {
      isSatisfiedByAsync: vi.fn().mockResolvedValue(true),
    };

    mockValidator = {
      validate: vi.fn().mockReturnValue({ success: true, errors: [] }),
    };

    testEntity = { id: 'test-1', value: 10, isValid: true };

    const context = PolicyContextBuilder.forUser('user-123', 'test');
    testRequest = PolicyRequestBuilder.create<TestEntity>()
      .withEntity(testEntity)
      .withContext(context)
      .build();
  });

  describe('PolicyBuilder', () => {
    describe('factory methods', () => {
      it('should create a new builder with create()', () => {
        const builder = PolicyBuilder.create<TestEntity>();
        expect(builder).toBeInstanceOf(PolicyBuilder);
      });

      it('should create builder for specific domain', () => {
        const builder = PolicyBuilder.forDomain<TestEntity>('test-domain');
        const policy = builder
          .must(mockSpecification)
          .withCode('TEST_CODE')
          .withMessage('Test message')
          .build();

        expect(policy.domain).toBe('test-domain');
      });

      it('should create validation policy', () => {
        const builder = PolicyBuilder.validation<TestEntity>(
          mockValidator,
          'VALIDATION_ERROR',
          'Validation failed'
        );
        expect(builder).toBeInstanceOf(PolicyBuilder);
      });
    });

    describe('configuration methods', () => {
      it('should set policy ID', () => {
        const policy = PolicyBuilder.create<TestEntity>()
          .withId('custom-policy')
          .must(mockSpecification)
          .withCode('TEST_CODE')
          .withMessage('Test message')
          .build();

        expect(policy.id).toBe('custom-policy');
      });

      it('should set policy domain', () => {
        const policy = PolicyBuilder.create<TestEntity>()
          .withDomain('custom-domain')
          .must(mockSpecification)
          .withCode('TEST_CODE')
          .withMessage('Test message')
          .build();

        expect(policy.domain).toBe('custom-domain');
      });

      it('should set policy version', () => {
        const policy = PolicyBuilder.create<TestEntity>()
          .withVersion('2.0.0')
          .must(mockSpecification)
          .withCode('TEST_CODE')
          .withMessage('Test message')
          .build();

        expect(policy.version).toBe('2.0.0');
      });
    });

    describe('policy creation methods', () => {
      it('should create policy with must() and step builder', () => {
        const stepBuilder = PolicyBuilder.create<TestEntity>().must(mockSpecification);

        expect(stepBuilder).toBeInstanceOf(PolicyStepBuilder);
      });

      it('should create async policy with mustAsync()', () => {
        const stepBuilder = PolicyBuilder.create<TestEntity>().mustAsync(mockAsyncSpecification);

        expect(stepBuilder).toBeInstanceOf(AsyncPolicyStepBuilder);
      });

      it('should create policy from predicate with mustSatisfy()', () => {
        const predicate = (entity: TestEntity) => entity.isValid;
        const builder = PolicyBuilder.create<TestEntity>().mustSatisfy(
          predicate,
          'INVALID_ENTITY',
          'Entity is not valid'
        );

        const policy = builder.build();
        expect(policy).toBeDefined();
      });

      it('should create policy from validator with mustSatisfyValidator()', () => {
        const builder = PolicyBuilder.create<TestEntity>().mustSatisfyValidator(
          mockValidator,
          'VALIDATION_ERROR',
          'Validation failed'
        );

        const policy = builder.build();
        expect(policy).toBeDefined();
      });

      it('should add existing policy with mustSatisfyPolicy()', () => {
        const existingPolicy = PolicyBuilder.create<TestEntity>()
          .must(mockSpecification)
          .withCode('EXISTING')
          .withMessage('Existing policy')
          .build();

        const builder = PolicyBuilder.create<TestEntity>().mustSatisfyPolicy(existingPolicy);

        const policy = builder.build();
        expect(policy).toBe(existingPolicy);
      });
    });

    describe('group methods', () => {
      it('should create OR policy with shouldSatisfyAny()', () => {
        const policy1 = BusinessPolicy.fromSpecification(
          'test-policy-1',
          'test-domain',
          mockSpecification,
          'GROUP1',
          'Group 1 violation'
        );
        const policy2 = BusinessPolicy.fromSpecification(
          'test-policy-2',
          'test-domain',
          mockSpecification,
          'GROUP2',
          'Group 2 violation'
        );

        const group1 = GroupBuilder.create<TestEntity>('group1').mustSatisfy(policy1);
        const group2 = GroupBuilder.create<TestEntity>('group2').mustSatisfy(policy2);

        const policy = PolicyBuilder.create<TestEntity>().shouldSatisfyAny(group1, group2).build();

        expect(policy).toBeDefined();
      });

      it('should create AND policy with shouldSatisfyAll()', () => {
        const policy1 = BusinessPolicy.fromSpecification(
          'test-policy-1',
          'test-domain',
          mockSpecification,
          'GROUP1',
          'Group 1 violation'
        );
        const policy2 = BusinessPolicy.fromSpecification(
          'test-policy-2',
          'test-domain',
          mockSpecification,
          'GROUP2',
          'Group 2 violation'
        );

        const group1 = GroupBuilder.create<TestEntity>('group1').mustSatisfy(policy1);
        const group2 = GroupBuilder.create<TestEntity>('group2').mustSatisfy(policy2);

        const policy = PolicyBuilder.create<TestEntity>().shouldSatisfyAll(group1, group2).build();

        expect(policy).toBeDefined();
      });
    });

    describe('conditional logic', () => {
      it('should create conditional policy with when()', () => {
        const condition = (request: PolicyRequest<TestEntity>) => request.entity.isValid;
        const conditionalBuilder = PolicyBuilder.create<TestEntity>().when(condition);

        expect(conditionalBuilder).toBeInstanceOf(FluentConditionalPolicyBuilder);
      });
    });

    describe('chaining methods', () => {
      it('should return self for and()', () => {
        const builder = PolicyBuilder.create<TestEntity>();
        expect(builder.and()).toBe(builder);
      });

      it('should return self for or()', () => {
        const builder = PolicyBuilder.create<TestEntity>();
        expect(builder.or()).toBe(builder);
      });
    });

    describe('build method', () => {
      it('should throw error when no policies defined', () => {
        const builder = PolicyBuilder.create<TestEntity>();
        const [error] = safeRun(() => builder.build());
        expect(error).toBeDefined();
        expect(error?.message).toContain('No policies defined');
      });

      it('should return single policy when only one policy defined', () => {
        const policy = PolicyBuilder.create<TestEntity>()
          .must(mockSpecification)
          .withCode('TEST_CODE')
          .withMessage('Test message')
          .build();

        expect(policy).toBeDefined();
      });

      it('should return composite policy when multiple policies defined', () => {
        const policy = PolicyBuilder.create<TestEntity>()
          .must(mockSpecification)
          .withCode('TEST1')
          .withMessage('Test 1')
          .and()
          .must(mockSpecification)
          .withCode('TEST2')
          .withMessage('Test 2')
          .build();

        expect(policy).toBeDefined();
      });
    });

    describe('buildAndRegister method', () => {
      it('should build and attempt to register policy', () => {
        const policy = PolicyBuilder.create<TestEntity>()
          .must(mockSpecification)
          .withCode('TEST_CODE')
          .withMessage('Test message')
          .buildAndRegister();

        expect(policy).toBeDefined();
      });
    });
  });

  describe('PolicyStepBuilder', () => {
    let builder: PolicyBuilder<TestEntity>;
    let stepBuilder: PolicyStepBuilder<TestEntity>;

    beforeEach(() => {
      builder = PolicyBuilder.create<TestEntity>();
      stepBuilder = builder.must(mockSpecification);
    });

    describe('configuration methods', () => {
      it('should set violation code', () => {
        const result = stepBuilder.withCode('TEST_CODE');
        expect(result).toBe(stepBuilder);
      });

      it('should set violation message', () => {
        const result = stepBuilder.withMessage('Test message');
        expect(result).toBe(stepBuilder);
      });

      it('should set violation severity', () => {
        const result = stepBuilder.withSeverity('WARNING');
        expect(result).toBe(stepBuilder);
      });

      it('should set violation field', () => {
        const result = stepBuilder.withField('testField');
        expect(result).toBe(stepBuilder);
      });
    });

    describe('chaining methods', () => {
      it('should return builder for and()', () => {
        stepBuilder.withCode('TEST').withMessage('Test');
        const result = stepBuilder.and();
        expect(result).toBeInstanceOf(PolicyBuilder);
      });

      it('should return builder for or()', () => {
        stepBuilder.withCode('TEST').withMessage('Test');
        const result = stepBuilder.or();
        expect(result).toBeInstanceOf(PolicyBuilder);
      });
    });

    describe('build method', () => {
      it('should build policy with complete configuration', () => {
        const policy = stepBuilder
          .withCode('TEST_CODE')
          .withMessage('Test message')
          .withSeverity('ERROR')
          .withField('testField')
          .build();

        expect(policy).toBeDefined();
      });

      it('should throw error when code is missing', () => {
        stepBuilder.withMessage('Test message');
        const [error] = safeRun(() => stepBuilder.build());
        expect(error).toBeDefined();
        expect(error?.message).toContain('Policy step requires violation code');
      });

      it('should throw error when message is missing', () => {
        stepBuilder.withCode('TEST_CODE');
        const [error] = safeRun(() => stepBuilder.build());
        expect(error).toBeDefined();
        expect(error?.message).toContain('Policy step requires violation message');
      });
    });
  });

  describe('AsyncPolicyStepBuilder', () => {
    let builder: PolicyBuilder<TestEntity>;
    let asyncStepBuilder: AsyncPolicyStepBuilder<TestEntity>;

    beforeEach(() => {
      builder = PolicyBuilder.create<TestEntity>();
      asyncStepBuilder = builder.mustAsync(mockAsyncSpecification);
    });

    describe('configuration methods', () => {
      it('should set violation code', () => {
        const result = asyncStepBuilder.withCode('ASYNC_CODE');
        expect(result).toBe(asyncStepBuilder);
      });

      it('should set violation message', () => {
        const result = asyncStepBuilder.withMessage('Async message');
        expect(result).toBe(asyncStepBuilder);
      });

      it('should set violation severity', () => {
        const result = asyncStepBuilder.withSeverity('ERROR');
        expect(result).toBe(asyncStepBuilder);
      });

      it('should set violation field', () => {
        const result = asyncStepBuilder.withField('asyncField');
        expect(result).toBe(asyncStepBuilder);
      });
    });

    describe('chaining methods', () => {
      it('should return builder for and()', () => {
        asyncStepBuilder.withCode('ASYNC').withMessage('Async');
        const result = asyncStepBuilder.and();
        expect(result).toBeInstanceOf(PolicyBuilder);
      });

      it('should return builder for or()', () => {
        asyncStepBuilder.withCode('ASYNC').withMessage('Async');
        const result = asyncStepBuilder.or();
        expect(result).toBeInstanceOf(PolicyBuilder);
      });
    });

    describe('build method', () => {
      it('should build async policy with complete configuration', () => {
        const policy = asyncStepBuilder
          .withCode('ASYNC_CODE')
          .withMessage('Async message')
          .withSeverity('WARNING')
          .withField('asyncField')
          .build();

        expect(policy).toBeDefined();
      });

      it('should throw error when code is missing', () => {
        asyncStepBuilder.withMessage('Async message');
        const [error] = safeRun(() => asyncStepBuilder.build());
        expect(error).toBeDefined();
        expect(error?.message).toContain('Async policy step requires violation code');
      });

      it('should throw error when message is missing', () => {
        asyncStepBuilder.withCode('ASYNC_CODE');
        const [error] = safeRun(() => asyncStepBuilder.build());
        expect(error).toBeDefined();
        expect(error?.message).toContain('Async policy step requires violation message');
      });
    });
  });

  describe('GroupBuilder', () => {
    let groupBuilder: GroupBuilder<TestEntity>;

    beforeEach(() => {
      groupBuilder = GroupBuilder.create<TestEntity>('test-group');
    });

    describe('factory method', () => {
      it('should create group builder with ID', () => {
        const group = GroupBuilder.create<TestEntity>('my-group');
        expect(group).toBeInstanceOf(GroupBuilder);
      });
    });

    describe('policy addition methods', () => {
      it('should add sync policy with must()', () => {
        const stepBuilder = groupBuilder.must(mockSpecification);
        expect(stepBuilder).toBeInstanceOf(PolicyStepBuilder);
      });

      it('should add async policy with mustAsync()', () => {
        const stepBuilder = groupBuilder.mustAsync(mockAsyncSpecification);
        expect(stepBuilder).toBeInstanceOf(AsyncPolicyStepBuilder);
      });

      it('should add existing policy with mustSatisfy()', () => {
        const existingPolicy = PolicyBuilder.create<TestEntity>()
          .must(mockSpecification)
          .withCode('EXISTING')
          .withMessage('Existing')
          .build();

        const result = groupBuilder.mustSatisfy(existingPolicy);
        expect(result).toBe(groupBuilder);
      });
    });

    describe('chaining method', () => {
      it('should return self for and()', () => {
        const result = groupBuilder.and();
        expect(result).toBe(groupBuilder);
      });
    });

    describe('build method', () => {
      it('should throw error when no policies defined', () => {
        const [error] = safeRun(() => groupBuilder.build());
        expect(error).toBeDefined();
        expect(error?.message).toContain("Group 'test-group' has no policies defined");
      });

      it('should return single policy when only one policy defined', () => {
        const policy = groupBuilder
          .must(mockSpecification)
          .withCode('SINGLE')
          .withMessage('Single policy')
          .build();

        expect(policy).toBeDefined();
      });

      it('should return composite policy when multiple policies defined', () => {
        groupBuilder
          .must(mockSpecification)
          .withCode('FIRST')
          .withMessage('First policy')
          .and()
          .must(mockSpecification)
          .withCode('SECOND')
          .withMessage('Second policy');

        const policy = groupBuilder.build();
        expect(policy).toBeDefined();
      });
    });
  });

  describe('FluentConditionalPolicyBuilder', () => {
    let builder: PolicyBuilder<TestEntity>;
    let condition: (request: PolicyRequest<TestEntity>) => boolean;
    let conditionalBuilder: FluentConditionalPolicyBuilder<TestEntity>;

    beforeEach(() => {
      builder = PolicyBuilder.create<TestEntity>();
      condition = (request: PolicyRequest<TestEntity>) => request.entity.isValid;
      conditionalBuilder = builder.when(condition);
    });

    describe('then method', () => {
      it('should accept policy builder function', () => {
        const result = conditionalBuilder.then(b =>
          b.must(mockSpecification).withCode('THEN_CODE').withMessage('Then message').and()
        );

        expect(result).toBe(conditionalBuilder);
      });
    });

    describe('otherwise method', () => {
      it('should accept policy builder function', () => {
        const result = conditionalBuilder.otherwise(b =>
          b
            .must(mockSpecification)
            .withCode('OTHERWISE_CODE')
            .withMessage('Otherwise message')
            .and()
        );

        expect(result).toBe(conditionalBuilder);
      });
    });

    describe('chaining methods', () => {
      it('should return base builder for and()', () => {
        const result = conditionalBuilder.and();
        expect(result).toBeInstanceOf(PolicyBuilder);
      });

      it('should build complete conditional policy', () => {
        const policy = conditionalBuilder
          .then(b =>
            b.must(mockSpecification).withCode('THEN_CODE').withMessage('Then message').and()
          )
          .otherwise(b =>
            b
              .must(mockSpecification)
              .withCode('OTHERWISE_CODE')
              .withMessage('Otherwise message')
              .and()
          )
          .build();

        expect(policy).toBeDefined();
      });
    });

    describe('async condition', () => {
      it('should handle async condition function', () => {
        const asyncCondition = async (request: PolicyRequest<TestEntity>) =>
          Promise.resolve(request.entity.isValid);

        const asyncConditionalBuilder = builder.when(asyncCondition);
        expect(asyncConditionalBuilder).toBeInstanceOf(FluentConditionalPolicyBuilder);
      });
    });
  });

  describe('Integration scenarios', () => {
    it('should build complex policy with multiple patterns', () => {
      const policy1 = BusinessPolicy.fromSpecification(
        'validation-1',
        'test-domain',
        mockSpecification,
        'VALIDATION_1',
        'First validation'
      );
      const policy2 = BusinessPolicy.fromAsyncSpecification(
        'validation-2',
        'test-domain',
        mockAsyncSpecification,
        'VALIDATION_2',
        'Second validation'
      );
      const policy3 = BusinessPolicy.fromSpecification(
        'business-1',
        'test-domain',
        mockSpecification,
        'BUSINESS_1',
        'Business rule'
      );

      const validationGroup = GroupBuilder.create<TestEntity>('validation')
        .mustSatisfy(policy1)
        .and()
        .mustSatisfy(policy2);

      const businessGroup = GroupBuilder.create<TestEntity>('business').mustSatisfy(policy3);

      const policy = PolicyBuilder.create<TestEntity>()
        .withId('complex-policy')
        .withDomain('test-domain')
        .withVersion('1.2.0')
        .shouldSatisfyAll(validationGroup, businessGroup)
        .and()
        .when(req => req.entity.value > 5)
        .then(b =>
          b
            .must(mockSpecification)
            .withCode('HIGH_VALUE')
            .withMessage('High value validation')
            .and()
        )
        .otherwise(b =>
          b.must(mockSpecification).withCode('LOW_VALUE').withMessage('Low value validation').and()
        )
        .build();

      expect(policy.id).toBe('complex-policy');
      expect(policy.domain).toBe('test-domain');
      expect(policy.version).toBe('1.2.0');
    });

    it('should handle chaining with mixed step builders', () => {
      const policy = PolicyBuilder.create<TestEntity>()
        .must(mockSpecification)
        .withCode('SYNC_STEP')
        .withMessage('Sync step')
        .withSeverity('ERROR')
        .and()
        .mustAsync(mockAsyncSpecification)
        .withCode('ASYNC_STEP')
        .withMessage('Async step')
        .withSeverity('WARNING')
        .withField('asyncField')
        .build();

      expect(policy).toBeDefined();
    });
  });
});
