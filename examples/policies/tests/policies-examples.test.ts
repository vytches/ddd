import { describe, it, expect } from 'vitest';
import { PolicyContextBuilder, PolicyRequestBuilder, PolicyEventBus } from '@vytches/ddd-policies';

import { buildMinimumAgePolicy } from '../src/01-basic-specification';
import {
  buildAlcoholPurchasePolicy,
  MinimumAgeSpecification,
} from '../src/02-reusable-specification';
import { buildShippingEligibilityPolicy } from '../src/03-policy-group-and-or';
import { buildVatRequiredForEuPolicy } from '../src/04-conditional-policy';
import { buildAuditedCreditPolicy, captureEventsTo } from '../src/05-event-driven-policy';
import { buildRetryingRiskPolicy } from '../src/06-retry-policy';
import { buildCachedFlagPolicy } from '../src/07-cached-policy';
import { buildTemporalFraudPolicy } from '../src/08-temporal-policy';

const ctx = PolicyContextBuilder.forUser('test-user').build();
const reqOf = <T>(entity: T) => PolicyRequestBuilder.forEntityAndContext(entity, ctx).build();

describe('Example 1 — Basic specification', () => {
  const policy = buildMinimumAgePolicy();

  it('passes when age >= 18', async () => {
    const r = await policy.check(reqOf({ age: 25, country: 'PL' }));
    expect(r.isSuccess).toBe(true);
  });

  it('fails with code UNDER_18 when age < 18', async () => {
    const r = await policy.check(reqOf({ age: 16, country: 'PL' }));
    expect(r.isFailure).toBe(true);
    if (r.isFailure) expect(r.error.code).toBe('UNDER_18');
  });
});

describe('Example 2 — Reusable specification', () => {
  it('MinimumAgeSpecification is testable in isolation', () => {
    const spec = new MinimumAgeSpecification<{ age: number }>(21);
    expect(spec.isSatisfiedBy({ age: 20 })).toBe(false);
    expect(spec.isSatisfiedBy({ age: 21 })).toBe(true);
    expect(spec.isSatisfiedBy({ age: 35 })).toBe(true);
  });

  it('MinimumAgeSpecification composes with .and(), .or(), .not()', () => {
    const adult = new MinimumAgeSpecification<{ age: number }>(18);
    const senior = new MinimumAgeSpecification<{ age: number }>(65);
    const adultButNotSenior = adult.and(senior.not());
    expect(adultButNotSenior.isSatisfiedBy({ age: 30 })).toBe(true);
    expect(adultButNotSenior.isSatisfiedBy({ age: 70 })).toBe(false);
    expect(adultButNotSenior.isSatisfiedBy({ age: 16 })).toBe(false);
  });

  it('alcohol policy fails for under-21', async () => {
    const policy = buildAlcoholPurchasePolicy();
    const r = await policy.check(reqOf({ age: 18, itemSku: 'BEER-001' }));
    expect(r.isFailure).toBe(true);
  });
});

describe('Example 3 — AND/OR composition', () => {
  const policy = buildShippingEligibilityPolicy();

  it('verified address + premium tier → ship', async () => {
    const r = await policy.check(
      reqOf({ hasVerifiedAddress: true, customerTier: 'premium', orderTotal: 10 })
    );
    expect(r.isSuccess).toBe(true);
  });

  it('verified address + free tier with $50+ → ship', async () => {
    const r = await policy.check(
      reqOf({ hasVerifiedAddress: true, customerTier: 'free', orderTotal: 60 })
    );
    expect(r.isSuccess).toBe(true);
  });

  it('unverified address → no ship even with premium tier', async () => {
    const r = await policy.check(
      reqOf({ hasVerifiedAddress: false, customerTier: 'premium', orderTotal: 100 })
    );
    expect(r.isFailure).toBe(true);
  });

  it('verified address + free tier + $20 → no ship (both OR branches fail)', async () => {
    const r = await policy.check(
      reqOf({ hasVerifiedAddress: true, customerTier: 'free', orderTotal: 20 })
    );
    expect(r.isFailure).toBe(true);
  });
});

describe('Example 4 — Conditional policy', () => {
  const policy = buildVatRequiredForEuPolicy();

  it('non-EU customer without VAT ID → success (rule bypassed)', async () => {
    const r = await policy.check(reqOf({ customerCountry: 'US', hasVatId: false }));
    expect(r.isSuccess).toBe(true);
  });

  it('EU customer without VAT ID → failure', async () => {
    const r = await policy.check(reqOf({ customerCountry: 'PL', hasVatId: false }));
    expect(r.isFailure).toBe(true);
  });

  it('EU customer with VAT ID → success', async () => {
    const r = await policy.check(reqOf({ customerCountry: 'PL', hasVatId: true }));
    expect(r.isSuccess).toBe(true);
  });
});

describe('Example 5 — Event-driven policy', () => {
  it('emits started + completed events on check', async () => {
    const bus = new PolicyEventBus();
    const events: any[] = [];
    captureEventsTo(bus, events);
    const policy = buildAuditedCreditPolicy(bus);

    await policy.check(reqOf({ amount: 5000, creditScore: 700 }));

    // At minimum we should observe a completion event for the wrapped check.
    // The exact set of emitted events depends on EventDrivenPolicy config
    // (`emitCompletionEvents`); here we just verify the bus is wired.
    expect(events.length).toBeGreaterThanOrEqual(1);
  });
});

describe('Example 6 — Retry policy', () => {
  it('decorated policy still produces a Result', async () => {
    const policy = buildRetryingRiskPolicy();
    const r = await policy.check(reqOf({ transactionId: 'tx-1', amount: 500 }));
    expect(r.isSuccess).toBe(true);
  });

  it('high-amount transaction fails after retries', async () => {
    const policy = buildRetryingRiskPolicy();
    const r = await policy.check(reqOf({ transactionId: 'tx-2', amount: 5000 }));
    expect(r.isFailure).toBe(true);
  });
});

describe('Example 7 — Cached policy', () => {
  it('repeated checks for same input return same outcome', async () => {
    const policy = buildCachedFlagPolicy();
    const r1 = await policy.check(reqOf({ userId: 'A_42', flagName: 'new-checkout' }));
    const r2 = await policy.check(reqOf({ userId: 'A_42', flagName: 'new-checkout' }));
    expect(r1.isSuccess).toBe(r2.isSuccess);
    expect(r1.isSuccess).toBe(true);
  });
});

describe('Example 8 — Temporal policy', () => {
  it('produces a usable policy with chained branches', async () => {
    const policy = buildTemporalFraudPolicy();
    // Just verify the policy is constructable + callable. Calendar-driven
    // selection requires non-trivial wall-clock setup; full coverage of
    // business-hours vs after-hours behavior lives in the policies package
    // tests (`packages/policies/tests/decorators/temporal-policy.test.ts`).
    expect(policy).toBeDefined();
    const r = await policy.check(reqOf({ amount: 100, riskScore: 10 }));
    expect(r.isSuccess).toBe(true);
  });
});
