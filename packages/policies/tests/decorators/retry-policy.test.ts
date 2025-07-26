import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Result } from '@vytches/ddd-utils';
import { PolicyRetryBehavior, PolicyRetryBehaviorFactory } from '../../src/decorators/retry-policy';
import { BaseBusinessPolicy } from '../../src/core/base/base-business-policy';
import type { PolicyViolation } from '../../src/core/models/policy-violation';
import { PolicyContextBuilder } from '../../src/utils/policy-context-builder';
import type {
  PolicyContext,
  PolicyRequest,
} from '../../src/core/interfaces/business-policy.interface';

// Test policy that can simulate failures and recovery
class UnreliablePolicy extends BaseBusinessPolicy<{ value: number }> {
  public callCount = 0;
  public failuresBeforeSuccess = 0;
  public shouldThrow = false;
  public violationCode = 'TEST_FAILURE';
  public violationSeverity: 'ERROR' | 'WARNING' | 'INFO' = 'ERROR';

  constructor() {
    super('unreliable-policy', 'test', 'Unreliable Policy');
  }

  public async check(
    request: PolicyRequest<{ value: number }>
  ): Promise<Result<{ value: number }, PolicyViolation>> {
    this.callCount++;

    if (this.shouldThrow) {
      throw new Error('Policy execution failed');
    }

    if (this.callCount <= this.failuresBeforeSuccess) {
      const violation = this.createViolation(
        this.violationCode,
        `Attempt ${this.callCount} failed`,
        this.violationSeverity,
        { context: request.context, details: { attempt: this.callCount } }
      );
      return this.failure(violation);
    }

    return this.success(request.entity);
  }

  public reset(): void {
    this.callCount = 0;
    this.failuresBeforeSuccess = 0;
    this.shouldThrow = false;
    this.violationCode = 'TEST_FAILURE';
    this.violationSeverity = 'ERROR';
  }
}

