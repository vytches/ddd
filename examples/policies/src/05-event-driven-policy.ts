/**
 * Example 5 — Event-driven policy.
 *
 * Wrap any `IBusinessPolicy<T>` with `EventDrivenPolicy` to emit start /
 * completion / error events to a `PolicyEventBus`. Useful for cross-cutting
 * observability (metrics, audit log, distributed tracing) without coupling
 * the policy itself to logging infrastructure.
 *
 * Use case: log every credit-limit decision to an audit trail without
 * touching the policy code.
 */

import {
  EventDrivenPolicy,
  PolicyBuilder,
  PolicyEventBus,
  type IBusinessPolicy,
  type PolicyEvaluationEvent,
} from '@vytches/ddd-policies';

export interface CreditApplication {
  readonly amount: number;
  readonly creditScore: number;
}

const baseCreditLimitPolicy: IBusinessPolicy<CreditApplication> =
  PolicyBuilder.create<CreditApplication>()
    .withId('credit-limit-check')
    .withDomain('lending')
    .withName('Credit Limit Check')
    .mustSatisfy(
      app => app.amount <= 10_000 && app.creditScore >= 600,
      'CREDIT_DECLINED',
      'Credit limit exceeded or insufficient credit score'
    )
    .build();

/**
 * Wrap the base policy so every check publishes events to the bus.
 * Subscribers receive: started, completed (success or failure), error.
 *
 * Returned policy has the same shape as the base — drop-in replacement.
 */
export function buildAuditedCreditPolicy(
  eventBus: PolicyEventBus
): IBusinessPolicy<CreditApplication> {
  return new EventDrivenPolicy(baseCreditLimitPolicy, {
    eventBus,
    emitCompletionEvents: true,
  });
}

/**
 * Helper for tests / consumers — capture events to inspect after a check.
 */
export function captureEventsTo(bus: PolicyEventBus, capture: PolicyEvaluationEvent[]): void {
  bus.subscribe({
    eventTypes: ['POLICY_EVALUATION_STARTED', 'POLICY_EVALUATED', 'POLICY_EVALUATION_ERROR'],
    handler: event => {
      capture.push(event as PolicyEvaluationEvent);
    },
  });
}
