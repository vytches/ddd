import { describe, it, expect } from 'vitest';
import { safeRun } from '@vytches-ddd/testing';
import {
  CircuitBreaker,
  Retry,
  Bulkhead,
  Resilience,
  Timeout,
  getResilienceMetrics,
} from './resilience-decorators';
import { DefaultResilienceContext } from '../core/resilience-context';
import { CircuitBreakerOpenError } from '../patterns/circuit-breaker';
import { MaxRetriesExceededError } from '../patterns/retry';
import { BulkheadRejectedException } from '../patterns/bulkhead';

describe('Resilience Decorators', () => {
  describe('@CircuitBreaker', () => {
    class TestService {
      @CircuitBreaker({
        failureThreshold: 2,
        recoveryTimeout: 1000,
        successThreshold: 1,
        timeout: 5000,
        name: 'test-circuit',
      })
      async flakyMethod(shouldFail: boolean): Promise<string> {
        if (shouldFail) {
          throw new Error('Service failure');
        }
        return 'success';
      }
    }

    it('should allow successful operations', async () => {
      const service = new TestService();

      const result = await service.flakyMethod(false);
      expect(result).toBe('success');
    });

    it('should trip circuit after threshold failures', async () => {
      const service = new TestService();

      const [error1] = await safeRun(() => service.flakyMethod(true));
      expect(error1).toBeInstanceOf(Error);

      const [error2] = await safeRun(() => service.flakyMethod(true));
      expect(error2).toBeInstanceOf(Error);

      const [error3] = await safeRun(() => service.flakyMethod(false));
      expect(error3).toBeInstanceOf(CircuitBreakerOpenError);
    });

    it('should preserve method metadata', () => {
      const service = new TestService();
      const config = (service.flakyMethod as any).resilienceConfig;

      expect(config).toBeDefined();
      expect(config.name).toBe('test-circuit');
      expect(config.failureThreshold).toBe(2);
    });
  });

  describe('@Retry', () => {
    class TestService {
      private callCount = 0;

      @Retry({
        maxAttempts: 3,
        baseDelay: 10,
        maxDelay: 100,
        backoffMultiplier: 2,
        jitter: false,
        decoratorName: 'test-retry',
      })
      async unreliableMethod(): Promise<string> {
        this.callCount++;
        if (this.callCount < 3) {
          throw new Error('Temporary failure');
        }
        return 'success';
      }

      resetCallCount(): void {
        this.callCount = 0;
      }
    }

    it('should retry until success', async () => {
      const service = new TestService();

      const result = await service.unreliableMethod();
      expect(result).toBe('success');
    });

    it('should fail after max attempts', async () => {
      const service = new TestService();

      // First call succeeds after retries
      await service.unreliableMethod();

      // Reset and test max retries
      service.resetCallCount();

      const [error] = await safeRun(async () => {
        // Make it always fail
        service.resetCallCount();
        class AlwaysFailService extends TestService {
          @Retry({
            maxAttempts: 2,
            baseDelay: 1,
            maxDelay: 10,
            backoffMultiplier: 2,
            jitter: false,
          })
          async alwaysFailMethod(): Promise<string> {
            throw new Error('Always fails');
          }
        }

        const failService = new AlwaysFailService();
        return await failService.alwaysFailMethod();
      });

      expect(error).toBeInstanceOf(MaxRetriesExceededError);
    });
  });

  describe('@Bulkhead', () => {
    class TestService {
      @Bulkhead({
        maxConcurrency: 2,
        queueCapacity: 1,
        timeout: 5000,
        name: 'test-bulkhead',
      })
      async slowMethod(delay: number): Promise<string> {
        await new Promise(resolve => setTimeout(resolve, delay));
        return 'completed';
      }
    }

    it('should allow concurrent operations within limit', async () => {
      const service = new TestService();

      const promises = [service.slowMethod(10), service.slowMethod(10)];

      const results = await Promise.all(promises);
      expect(results).toEqual(['completed', 'completed']);
    });

    it('should reject when over capacity', async () => {
      const service = new TestService();

      // Fill concurrency slots
      const longPromise1 = service.slowMethod(1000);
      const longPromise2 = service.slowMethod(1000);

      // Fill queue
      const queuedPromise = service.slowMethod(10);

      // This should be rejected
      const [error] = await safeRun(() => service.slowMethod(10));

      expect(error).toBeInstanceOf(BulkheadRejectedException);

      // Cleanup
      longPromise1.catch(() => {
        // Ignore cleanup errors
      });
      longPromise2.catch(() => {
        // Ignore cleanup errors
      });
      queuedPromise.catch(() => {
        // Ignore cleanup errors
      });
    });
  });

  describe('@Resilience (Composite)', () => {
    class TestService {
      private callCount = 0;

      @Resilience({
        decoratorName: 'comprehensive-service',
        timeout: 10000,
        bulkhead: {
          maxConcurrency: 5,
          queueCapacity: 10,
        },
        retry: {
          maxAttempts: 2,
          baseDelay: 10,
          maxDelay: 100,
          backoffMultiplier: 2,
          jitter: false,
        },
        circuitBreaker: {
          failureThreshold: 3,
          recoveryTimeout: 5000,
          successThreshold: 2,
          timeout: 5000,
        },
      })
      async comprehensiveMethod(shouldFail: boolean): Promise<string> {
        this.callCount++;
        if (shouldFail && this.callCount === 1) {
          throw new Error('First attempt fails');
        }
        return 'success';
      }

      resetCallCount(): void {
        this.callCount = 0;
      }
    }

    it('should combine multiple resilience patterns', async () => {
      const service = new TestService();

      // Should succeed on retry
      const result = await service.comprehensiveMethod(true);
      expect(result).toBe('success');
    });

    it('should preserve composite configuration', () => {
      const service = new TestService();
      const config = (service.comprehensiveMethod as any).resilienceConfig;

      expect(config).toBeDefined();
      expect(config.decoratorName).toBe('comprehensive-service');
      expect(config.retry?.maxAttempts).toBe(2);
      expect(config.bulkhead?.maxConcurrency).toBe(5);
      expect(config.circuitBreaker?.failureThreshold).toBe(3);
    });
  });

  describe('@Timeout', () => {
    class TestService {
      @Timeout({ timeout: 100, decoratorName: 'fast-timeout' })
      async slowMethod(delay: number): Promise<string> {
        await new Promise(resolve => setTimeout(resolve, delay));
        return 'completed';
      }
    }

    it('should complete within timeout', async () => {
      const service = new TestService();

      const result = await service.slowMethod(50);
      expect(result).toBe('completed');
    });

    it('should timeout on slow operations', async () => {
      const service = new TestService();

      const [error] = await safeRun(() => service.slowMethod(200));
      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toContain('timed out');
    });
  });

  describe('getResilienceMetrics', () => {
    class TestService {
      @CircuitBreaker({
        failureThreshold: 5,
        recoveryTimeout: 30000,
        successThreshold: 3,
        timeout: 10000,
        name: 'metrics-test',
      })
      async testMethod(): Promise<string> {
        return 'success';
      }
    }

    it('should extract resilience configuration', () => {
      const service = new TestService();

      const metrics = getResilienceMetrics(
        service as unknown as Record<string, unknown>,
        'testMethod'
      );

      expect(metrics.config).toBeDefined();
      expect((metrics.config as any).name).toBe('metrics-test');
      expect(metrics.className).toBe('TestService');
      expect(metrics.methodName).toBe('testMethod');
    });

    it('should throw for non-decorated methods', () => {
      const service = new TestService();

      expect(() =>
        getResilienceMetrics(service as unknown as Record<string, unknown>, 'nonExistentMethod')
      ).toThrow('Method nonExistentMethod is not decorated with resilience patterns');
    });
  });

  describe('Context Injection', () => {
    class TestService {
      @CircuitBreaker({
        failureThreshold: 5,
        recoveryTimeout: 30000,
        successThreshold: 3,
        timeout: 10000,
        contextProvider: () =>
          DefaultResilienceContext.create({
            correlationId: 'custom-correlation',
            metadata: { source: 'test' },
          }),
      })
      async methodWithCustomContext(): Promise<string> {
        return 'success';
      }
    }

    it('should use custom context provider', async () => {
      const service = new TestService();

      const result = await service.methodWithCustomContext();
      expect(result).toBe('success');
    });
  });
});
