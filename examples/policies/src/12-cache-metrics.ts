/**
 * Example 12 — Reading cache metrics (VB-008 AC3/AC5).
 *
 * `PolicyCachingBehavior.getCacheMetrics()` returns a named
 * `PolicyCacheMetrics` interface (VB-008 AC3 — previously an anonymous
 * `ReturnType<PolicyCache['getMetrics']>` derived from an unexported
 * internal class, so consumers had nothing to name the return value with).
 * This example gives that type a compiled consumer.
 *
 * Use case: expose a lightweight health/ops endpoint reporting how well a
 * cached policy's cache is performing (hit-to-miss ratio, current size).
 */

import {
  PolicyBuilder,
  PolicyCachingBehaviorFactory,
  type IBusinessPolicy,
  type PolicyCacheMetrics,
} from '@vytches/ddd-policies';

export interface FeatureFlagCheck {
  readonly userId: string;
  readonly flagName: string;
}

const baseFlagPolicy: IBusinessPolicy<FeatureFlagCheck> = PolicyBuilder.create<FeatureFlagCheck>()
  .withId('feature-flag-check')
  .withDomain('flags')
  .withName('Feature Flag Check')
  .mustSatisfy(
    req => isEnabledStub(req.userId, req.flagName),
    'FLAG_DISABLED',
    'Feature flag is disabled for this user'
  )
  .build();

function isEnabledStub(userId: string, flag: string): boolean {
  return flag === 'new-checkout' && userId.startsWith('A_');
}

const cachedFlagPolicy = PolicyCachingBehaviorFactory.withTTL(baseFlagPolicy, 60_000);

/**
 * Report the cache hit ratio for an ops dashboard. `PolicyCacheMetrics` is
 * a plain, named, importable interface — consumers can build derived
 * reporting types on top of it (like `CacheHealthReport` below) without
 * reaching into library internals.
 */
export interface CacheHealthReport {
  readonly policyId: string;
  readonly hitRatio: number;
  readonly currentSize: number;
}

export function reportCacheHealth(
  policy: IBusinessPolicy<FeatureFlagCheck> & { getCacheMetrics(): PolicyCacheMetrics }
): CacheHealthReport {
  const metrics = policy.getCacheMetrics();
  const totalReads = metrics.hits + metrics.misses;

  return {
    policyId: policy.id,
    hitRatio: totalReads === 0 ? 0 : metrics.hits / totalReads,
    currentSize: metrics.entries,
  };
}

export function buildFlagPolicyWithMetrics(): typeof cachedFlagPolicy {
  return cachedFlagPolicy;
}
