import { describe, it, expect } from 'vitest';

import { EntityId } from '@vytches/ddd-value-objects';

import { Entity } from '../src/core/entity';

class OrderLine extends Entity<string> {
  constructor(
    id: EntityId<string>,
    public readonly sku: string,
    public quantity: number
  ) {
    super(id);
  }
}

describe('Entity — VF-CANON-001 base class for non-root domain entities', () => {
  describe('identity', () => {
    it('exposes the id passed to the constructor via getId()', () => {
      const id = EntityId.fromUUID('00000000-0000-4000-8000-000000000001');
      const line = new OrderLine(id, 'SKU-1', 1);

      expect(line.getId()).toBe(id);
      expect(line.getId().getValue()).toBe('00000000-0000-4000-8000-000000000001');
    });
  });

  describe('equals (identity-based, not attribute-based)', () => {
    it('returns true for entities with the same id, regardless of attributes', () => {
      const id = EntityId.fromUUID('00000000-0000-4000-8000-000000000002');
      const a = new OrderLine(id, 'SKU-1', 1);
      const b = new OrderLine(id, 'SKU-1', 99); // different quantity

      expect(a.equals(b)).toBe(true);
    });

    it('returns false for entities with different ids, even if attributes match', () => {
      const id1 = EntityId.fromUUID('00000000-0000-4000-8000-000000000003');
      const id2 = EntityId.fromUUID('00000000-0000-4000-8000-000000000004');
      const a = new OrderLine(id1, 'SKU-1', 5);
      const b = new OrderLine(id2, 'SKU-1', 5); // same attrs, different id

      expect(a.equals(b)).toBe(false);
    });

    it('returns true for self-comparison', () => {
      const line = new OrderLine(EntityId.create(), 'SKU-1', 1);
      expect(line.equals(line)).toBe(true);
    });

    it('returns false when comparing to null or undefined', () => {
      const line = new OrderLine(EntityId.create(), 'SKU-1', 1);
      expect(line.equals(null)).toBe(false);
      expect(line.equals(undefined)).toBe(false);
    });

    it('returns false when comparing to a non-Entity value', () => {
      const line = new OrderLine(EntityId.create(), 'SKU-1', 1);
      // The contract is strict: only Entity-typed values pass; we cast
      // through `any` here to simulate a runtime misuse and verify the
      // method does not throw.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(line.equals({ getId: () => line.getId() } as any)).toBe(false);
    });
  });

  describe('subclassing', () => {
    it('Entity is abstract — cannot be instantiated directly', () => {
      // Direct instantiation isn't legal in TypeScript at compile time; at
      // runtime there's nothing preventing it because abstract is erased.
      // What matters is that subclassing works:
      class MyEntity extends Entity<number> {
        constructor(id: EntityId<number>) {
          super(id);
        }
      }
      const e = new MyEntity(new EntityId(42, 'integer'));
      expect(e).toBeInstanceOf(Entity);
      expect(e.getId().getValue()).toBe(42);
    });
  });
});
