/**
 * Example 9 — Caching preset factory (VB-008 AC5).
 *
 * `PolicyCachingBehaviorFactory` is the frozen-object preset surface for
 * `PolicyCachingBehavior` (VB-008 AC2 converted it from a static-only class
 * to a frozen object — same export name, same call syntax). Prefer these
 * presets over calling `PolicyCachingBehavior.create()` directly when your
 * use case matches one of the named scenarios below.
 *
 * Use case: an expensive fraud-scoring lookup — cache the decision per
 * transaction fingerprint so a retried command doesn't re-run the scorer.
 */

import {
  PolicyBuilder,
  PolicyCachingBehaviorFactory,
  type IBusinessPolicy,
} from '@vytches/ddd-policies';

export interface FraudScoreCheck {
  readonly transactionFingerprint: string;
  readonly amount: number;
}

/**
 * Base policy: rejects transactions the (stubbed) scorer flags as risky.
 * In a real system this would call out to a fraud-scoring service — the
 * exact reason `forExpensivePolicy` exists: avoid paying that cost twice
 * for the same fingerprint.
 */
const baseFraudPolicy: IBusinessPolicy<FraudScoreCheck> = PolicyBuilder.create<FraudScoreCheck>()
  .withId('fraud-score-check')
  .withDomain('fraud')
  .withName('Fraud Score Check')
  .mustSatisfy(scoreStub, 'FRAUD_SCORE_TOO_HIGH', 'Transaction fraud score exceeds threshold')
  .build();

function scoreStub(tx: FraudScoreCheck): boolean {
  // Pretend transactions over $10,000 always score as risky.
  return tx.amount <= 10_000;
}

/**
 * `forExpensivePolicy` is the preset for costly checks: longer default TTL,
 * a smaller default `maxSize` (entries here are assumed individually
 * costlier), and failures are cached too (so a flagged fingerprint doesn't
 * re-trigger the scorer on every retry).
 */
export function buildCachedFraudPolicy(): IBusinessPolicy<FraudScoreCheck> {
  return PolicyCachingBehaviorFactory.forExpensivePolicy(baseFraudPolicy, {
    ttl: 120_000, // 2 minutes
  });
}
