import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ISpecification } from '@vytches-ddd/contracts';
import { BusinessPolicy, AsyncBusinessPolicy } from '../src/business-policy';
import { PolicyViolation } from '../src/policy-violation';
import { PolicyContextBuilder, PolicyRequestBuilder } from '../src/policy-context';
import type { PolicyRequest, IAsyncSpecification } from '../src/business-policy-interface';

describe('BusinessPolicy', () => {
  interface TestEntity {
    id: string;
    value: number;
    isValid: boolean;
  }

  let mockSpecification: ISpecification<TestEntity>;
  let testEntity: TestEntity;
  let testRequest: PolicyRequest<TestEntity>;

  beforeEach(() => {
    mockSpecification = {
      isSatisfiedBy: vi.fn(),
      and: vi.fn(),
      or: vi.fn(),
      not: vi.fn(),
    };

    testEntity = { id: 'test-1', value: 10, isValid: true };

    const context = PolicyContextBuilder.forUser('user-123', 'test');
    testRequest = PolicyRequestBuilder.create<TestEntity>()
      .withEntity(testEntity)
      .withContext(context)
      .build();
  });

  describe('constructor', () => {
    it('should create policy with required parameters', () => {
      const policy = new BusinessPolicy(
        'test-policy',
        'test-domain',
        '1.0.0',
        mockSpecification,
        'TEST_CODE',
        'Test message'
      );

      expect(policy.id).toBe('test-policy');
      expect(policy.domain).toBe('test-domain');
      expect(policy.version).toBe('1.0.0');
    });

    it('should create policy with all optional parameters', () => {
      const detailsProvider = vi.fn().mockReturnValue({ extra: 'data' });

      const policy = new BusinessPolicy(
        'test-policy',
        'test-domain',
        '1.0.0',
        mockSpecification,
        'TEST_CODE',
        'Test message',
        'WARNING',
        'testField',
        detailsProvider
      );

      expect(policy.id).toBe('test-policy');
      expect(policy.domain).toBe('test-domain');
      expect(policy.version).toBe('1.0.0');
    });
  });

  describe('isSatisfiedBy', () => {
    it('should return true when specification is satisfied', async () => {
      vi.mocked(mockSpecification.isSatisfiedBy).mockReturnValue(true);

      const policy = new BusinessPolicy(
        'test-policy',
        'test-domain',
        '1.0.0',
        mockSpecification,
        'TEST_CODE',
        'Test message'
      );

      const result = await policy.isSatisfiedBy(testRequest);

      expect(result).toBe(true);
      expect(mockSpecification.isSatisfiedBy).toHaveBeenCalledWith(testEntity);
    });

    it('should return false when specification is not satisfied', async () => {
      vi.mocked(mockSpecification.isSatisfiedBy).mockReturnValue(false);

      const policy = new BusinessPolicy(
        'test-policy',
        'test-domain',
        '1.0.0',
        mockSpecification,
        'TEST_CODE',
        'Test message'
      );

      const result = await policy.isSatisfiedBy(testRequest);

      expect(result).toBe(false);
    });
  });

  describe('check', () => {
    it('should return success when specification is satisfied', async () => {
      vi.mocked(mockSpecification.isSatisfiedBy).mockReturnValue(true);

      const policy = new BusinessPolicy(
        'test-policy',
        'test-domain',
        '1.0.0',
        mockSpecification,
        'TEST_CODE',
        'Test message'
      );

      const result = await policy.check(testRequest);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(testEntity);
    });

    it('should return failure with violation when specification is not satisfied', async () => {
      vi.mocked(mockSpecification.isSatisfiedBy).mockReturnValue(false);

      const policy = new BusinessPolicy(
        'test-policy',
        'test-domain',
        '1.0.0',
        mockSpecification,
        'TEST_CODE',
        'Test message',
        'ERROR',
        'testField'
      );

      const result = await policy.check(testRequest);

      expect(result.isFailure).toBe(true);
      expect(result.error).toBeInstanceOf(PolicyViolation);
      expect(result.error.code).toBe('TEST_CODE');
      expect(result.error.message).toBe('Test message');
      expect(result.error.severity).toBe('ERROR');
      expect(result.error.field).toBe('testField');
    });

    it('should include details from details provider', async () => {
      vi.mocked(mockSpecification.isSatisfiedBy).mockReturnValue(false);

      const detailsProvider = vi.fn().mockReturnValue({ providedValue: 10, requiredValue: 20 });

      const policy = new BusinessPolicy(
        'test-policy',
        'test-domain',
        '1.0.0',
        mockSpecification,
        'TEST_CODE',
        'Test message',
        'ERROR',
        'testField',
        detailsProvider
      );

      const result = await policy.check(testRequest);

      expect(result.isFailure).toBe(true);
      expect(result.error.details).toEqual({ providedValue: 10, requiredValue: 20 });
      expect(detailsProvider).toHaveBeenCalledWith(testEntity, testRequest.context);
    });

    it('should handle specification evaluation errors', async () => {
      const error = new Error('Specification error');
      vi.mocked(mockSpecification.isSatisfiedBy).mockImplementation(() => {
        throw error;
      });

      const policy = new BusinessPolicy(
        'test-policy',
        'test-domain',
        '1.0.0',
        mockSpecification,
        'TEST_CODE',
        'Test message'
      );

      const result = await policy.check(testRequest);

      expect(result.isFailure).toBe(true);
      expect(result.error.code).toBe('TEST_CODE_EVALUATION_ERROR');
      expect(result.error.message).toContain('Policy evaluation failed');
      expect(result.error.details?.originalError).toBe(error);
    });
  });

  describe('static factory methods', () => {
    describe('fromSpecification', () => {
      it('should create policy from specification with default options', () => {
        const policy = BusinessPolicy.fromSpecification(
          'test-policy',
          'test-domain',
          mockSpecification,
          'TEST_CODE',
          'Test message'
        );

        expect(policy.id).toBe('test-policy');
        expect(policy.domain).toBe('test-domain');
        expect(policy.version).toBe('1.0.0');
      });

      it('should create policy from specification with custom options', () => {
        const detailsProvider = vi.fn();

        const policy = BusinessPolicy.fromSpecification(
          'test-policy',
          'test-domain',
          mockSpecification,
          'TEST_CODE',
          'Test message',
          {
            version: '2.0.0',
            severity: 'WARNING',
            field: 'customField',
            detailsProvider,
          }
        );

        expect(policy.version).toBe('2.0.0');
      });
    });

    describe('fromPredicate', () => {
      it('should create policy from predicate function', async () => {
        const predicate = vi.fn().mockReturnValue(true);

        const policy = BusinessPolicy.fromPredicate(
          'predicate-policy',
          'test-domain',
          predicate,
          'PREDICATE_FAILED',
          'Predicate failed'
        );

        const result = await policy.isSatisfiedBy(testRequest);

        expect(result).toBe(true);
        expect(predicate).toHaveBeenCalledWith(testEntity);
      });

      it('should handle predicate that returns false', async () => {
        const predicate = vi.fn().mockReturnValue(false);

        const policy = BusinessPolicy.fromPredicate(
          'predicate-policy',
          'test-domain',
          predicate,
          'PREDICATE_FAILED',
          'Predicate failed'
        );

        const checkResult = await policy.check(testRequest);

        expect(checkResult.isFailure).toBe(true);
        expect(checkResult.error.code).toBe('PREDICATE_FAILED');
      });
    });

    describe('fromAsyncSpecification', () => {
      it('should create async policy', () => {
        const asyncSpec: IAsyncSpecification<TestEntity> = {
          isSatisfiedByAsync: vi.fn().mockResolvedValue(true),
        };

        const policy = BusinessPolicy.fromAsyncSpecification(
          'async-policy',
          'test-domain',
          asyncSpec,
          'ASYNC_FAILED',
          'Async failed'
        );

        expect(policy).toBeInstanceOf(AsyncBusinessPolicy);
        expect(policy.id).toBe('async-policy');
      });
    });
  });

  describe('composition methods', () => {
    let policy: BusinessPolicy<TestEntity>;

    beforeEach(() => {
      policy = new BusinessPolicy(
        'test-policy',
        'test-domain',
        '1.0.0',
        mockSpecification,
        'TEST_CODE',
        'Test message'
      );
    });

    it('should create AND composition', () => {
      const otherPolicy = new BusinessPolicy(
        'other-policy',
        'test-domain',
        '1.0.0',
        mockSpecification,
        'OTHER_CODE',
        'Other message'
      );

      const composer = policy.and(otherPolicy);

      expect(composer).toBeDefined();
    });

    it('should create OR composition', () => {
      const otherPolicy = new BusinessPolicy(
        'other-policy',
        'test-domain',
        '1.0.0',
        mockSpecification,
        'OTHER_CODE',
        'Other message'
      );

      const composer = policy.or(otherPolicy);

      expect(composer).toBeDefined();
    });

    it('should create NOT policy', () => {
      const notPolicy = policy.not();

      expect(notPolicy).toBeDefined();
      expect(notPolicy.id).toBe('NOT_test-policy');
    });

    it('should create conditional policy', () => {
      const condition = vi.fn().mockReturnValue(true);

      const conditionalBuilder = policy.when(condition);

      expect(conditionalBuilder).toBeDefined();
    });
  });
});

