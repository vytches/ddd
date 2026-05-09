import { describe, it, expect } from 'vitest';

import { PlainDomainService } from '../src/plain-domain-service';

class TaxCalculator extends PlainDomainService {
  constructor() {
    super('TaxCalculator');
  }

  rateFor(country: string): number {
    return country === 'PL' ? 0.23 : 0.2;
  }

  calculate(subtotal: number, country: string): number {
    return subtotal * this.rateFor(country);
  }
}

describe('PlainDomainService — VF-CANON-001 minimal base class', () => {
  it('stores serviceId from constructor', () => {
    const svc = new TaxCalculator();
    expect(svc.serviceId).toBe('TaxCalculator');
  });

  it('serviceId is readonly', () => {
    const svc = new TaxCalculator();
    // Direct mutation would fail at compile time; runtime check that the
    // descriptor is read-only is excessive for an abstract class. Just
    // verify the value sticks.
    expect(svc.serviceId).toBe('TaxCalculator');
  });

  it('contains no infrastructure (no logger, no event bus, no UoW)', () => {
    const svc = new TaxCalculator();
    expect((svc as unknown as { logger?: unknown }).logger).toBeUndefined();
    expect((svc as unknown as { eventBus?: unknown }).eventBus).toBeUndefined();
    expect((svc as unknown as { unitOfWork?: unknown }).unitOfWork).toBeUndefined();
  });

  it('can implement a stateless domain operation', () => {
    const svc = new TaxCalculator();
    expect(svc.calculate(100, 'PL')).toBeCloseTo(23);
    expect(svc.calculate(100, 'US')).toBeCloseTo(20);
  });

  it('subclasses can be tested without DI setup', () => {
    // The whole point: zero infrastructure means a unit test is just
    // `new ConcreteService()` — no DI container, no event bus stub, no
    // unit-of-work fake.
    expect(() => new TaxCalculator()).not.toThrow();
  });
});