describe('RetryPolicy', () => {
  let unreliablePolicy: UnreliablePolicy;
  let retryPolicy: InstanceType<typeof PolicyRetryBehavior<{ value: number }>>;
  let testEntity: { value: number };
  let policyContext: PolicyContext;
  let request: PolicyRequest<{ value: number }>;

  beforeEach(() => {
    unreliablePolicy = new UnreliablePolicy();
    testEntity = { value: 42 };
    policyContext = PolicyContextBuilder.forUser('test-user').withEnvironment('test').build();

    request = { entity: testEntity, context: policyContext };

    // Mock timers for faster tests
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    unreliablePolicy.reset();
  });

  describe('Basic Retry Logic', () => {
    beforeEach(() => {
      retryPolicy = PolicyRetryBehavior.withDefaults(unreliablePolicy, 3);
    });

    it('should succeed immediately if policy passes', async () => {
      const resultPromise = retryPolicy.check(request);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(testEntity);
      expect(unreliablePolicy.callCount).toBe(1);

      const metrics = retryPolicy.getRetryMetrics();
      expect(metrics.successfulEvaluations).toBe(1);
      expect(metrics.retriedEvaluations).toBe(0);
    });

    it('should retry and eventually succeed', async () => {
      unreliablePolicy.failuresBeforeSuccess = 2; // Fail first 2 attempts
      unreliablePolicy.violationSeverity = 'WARNING'; // Make it retryable

      const resultPromise = retryPolicy.check(request);

      // Advance timers step by step for each retry
      await vi.advanceTimersByTimeAsync(1000); // First retry delay
      await vi.advanceTimersByTimeAsync(2000); // Second retry delay
      await vi.runAllTimersAsync();

      const result = await resultPromise;

      expect(result.isSuccess).toBe(true);
      expect(unreliablePolicy.callCount).toBe(3); // 2 failures + 1 success

      const metrics = retryPolicy.getRetryMetrics();
      expect(metrics.successfulEvaluations).toBe(1);
      expect(metrics.retriedEvaluations).toBe(1);
      expect(metrics.totalAttempts).toBe(3);
    });

    it('should fail after max attempts', async () => {
      unreliablePolicy.failuresBeforeSuccess = 5; // More failures than max attempts
      unreliablePolicy.violationSeverity = 'WARNING'; // Make it retryable

      const resultPromise = retryPolicy.check(request);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.isFailure).toBe(true);
      expect(result.error.message).toContain('after 3 attempts');
      expect(unreliablePolicy.callCount).toBe(3);

      const metrics = retryPolicy.getRetryMetrics();
      expect(metrics.failedEvaluations).toBe(1);
      expect(metrics.maxAttemptsReached).toBe(1);
    });

    it('should not retry ERROR violations by default', async () => {
      unreliablePolicy.failuresBeforeSuccess = 1;
      unreliablePolicy.violationSeverity = 'ERROR';

      const resultPromise = retryPolicy.check(request);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.isFailure).toBe(true);
      expect(unreliablePolicy.callCount).toBe(1); // No retries for ERROR
    });

    it('should retry WARNING violations by default', async () => {
      unreliablePolicy.failuresBeforeSuccess = 2;
      unreliablePolicy.violationSeverity = 'WARNING';

      const resultPromise = retryPolicy.check(request);

      // Run all timers and flush promises
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.isSuccess).toBe(true);
      expect(unreliablePolicy.callCount).toBe(3); // Retried warnings
    });
  });

  describe('Custom Retry Logic', () => {
    it('should use custom shouldRetry function', async () => {
      const customRetryPolicy = PolicyRetryBehavior.create(unreliablePolicy, {
        maxAttempts: 3,
        baseDelay: 100,
        shouldRetry: violation => violation.code === 'RETRYABLE_ERROR',
      });

      // Test with non-retryable error
      unreliablePolicy.failuresBeforeSuccess = 1;
      unreliablePolicy.violationCode = 'NON_RETRYABLE';

      const resultPromise1 = customRetryPolicy.check(request);
      await vi.runAllTimersAsync();
      const result1 = await resultPromise1;

      expect(result1.isFailure).toBe(true);
      expect(unreliablePolicy.callCount).toBe(1); // No retry

      // Reset and test with retryable error
      unreliablePolicy.reset();
      unreliablePolicy.failuresBeforeSuccess = 2;
      unreliablePolicy.violationCode = 'RETRYABLE_ERROR';

      const resultPromise2 = customRetryPolicy.check(request);
      await vi.runAllTimersAsync();
      const result2 = await resultPromise2;

      expect(result2.isSuccess).toBe(true);
      expect(unreliablePolicy.callCount).toBe(3); // Retried
    });

    it('should use custom exception retry logic', async () => {
      const exceptionRetryPolicy = PolicyRetryBehavior.create(unreliablePolicy, {
        maxAttempts: 3,
        baseDelay: 100,
        shouldRetryOnException: error => error.message.includes('timeout'),
      });

      unreliablePolicy.shouldThrow = true;

      const resultPromise = exceptionRetryPolicy.check(request);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.isFailure).toBe(true);
      expect(unreliablePolicy.callCount).toBe(1); // No retry for non-timeout error
    });

    it('should modify context for retries', async () => {
      const contextModifyingPolicy = PolicyRetryBehavior.create(unreliablePolicy, {
        maxAttempts: 3,
        baseDelay: 100,
        contextModifier: (request, attempt) => ({
          ...request,
          context: {
            ...request.context,
            metadata: {
              ...request.context.metadata,
              retryAttempt: attempt,
            },
          },
        }),
      });

      unreliablePolicy.failuresBeforeSuccess = 2;
      unreliablePolicy.violationSeverity = 'WARNING'; // Make it retryable

      const resultPromise = contextModifyingPolicy.check(request);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.isSuccess).toBe(true);
      // Context should have been modified for retries
    });
  });

  describe('Backoff Strategies', () => {
    beforeEach(() => {
      unreliablePolicy.violationSeverity = 'WARNING'; // Make retryable
    });

    it('should use exponential backoff', async () => {
      const exponentialRetryPolicy = PolicyRetryBehavior.create(unreliablePolicy, {
        maxAttempts: 4,
        baseDelay: 100,
        backoff: 'exponential',
        backoffMultiplier: 2,
      });

      unreliablePolicy.failuresBeforeSuccess = 3;
      unreliablePolicy.violationSeverity = 'WARNING'; // Make it retryable

      const resultPromise = exponentialRetryPolicy.check(request);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.isSuccess).toBe(true);
      expect(unreliablePolicy.callCount).toBe(4);
    });

    it('should use linear backoff', async () => {
      const linearRetryPolicy = PolicyRetryBehavior.create(unreliablePolicy, {
        maxAttempts: 3,
        baseDelay: 100,
        backoff: 'linear',
      });

      unreliablePolicy.failuresBeforeSuccess = 2;
      unreliablePolicy.violationSeverity = 'WARNING';

      const resultPromise = linearRetryPolicy.check(request);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.isSuccess).toBe(true);
    });

    it('should use fixed backoff', async () => {
      const fixedRetryPolicy = PolicyRetryBehavior.create(unreliablePolicy, {
        maxAttempts: 3,
        baseDelay: 150,
        backoff: 'fixed',
      });

      unreliablePolicy.failuresBeforeSuccess = 2;
      unreliablePolicy.violationSeverity = 'WARNING';

      const resultPromise = fixedRetryPolicy.check(request);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.isSuccess).toBe(true);
    });

    it('should respect max delay', async () => {
      const maxDelayPolicy = PolicyRetryBehavior.create(unreliablePolicy, {
        maxAttempts: 4,
        baseDelay: 100,
        maxDelay: 250,
        backoff: 'exponential',
        backoffMultiplier: 3,
      });

      unreliablePolicy.failuresBeforeSuccess = 3;
      unreliablePolicy.violationSeverity = 'WARNING';

      const resultPromise = maxDelayPolicy.check(request);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.isSuccess).toBe(true);
    });
  });

  describe('Factory Methods', () => {
    it('should create retry policy for transient failures', async () => {
      const transientRetryPolicy = PolicyRetryBehaviorFactory.forTransientFailures(
        unreliablePolicy,
        3
      );

      // Test with timeout error (should retry)
      unreliablePolicy.failuresBeforeSuccess = 2;
      unreliablePolicy.violationCode = 'TIMEOUT_ERROR';

      const resultPromise = transientRetryPolicy.check(request);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.isSuccess).toBe(true);
      expect(unreliablePolicy.callCount).toBe(3);
    });

    it('should create retry policy for external services', async () => {
      const externalRetryPolicy = PolicyRetryBehaviorFactory.forExternalServices(unreliablePolicy, {
        maxAttempts: 5,
        baseDelay: 2000,
        maxDelay: 30000,
      });

      expect(externalRetryPolicy.id).toContain('retry_');

      // Should have 5 max attempts
      unreliablePolicy.failuresBeforeSuccess = 4;
      unreliablePolicy.violationSeverity = 'WARNING';

      const resultPromise = externalRetryPolicy.check(request);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.isSuccess).toBe(true);
      expect(unreliablePolicy.callCount).toBe(5);
    });

    it('should create retry policy with custom logic', async () => {
      const customRetryPolicy = PolicyRetryBehaviorFactory.withCustomLogic(
        unreliablePolicy,
        violation => violation.code.startsWith('CUSTOM_'),
        4,
        500
      );

      // Test with custom retryable error
      unreliablePolicy.failuresBeforeSuccess = 3;
      unreliablePolicy.violationCode = 'CUSTOM_ERROR';

      const resultPromise = customRetryPolicy.check(request);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.isSuccess).toBe(true);
      expect(unreliablePolicy.callCount).toBe(4);
    });
  });

  describe('Metrics and Monitoring', () => {
    beforeEach(() => {
      retryPolicy = PolicyRetryBehavior.withDefaults(unreliablePolicy, 3);
    });

    it('should track comprehensive metrics', async () => {
      // Successful evaluation
      let resultPromise = retryPolicy.check(request);
      await vi.runAllTimersAsync();
      await resultPromise;

      // Failed evaluation with retries
      unreliablePolicy.reset();
      unreliablePolicy.failuresBeforeSuccess = 2;
      unreliablePolicy.violationSeverity = 'WARNING';

      resultPromise = retryPolicy.check(request);
      await vi.runAllTimersAsync();
      await resultPromise;

      // Failed evaluation exceeding max attempts
      unreliablePolicy.reset();
      unreliablePolicy.failuresBeforeSuccess = 5;
      unreliablePolicy.violationSeverity = 'WARNING';

      resultPromise = retryPolicy.check(request);
      await vi.runAllTimersAsync();
      await resultPromise;

      const metrics = retryPolicy.getRetryMetrics();
      expect(metrics.successfulEvaluations).toBe(2);
      expect(metrics.failedEvaluations).toBe(1);
      expect(metrics.retriedEvaluations).toBe(1);
      expect(metrics.maxAttemptsReached).toBe(1);
      expect(metrics.totalAttempts).toBe(7); // 1 + 3 + 3
      expect(metrics.averageAttempts).toBeGreaterThan(2);
    });

    it('should reset metrics', async () => {
      const resultPromise = retryPolicy.check(request);
      await vi.runAllTimersAsync();
      await resultPromise;

      let metrics = retryPolicy.getRetryMetrics();
      expect(metrics.totalAttempts).toBe(1);

      retryPolicy.resetMetrics();
      metrics = retryPolicy.getRetryMetrics();
      expect(metrics.totalAttempts).toBe(0);
      expect(metrics.successfulEvaluations).toBe(0);
    });
  });

  describe('Policy Interface Implementation', () => {
    beforeEach(() => {
      retryPolicy = PolicyRetryBehavior.withDefaults(unreliablePolicy);
    });

    it('should preserve policy identity', () => {
      expect(retryPolicy.id).toBe('policy_retry_unreliable-policy');
      expect(retryPolicy.domain).toBe('test');
      expect(retryPolicy.name).toBe('Policy Retry Unreliable Policy');
    });

    it('should support policy composition', () => {
      const otherPolicy = new UnreliablePolicy();

      expect(() => retryPolicy.and(otherPolicy)).not.toThrow();
      expect(() => retryPolicy.or(otherPolicy)).not.toThrow();
    });

    it('should support negation with retry preservation', () => {
      const negatedPolicy = retryPolicy.not();

      expect(negatedPolicy).toBeInstanceOf(PolicyRetryBehavior);
      expect(negatedPolicy.id).toContain('NOT_');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    beforeEach(() => {
      retryPolicy = PolicyRetryBehavior.withDefaults(unreliablePolicy, 3);
    });

    it('should handle exceptions during retry', async () => {
      const throwingRetryPolicy = PolicyRetryBehavior.create(unreliablePolicy, {
        maxAttempts: 3,
        baseDelay: 100,
        shouldRetryOnException: () => true,
      });

      unreliablePolicy.shouldThrow = true;

      const resultPromise = throwingRetryPolicy.check(request);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.isFailure).toBe(true);
      expect(result.error.code).toBe('POLICY_EXECUTION_ERROR');
      expect(unreliablePolicy.callCount).toBe(3); // Retried exceptions
    });

    it('should handle zero delay gracefully', async () => {
      const zeroDelayPolicy = PolicyRetryBehavior.create(unreliablePolicy, {
        maxAttempts: 3,
        baseDelay: 0,
      });

      unreliablePolicy.failuresBeforeSuccess = 2;
      unreliablePolicy.violationSeverity = 'WARNING';

      const resultPromise = zeroDelayPolicy.check(request);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.isSuccess).toBe(true);
      expect(unreliablePolicy.callCount).toBe(3);
    });

    it('should handle jitter correctly', async () => {
      const jitterPolicy = PolicyRetryBehavior.create(unreliablePolicy, {
        maxAttempts: 3,
        baseDelay: 1000,
        jitter: true,
      });

      unreliablePolicy.failuresBeforeSuccess = 2;
      unreliablePolicy.violationSeverity = 'WARNING';

      const resultPromise = jitterPolicy.check(request);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.isSuccess).toBe(true);
      // Jitter should still allow success despite timing variations
    });

    it('should enhance final violation with retry information', async () => {
      unreliablePolicy.failuresBeforeSuccess = 5; // More than max attempts
      unreliablePolicy.violationSeverity = 'WARNING';

      const resultPromise = retryPolicy.check(request);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.isFailure).toBe(true);
      expect(result.error.details?.retryAttempts).toBeDefined();
      expect(result.error.details?.totalAttempts).toBe(3);
      expect(result.error.details?.retryConfig).toBeDefined();
    });
  });
});
