/**
 * Example 2 — Reusable specification.
 *
 * When the SAME rule applies in multiple policies (e.g. "minimum age" appears
 * in registration, ride-sharing, alcohol purchase), extract it as a class
 * extending `CompositeSpecification<T>` from `@vytches/ddd-validation`.
 * Specifications compose with `.and()`, `.or()`, `.not()` and can be tested
 * in isolation.
 *
 * Use case: shared age-gating logic.
 */

import { PolicyBuilder, type IBusinessPolicy } from '@vytches/ddd-policies';
import { CompositeSpecification } from '@vytches/ddd-validation';

export interface AgeBearer {
  readonly age: number;
}

/**
 * Reusable specification — encapsulates the rule "person is at least N years
 * old". Extending `CompositeSpecification` provides `.and()`, `.or()`,
 * `.not()` for free.
 */
export class MinimumAgeSpecification<T extends AgeBearer> extends CompositeSpecification<T> {
  constructor(private readonly minimumAge: number) {
    super();
  }

  isSatisfiedBy(entity: T): boolean {
    return entity.age >= this.minimumAge;
  }
}

export interface AlcoholPurchase {
  readonly age: number;
  readonly itemSku: string;
}

/**
 * Policy using the reusable specification.
 *
 * `must(spec)` accepts an `ISpecification<T>` directly. For class-based rules
 * this is preferred over `mustSatisfy` because the spec is testable
 * standalone and composable with other specs.
 */
export function buildAlcoholPurchasePolicy(): IBusinessPolicy<AlcoholPurchase> {
  return PolicyBuilder.create<AlcoholPurchase>()
    .withId('alcohol-purchase-21')
    .withDomain('commerce')
    .withName('Alcohol Purchase (21+)')
    .must(new MinimumAgeSpecification<AlcoholPurchase>(21))
    .withCode('UNDERAGE_ALCOHOL')
    .withMessage('Must be at least 21 to purchase alcohol')
    .withSeverity('ERROR')
    .build();
}
