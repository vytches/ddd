import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { safeRun } from '@vytches/ddd-utils';
import {
  DefaultResilienceContext,
  CircuitBreaker,
  CircuitBreakerState,
  CircuitBreakerOpenError,
} from '../../src';

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker;
  const defaultConfig = {
    failureThreshold: 3,
    recoveryTimeout: 1000,
    successThreshold: 2,
    timeout: 5000,
    name: 'test-circuit',
  };

  beforeEach(() => {
    circuitBreaker = new CircuitBreaker(defaultConfig);
  });

  describe('when circuit is closed', () => {
    it('should execute operation successfully', async () => {
      const context = DefaultResilienceContext.create();
      const operation = vi.fn().mockResolvedValue('success');

      const result = await circuitBreaker.execute(operation, context);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledWith(expect.any(DefaultResilienceContext));
    });

    it('should remain closed on single failure', async () => {
      const context = DefaultResilienceContext.create();
      const operation = vi.fn().mockRejectedValue(new Error('failure'));

      const [error, result] = await safeRun(() => circuitBreaker.execute(operation, context));

      expect(result).toBeUndefined();
      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toBe('failure');

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.state).toBe(CircuitBreakerState.CLOSED);
      expect(metrics.failureCount).toBe(1);
    });

    it('should trip to open state after threshold failures', async () => {
      const context = DefaultResilienceContext.create();
      const operation = vi.fn().mockRejectedValue(new Error('failure'));

      for (let i = 0; i < defaultConfig.failureThreshold; i++) {
        const [error, result] = await safeRun(() => circuitBreaker.execute(operation, context));
        expect(result).toBeUndefined();
        expect(error).toBeInstanceOf(Error);
        expect(error?.message).toBe('failure');
      }

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.state).toBe(CircuitBreakerState.OPEN);
      expect(metrics.failureCount).toBe(defaultConfig.failureThreshold);
      expect(metrics.nextAttemptTime).toBeDefined();
    });
  });

  describe('when circuit is open', () => {
    beforeEach(async () => {
      const context = DefaultResilienceContext.create();
      const operation = vi.fn().mockRejectedValue(new Error('failure'));

      for (let i = 0; i < defaultConfig.failureThreshold; i++) {
        const [error] = await safeRun(() => circuitBreaker.execute(operation, context));
        expect(error).toBeInstanceOf(Error);
      }
    });

    it('should reject immediately without executing operation', async () => {
      const context = DefaultResilienceContext.create();
      const operation = vi.fn().mockResolvedValue('success');

      const [error, result] = await safeRun(() => circuitBreaker.execute(operation, context));

      expect(result).toBeUndefined();
      expect(error).toBeInstanceOf(CircuitBreakerOpenError);
      expect(operation).not.toHaveBeenCalled();
    });

    it('should transition to half-open after recovery timeout', async () => {
      vi.useFakeTimers();

      const context = DefaultResilienceContext.create();
      const operation = vi.fn().mockResolvedValue('success');

      vi.advanceTimersByTime(defaultConfig.recoveryTimeout + 100);

      await circuitBreaker.execute(operation, context);
      await circuitBreaker.execute(operation, context);

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.state).toBe(CircuitBreakerState.CLOSED);

      vi.useRealTimers();
    });
  });

  describe('when circuit is half-open', () => {
    beforeEach(async () => {
      // VT-001 (2026-05-09): replaced real-timer setTimeout (which depended on
      // system clock and made the suite flaky on slow CI) with fake timers +
      // advanceTimersByTime — deterministic and ~1000× faster.
      vi.useFakeTimers();

      const context = DefaultResilienceContext.create();
      const operation = vi.fn().mockRejectedValue(new Error('failure'));

      for (let i = 0; i < defaultConfig.failureThreshold; i++) {
        const [error] = await safeRun(() => circuitBreaker.execute(operation, context));
        expect(error).toBeInstanceOf(Error);
      }

      vi.advanceTimersByTime(defaultConfig.recoveryTimeout + 100);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should close circuit after successful operations', async () => {
      const context = DefaultResilienceContext.create();
      const operation = vi.fn().mockResolvedValue('success');

      for (let i = 0; i < defaultConfig.successThreshold; i++) {
        await circuitBreaker.execute(operation, context);
      }

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.state).toBe(CircuitBreakerState.CLOSED);
      expect(metrics.failureCount).toBe(0);
    });

    it('should trip back to open on failure', async () => {
      const context = DefaultResilienceContext.create();
      const failOperation = vi.fn().mockRejectedValue(new Error('failure'));

      const [error, result] = await safeRun(() => circuitBreaker.execute(failOperation, context));

      expect(result).toBeUndefined();
      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toBe('failure');

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.state).toBe(CircuitBreakerState.OPEN);
    });
  });

  describe('metrics', () => {
    it('should track failure and success counts', async () => {
      const context = DefaultResilienceContext.create();
      const successOp = vi.fn().mockResolvedValue('success');
      const failOp = vi.fn().mockRejectedValue(new Error('fail'));

      await circuitBreaker.execute(successOp, context);

      const [error, result] = await safeRun(() => circuitBreaker.execute(failOp, context));
      expect(result).toBeUndefined();
      expect(error).toBeInstanceOf(Error);

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.failureCount).toBe(1);
      expect(metrics.lastSuccessTime).toBeDefined();
      expect(metrics.lastFailureTime).toBeDefined();
    });
  });
});
