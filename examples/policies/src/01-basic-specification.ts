/**
 * Example 1 — Basic specification policy.
 *
 * The simplest policy: a single boolean rule wrapped via `PolicyBuilder.create()`.
 * Use this when you have ONE business rule that returns success/failure for
 * a request entity.
 *
 * Use case: minimum-age check during user registration.
 */

import { PolicyBuilder, type IBusinessPolicy } from '@vytches/ddd-policies';

export interface UserRegistration {
  readonly age: number;
  readonly country: string;
}

/**
 * Policy: user must be at least 18 years old.
 *
 * `mustSatisfy(predicate, code, message)` is the inline form — register a
 * custom predicate plus violation code + message in one chained call.
 * For reusable rules, prefer `must(new AgeSpecification(18))` (Example 2).
 */
export function buildMinimumAgePolicy(): IBusinessPolicy<UserRegistration> {
  return PolicyBuilder.create<UserRegistration>()
    .withId('minimum-age-18')
    .withDomain('user-registration')
    .withName('Minimum Age (18)')
    .mustSatisfy(user => user.age >= 18, 'UNDER_18', 'User must be at least 18 years old')
    .withSeverity('ERROR')
    .build();
}
