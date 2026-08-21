/**
 * Example 11 — Temporal preset factory (VB-008 AC5).
 *
 * `PolicyTemporalBehaviorFactory` is the frozen-object preset surface for
 * `PolicyTemporalBehavior` (VB-008 AC2). `businessHours` wires the common
 * "different rule during vs. outside 9-to-5, Mon-Fri" shape without hand
 * assembling `PolicyTemporalBehaviorBuilder` calls yourself.
 *
 * Note: `PolicyTemporalBehaviorFactory` has exactly three preset methods —
 * `businessHours`, `weekendAware`, `holidayAware`. `from()` belongs to
 * `PolicyTemporalBehaviorBuilder`, not the factory (see example 08 for the
 * builder path when you need branches the presets don't cover, e.g. a
 * custom calendar or a `.when()` condition).
 *
 * Use case: same fraud scenario as example 08, but built from the preset
 * instead of the builder — stricter after-hours, relaxed during business
 * hours.
 */

import {
  PolicyBuilder,
  PolicyTemporalBehaviorFactory,
  type IBusinessPolicy,
} from '@vytches/ddd-policies';

export interface PaymentCheck {
  readonly amount: number;
  readonly riskScore: number;
}

const basePaymentPolicy: IBusinessPolicy<PaymentCheck> = PolicyBuilder.create<PaymentCheck>()
  .withId('payment-risk-check')
  .withDomain('fraud')
  .withName('Payment Risk Check')
  .mustSatisfy(p => p.amount <= 5000 || p.riskScore <= 70, 'RISK_TOO_HIGH', 'Risk too high')
  .build();

const relaxedDuringBusinessHours: IBusinessPolicy<PaymentCheck> =
  PolicyBuilder.create<PaymentCheck>()
    .withId('business-hours-relaxed')
    .withDomain('fraud')
    .withName('Business Hours (relaxed)')
    .mustSatisfy(
      p => p.amount <= 5000 || p.riskScore <= 70,
      'BH_RISK_HIGH',
      'Risk too high for business hours'
    )
    .build();

const strictAfterHours: IBusinessPolicy<PaymentCheck> = PolicyBuilder.create<PaymentCheck>()
  .withId('after-hours-strict')
  .withDomain('fraud')
  .withName('After Hours (strict)')
  .mustSatisfy(
    p => p.amount <= 1000 && p.riskScore <= 30,
    'AH_RISK_HIGH',
    'Risk too high for after-hours autoapproval'
  )
  .build();

/**
 * `businessHours(policy, duringBusinessHours, afterHours?)` uses a default
 * calendar (09:00-17:00, Mon-Fri). Pass an explicit `afterHours` branch —
 * omitting it falls back to `policy` itself for the after-hours case.
 */
export function buildPresetTemporalPaymentPolicy(): IBusinessPolicy<PaymentCheck> {
  return PolicyTemporalBehaviorFactory.businessHours(
    basePaymentPolicy,
    relaxedDuringBusinessHours,
    strictAfterHours
  );
}
