/**
 * Example 10 — Retry preset factory (VB-008 AC5).
 *
 * `PolicyRetryBehaviorFactory` is the frozen-object preset surface for
 * `PolicyRetryBehavior` (VB-008 AC2). `forExternalServices` is the preset
 * tuned for calls to systems outside your control: more attempts, a longer
 * base delay, and a capped maximum delay so a slow dependency doesn't stall
 * the caller indefinitely.
 *
 * Use case: a shipping-rate lookup against a third-party carrier API that
 * occasionally times out under load.
 */

import {
  PolicyBuilder,
  PolicyRetryBehaviorFactory,
  type IBusinessPolicy,
} from '@vytches/ddd-policies';

export interface ShippingRateCheck {
  readonly orderId: string;
  readonly weightKg: number;
}

/**
 * Base policy: rejects shipments the (stubbed) carrier API can't rate.
 * In a real system this would call the carrier's rating endpoint.
 */
const baseShippingPolicy: IBusinessPolicy<ShippingRateCheck> =
  PolicyBuilder.create<ShippingRateCheck>()
    .withId('shipping-rate-check')
    .withDomain('fulfillment')
    .withName('Shipping Rate Check')
    .mustSatisfy(rateableStub, 'CARRIER_CANNOT_RATE', 'Carrier could not produce a rate')
    .build();

function rateableStub(order: ShippingRateCheck): boolean {
  // Pretend the carrier can't rate anything over 70kg (needs freight, not parcel).
  return order.weightKg <= 70;
}

/**
 * `forExternalServices` retries up to 5 times by default, with a 2s base
 * delay and exponential backoff capped at 60s — appropriate for a
 * third-party dependency you don't control the latency of.
 */
export function buildRetryingShippingPolicy(): IBusinessPolicy<ShippingRateCheck> {
  return PolicyRetryBehaviorFactory.forExternalServices(baseShippingPolicy, {
    maxAttempts: 5,
  });
}
