import { it, expect, describe } from 'vitest';
import { EntityId } from '../src/id.value-object';
import {
  type BrandedId,
  createBrandedId,
  newBrandedId,
  brandedIdFromUUID,
  brandedIdFromText,
} from '../src/branded-id';
import { LibUtils } from '@vytches/ddd-utils';

type OrderId = BrandedId<'Order'>;
type CustomerId = BrandedId<'Customer'>;

describe('BrandedId', () => {
  describe('createBrandedId', () => {
    it('should brand an existing EntityId', () => {
      const entityId = EntityId.create();
      const orderId: OrderId = createBrandedId<'Order'>(entityId);

      expect(orderId.value).toBe(entityId.value);
      expect(orderId.getType()).toBe('uuid');
    });

    it('should be usable as EntityId (structural subtype)', () => {
      const orderId: OrderId = createBrandedId<'Order'>(EntityId.create());
      const entityId: EntityId<string> = orderId;

      expect(entityId.value).toBe(orderId.value);
    });
  });

  describe('newBrandedId', () => {
    it('should create a new branded UUID', () => {
      const orderId: OrderId = newBrandedId<'Order'>();

      expect(LibUtils.isValidUUID(orderId.value)).toBe(true);
      expect(orderId.getType()).toBe('uuid');
    });

    it('should create unique IDs on each call', () => {
      const id1: OrderId = newBrandedId<'Order'>();
      const id2: OrderId = newBrandedId<'Order'>();

      expect(id1.value).not.toBe(id2.value);
    });
  });

  describe('brandedIdFromUUID', () => {
    it('should create branded ID from valid UUID', () => {
      const uuid = LibUtils.getUUID();
      const orderId: OrderId = brandedIdFromUUID<'Order'>(uuid);

      expect(orderId.value).toBe(uuid);
      expect(orderId.getType()).toBe('uuid');
    });

    it('should throw on invalid UUID', () => {
      expect(() => brandedIdFromUUID<'Order'>('not-a-uuid')).toThrow();
    });
  });

  describe('brandedIdFromText', () => {
    it('should create branded ID from text', () => {
      const customerId: CustomerId = brandedIdFromText<'Customer'>('cust-123');

      expect(customerId.value).toBe('cust-123');
      expect(customerId.getType()).toBe('text');
    });

    it('should throw on empty text', () => {
      expect(() => brandedIdFromText<'Customer'>('')).toThrow();
    });
  });

  describe('type safety (runtime verification)', () => {
    it('different branded IDs have same runtime value structure', () => {
      const orderId: OrderId = newBrandedId<'Order'>();
      const customerId: CustomerId = newBrandedId<'Customer'>();

      // Both are EntityIds at runtime
      expect(orderId).toBeInstanceOf(EntityId);
      expect(customerId).toBeInstanceOf(EntityId);

      // Type safety is compile-time only — these are structurally identical at runtime
      // The following would be a compile error if types were checked:
      // const wrong: OrderId = customerId;  // TS Error: Type 'BrandedId<"Customer">' is not assignable to 'BrandedId<"Order">'
    });
  });
});
