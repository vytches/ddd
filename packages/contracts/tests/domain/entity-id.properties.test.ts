import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

import { EntityId } from '../../src/domain/entity-id.implementation';
import type { IdType } from '../../src/domain/entity-id.interfaces';
import { safeRun } from '../_helpers/safe-run';

const idTypeArb: fc.Arbitrary<IdType> = fc.constantFrom('text', 'uuid', 'integer', 'bigint');

const idValueArb = fc.string({ minLength: 1, maxLength: 64 });

const idArb = fc.tuple(idValueArb, idTypeArb).map(([value, type]) => new EntityId(value, type));

describe('EntityId — algebraic invariants (PBT, fast-check)', () => {
  describe('equals() reflexivity', () => {
    it('every EntityId equals itself', () => {
      fc.assert(
        fc.property(idArb, id => {
          expect(id.equals(id)).toBe(true);
        })
      );
    });
  });

  describe('equals() symmetry', () => {
    it('a.equals(b) iff b.equals(a) — for ANY two ids', () => {
      fc.assert(
        fc.property(idArb, idArb, (a, b) => {
          expect(a.equals(b)).toBe(b.equals(a));
        })
      );
    });
  });

  describe('equals() transitivity', () => {
    it('a == b && b == c implies a == c — for same value+type triples', () => {
      fc.assert(
        fc.property(idValueArb, idTypeArb, (value, type) => {
          const a = new EntityId(value, type);
          const b = new EntityId(value, type);
          const c = new EntityId(value, type);
          if (a.equals(b) && b.equals(c)) {
            expect(a.equals(c)).toBe(true);
          }
        })
      );
    });
  });

  describe('type discrimination', () => {
    it('two ids with same value but different types are NEVER equal', () => {
      fc.assert(
        fc.property(idValueArb, idTypeArb, idTypeArb, (value, t1, t2) => {
          fc.pre(t1 !== t2);
          const a = new EntityId(value, t1);
          const b = new EntityId(value, t2);
          expect(a.equals(b)).toBe(false);
        })
      );
    });

    it('isType(t) iff getType() === t', () => {
      fc.assert(
        fc.property(idArb, idTypeArb, (id, queryType) => {
          expect(id.isType(queryType)).toBe(id.getType() === queryType);
        })
      );
    });
  });

  describe('serialization round-trip', () => {
    it('toString() returns String(value) for any id', () => {
      fc.assert(
        fc.property(idArb, id => {
          expect(id.toString()).toBe(String(id.getValue()));
        })
      );
    });

    it('toJSON() is parseable JSON containing original value+type', () => {
      fc.assert(
        fc.property(idArb, id => {
          const parsed = JSON.parse(id.toJSON()) as { value: string; type: string };
          expect(parsed.value).toBe(id.getValue());
          expect(parsed.type).toBe(id.getType());
        })
      );
    });
  });

  describe('factory invariants', () => {
    it('EntityId.create() always returns a uuid-typed id', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 100 }), n => {
          for (let i = 0; i < n; i++) {
            const id = EntityId.create();
            expect(id.getType()).toBe('uuid');
            expect(typeof id.getValue()).toBe('string');
            expect(id.getValue().length).toBeGreaterThan(0);
          }
        })
      );
    });

    it('EntityId.create() returns ids that pairwise NEVER equal (random uuid)', () => {
      fc.assert(
        fc.property(fc.integer({ min: 2, max: 20 }), n => {
          const ids = Array.from({ length: n }, () => EntityId.create());
          for (let i = 0; i < ids.length; i++) {
            for (let j = i + 1; j < ids.length; j++) {
              expect(ids[i]!.equals(ids[j]!)).toBe(false);
            }
          }
        })
      );
    });

    it('fromText accepts safe-char input and rejects unsafe', () => {
      const safe = fc.stringMatching(/^[a-zA-Z0-9_-]+$/);
      const unsafe = fc.string({ minLength: 1 }).filter(s => !/^[a-zA-Z0-9_-]+$/.test(s));

      fc.assert(
        fc.property(safe, s => {
          fc.pre(s.length > 0);
          const id = EntityId.fromText(s);
          expect(id.getValue()).toBe(s);
          expect(id.getType()).toBe('text');
        })
      );

      fc.assert(
        fc.property(unsafe, s => {
          const [error] = safeRun(() => EntityId.fromText(s));
          expect(error).toBeDefined();
        })
      );
    });

    it('fromInteger rejects negative or non-integer values', () => {
      fc.assert(
        fc.property(fc.integer({ max: -1 }), n => {
          const [error] = safeRun(() => EntityId.fromInteger(n));
          expect(error).toBeDefined();
        })
      );
      fc.assert(
        fc.property(
          fc.float({ noNaN: true }).filter(f => !Number.isInteger(f) && f >= 0),
          f => {
            const [error] = safeRun(() => EntityId.fromInteger(f));
            expect(error).toBeDefined();
          }
        )
      );
      fc.assert(
        fc.property(fc.nat(), n => {
          const id = EntityId.fromInteger(n);
          expect(id.getValue()).toBe(n.toString());
          expect(id.getType()).toBe('integer');
        })
      );
    });
  });
});
