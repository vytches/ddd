/**
 * Example 4 — Conditional policy.
 *
 * "Apply this rule only when..." — chain `.when(condition)` after the
 * builder header to short-circuit evaluation. If the condition returns
 * `false`, the policy succeeds without checking the inner specification.
 *
 * Use case: tax exemption — apply VAT rule only for EU customers; non-EU
 * orders skip the check entirely.
 */

import { PolicyBuilder, type IBusinessPolicy } from '@vytches/ddd-policies';
import { CompositeSpecification } from '@vytches/ddd-validation';

export interface OrderForTax {
  readonly customerCountry: string;
  readonly hasVatId: boolean;
}

const EU_COUNTRIES = new Set([
  'AT',
  'BE',
  'BG',
  'CY',
  'CZ',
  'DE',
  'DK',
  'EE',
  'ES',
  'FI',
  'FR',
  'GR',
  'HR',
  'HU',
  'IE',
  'IT',
  'LT',
  'LU',
  'LV',
  'MT',
  'NL',
  'PL',
  'PT',
  'RO',
  'SE',
  'SI',
  'SK',
]);

class HasVatIdSpec extends CompositeSpecification<OrderForTax> {
  isSatisfiedBy(order: OrderForTax): boolean {
    return order.hasVatId;
  }
}

/**
 * Conditional policy: EU customers must provide a VAT ID; non-EU
 * customers are unaffected (the inner rule is bypassed by `.when()`).
 *
 * Pattern: `.when(cond).thenMust(spec).withCode/Message/Severity()` opens
 * a conditional clause. To finalize you MUST close with one of the
 * `otherwise*` calls — `.otherwisePass()` here means "non-EU passes
 * automatically". The `.build()` then lives on the `else` builder.
 */
export function buildVatRequiredForEuPolicy(): IBusinessPolicy<OrderForTax> {
  return PolicyBuilder.create<OrderForTax>()
    .withId('vat-required-eu')
    .withDomain('tax')
    .withName('VAT ID Required for EU')
    .when(order => EU_COUNTRIES.has(order.customerCountry))
    .thenMust(new HasVatIdSpec())
    .withCode('MISSING_VAT_ID')
    .withMessage('EU customers must provide a VAT ID')
    .withSeverity('ERROR')
    .otherwisePass()
    .build();
}
