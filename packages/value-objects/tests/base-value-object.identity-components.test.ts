import { describe, it, expect } from 'vitest';
import { LibUtils } from '@vytches/ddd-utils';

import { BaseValueObject } from '../src/base-value-object';

/**
 * VF-036: behavioral test suite for the `getIdentityComponents()` opt-in
 * hook and its effect on `equals()`.
 *
 * Scope note: the pre-existing six equality assertions in
 * `base-value-object.test.ts` (including the cross-subclass assertion at
 * lines 355-373) are the "default path" pin — both sides return `undefined`
 * from `getIdentityComponents()`, so `equals()` must execute the exact,
 * unmodified pre-VF-036 raw comparison. This file intentionally does not
 * touch that file; it only adds new fixtures that exercise the new,
 * additive branch.
 */

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/**
 * Configurable component-identity VO: the component array (or `undefined`
 * to opt out) is supplied per-instance via a thunk, so a single class can
 * exercise every branch of the equals() dispatch without a proliferation of
 * near-identical subclasses.
 */
class ComponentVO extends BaseValueObject<string> {
  private readonly componentsThunk: () => readonly unknown[] | undefined;

  constructor(value: string, componentsThunk: () => readonly unknown[] | undefined) {
    super(value);
    this.componentsThunk = componentsThunk;
  }

  validate(value: unknown): boolean {
    return typeof value === 'string';
  }

  protected override getIdentityComponents(): readonly unknown[] | undefined {
    return this.componentsThunk();
  }
}

/** A VO that never overrides the hook — represents "legacy" raw comparison. */
class RawStringVO extends BaseValueObject<string> {
  validate(value: unknown): boolean {
    return typeof value === 'string';
  }
}

/** Overrides the hook but always throws — pins D5 propagation. */
class ThrowingComponentVO extends BaseValueObject<string> {
  validate(value: unknown): boolean {
    return typeof value === 'string';
  }

  protected override getIdentityComponents(): readonly unknown[] | undefined {
    throw new Error('boom: component accessor failed');
  }
}

/** Component-identity VO whose identity is a tag, independent of raw value. */
class NestedTagVO extends BaseValueObject<string> {
  private readonly tag: string;

  constructor(value: string, tag: string) {
    super(value);
    this.tag = tag;
  }

  validate(value: unknown): boolean {
    return typeof value === 'string';
  }

  protected override getIdentityComponents(): readonly unknown[] {
    return [this.tag];
  }
}

/** Wraps a `NestedTagVO` as one of its own identity components. */
class WrapperVO extends BaseValueObject<string> {
  private readonly nested: NestedTagVO;

  constructor(value: string, nested: NestedTagVO) {
    super(value);
    this.nested = nested;
  }

  validate(value: unknown): boolean {
    return typeof value === 'string';
  }

  protected override getIdentityComponents(): readonly unknown[] {
    return [this.nested];
  }
}

/** "Legacy" email: no override, compares by raw stored string only. */
class LegacyEmail extends BaseValueObject<string> {
  validate(value: unknown): boolean {
    return typeof value === 'string';
  }
}

/** "New" email: overrides the hook to compare by a normalized projection. */
class Email extends BaseValueObject<string> {
  private readonly normalized: string;

  constructor(raw: string, normalized: string) {
    super(raw);
    this.normalized = normalized;
  }

  validate(value: unknown): boolean {
    return typeof value === 'string';
  }

  protected override getIdentityComponents(): readonly unknown[] {
    return [this.normalized];
  }
}

/** Two unrelated subclasses, each hardcoding identical components (D6). */
class MoneyLikeA extends BaseValueObject<number> {
  validate(value: unknown): boolean {
    return typeof value === 'number';
  }

  protected override getIdentityComponents(): readonly unknown[] {
    return ['Money', 10, 'USD'];
  }
}

class MoneyLikeB extends BaseValueObject<number> {
  validate(value: unknown): boolean {
    return typeof value === 'number';
  }

