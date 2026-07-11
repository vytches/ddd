import { describe, it, expect } from 'vitest';
import { safeRun } from '@vytches/ddd-utils';

import { BaseValueObject } from '../src/base-value-object';

/**
 * VF-023 (D-6, AC8 proxy): consumer-simulation test suite.
 *
 * juz-ide-api (the largest known consumer, 237+ aggregates) cannot be
 * exercised directly from this repo. These tests are a proxy — they
 * reconstruct the realistic patterns a large consumer's value-object
 * subclasses are likely to hit under the VF-023 invariants (throw-during-
 * construction validation, deep freeze), so regressions are caught here
 * before a consumer upgrade surfaces them. Kept small and representative,
 * not exhaustive — see CHANGELOG.md's "Consumer Impact Checklist" for the
 * grep-based self-audit consumers should run instead of per-VO test
 * duplication.
 */
describe('Consumer simulation — value-objects (VF-023 D-6)', () => {
  describe('a VO whose validate() used to silently pass invalid data now throws at construction', () => {
    // Simulates a real-world consumer VO where the pre-VF-023 pattern was:
    // constructor calls super(value), and only the SUBCLASS constructor body
    // (running after super()) checked validity and threw. If that subclass
    // validate() override was ever loose/buggy (e.g. missing a length check
    // the author intended to add "later"), the object used to construct
    // successfully in an invalid state. Now `validate()` gates construction
    // itself, so any previously-silent gap becomes a hard throw.
    class Email extends BaseValueObject<string> {
      validate(value: string): boolean {
        return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      }
      protected override getInvalidValueMessage(value: string): string {
        return `Invalid email address: "${value}"`;
      }
    }

    it('constructs successfully for valid input', () => {
      const email = new Email('user@example.com');
      expect(email.getValue()).toBe('user@example.com');
    });

    it('throws synchronously — a consumer relying on catching this AFTER construction (e.g. a deferred .validate() call) will now never reach that code', () => {
      const [error] = safeRun(() => new Email('not-an-email'));
      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toMatch(/Invalid email address/);
    });
  });

  describe('post-construction mutation of a VO nested value now throws (deep freeze)', () => {
    interface Address {
      street: string;
      geo: { lat: number; lng: number };
      tags: string[];
    }

    class AddressValueObject extends BaseValueObject<Address> {
      validate(value: Address): boolean {
        return typeof value?.street === 'string' && value.street.length > 0;
      }
    }

    it('a consumer helper that mutates the nested geo object returned by getValue() now throws instead of silently corrupting shared state', () => {
      const address = new AddressValueObject({
        street: 'Main St',
        geo: { lat: 1, lng: 2 },
        tags: ['home'],
      });

      // Common pre-VF-023 consumer bug: "just tweak the returned object",
      // relying on getValue() returning a live, mutable reference.
      const [error] = safeRun(() => {
        (address.getValue().geo as { lat: number }).lat = 999;
      });
      expect(error).toBeInstanceOf(TypeError);
      expect(address.getValue().geo.lat).toBe(1);

      // Same for an array nested inside the value.
      const [arrError] = safeRun(() => {
        (address.getValue().tags as string[]).push('office');
      });
      expect(arrError).toBeInstanceOf(TypeError);
      expect(address.getValue().tags).toEqual(['home']);
    });
  });

  describe('equals() using deepEqual instead of JSON.stringify semantics', () => {
    interface Money {
      amount: number;
      currency: string;
      metadata?: { note?: string };
    }
    class MoneyValueObject extends BaseValueObject<Money> {
      validate(value: Money): boolean {
        return typeof value?.amount === 'number' && typeof value?.currency === 'string';
      }
    }

    it('two VOs whose nested value contains NaN compare equal to each other but NOT to null — the old JSON.stringify-based equals() stringified NaN to "null" and would have wrongly treated {note: NaN} and {note: null} as equal', () => {
      const a = new MoneyValueObject({
        amount: 10,
        currency: 'USD',
        metadata: { note: NaN } as unknown as { note?: string },
      });
      const b = new MoneyValueObject({
        amount: 10,
        currency: 'USD',
        metadata: { note: NaN } as unknown as { note?: string },
      });
      const c = new MoneyValueObject({
        amount: 10,
        currency: 'USD',
        metadata: { note: null } as unknown as { note?: string },
      });

      expect(a.equals(b)).toBe(true);
      expect(a.equals(c)).toBe(false);
    });

    it('two VOs with different nested metadata are correctly NOT equal', () => {
      const a = new MoneyValueObject({ amount: 10, currency: 'USD', metadata: { note: 'x' } });
      const b = new MoneyValueObject({ amount: 10, currency: 'USD', metadata: { note: 'y' } });
      expect(a.equals(b)).toBe(false);
    });
  });
});
