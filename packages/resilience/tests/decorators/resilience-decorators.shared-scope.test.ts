import { describe, expect, it } from 'vitest';
import { safeRun } from '@vytches/ddd-utils';
import { CircuitBreakerDecorator as CircuitBreaker, CircuitBreakerOpenError } from '../../src';

/**
 * AC7 — `scope: 'shared'` opt-in restores the pre-AC2 behavior: one policy
 * for the whole decorated method, shared by every instance of the class.
 *
 * Kept in its own file/describe (per the task card) rather than folded into
 * the AC2 instance-scope test, so the two behaviors read as an explicit
 * contrast: default ('instance', see
 * resilience-decorators.instance-scope.test.ts) isolates state per
 * instance; 'shared' deliberately opts back into the old, class-wide
 * sharing — e.g. to protect one shared downstream resource (a connection
 * pool) with a single breaker regardless of how many instances call it.
 *
 * LT1/N1: imports the package's own public barrel via '../../src'
 * (`packages/resilience/src/index.ts` — the exact file '@vytches/ddd-resilience'
 * resolves to), not an internal subpath. A literal package-name self-import
 * here is rejected by this repo's `@nx/enforce-module-boundaries` lint rule
 * (see tests/api-surface.test.ts for the same established pattern).
 */
describe("@CircuitBreaker scope: 'shared' shares one policy across every instance (AC7)", () => {
  class SharedService {
    @CircuitBreaker({
      failureThreshold: 2,
      recoveryTimeout: 60000,
      successThreshold: 1,
      timeout: 5000,
      name: 'shared-circuit',
      scope: 'shared',
    })
    async flakyMethod(shouldFail: boolean): Promise<string> {
      if (shouldFail) {
        throw new Error('downstream failure');
      }
      return 'ok';
    }
  }

  it('failures tripping the breaker via one instance also reject calls made through a different instance', async () => {
    const instanceA = new SharedService();
    const instanceB = new SharedService();

    // Trip the shared breaker via instance A: failureThreshold: 2.
    const [err1] = await safeRun(() => instanceA.flakyMethod(true));
    expect(err1).toBeInstanceOf(Error);
    const [err2] = await safeRun(() => instanceA.flakyMethod(true));
    expect(err2).toBeInstanceOf(Error);

    // A never-failing call through instance B is rejected too — same
    // policy, same OPEN state, regardless of which instance called it. This
    // is the exact contrast to AC2's default isolation.
    const [errB] = await safeRun(() => instanceB.flakyMethod(false));
    expect(errB).toBeInstanceOf(CircuitBreakerOpenError);
  });
});
