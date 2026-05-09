import { describe, it, expect } from 'vitest';
import { EntityId } from '../../src/domain/entity-id.implementation';
import { safeRun } from '../_helpers/safe-run';

describe('EntityId', () => {
  describe('constructor', () => {
    it('should create an EntityId with uuid type', () => {
      const id = new EntityId('550e8400-e29b-41d4-a716-446655440000', 'uuid');
      expect(id.getValue()).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(id.getType()).toBe('uuid');
    });

    it('should create an EntityId with text type', () => {
      const id = new EntityId('my-text-id', 'text');
      expect(id.getValue()).toBe('my-text-id');
      expect(id.getType()).toBe('text');
    });

    it('should create an EntityId with integer type', () => {
      const id = new EntityId('123', 'integer');
      expect(id.getValue()).toBe('123');
      expect(id.getType()).toBe('integer');
    });

    it('should create an EntityId with bigint type', () => {
      const id = new EntityId('9007199254740993', 'bigint');
      expect(id.getValue()).toBe('9007199254740993');
      expect(id.getType()).toBe('bigint');
    });

    it('should default to text type', () => {
      const id = new EntityId('test-value');
      expect(id.getType()).toBe('text');
    });
  });

  describe('getValue', () => {
    it('should return the value', () => {
      const id = new EntityId('test-value', 'text');
      expect(id.getValue()).toBe('test-value');
    });

    it('should also be accessible via value property', () => {
      const id = new EntityId('test-value', 'text');
      expect(id.value).toBe('test-value');
    });
  });

  describe('getType', () => {
    it('should return the type', () => {
      const id = new EntityId('test', 'text');
      expect(id.getType()).toBe('text');
    });
  });

  describe('validate', () => {
    it('should return true for non-null value', () => {
      const id = new EntityId('any-value', 'text');
      expect(id.validate('any-value')).toBe(true);
    });

    it('should return false for null', () => {
      const id = new EntityId('any-value', 'text');
      expect(id.validate(null as unknown as string)).toBe(false);
    });

    it('should return false for undefined', () => {
      const id = new EntityId('any-value', 'text');
      expect(id.validate(undefined as unknown as string)).toBe(false);
    });
  });

  describe('equals', () => {
    it('should return true for same value and type', () => {
      const id1 = new EntityId('test', 'text');
      const id2 = new EntityId('test', 'text');
      expect(id1.equals(id2)).toBe(true);
    });

    it('should return false for different values', () => {
      const id1 = new EntityId('test1', 'text');
      const id2 = new EntityId('test2', 'text');
      expect(id1.equals(id2)).toBe(false);
    });

    it('should return false for different types', () => {
      const id1 = new EntityId('123', 'text');
      const id2 = new EntityId('123', 'integer');
      expect(id1.equals(id2)).toBe(false);
    });
  });

  describe('isType', () => {
    it('should return true for matching type', () => {
      const id = new EntityId('test', 'uuid');
      expect(id.isType('uuid')).toBe(true);
    });

    it('should return false for non-matching type', () => {
      const id = new EntityId('test', 'uuid');
      expect(id.isType('text')).toBe(false);
    });
  });

  describe('toString', () => {
    it('should return string value', () => {
      const id = new EntityId('my-id', 'text');
      expect(id.toString()).toBe('my-id');
    });

    it('should convert numeric value to string', () => {
      const id = new EntityId(123 as unknown as string, 'integer');
      expect(id.toString()).toBe('123');
    });
  });

  describe('toJSON', () => {
    it('should return JSON string representation', () => {
      const id = new EntityId('my-id', 'text');
      const json = id.toJSON();
      expect(json).toBe('{"value":"my-id","type":"text"}');
    });

    it('should be parseable back to object', () => {
      const id = new EntityId('my-id', 'text');
      const parsed = JSON.parse(id.toJSON());
      expect(parsed).toEqual({ value: 'my-id', type: 'text' });
    });
  });

  describe('static factory methods', () => {
    describe('createWithRandomUUID', () => {
      it('should create a UUID EntityId', () => {
        const id = EntityId.createWithRandomUUID();
        expect(id.getType()).toBe('uuid');
        expect(id.getValue()).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        );
      });

      it('should create unique UUIDs', () => {
        const id1 = EntityId.createWithRandomUUID();
        const id2 = EntityId.createWithRandomUUID();
        expect(id1.equals(id2)).toBe(false);
      });
    });

    describe('fromUUID', () => {
      it('should create EntityId from valid UUID', () => {
        const uuid = '550e8400-e29b-41d4-a716-446655440000';
        const id = EntityId.fromUUID(uuid);
        expect(id.getValue()).toBe(uuid);
        expect(id.getType()).toBe('uuid');
      });

      it('should throw for invalid UUID', () => {
        const [error] = safeRun(() => EntityId.fromUUID('not-a-uuid'));
        expect(error).toBeInstanceOf(Error);
        expect(error?.message).toContain('valid UUID');
      });

      it('should throw for empty string', () => {
        const [error] = safeRun(() => EntityId.fromUUID(''));
        expect(error).toBeInstanceOf(Error);
      });
    });

    describe('fromInteger', () => {
      it('should create EntityId from positive integer', () => {
        const id = EntityId.fromInteger(42);
        expect(id.getValue()).toBe('42');
        expect(id.getType()).toBe('integer');
      });

      it('should create EntityId from zero', () => {
        const id = EntityId.fromInteger(0);
        expect(id.getValue()).toBe('0');
        expect(id.getType()).toBe('integer');
      });

      it('should throw for negative integer', () => {
        const [error] = safeRun(() => EntityId.fromInteger(-1));
        expect(error).toBeInstanceOf(Error);
        expect(error?.message).toContain('non-negative integer');
      });

      it('should throw for float', () => {
        const [error] = safeRun(() => EntityId.fromInteger(1.5));
        expect(error).toBeInstanceOf(Error);
      });
    });

    describe('fromBigInt', () => {
      it('should create EntityId from bigint', () => {
        const id = EntityId.fromBigInt(BigInt('9007199254740993'));
        expect(id.getValue()).toBe('9007199254740993');
        expect(id.getType()).toBe('bigint');
      });

      it('should create EntityId from string bigint', () => {
        const id = EntityId.fromBigInt('9007199254740993');
        expect(id.getValue()).toBe('9007199254740993');
        expect(id.getType()).toBe('bigint');
      });
    });

    describe('fromText', () => {
      it('should create EntityId from valid text', () => {
        const id = EntityId.fromText('my-custom-id');
        expect(id.getValue()).toBe('my-custom-id');
        expect(id.getType()).toBe('text');
      });

      it('should throw for empty string', () => {
        const [error] = safeRun(() => EntityId.fromText(''));
        expect(error).toBeInstanceOf(Error);
      });

      it('should throw for text with special characters', () => {
        const [error] = safeRun(() => EntityId.fromText('id with spaces'));
        expect(error).toBeInstanceOf(Error);
        expect(error?.message).toContain('invalid characters');
      });
    });

    describe('createText', () => {
      it('should create EntityId with text type', () => {
        const id = EntityId.createText('custom-text');
        expect(id.getValue()).toBe('custom-text');
        expect(id.getType()).toBe('text');
      });
    });

    describe('createUuid', () => {
      it('should create EntityId with provided UUID', () => {
        const uuid = '123e4567-e89b-12d3-a456-426614174000';
        const id = EntityId.createUuid(uuid);
        expect(id.getValue()).toBe(uuid);
        expect(id.getType()).toBe('uuid');
      });
    });

    describe('createInteger', () => {
      it('should create EntityId with integer type', () => {
        const id = EntityId.createInteger(100);
        expect(id.getValue()).toBe('100');
        expect(id.getType()).toBe('integer');
      });
    });

    describe('createBigInt', () => {
      it('should create EntityId with bigint type from bigint', () => {
        const id = EntityId.createBigInt(BigInt('12345678901234567890'));
        expect(id.getValue()).toBe('12345678901234567890');
        expect(id.getType()).toBe('bigint');
      });

      it('should create EntityId with bigint type from string', () => {
        const id = EntityId.createBigInt('12345678901234567890');
        expect(id.getValue()).toBe('12345678901234567890');
        expect(id.getType()).toBe('bigint');
      });
    });
  });
});
