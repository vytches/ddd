import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ResiliencePolicyBuilder,
  CompositeResilienceStrategy,
  CircuitBreakerStrategy,
  RetryStrategy,
  TimeoutStrategy,
} from '../patterns/resilience-strategy';
import { DefaultResilienceContext, TimeoutError } from './resilience-context';

describe('ResilienceStrategy', () => {
  let context: DefaultResilienceContext;

  beforeEach(() => {
    context = DefaultResilienceContext.create() as DefaultResilienceContext;
  });

  describe('CircuitBreakerStrategy', () => {
    it('should execute operation through circuit breaker', async () => {
      const strategy = new CircuitBreakerStrategy({
        failureThreshold: 2,
        recoveryTimeout: 1000,
        successThreshold: 1,
        timeout: 5000,
      });

      const operation = vi.fn().mockResolvedValue('success');
      const result = await strategy.execute(operation, context);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalled();
    });

    it('should provide circuit breaker metrics', async () => {
      const strategy = new CircuitBreakerStrategy({
        failureThreshold: 1,
        recoveryTimeout: 1000,
        successThreshold: 1,
        timeout: 5000,
      });

      const metrics = strategy.getMetrics();
      expect(metrics).toHaveProperty('state');
      expect(metrics).toHaveProperty('failureCount');
    });
  });

  describe('RetryStrategy', () => {
    it('should execute operation through retry policy', async () => {
      const strategy = new RetryStrategy({
        maxAttempts: 3,
        baseDelay: 100,
        maxDelay: 1000,
        backoffMultiplier: 2,
        jitter: false,
      });

      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success');

      const result = await strategy.execute(operation, context);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });
  });

  describe('TimeoutStrategy', () => {
    it('should apply timeout to operation', async () => {
      const strategy = new TimeoutStrategy(100);
      const operation = vi
        .fn()
        .mockImplementation(() => new Promise(resolve => setTimeout(resolve, 200)));

      await expect(strategy.execute(operation, context)).rejects.toThrow(TimeoutError);
    });

    it('should succeed if operation completes within timeout', async () => {
      const strategy = new TimeoutStrategy(1000);
      const operation = vi.fn().mockResolvedValue('success');

      const result = await strategy.execute(operation, context);

      expect(result).toBe('success');
    });
  });

  describe('CompositeResilienceStrategy', () => {
    it('should combine multiple strategies', async () => {
      const retryStrategy = new RetryStrategy({
        maxAttempts: 2,
        baseDelay: 1,
        maxDelay: 10,
        backoffMultiplier: 2,
        jitter: false,
      });

      const timeoutStrategy = new TimeoutStrategy(5000);

      const composite = CompositeResilienceStrategy.combine(retryStrategy, timeoutStrategy);

      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success');

      const result = await composite.execute(operation, context);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should apply strategies in correct order', async () => {
      const executionOrder: string[] = [];

      const strategy1 = {
        execute: vi.fn().mockImplementation(async (op, ctx) => {
          executionOrder.push('strategy1-start');
          const result = await op(ctx);
          executionOrder.push('strategy1-end');
          return result;
        }),
      };

      const strategy2 = {
        execute: vi.fn().mockImplementation(async (op, ctx) => {
          executionOrder.push('strategy2-start');
          const result = await op(ctx);
          executionOrder.push('strategy2-end');
          return result;
        }),
      };

      const composite = new CompositeResilienceStrategy([strategy1, strategy2]);
      const operation = vi.fn().mockImplementation(() => {
        executionOrder.push('operation');
        return Promise.resolve('success');
      });

      await composite.execute(operation, context);

      expect(executionOrder).toEqual([
        'strategy1-start',
        'strategy2-start',
        'operation',
        'strategy2-end',
        'strategy1-end',
      ]);
    });
  });

  describe('ResiliencePolicyBuilder', () => {
    it('should build single strategy', () => {
      const policy = ResiliencePolicyBuilder.create().withTimeout(5000).build();

      expect(policy).toBeInstanceOf(TimeoutStrategy);
    });

    it('should build composite strategy with multiple components', () => {
      const policy = ResiliencePolicyBuilder.create()
        .withCircuitBreaker({
          failureThreshold: 3,
          recoveryTimeout: 1000,
          successThreshold: 2,
          timeout: 5000,
        })
        .withRetry({
          maxAttempts: 3,
          baseDelay: 100,
          maxDelay: 1000,
          backoffMultiplier: 2,
          jitter: false,
        })
        .withTimeout(10000)
        .build();

      expect(policy).toBeInstanceOf(CompositeResilienceStrategy);
    });

    it('should throw error when no strategies configured', () => {
      expect(() => {
        ResiliencePolicyBuilder.create().build();
      }).toThrow('At least one resilience strategy must be configured');
    });

    it('should execute complete resilience policy', async () => {
      const policy = ResiliencePolicyBuilder.create()
        .withRetry({
          maxAttempts: 3,
          baseDelay: 1,
          maxDelay: 10,
          backoffMultiplier: 2,
          jitter: false,
        })
        .withTimeout(5000)
        .build();

      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success');

      const result = await policy.execute(operation, context);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });
  });
});
