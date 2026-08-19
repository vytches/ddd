import { describe, expect, it } from 'vitest';
import { safeRun } from '@vytches/ddd-utils';
import { CircuitBreakerDecorator as CircuitBreaker, CircuitBreakerOpenError } from '../../src';

/**
 * AC2 — default `scope: 'instance'` isolation for resilience decorators.
 *
 * Pre-fix, the policy built by `createResilienceDecorator` (circuit
 * breaker, retry, bulkhead, ...) was constructed ONCE at class-decoration
 * time and shared by every instance of the decorated class, regardless of
 * caller intent. That silently coupled unrelated instances: tripping the
 * breaker via instance A's failures also broke instance B, which never
 * failed at all.
 *
 * This file (kept separate from AC7's shared-scope contrast test, per the
 * task card) asserts the fixed default behavior: each instance gets its own
 * lazily-created policy, keyed by a `WeakMap<instance, policy>`.
 *
 * LT1/N1: imports the package's own public barrel via '../../src'
 * (`packages/resilience/src/index.ts` — the exact file '@vytches/ddd-resilience'
 * resolves to), not an internal subpath. A literal package-name self-import
 * here is rejected by this repo's `@nx/enforce-module-boundaries` lint rule
 * (see tests/api-surface.test.ts for the same established pattern).
 */
describe("@CircuitBreaker default scope ('instance') isolates state across instances (AC2)", () => {
  class TestService {
    @CircuitBreaker({
      failureThreshold: 2,
      recoveryTimeout: 60000,
      successThreshold: 1,
      timeout: 5000,
      name: 'instance-scoped-circuit',
      // scope omitted — must default to 'instance'.
    })
    async flakyMethod(shouldFail: boolean): Promise<string> {
      if (shouldFail) {
        throw new Error('downstream failure');
      }
      return 'ok';
    }
  }

  it('failures tripping the breaker on one instance do not affect a second instance', async () => {
    const instanceA = new TestService();
    const instanceB = new TestService();

    // Trip instance A's breaker: failureThreshold: 2.
    const [err1] = await safeRun(() => instanceA.flakyMethod(true));
    expect(err1).toBeInstanceOf(Error);
    const [err2] = await safeRun(() => instanceA.flakyMethod(true));
    expect(err2).toBeInstanceOf(Error);

    // Instance A's breaker is now OPEN — even a non-failing call is rejected.
    const [errA] = await safeRun(() => instanceA.flakyMethod(false));
    expect(errA).toBeInstanceOf(CircuitBreakerOpenError);

    // Instance B never failed and must be completely unaffected — its own,
    // independent breaker is still CLOSED.
    const resultB = await instanceB.flakyMethod(false);
    expect(resultB).toBe('ok');
  });

  it('each instance also independently recovers its own breaker (no cross-instance bleed on success)', async () => {
    const instanceA = new TestService();
    const instanceB = new TestService();

    await safeRun(() => instanceA.flakyMethod(true));
    await safeRun(() => instanceA.flakyMethod(true));
    const [errA] = await safeRun(() => instanceA.flakyMethod(false));
    expect(errA).toBeInstanceOf(CircuitBreakerOpenError);

    // Instance B, having never been called before, starts CLOSED and stays
    // that way across repeated successful calls — nothing from A's tripped
    // state leaks into B's independent policy.
    await expect(instanceB.flakyMethod(false)).resolves.toBe('ok');
    await expect(instanceB.flakyMethod(false)).resolves.toBe('ok');
  });
});
