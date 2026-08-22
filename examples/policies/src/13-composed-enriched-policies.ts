/**
 * Example 13 — Composing two enriched (decorated) policies (VB-008 AC5).
 *
 * Nothing before this documented that *wrapping order changes failure
 * semantics*. This example builds the same flaky base policy two different
 * ways and shows the two results are not interchangeable:
 *
 * 1. `cached(retry(base))` — retry wraps the base check; caching wraps the
 *    already-retried result. A transient failure gets retried in full on
 *    the FIRST call; once it eventually succeeds, that success is cached,
 *    so a repeat call is a pure cache hit and doesn't need to retry again.
 *    This is almost always what you want: retries resolve flakiness,
 *    caching avoids paying for the resolved answer twice.
 *
 * 2. `retry(cached(base))` — caching wraps base and (via
 *    `forExpensivePolicy`, which caches failures by default) caches a
 *    failing result too; retry wraps that cached policy. The FIRST retry
 *    attempt calls `base`, fails, and the failure gets cached. Every
 *    subsequent "retry" attempt reads that cached failure instead of
 *    re-invoking `base` — the loop still runs `maxAttempts` times, but it
 *    is retrying the cache, not the flaky dependency, so it never
 *    observes `base`'s eventual success.
 *
 * Use case: a payment-risk lookup that's flaky (retry candidate) and
 * expensive (cache candidate) — order 1 is correct, order 2 silently
 * defeats the retry.
 */

import {
  PolicyBuilder,
  PolicyCachingBehaviorFactory,
  PolicyRetryBehaviorFactory,
  type IBusinessPolicy,
} from '@vytches/ddd-policies';

export interface RiskCheck {
  readonly transactionId: string;
}

/**
 * A base policy that fails its first call and succeeds afterward — stands
 * in for a flaky external dependency. `callCount()` makes the difference
 * between the two wrapping orders observable.
 */
function buildBaseRiskPolicy(): { policy: IBusinessPolicy<RiskCheck>; callCount: () => number } {
  let callCount = 0;
  const policy = PolicyBuilder.create<RiskCheck>()
    .withId('flaky-risk-check')
    .withDomain('fraud')
    .withName('Flaky Risk Check')
    .mustSatisfy(
      () => {
        callCount++;
        return callCount > 1; // fails on the first call, succeeds after
      },
      'TIMEOUT_RISK_SERVICE',
      'Risk service timed out'
    )
    .build();

  return { policy, callCount: () => callCount };
}

/**
 * Order 1 (recommended): retry the flaky dependency, then cache the
 * resolved outcome. `cached(retry(base))`.
 */
export function buildRetryThenCachePolicy(): {
  policy: IBusinessPolicy<RiskCheck>;
  callCount: () => number;
} {
  const { policy: base, callCount } = buildBaseRiskPolicy();
  const retried = PolicyRetryBehaviorFactory.forTransientFailures(base, 3);
  const cached = PolicyCachingBehaviorFactory.withTTL(retried, 60_000);
  return { policy: cached, callCount };
}

/**
 * Order 2 (anti-pattern): cache first — including failures, via
 * `forExpensivePolicy`'s `cacheFailures: true` default — then retry the
 * cache. `retry(cached(base))`.
 */
export function buildCacheThenRetryPolicy(): {
  policy: IBusinessPolicy<RiskCheck>;
  callCount: () => number;
} {
  const { policy: base, callCount } = buildBaseRiskPolicy();
  const cached = PolicyCachingBehaviorFactory.forExpensivePolicy(base);
  const retried = PolicyRetryBehaviorFactory.forTransientFailures(cached, 3);
  return { policy: retried, callCount };
}
