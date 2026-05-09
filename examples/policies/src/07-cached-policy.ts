/**
 * Example 7 — Cached policy with TTL.
 *
 * Wrap a policy with `PolicyCachingBehavior` to memoize check results.
 * The cache is keyed by the request entity (deep-equal); TTL bounds the
 * staleness window.
 *
 * Use case: feature-flag gating — checking the flag store on every
 * command would be expensive. Cache the result for 60 seconds.
 */

import { PolicyBuilder, PolicyCachingBehavior, type IBusinessPolicy } from '@vytches/ddd-policies';

export interface FeatureFlagCheck {
  readonly userId: string;
  readonly flagName: string;
}

/**
 * Base policy: does the user have the feature flag enabled?
 * In a real system, this would call out to LaunchDarkly / GrowthBook.
 */
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

// Stub for documentation; real impl reads from a flag service.
function isEnabledStub(userId: string, flag: string): boolean {
  // Pretend feature is on for users in cohort A.
  return flag === 'new-checkout' && userId.startsWith('A_');
}

/**
 * Cached version — same identity (userId + flagName) within 60 seconds
 * returns the cached decision instead of re-querying. After TTL expires,
 * the next call re-checks and refreshes.
 */
export function buildCachedFlagPolicy(): IBusinessPolicy<FeatureFlagCheck> {
  return PolicyCachingBehavior.create(baseFlagPolicy, {
    ttl: 60_000, // 60 seconds
  });
}