describe('AsyncBusinessPolicy', () => {
  interface TestEntity {
    id: string;
    value: number;
  }

  let mockAsyncSpec: IAsyncSpecification<TestEntity>;
  let testEntity: TestEntity;
  let testRequest: PolicyRequest<TestEntity>;

  beforeEach(() => {
    mockAsyncSpec = {
      isSatisfiedByAsync: vi.fn(),
    };

    testEntity = { id: 'test-1', value: 10 };

    const context = PolicyContextBuilder.forUser('user-123', 'test');
    testRequest = PolicyRequestBuilder.create<TestEntity>()
      .withEntity(testEntity)
      .withContext(context)
      .build();
  });

  describe('constructor', () => {
    it('should create async policy with required parameters', () => {
      const policy = new AsyncBusinessPolicy(
        'async-policy',
        'test-domain',
        '1.0.0',
        mockAsyncSpec,
        'ASYNC_CODE',
        'Async message'
      );

      expect(policy.id).toBe('async-policy');
      expect(policy.domain).toBe('test-domain');
      expect(policy.version).toBe('1.0.0');
    });
  });

  describe('isSatisfiedBy', () => {
    it('should return true when async specification is satisfied', async () => {
      vi.mocked(mockAsyncSpec.isSatisfiedByAsync).mockResolvedValue(true);

      const policy = new AsyncBusinessPolicy(
        'async-policy',
        'test-domain',
        '1.0.0',
        mockAsyncSpec,
        'ASYNC_CODE',
        'Async message'
      );

      const result = await policy.isSatisfiedBy(testRequest);

      expect(result).toBe(true);
      expect(mockAsyncSpec.isSatisfiedByAsync).toHaveBeenCalledWith(
        testEntity,
        testRequest.context
      );
    });

    it('should return false when async specification fails', async () => {
      vi.mocked(mockAsyncSpec.isSatisfiedByAsync).mockRejectedValue(new Error('Async error'));

      const policy = new AsyncBusinessPolicy(
        'async-policy',
        'test-domain',
        '1.0.0',
        mockAsyncSpec,
        'ASYNC_CODE',
        'Async message'
      );

      const result = await policy.isSatisfiedBy(testRequest);

      expect(result).toBe(false);
    });
  });

  describe('check', () => {
    it('should return success when async specification is satisfied', async () => {
      vi.mocked(mockAsyncSpec.isSatisfiedByAsync).mockResolvedValue(true);

      const policy = new AsyncBusinessPolicy(
        'async-policy',
        'test-domain',
        '1.0.0',
        mockAsyncSpec,
        'ASYNC_CODE',
        'Async message'
      );

      const result = await policy.check(testRequest);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(testEntity);
    });

    it('should return failure when async specification is not satisfied', async () => {
      vi.mocked(mockAsyncSpec.isSatisfiedByAsync).mockResolvedValue(false);

      const policy = new AsyncBusinessPolicy(
        'async-policy',
        'test-domain',
        '1.0.0',
        mockAsyncSpec,
        'ASYNC_CODE',
        'Async message'
      );

      const result = await policy.check(testRequest);

      expect(result.isFailure).toBe(true);
      expect(result.error.code).toBe('ASYNC_CODE');
    });

    it('should handle async specification errors', async () => {
      const error = new Error('Async specification error');
      vi.mocked(mockAsyncSpec.isSatisfiedByAsync).mockRejectedValue(error);

      const policy = new AsyncBusinessPolicy(
        'async-policy',
        'test-domain',
        '1.0.0',
        mockAsyncSpec,
        'ASYNC_CODE',
        'Async message'
      );

      const result = await policy.check(testRequest);

      expect(result.isFailure).toBe(true);
      expect(result.error.code).toBe('ASYNC_CODE_EVALUATION_ERROR');
      expect(result.error.message).toContain('Async policy evaluation failed');
      expect(result.error.details?.originalError).toBe(error);
    });
  });

  describe('composition methods', () => {
    let policy: AsyncBusinessPolicy<TestEntity>;

    beforeEach(() => {
      policy = new AsyncBusinessPolicy(
        'async-policy',
        'test-domain',
        '1.0.0',
        mockAsyncSpec,
        'ASYNC_CODE',
        'Async message'
      );
    });

    it('should support all composition methods', () => {
      const otherPolicy = new AsyncBusinessPolicy(
        'other-async-policy',
        'test-domain',
        '1.0.0',
        mockAsyncSpec,
        'OTHER_ASYNC_CODE',
        'Other async message'
      );

      expect(policy.and(otherPolicy)).toBeDefined();
      expect(policy.or(otherPolicy)).toBeDefined();
      expect(policy.not()).toBeDefined();

      const condition = vi.fn().mockReturnValue(true);
      expect(policy.when(condition)).toBeDefined();
    });
  });
});
