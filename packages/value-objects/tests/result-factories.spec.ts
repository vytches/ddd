import { it, expect, describe } from 'vitest';
import { EntityId } from '../src/id.value-object';
import { LibUtils } from '@vytches/ddd-utils';

describe('EntityId Result-returning factories', () => {
  describe('tryFromUUID', () => {
    it('should return success for valid UUID', () => {
      const uuid = LibUtils.getUUID();
      const result = EntityId.tryFromUUID(uuid);

      expect(result.isSuccess).toBe(true);
      expect(result.value.value).toBe(uuid);
      expect(result.value.getType()).toBe('uuid');
    });

    it('should return failure for invalid UUID', () => {
      const result = EntityId.tryFromUUID('not-a-uuid');

      expect(result.isFailure).toBe(true);
      expect(result.error).toBeDefined();
    });

    it('should return failure for empty string', () => {
      const result = EntityId.tryFromUUID('');

      expect(result.isFailure).toBe(true);
    });
  });

  describe('tryFromInteger', () => {
    it('should return success for valid integer', () => {
      const result = EntityId.tryFromInteger(42);

      expect(result.isSuccess).toBe(true);
      expect(result.value.value).toBe('42');
    });

    it('should return failure for negative integer', () => {
      const result = EntityId.tryFromInteger(-1);

      expect(result.isFailure).toBe(true);
    });
  });

  describe('tryFromBigInt', () => {
    it('should return success for valid bigint string', () => {
      const result = EntityId.tryFromBigInt('123456789');

      expect(result.isSuccess).toBe(true);
      expect(result.value.value).toBe('123456789');
    });

    it('should return failure for invalid bigint', () => {
      const result = EntityId.tryFromBigInt('not-a-number');

      expect(result.isFailure).toBe(true);
    });
  });

  describe('tryFromText', () => {
    it('should return success for valid text', () => {
      const result = EntityId.tryFromText('order-123');

      expect(result.isSuccess).toBe(true);
      expect(result.value.value).toBe('order-123');
    });

    it('should return failure for empty text', () => {
      const result = EntityId.tryFromText('');

      expect(result.isFailure).toBe(true);
    });
  });

  describe('chaining with Result.map/flatMap', () => {
    it('should chain Result operations', () => {
      const result = EntityId.tryFromUUID(LibUtils.getUUID()).map(id => id.value);

      expect(result.isSuccess).toBe(true);
      expect(typeof result.value).toBe('string');
    });

    it('should propagate failure through chain', () => {
      const result = EntityId.tryFromUUID('invalid').map(id => id.value);

      expect(result.isFailure).toBe(true);
    });
  });
});
