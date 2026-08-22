import { describe, expect, it } from 'vitest';
import {
  CircuitBreaker,
  CircuitBreakerHalfOpenLimitError,
  CircuitBreakerOpenError,
  DefaultResilienceContext,
} from '../../src';

/**
 * AC3 — HALF_OPEN admission is gated by `halfOpenMaxProbes` (default 1)
 * under N concurrent callers arriving exactly at the OPEN -> HALF_OPEN
 * boundary (SA-M3).
 *
 * The admission check-then-increment in `CircuitBreaker.execute()` is fully
 * synchronous — no `await` between reading `halfOpenProbesInFlight` and
 * incrementing it (see the class's own comment on that field). Given that,
 * calling `execute()` N times back-to-back (no `await` between the calls
 * themselves) makes every admission decision run to completion, in
 * registration order, before any of the N probe operations gets a chance to
 * resolve — so this test is deterministic without needing `Promise.race`
 * timing games or a retry/flaky-sleep loop.
 *
 * LT1/N1: imports the package's own public barrel via '../../src'
 * (`packages/resilience/src/index.ts` — the exact file '@vytches/ddd-resilience'
 * resolves to), not an internal subpath. A literal package-name self-import
 * here is rejected by this repo's `@nx/enforce-module-boundaries` lint rule
 * (see tests/api-surface.test.ts for the same established pattern).
 *
 * OUT OF SCOPE (per the task card): `halfOpenProbesInFlight` itself is not
 * asserted on directly — it is a private implementation counter, not public
 * API (VF-025, D6). This test only asserts the publicly-observable outcome:
 * which calls resolve vs. which are rejected, and with what error type.
 */
describe('CircuitBreaker HALF_OPEN admission race (AC3)', () => {
  it('admits exactly halfOpenMaxProbes (default 1) concurrent calls at the OPEN->HALF_OPEN boundary; rejects the rest with CircuitBreakerHalfOpenLimitError', async () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 1,
      // Immediate eligibility for HALF_OPEN on the very next call after the
      // trip — no need to wait out a real recovery window in the test.
      recoveryTimeout: 0,
      successThreshold: 1,
      timeout: 5000,
      name: 'half-open-race',
      // halfOpenMaxProbes omitted — exercises the documented default of 1.
    });

    const context = DefaultResilienceContext.create({});

    // 1) Trip the breaker to OPEN.
    await expect(
      breaker.execute(async () => {
        throw new Error('boom');
      }, context)
    ).rejects.toThrow('boom');

    // 2) N concurrent probes arriving right as the breaker becomes eligible
    // to transition OPEN -> HALF_OPEN. Each probe operation suspends on an
    // externally-controlled gate so none of them can complete before every
    // admission decision has already been made.
    const N = 5;
    const started: number[] = [];
    let releaseGate: () => void;
    const gate = new Promise<void>(resolve => {
      releaseGate = resolve;
    });

    const operations = Array.from({ length: N }, (_, i) =>
      breaker.execute(async () => {
        started.push(i);
        await gate;
        return `done-${i}`;
      }, context)
    );

    // Admission for all N calls has already run synchronously by this
    // point (execute() has no `await` before either throwing or invoking
    // the operation) — exactly one probe operation started; the other four
    // were rejected before ever reaching the operation body.
    expect(started).toEqual([0]);

    releaseGate!();
    const results = await Promise.allSettled(operations);

    expect(results[0]).toMatchObject({ status: 'fulfilled', value: 'done-0' });

    const rejected = results.slice(1);
    expect(rejected).toHaveLength(N - 1);
    for (const result of rejected) {
      expect(result.status).toBe('rejected');
      const reason = (result as PromiseRejectedResult).reason;
      expect(reason).toBeInstanceOf(CircuitBreakerHalfOpenLimitError);
      // D5: CircuitBreakerHalfOpenLimitError extends CircuitBreakerOpenError
      // — existing `instanceof CircuitBreakerOpenError` catch handlers must
      // keep working unchanged.
      expect(reason).toBeInstanceOf(CircuitBreakerOpenError);
    }
  });
});
