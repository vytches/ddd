import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

import { BaseValueObject } from '../src/base-value-object';

class StringVO extends BaseValueObject<string> {
  validate(_value: unknown): boolean {
    return true;
  }
}

class NumberVO extends BaseValueObject<number> {
  validate(_value: unknown): boolean {
    return true;
  }
}

class ObjectVO extends BaseValueObject<Record<string, unknown>> {
  validate(_value: unknown): boolean {
    return true;
  }
}

describe('BaseValueObject — algebraic invariants (PBT, fast-check)', () => {
  describe('reflexivity (a == a)', () => {
    it('every string VO equals itself', () => {
      fc.assert(
        fc.property(fc.string(), s => {
          const vo = new StringVO(s);
          expect(vo.equals(vo)).toBe(true);
        })
      );
    });

    it('every number VO equals itself (NaN excluded — JS quirk)', () => {
      fc.assert(
        fc.property(fc.float({ noNaN: true }), n => {
          const vo = new NumberVO(n);
          expect(vo.equals(vo)).toBe(true);
        })
      );
    });

    it('every object VO equals itself', () => {
      fc.assert(
        fc.property(fc.dictionary(fc.string(), fc.jsonValue()), obj => {
          const vo = new ObjectVO(obj);
          expect(vo.equals(vo)).toBe(true);
        })
      );
    });
  });

  describe('symmetry (a == b iff b == a)', () => {
    it('two string VOs — equality is symmetric', () => {
      fc.assert(
        fc.property(fc.string(), fc.string(), (s1, s2) => {
          const a = new StringVO(s1);
          const b = new StringVO(s2);
          expect(a.equals(b)).toBe(b.equals(a));
        })
      );
    });

    it('two object VOs — equality is symmetric', () => {
      fc.assert(
        fc.property(
          fc.dictionary(fc.string(), fc.jsonValue()),
          fc.dictionary(fc.string(), fc.jsonValue()),
          (o1, o2) => {
            const a = new ObjectVO(o1);
            const b = new ObjectVO(o2);
            expect(a.equals(b)).toBe(b.equals(a));
          }
        )
      );
    });
  });

  describe('value-driven equality', () => {
    it('two VOs constructed with the same primitive value are equal', () => {
      fc.assert(
        fc.property(fc.string(), s => {
          expect(new StringVO(s).equals(new StringVO(s))).toBe(true);
        })
      );
      fc.assert(
        fc.property(fc.float({ noNaN: true }), n => {
          expect(new NumberVO(n).equals(new NumberVO(n))).toBe(true);
        })
      );
    });

    it('two VOs constructed with same object shape are equal (deep)', () => {
      fc.assert(
        fc.property(fc.dictionary(fc.string(), fc.jsonValue()), obj => {
          const copy = JSON.parse(JSON.stringify(obj)) as Record<string, unknown>;
          expect(new ObjectVO(obj).equals(new ObjectVO(copy))).toBe(true);
        })
      );
    });

    it('two VOs with different primitive values are NOT equal', () => {
      fc.assert(
        fc.property(fc.string(), fc.string(), (s1, s2) => {
          fc.pre(s1 !== s2);
          expect(new StringVO(s1).equals(new StringVO(s2))).toBe(false);
        })
      );
    });
  });

  describe('null/undefined safety', () => {
    it('equals(null) and equals(undefined) always return false', () => {
      fc.assert(
        fc.property(fc.string(), s => {
          const vo = new StringVO(s);
          expect(vo.equals(null as unknown as BaseValueObject<string>)).toBe(false);
          expect(vo.equals(undefined as unknown as BaseValueObject<string>)).toBe(false);
        })
      );
    });
  });

  describe('immutability', () => {
    it('object values are deep-frozen on construction', () => {
      fc.assert(
        fc.property(fc.dictionary(fc.string(), fc.jsonValue()), obj => {
          const vo = new ObjectVO(obj);
          expect(Object.isFrozen(vo.getValue())).toBe(true);
        })
      );
    });

    it('getValue() returns the same reference on repeated calls', () => {
      fc.assert(
        fc.property(fc.string(), s => {
          const vo = new StringVO(s);
          expect(vo.getValue()).toBe(vo.getValue());
        })
      );
    });
  });

  describe('serialization', () => {
    it('toString() returns String(value) for primitives', () => {
      fc.assert(
        fc.property(fc.string(), s => {
          expect(new StringVO(s).toString()).toBe(s);
        })
      );
      fc.assert(
        fc.property(fc.float({ noNaN: true }), n => {
          expect(new NumberVO(n).toString()).toBe(String(n));
        })
      );
    });

    it('toJSON() returns the raw value (no double-encoding)', () => {
      fc.assert(
        fc.property(fc.string(), s => {
          expect(new StringVO(s).toJSON()).toBe(s);
        })
      );
      fc.assert(
        fc.property(fc.dictionary(fc.string(), fc.jsonValue()), obj => {
          const vo = new ObjectVO(obj);
          const stringified = JSON.stringify(vo);
          const reparsed = JSON.parse(stringified) as Record<string, unknown>;
          expect(reparsed).toEqual(obj);
        })
      );
    });
  });
});
