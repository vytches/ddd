/**
 * Example 6 — Retry behavior on transient failures.
 *
 * Wrap a policy with `PolicyRetryBehavior` to automatically retry on
 * transient failures (network blips, optimistic-concurrency conflicts).
 * The behavior is opt-in and configurable: max attempts, exponential
 * backoff, jitter, and a `shouldRetry` predicate to filter which errors
 * deserve another attempt.
 *
 * Use case: external risk-score check that occasionally times out — retry
 * up to 3 times with backoff, fail fast on permanent errors.
 */

import { PolicyBuilder, PolicyRetryBehavior, type IBusinessPolicy } from '@vytches/ddd-policies';

export interface RiskCheck {
  readonly transactionId: string;
  readonly amount: number;
}

/**
 * Base policy: rejects transactions over $1000 from new accounts.
 * In a real system, this would call out to a risk-scoring service.
 */
const baseRiskPolicy: IBusinessPolicy<RiskCheck> = PolicyBuilder.create<RiskCheck>()
  .withId('risk-check')
  .withDomain('payments')
  .withName('Transaction Risk Check')
  .mustSatisfy(tx => tx.amount <= 1000, 'RISK_LIMIT_EXCEEDED', 'Transaction exceeds risk threshold')
  .build();

/**
 * Wrap with retry: try up to 3 times on transient failures.
 * `withDefaults(policy, maxAttempts)` uses sensible defaults
 * (exponential backoff, retry on network-style errors).
 */
export function buildRetryingRiskPolicy(): IBusinessPolicy<RiskCheck> {
  return PolicyRetryBehavior.withDefaults(baseRiskPolicy, 3);
}
