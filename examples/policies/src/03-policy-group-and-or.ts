/**
 * Example 3 — Composing policies with AND/OR.
 *
 * For complex business rules where multiple policies must be evaluated as a
 * unit, chain `.and(other)` / `.or(other)` on existing `IBusinessPolicy`
 * instances. AND requires every policy to succeed; OR succeeds if any one
 * passes. Failed OR composers now aggregate ALL sub-violations into
 * `details.violations[]` (REL-009 fix) so the consumer sees every reason.
 *
 * Use case: shipping eligibility — order is shippable if the customer
 * has a verified address AND (premium tier OR over $50 minimum).
 */

import { PolicyBuilder, type IBusinessPolicy } from '@vytches/ddd-policies';

export interface ShipmentRequest {
  readonly hasVerifiedAddress: boolean;
  readonly customerTier: 'free' | 'premium';
  readonly orderTotal: number;
}

const verifiedAddressPolicy: IBusinessPolicy<ShipmentRequest> =
  PolicyBuilder.create<ShipmentRequest>()
    .withId('verified-address')
    .withDomain('shipping')
    .withName('Verified Address')
    .mustSatisfy(
      req => req.hasVerifiedAddress,
      'ADDRESS_UNVERIFIED',
      'Shipping requires a verified address'
    )
    .build();

const premiumTierPolicy: IBusinessPolicy<ShipmentRequest> = PolicyBuilder.create<ShipmentRequest>()
  .withId('premium-tier')
  .withDomain('shipping')
  .withName('Premium Tier')
  .mustSatisfy(
    req => req.customerTier === 'premium',
    'NOT_PREMIUM',
    'Customer is not on the premium tier'
  )
  .build();

const minimumOrderPolicy: IBusinessPolicy<ShipmentRequest> = PolicyBuilder.create<ShipmentRequest>()
  .withId('minimum-order-50')
  .withDomain('shipping')
  .withName('Minimum Order $50')
  .mustSatisfy(req => req.orderTotal >= 50, 'BELOW_MINIMUM', 'Order total must be at least $50')
  .build();

/**
 * Build the composite policy:
 *   verifiedAddress AND (premiumTier OR minimumOrder)
 *
 * `.and()` and `.or()` are chainable on any `BaseBusinessPolicy`. The
 * returned `IPolicyComposer<T>` extends `IBusinessPolicy<T>` so it can be
 * used anywhere a regular policy is expected, or composed further.
 */
export function buildShippingEligibilityPolicy(): IBusinessPolicy<ShipmentRequest> {
  const tierOrMinimum = premiumTierPolicy.or(minimumOrderPolicy);
  return verifiedAddressPolicy.and(tierOrMinimum);
}
