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

    // VF-025 AC10 (bonus) — see project-orchestration/analysis/VF-025.analysis.md
    // Q2. Resetting failureCount on OPEN->HALF_OPEN (updateStateIfNeeded) and
    // "any HALF_OPEN failure re-trips immediately" (onFailure's HALF_OPEN
    // branch, checked BEFORE the failureThreshold comparison) are one
    // inseparable unit: reset alone would be a regression, since a single
    // failure from a fresh failureCount=0 would then need
    // `failureThreshold` more failures to trip again instead of just one.
    it('re-trips to OPEN on a single HALF_OPEN failure, without needing failureThreshold more failures', async () => {
      const context = DefaultResilienceContext.create();
      const failOperation = vi.fn().mockRejectedValue(new Error('single failure'));

      // failureThreshold is 3 (defaultConfig) — if the immediate-trip branch
      // in onFailure() were missing (i.e. only the failureCount reset had
      // shipped), a lone failure here would land at failureCount=1, which is
      // below threshold, and the circuit would stay HALF_OPEN instead of
      // re-opening. Asserting OPEN after exactly one failure is what
      // discriminates the real fix from that isolated-reset regression.
      const [error] = await safeRun(() => circuitBreaker.execute(failOperation, context));
      expect(error).toBeInstanceOf(Error);
      expect(failOperation).toHaveBeenCalledTimes(1);

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.state).toBe(CircuitBreakerState.OPEN);
      // onFailure()'s HALF_OPEN branch trips and returns before the
      // failureThreshold increment runs, so failureCount stays at the reset
      // value (0) — the trip is driven by the immediate-trip rule itself,
      // not by the counter reaching any particular number.
      expect(metrics.failureCount).toBe(0);
      expect(metrics.nextAttemptTime).toBeDefined();
    });

    // VF-025 AC10 (bonus), Q2 — the other half of the same unit: failureCount
    // must already read 0 by the time the very first HALF_OPEN probe runs,
    // not only after it settles. Verified from inside the probe operation
    // itself (gated so we can inspect metrics mid-flight) rather than after
    // execute() resolves, so this fails if the reset were ever moved to run
    // after the probe instead of before it.
    it('resets failureCount to 0 on entering HALF_OPEN, before the first probe runs', async () => {
      const context = DefaultResilienceContext.create();

      let releaseGate!: () => void;
      const gate = new Promise<void>(resolve => {
        releaseGate = resolve;
      });

      const probe = circuitBreaker.execute(async () => {
        const metricsDuringProbe = circuitBreaker.getMetrics();
        expect(metricsDuringProbe.state).toBe(CircuitBreakerState.HALF_OPEN);
        expect(metricsDuringProbe.failureCount).toBe(0);
        await gate;
        return 'success';
      }, context);

      releaseGate();
      await expect(probe).resolves.toBe('success');
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