  protected override getIdentityComponents(): readonly unknown[] {
    return ['Money', 10, 'USD'];
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BaseValueObject — getIdentityComponents() (VF-036)', () => {
  describe('Core dispatch matrix', () => {
    it('treats two VOs as equal when both sides return equal, same-length components', () => {
      const a = new ComponentVO('raw-a', () => ['x', 1, true]);
      const b = new ComponentVO('raw-b', () => ['x', 1, true]);

      expect(a.equals(b)).toBe(true);
    });

    it('treats two VOs as unequal when a single element differs', () => {
      const a = new ComponentVO('raw', () => ['x', 1, true]);
      const b = new ComponentVO('raw', () => ['x', 2, true]);

      expect(a.equals(b)).toBe(false);
    });

    it('treats two VOs as unequal on length mismatch, in both call directions', () => {
      const longer = new ComponentVO('raw', () => ['x', 'y', 'z']);
      const shorter = new ComponentVO('raw', () => ['x', 'y']);

      expect(longer.equals(shorter)).toBe(false);
      expect(shorter.equals(longer)).toBe(false);
    });

    it('treats empty-array components as equal regardless of the underlying raw value', () => {
      // D4: an empty array is "defined and empty", not "opt out" — it is
      // equal to every other VO whose getIdentityComponents() also returns
      // [], even though the raw values below are deliberately different.
      const a = new ComponentVO('raw-a', () => []);
      const b = new ComponentVO('raw-b', () => []);

      expect(a.equals(b)).toBe(true);
    });

    it('falls back to the raw comparison when the other side opts out, in both call directions', () => {
      const withComponents = new ComponentVO('shared-raw', () => ['tag']);
      const withoutComponents = new ComponentVO('shared-raw', () => undefined);

      // Same raw value on both sides -> raw fallback says "equal".
      expect(withComponents.equals(withoutComponents)).toBe(true);
      expect(withoutComponents.equals(withComponents)).toBe(true);

      const withComponents2 = new ComponentVO('raw-1', () => ['tag']);
      const withoutComponents2 = new ComponentVO('raw-2', () => undefined);

      // Different raw value on both sides -> raw fallback says "not equal",
      // even though `withComponents2` itself defines components — one side
      // opting out is enough to force the raw path (D2 asymmetric fallback).
      expect(withComponents2.equals(withoutComponents2)).toBe(false);
      expect(withoutComponents2.equals(withComponents2)).toBe(false);
    });

    it('supports an override that explicitly returns undefined (distinct from never overriding)', () => {
      const same1 = new ComponentVO('same', () => undefined);
      const same2 = new ComponentVO('same', () => undefined);
      const different = new ComponentVO('different', () => undefined);

      expect(same1.equals(same2)).toBe(true);
      expect(same1.equals(different)).toBe(false);
    });
  });

  describe('Nested semantics', () => {
    it('compares Date components by value, not by reference', () => {
      const a = new ComponentVO('a', () => [new Date('2024-01-01T00:00:00.000Z')]);
      const b = new ComponentVO('b', () => [new Date('2024-01-01T00:00:00.000Z')]);
      const c = new ComponentVO('c', () => [new Date('2024-06-01T00:00:00.000Z')]);

      expect(a.equals(b)).toBe(true);
      expect(a.equals(c)).toBe(false);
    });

    it('compares Map components by entries, not by reference', () => {
      const a = new ComponentVO('a', () => [new Map([['k', 1]])]);
      const b = new ComponentVO('b', () => [new Map([['k', 1]])]);
      const c = new ComponentVO('c', () => [new Map([['k', 2]])]);

      expect(a.equals(b)).toBe(true);
      expect(a.equals(c)).toBe(false);
    });

    it('compares Set components by membership, not order or reference', () => {
      const a = new ComponentVO('a', () => [new Set([1, 2, 3])]);
      const b = new ComponentVO('b', () => [new Set([3, 2, 1])]);
      const c = new ComponentVO('c', () => [new Set([1, 2])]);

      expect(a.equals(b)).toBe(true);
      expect(a.equals(c)).toBe(false);
    });

    it('treats NaN components as equal to NaN', () => {
      const a = new ComponentVO('a', () => [NaN]);
      const b = new ComponentVO('b', () => [NaN]);

      expect(a.equals(b)).toBe(true);
    });

    it('dispatches a value-object component to its own equals(), not a structural walk', () => {
      // Two NestedTagVO instances with DIFFERENT raw values but the SAME
      // identity tag. A structural walk (LibUtils.deepEqual over the raw
      // instances) would see different `value` fields and say "not equal".
      // componentEquals must instead detect the brand and delegate to
      // nested.equals(), which itself goes through getIdentityComponents()
      // and says "equal" because the tags match.
      const nestedA = new NestedTagVO('raw-a', 'same-tag');
      const nestedB = new NestedTagVO('raw-b', 'same-tag');

      // Sanity check: proves the raw values genuinely differ, so a
      // structural walk over the nested instances would NOT call them
      // equal — the passing assertion below is therefore attributable to
      // equals()-dispatch, not to coincidental structural equality.
      expect(LibUtils.deepEqual(nestedA, nestedB)).toBe(false);

      const wrapperA = new WrapperVO('w', nestedA);
      const wrapperB = new WrapperVO('w', nestedB);

      expect(wrapperA.equals(wrapperB)).toBe(true);
    });
  });

  describe('Robustness', () => {
    it('propagates a throwing override out of equals() instead of swallowing it', () => {
      const a = new ThrowingComponentVO('x');
      const b = new ThrowingComponentVO('y');

      expect(() => a.equals(b)).toThrow('boom: component accessor failed');
    });

    it(
      'KNOWN ACCEPTED LIMITATION (do not fix): the asymmetric undefined-fallback is ' +
        'symmetric but not transitive — Email/LegacyEmail triangle',
      () => {
        // This is documented and intentional (see getIdentityComponents()
        // doc comment, "The asymmetric fallback, and why it is not
        // transitive", and Q9 in the VF-036 analysis). Do NOT "fix" this by
        // adding type/instanceof gating to equals() — that is explicitly
        // rejected by D6.
        const legacy = new LegacyEmail('Alice@Example.com'); // no override -> raw comparison only
        const emailB = new Email('Alice@Example.com', 'alice@example.com'); // same raw as legacy
        const emailC = new Email('alice@example.com', 'alice@example.com'); // same components as emailB

        // legacy <-> emailB: legacy opts out -> raw fallback -> raw values match.
        expect(legacy.equals(emailB)).toBe(true);
        expect(emailB.equals(legacy)).toBe(true);

        // emailB <-> emailC: both opt in -> components match.
        expect(emailB.equals(emailC)).toBe(true);
        expect(emailC.equals(emailB)).toBe(true);

        // legacy <-> emailC: legacy opts out -> raw fallback -> raw values differ.
        // Equivalence would require this to be `true` (transitivity), but it
        // is `false` — the accepted, test-pinned break in transitivity.
        expect(legacy.equals(emailC)).toBe(false);
        expect(emailC.equals(legacy)).toBe(false);
      }
    );

    it('considers two different subclasses equal when their components match (no instanceof gating, D6)', () => {
      const a = new MoneyLikeA(10);
      const b = new MoneyLikeB(999999); // deliberately different raw value & subclass

      expect(a.equals(b)).toBe(true);
      expect(a instanceof MoneyLikeB).toBe(false);
      expect(b instanceof MoneyLikeA).toBe(false);
    });

    it('treats 0 and -0 as equal identity-component elements', () => {
      const a = new ComponentVO('a', () => [0]);
      const b = new ComponentVO('b', () => [-0]);

      expect(a.equals(b)).toBe(true);
    });
  });

  describe('Default path stays untouched (sanity re-check, see base-value-object.test.ts for the pinned suite)', () => {
    it('never overriding the hook keeps raw comparison in effect', () => {
      const a = new RawStringVO('same');
      const b = new RawStringVO('same');
      const c = new RawStringVO('different');

      expect(a.equals(b)).toBe(true);
      expect(a.equals(c)).toBe(false);
    });
  });
});
