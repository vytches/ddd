/**
 * Example 8 — Temporal policy (time-window aware).
 *
 * Different rules apply at different times of day. `PolicyTemporalBehaviorBuilder`
 * lets you define per-time-window policies that swap automatically based on
 * a `BusinessCalendar` definition. The behavior delegates to the appropriate
 * policy depending on whether the check happens during business hours or
 * after-hours.
 *
 * Use case: stricter fraud rules during after-hours when human review
 * isn't available; relaxed rules during business hours.
 */

import {
  PolicyBuilder,
  PolicyTemporalBehaviorBuilder,
  type BusinessCalendar,
  type IBusinessPolicy,
} from '@vytches/ddd-policies';

export interface PaymentCheck {
  readonly amount: number;
  readonly riskScore: number;
}

const businessHoursPolicy: IBusinessPolicy<PaymentCheck> = PolicyBuilder.create<PaymentCheck>()
  .withId('business-hours-relaxed')
  .withDomain('fraud')
  .withName('Business Hours (relaxed)')
  .mustSatisfy(
    p => p.amount <= 5000 || p.riskScore <= 70,
    'BH_RISK_HIGH',
    'Risk too high for business hours'
  )
  .build();

const afterHoursPolicy: IBusinessPolicy<PaymentCheck> = PolicyBuilder.create<PaymentCheck>()
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
 * Mon-Fri 9am-5pm = business hours.
 */
const standardCalendar: BusinessCalendar = {
  timezone: 'UTC',
  workingDays: [1, 2, 3, 4, 5], // Mon-Fri (Sun=0)
  workingHours: { start: 9, end: 17 },
  holidays: [],
};

/**
 * The temporal policy uses the strict/relaxed pair depending on time of
 * the request. `duringBusinessHours` and `duringAfterHours` register the
 * branches; the calendar drives selection.
 */
export function buildTemporalFraudPolicy(): IBusinessPolicy<PaymentCheck> {
  return PolicyTemporalBehaviorBuilder.from(businessHoursPolicy)
    .withBusinessCalendar(standardCalendar)
    .duringBusinessHours(businessHoursPolicy)
    .duringAfterHours(afterHoursPolicy)
    .build();
}
