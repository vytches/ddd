/* eslint-disable @typescript-eslint/no-empty-function */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validate } from 'uuid';
import { LibUtils, safeRun } from '../src';

// Mock for uuid
vi.mock('uuid', () => ({
  v4: () => '123e4567-e89b-12d3-a456-426614174000',
  validate: vi.fn(),
}));

describe('LibUtils', () => {
  describe('getUUID', () => {
    it('should handle unusual input cases', () => {
      // Arrange & Act
      const result1 = LibUtils.getUUID(null as any);
      const result2 = LibUtils.getUUID(undefined);
      // @ts-expect-error for test
      const result3 = LibUtils.getUUID('invalid');
      // @ts-expect-error for test
      const result4 = LibUtils.getUUID(123);

      // Assert
      // Regardless of invalid input, the function should return a UUID
      expect(result1).toBe('123e4567-e89b-12d3-a456-426614174000');
      expect(result2).toBe('123e4567-e89b-12d3-a456-426614174000');
      expect(result3).toBe('123e4567-e89b-12d3-a456-426614174000');
      expect(result4).toBe('123e4567-e89b-12d3-a456-426614174000');
    });

    it('should return a UUID v4 when type is v4', () => {
      // Arrange
      const type = 'v4' as const;

      // Act
      const result = LibUtils.getUUID(type);

      // Assert
      expect(result).toBe('123e4567-e89b-12d3-a456-426614174000');
    });

    it('should return a UUID v4 when type is not specified', () => {
      // Arrange & Act
      const result = LibUtils.getUUID();

      // Assert
      expect(result).toBe('123e4567-e89b-12d3-a456-426614174000');
    });
  });

  describe('isEmpty', () => {
    it('should handle edge cases', () => {
      // Extreme numbers
      expect(LibUtils.isEmpty(Number.MAX_SAFE_INTEGER)).toBe(false);
      expect(LibUtils.isEmpty(Number.MIN_SAFE_INTEGER)).toBe(false);
      expect(LibUtils.isEmpty(Infinity)).toBe(false);
      expect(LibUtils.isEmpty(-Infinity)).toBe(false);

      // Special objects
      expect(LibUtils.isEmpty(Object.create(null))).toBe(true);

      // Functions
      expect(LibUtils.isEmpty(() => {})).toBe(true);

      // Symbols
      expect(LibUtils.isEmpty(Symbol())).toBe(true);

      // Map/Set with empty/undefined elements
      const mapWithUndefined = new Map([[undefined, undefined]]);
      const setWithUndefined = new Set([undefined]);
      expect(LibUtils.isEmpty(mapWithUndefined)).toBe(false);
      expect(LibUtils.isEmpty(setWithUndefined)).toBe(false);

      // Object with non-enumerable properties
      const objWithNonEnumerable = {};
      Object.defineProperty(objWithNonEnumerable, 'hiddenProp', {
        value: 'value',
        enumerable: false,
      });
      expect(LibUtils.isEmpty(objWithNonEnumerable)).toBe(true);
    });

    it('should correctly evaluate boolean values', () => {
      expect(LibUtils.isEmpty(true)).toBe(false);
      expect(LibUtils.isEmpty(false)).toBe(true);
    });

    it('should correctly evaluate number values', () => {
      expect(LibUtils.isEmpty(1)).toBe(false);
      expect(LibUtils.isEmpty(0)).toBe(true);
      expect(LibUtils.isEmpty(NaN)).toBe(true);
    });

    it('should correctly evaluate string values', () => {
      expect(LibUtils.isEmpty('hello')).toBe(false);
      expect(LibUtils.isEmpty('')).toBe(true);
    });

    it('should correctly evaluate null and undefined', () => {
      expect(LibUtils.isEmpty(null)).toBe(true);
      expect(LibUtils.isEmpty(undefined)).toBe(true);
    });

    it('should correctly evaluate collections', () => {
      const emptyMap = new Map();
      const nonEmptyMap = new Map([['key', 'value']]);
      const emptySet = new Set();
      const nonEmptySet = new Set([1]);

      expect(LibUtils.isEmpty(emptyMap)).toBe(true);
      expect(LibUtils.isEmpty(nonEmptyMap)).toBe(false);
      expect(LibUtils.isEmpty(emptySet)).toBe(true);
      expect(LibUtils.isEmpty(nonEmptySet)).toBe(false);
    });

    it('should correctly evaluate arrays', () => {
      const emptyArray: any[] = [];
      const nonEmptyArray = [1, 2, 3];

      expect(LibUtils.isEmpty(emptyArray)).toBe(true);
      expect(LibUtils.isEmpty(nonEmptyArray)).toBe(false);
    });

    it('should correctly evaluate objects', () => {
      const emptyObject = {};
      const nonEmptyObject = { key: 'value' };

      expect(LibUtils.isEmpty(emptyObject)).toBe(true);
      expect(LibUtils.isEmpty(nonEmptyObject)).toBe(false);
    });

    it('should correctly evaluate Date objects', () => {
      const validDate = new Date();
      const invalidDate = new Date('invalid date');

      expect(LibUtils.isEmpty(validDate)).toBe(false);
      expect(LibUtils.isEmpty(invalidDate)).toBe(true);
    });
  });

  describe('hasValue', () => {
    it('should handle edge cases', () => {
      // Extreme numbers
      expect(LibUtils.hasValue(Number.MAX_SAFE_INTEGER)).toBe(true);
      expect(LibUtils.hasValue(Number.MIN_SAFE_INTEGER)).toBe(true);
      expect(LibUtils.hasValue(Infinity)).toBe(true);
      expect(LibUtils.hasValue(-Infinity)).toBe(true);

      // Special objects
      expect(LibUtils.hasValue(Object.create(null))).toBe(false);

      // Functions
      expect(LibUtils.hasValue(() => {})).toBe(false);

      // Symbols
      expect(LibUtils.hasValue(Symbol())).toBe(false);

      // Map/Set with empty/undefined elements
      const mapWithUndefined = new Map([[undefined, undefined]]);
      const setWithUndefined = new Set([undefined]);
      expect(LibUtils.hasValue(mapWithUndefined)).toBe(true);
      expect(LibUtils.hasValue(setWithUndefined)).toBe(true);

      // Object with non-enumerable properties
      const objWithNonEnumerable = {};
      Object.defineProperty(objWithNonEnumerable, 'hiddenProp', {
        value: 'value',
        enumerable: false,
      });
      expect(LibUtils.hasValue(objWithNonEnumerable)).toBe(false);
    });

    it('should correctly evaluate boolean values', () => {
      expect(LibUtils.hasValue(true)).toBe(true);
      expect(LibUtils.hasValue(false)).toBe(false);
    });

    it('should correctly evaluate number values', () => {
      expect(LibUtils.hasValue(1)).toBe(true);
      expect(LibUtils.hasValue(0)).toBe(false);
      expect(LibUtils.hasValue(NaN)).toBe(false);
    });

    it('should correctly evaluate string values', () => {
      expect(LibUtils.hasValue('hello')).toBe(true);
      expect(LibUtils.hasValue('')).toBe(false);
    });

    it('should correctly evaluate null and undefined', () => {
      expect(LibUtils.hasValue(null)).toBe(false);
      expect(LibUtils.hasValue(undefined)).toBe(false);
    });

    it('should correctly evaluate collections', () => {
      const emptyMap = new Map();
      const nonEmptyMap = new Map([['key', 'value']]);
      const emptySet = new Set();
      const nonEmptySet = new Set([1]);

      expect(LibUtils.hasValue(emptyMap)).toBe(false);
      expect(LibUtils.hasValue(nonEmptyMap)).toBe(true);
      expect(LibUtils.hasValue(emptySet)).toBe(false);
      expect(LibUtils.hasValue(nonEmptySet)).toBe(true);
    });

    it('should correctly evaluate arrays', () => {
      const emptyArray: any[] = [];
      const nonEmptyArray = [1, 2, 3];

      expect(LibUtils.hasValue(emptyArray)).toBe(false);
      expect(LibUtils.hasValue(nonEmptyArray)).toBe(true);
    });

    it('should correctly evaluate objects', () => {
      const emptyObject = {};
      const nonEmptyObject = { key: 'value' };

      expect(LibUtils.hasValue(emptyObject)).toBe(false);
      expect(LibUtils.hasValue(nonEmptyObject)).toBe(true);
    });

    it('should correctly evaluate Date objects', () => {
      const validDate = new Date();
      const invalidDate = new Date('invalid date');

      expect(LibUtils.hasValue(validDate)).toBe(true);
      expect(LibUtils.hasValue(invalidDate)).toBe(false);
    });
  });

  describe('isNotEmpty', () => {
    it('should handle edge cases', () => {
      // Extreme numbers
      expect(LibUtils.isNotEmpty(Number.MAX_SAFE_INTEGER)).toBe(true);
      expect(LibUtils.isNotEmpty(Number.MIN_SAFE_INTEGER)).toBe(true);
      expect(LibUtils.isNotEmpty(Infinity)).toBe(true);
      expect(LibUtils.isNotEmpty(-Infinity)).toBe(true);

      // Special objects
      expect(LibUtils.isNotEmpty(Object.create(null))).toBe(false);

      // Functions
      expect(LibUtils.isNotEmpty(() => {})).toBe(false);

      // Symbols
      expect(LibUtils.isNotEmpty(Symbol())).toBe(false);

      // Map/Set with empty/undefined elements
      const mapWithUndefined = new Map([[undefined, undefined]]);
      const setWithUndefined = new Set([undefined]);
      expect(LibUtils.isNotEmpty(mapWithUndefined)).toBe(true);
      expect(LibUtils.isNotEmpty(setWithUndefined)).toBe(true);

      // Object with non-enumerable properties
      const objWithNonEnumerable = {};
      Object.defineProperty(objWithNonEnumerable, 'hiddenProp', {
        value: 'value',
        enumerable: false,
      });
      expect(LibUtils.isNotEmpty(objWithNonEnumerable)).toBe(false);
    });

    it('should correctly evaluate boolean values', () => {
      expect(LibUtils.isNotEmpty(true)).toBe(true);
      expect(LibUtils.isNotEmpty(false)).toBe(false);
    });

    it('should correctly evaluate number values', () => {
      expect(LibUtils.isNotEmpty(1)).toBe(true);
      expect(LibUtils.isNotEmpty(0)).toBe(false);
      expect(LibUtils.isNotEmpty(NaN)).toBe(false);
    });

    it('should correctly evaluate string values', () => {
      expect(LibUtils.isNotEmpty('hello')).toBe(true);
      expect(LibUtils.isNotEmpty('')).toBe(false);
    });

    it('should correctly evaluate null and undefined', () => {
      expect(LibUtils.isNotEmpty(null)).toBe(false);
      expect(LibUtils.isNotEmpty(undefined)).toBe(false);
    });

    it('should correctly evaluate collections', () => {
      const emptyMap = new Map();
      const nonEmptyMap = new Map([['key', 'value']]);
      const emptySet = new Set();
      const nonEmptySet = new Set([1]);

      expect(LibUtils.isNotEmpty(emptyMap)).toBe(false);
      expect(LibUtils.isNotEmpty(nonEmptyMap)).toBe(true);
      expect(LibUtils.isNotEmpty(emptySet)).toBe(false);
      expect(LibUtils.isNotEmpty(nonEmptySet)).toBe(true);
    });

    it('should correctly evaluate arrays', () => {
      const emptyArray: any[] = [];
      const nonEmptyArray = [1, 2, 3];

      expect(LibUtils.isNotEmpty(emptyArray)).toBe(false);
      expect(LibUtils.isNotEmpty(nonEmptyArray)).toBe(true);
    });

    it('should correctly evaluate objects', () => {
      const emptyObject = {};
      const nonEmptyObject = { key: 'value' };

      expect(LibUtils.isNotEmpty(emptyObject)).toBe(false);
      expect(LibUtils.isNotEmpty(nonEmptyObject)).toBe(true);
    });

    it('should correctly evaluate Date objects', () => {
      const validDate = new Date();
      const invalidDate = new Date('invalid date');

      expect(LibUtils.isNotEmpty(validDate)).toBe(true);
      expect(LibUtils.isNotEmpty(invalidDate)).toBe(false);
    });
  });

  describe('isTruthy', () => {
    it('should handle edge cases', () => {
      // Extreme numbers
      expect(LibUtils.isTruthy(Number.MAX_SAFE_INTEGER)).toBe(true);
      expect(LibUtils.isTruthy(Number.MIN_SAFE_INTEGER)).toBe(true);
      expect(LibUtils.isTruthy(Infinity)).toBe(true);
      expect(LibUtils.isTruthy(-Infinity)).toBe(true);

      // Special objects
      expect(LibUtils.isTruthy(Object.create(null))).toBe(false);

      // Functions
      expect(LibUtils.isTruthy(() => {})).toBe(false);

      // Symbols
      expect(LibUtils.isTruthy(Symbol())).toBe(false);

      // Map/Set with empty/undefined elements
      const mapWithUndefined = new Map([[undefined, undefined]]);
      const setWithUndefined = new Set([undefined]);
      expect(LibUtils.isTruthy(mapWithUndefined)).toBe(true);
      expect(LibUtils.isTruthy(setWithUndefined)).toBe(true);

      // Object with non-enumerable properties
      const objWithNonEnumerable = {};
      Object.defineProperty(objWithNonEnumerable, 'hiddenProp', {
        value: 'value',
        enumerable: false,
      });
      expect(LibUtils.isTruthy(objWithNonEnumerable)).toBe(false);
    });

    it('should correctly evaluate boolean values', () => {
      expect(LibUtils.isTruthy(true)).toBe(true);
      expect(LibUtils.isTruthy(false)).toBe(false);
    });

    it('should correctly evaluate number values', () => {
      expect(LibUtils.isTruthy(42)).toBe(true);
      expect(LibUtils.isTruthy(0)).toBe(false);
      expect(LibUtils.isTruthy(NaN)).toBe(false);
    });

    it('should correctly evaluate string values', () => {
      expect(LibUtils.isTruthy('test')).toBe(true);
      expect(LibUtils.isTruthy('')).toBe(false);
    });

    it('should correctly evaluate null and undefined', () => {
      expect(LibUtils.isTruthy(null)).toBe(false);
      expect(LibUtils.isTruthy(undefined)).toBe(false);
    });

    it('should correctly evaluate collections', () => {
      const emptyMap = new Map();
      const nonEmptyMap = new Map([['key', 'value']]);
      const emptySet = new Set();
      const nonEmptySet = new Set([1]);

      expect(LibUtils.isTruthy(emptyMap)).toBe(false);
      expect(LibUtils.isTruthy(nonEmptyMap)).toBe(true);
      expect(LibUtils.isTruthy(emptySet)).toBe(false);
      expect(LibUtils.isTruthy(nonEmptySet)).toBe(true);
    });

    it('should correctly evaluate arrays', () => {
      const emptyArray: any[] = [];
      const nonEmptyArray = [1, 2, 3];

      expect(LibUtils.isTruthy(emptyArray)).toBe(false);
      expect(LibUtils.isTruthy(nonEmptyArray)).toBe(true);
    });

    it('should correctly evaluate objects', () => {
      const emptyObject = {};
      const nonEmptyObject = { key: 'value' };

      expect(LibUtils.isTruthy(emptyObject)).toBe(false);
      expect(LibUtils.isTruthy(nonEmptyObject)).toBe(true);
    });

    it('should correctly evaluate Date objects', () => {
      const validDate = new Date();
      const invalidDate = new Date('invalid date');

      expect(LibUtils.isTruthy(validDate)).toBe(true);
      expect(LibUtils.isTruthy(invalidDate)).toBe(false);
    });
  });

  describe('isFalsy', () => {
    it('should handle edge cases', () => {
      // Extreme numbers
      expect(LibUtils.isFalsy(Number.MAX_SAFE_INTEGER)).toBe(false);
      expect(LibUtils.isFalsy(Number.MIN_SAFE_INTEGER)).toBe(false);
      expect(LibUtils.isFalsy(Infinity)).toBe(false);
      expect(LibUtils.isFalsy(-Infinity)).toBe(false);

      // Special objects
      expect(LibUtils.isFalsy(Object.create(null))).toBe(true);

      // Functions
      expect(LibUtils.isFalsy(() => {})).toBe(true);

      // Symbols
      expect(LibUtils.isFalsy(Symbol())).toBe(true);

      // Map/Set with empty/undefined elements
      const mapWithUndefined = new Map([[undefined, undefined]]);
      const setWithUndefined = new Set([undefined]);
      expect(LibUtils.isFalsy(mapWithUndefined)).toBe(false);
      expect(LibUtils.isFalsy(setWithUndefined)).toBe(false);

      // Object with non-enumerable properties
      const objWithNonEnumerable = {};
      Object.defineProperty(objWithNonEnumerable, 'hiddenProp', {
        value: 'value',
        enumerable: false,
      });
      expect(LibUtils.isFalsy(objWithNonEnumerable)).toBe(true);
    });

    it('should correctly evaluate boolean values', () => {
      expect(LibUtils.isFalsy(true)).toBe(false);
      expect(LibUtils.isFalsy(false)).toBe(true);
    });

    it('should correctly evaluate number values', () => {
      expect(LibUtils.isFalsy(1)).toBe(false);
      expect(LibUtils.isFalsy(0)).toBe(true);
      expect(LibUtils.isFalsy(NaN)).toBe(true);
    });

    it('should correctly evaluate string values', () => {
      expect(LibUtils.isFalsy('hello')).toBe(false);
      expect(LibUtils.isFalsy('')).toBe(true);
    });

    it('should correctly evaluate null and undefined', () => {
      expect(LibUtils.isFalsy(null)).toBe(true);
      expect(LibUtils.isFalsy(undefined)).toBe(true);
    });

    it('should correctly evaluate collections', () => {
      const emptyMap = new Map();
      const nonEmptyMap = new Map([['key', 'value']]);
      const emptySet = new Set();
      const nonEmptySet = new Set([1]);

      expect(LibUtils.isFalsy(emptyMap)).toBe(true);
      expect(LibUtils.isFalsy(nonEmptyMap)).toBe(false);
      expect(LibUtils.isFalsy(emptySet)).toBe(true);
      expect(LibUtils.isFalsy(nonEmptySet)).toBe(false);
    });

    it('should correctly evaluate arrays', () => {
      const emptyArray: any[] = [];
      const nonEmptyArray = [1, 2, 3];

      expect(LibUtils.isFalsy(emptyArray)).toBe(true);
      expect(LibUtils.isFalsy(nonEmptyArray)).toBe(false);
    });

    it('should correctly evaluate objects', () => {
      const emptyObject = {};
      const nonEmptyObject = { key: 'value' };

      expect(LibUtils.isFalsy(emptyObject)).toBe(true);
      expect(LibUtils.isFalsy(nonEmptyObject)).toBe(false);
    });

    it('should correctly evaluate Date objects', () => {
      const validDate = new Date();
      const invalidDate = new Date('invalid date');

      expect(LibUtils.isFalsy(validDate)).toBe(false);
      expect(LibUtils.isFalsy(invalidDate)).toBe(true);
    });
  });

  describe('sleep', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should handle edge cases for sleep duration', async () => {
      // Zero wait time
      const zeroPromise = LibUtils.sleep(0);
      vi.advanceTimersByTime(0);
      await expect(zeroPromise).resolves.toBeUndefined();

      // Negative time (should immediately resolve the promise)
      const negativePromise = LibUtils.sleep(-1);
      vi.advanceTimersByTime(0);
      await expect(negativePromise).resolves.toBeUndefined();

      // Very large value (checking if it doesn't overflow)
      const largePromise = LibUtils.sleep(Number.MAX_SAFE_INTEGER);
      vi.advanceTimersByTime(Number.MAX_SAFE_INTEGER);
      await expect(largePromise).resolves.toBeUndefined();
    });

    it('should resolve after specified time', async () => {
      // Arrange
      const ms = 1000;
      const sleepPromise = LibUtils.sleep(ms);

      // Act
      vi.advanceTimersByTime(ms);

      // Assert
      await expect(sleepPromise).resolves.toBeUndefined();
    });
  });

  describe('isValidUUID', () => {
    beforeEach(() => {
      (validate as any).mockReset();
    });

    it('should use uuid validate function to check UUID validity', () => {
      // Arrange
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';
      (validate as any).mockReturnValue(true);

      // Act
      const result = LibUtils.isValidUUID(validUuid);

      // Assert
      expect(validate).toHaveBeenCalledWith(validUuid);
      expect(result).toBe(true);
    });

    it('should return false for invalid UUID', () => {
      // Arrange
      const invalidUuid = 'not-a-uuid';
      (validate as any).mockReturnValue(false);

      // Act
      const result = LibUtils.isValidUUID(invalidUuid);

      // Assert
      expect(validate).toHaveBeenCalledWith(invalidUuid);
      expect(result).toBe(false);
    });
  });

  describe('isValidInteger', () => {
    it('should handle edge cases for integers', () => {
      // Largest safe integer and other edge cases
      expect(LibUtils.isValidInteger(Number.MAX_SAFE_INTEGER)).toBe(true);
      expect(LibUtils.isValidInteger(2147483647)).toBe(true); // Typical 32-bit int max
      expect(LibUtils.isValidInteger(4294967295)).toBe(true); // Typical uint32 max value
      expect(LibUtils.isValidInteger(0x7fffffff)).toBe(true); // Maximum 32-bit value in hex
      expect(LibUtils.isValidInteger(0)).toBe(true);

      // Cases that should return false
      expect(LibUtils.isValidInteger(Number.MAX_VALUE)).toBe(true); // For JS it's an integer
      expect(LibUtils.isValidInteger(Number.POSITIVE_INFINITY)).toBe(false);
    });

    it('should return true for valid integers', () => {
      const validIntegers = [0, 1, 42, 100];

      validIntegers.forEach(num => {
        expect(LibUtils.isValidInteger(num)).toBe(true);
      });
    });

    it('should return false for negative integers', () => {
      const negativeIntegers = [-1, -42, -100];

      negativeIntegers.forEach(num => {
        expect(LibUtils.isValidInteger(num)).toBe(false);
      });
    });

    it('should return false for floating point numbers', () => {
      const floats = [0.5, 1.1, 42.42];

      floats.forEach(num => {
        expect(LibUtils.isValidInteger(num)).toBe(false);
      });
    });
  });

  describe('isValidBigInt', () => {
    it('should handle edge cases for BigInt strings', () => {
      const edgeCases = [
        '9007199254740991', // MAX_SAFE_INTEGER
        '9007199254740992', // MAX_SAFE_INTEGER + 1
        '18446744073709551615', // Maximum value of uint64
        '340282366920938463463374607431768211455', // 2^128 - 1
        '115792089237316195423570985008687907853269984665640564039457584007913129639935', // 2^256 - 1, typical for blockchain
      ];

      edgeCases.forEach(str => {
        expect(LibUtils.isValidBigInt(str)).toBe(true);
      });

      // Cases that should return false
      expect(LibUtils.isValidBigInt('9.9e+100')).toBe(false); // Scientific notation
      expect(LibUtils.isValidBigInt('0x123')).toBe(false); // Hex
      expect(LibUtils.isValidBigInt('0b101')).toBe(false); // Binary
      expect(LibUtils.isValidBigInt('0o777')).toBe(false); // Octal
    });

    it('should return true for valid big integers strings', () => {
      const validBigIntStrings = ['0', '1', '9007199254740991', '12345678901234567890'];

      validBigIntStrings.forEach(str => {
        expect(LibUtils.isValidBigInt(str)).toBe(true);
      });
    });

    it('should return false for invalid big integer strings', () => {
      const invalidBigIntStrings = [
        '-1', // Negative
        '3.14', // Float
        'abc', // Non-numeric
        '123abc', // Mixed
        '', // Empty
      ];

      invalidBigIntStrings.forEach(str => {
        expect(LibUtils.isValidBigInt(str)).toBe(false);
      });
    });
  });

  describe('isValidTextId', () => {
    it('should handle edge cases for text IDs', () => {
      const edgeCases = [
        '_', // Only underscore
        '-', // Only hyphen
        'a', // Single character
        '0', // Single digit
        'A', // Single uppercase letter
        '_-_-', // Only special characters
        'a'.repeat(255), // Very long string
        'a_'.repeat(100), // Repeating pattern
        'z9_-Z', // Mix of all allowed characters
      ];

      edgeCases.forEach(id => {
        expect(LibUtils.isValidTextId(id)).toBe(true);
      });

      // Cases that should return false
      expect(LibUtils.isValidTextId(' ')).toBe(false); // Space
      expect(LibUtils.isValidTextId('\t')).toBe(false); // Tab
      expect(LibUtils.isValidTextId('\n')).toBe(false); // New line
      expect(LibUtils.isValidTextId('\u200B')).toBe(false); // Zero-width space
      expect(LibUtils.isValidTextId('ą')).toBe(false); // Diacritical mark
      expect(LibUtils.isValidTextId('😀')).toBe(false); // Emoji
    });

    it('should return true for valid text IDs', () => {
      const validTextIds = ['abc', 'ABC', '123', 'abc_123', 'abc-123', 'a_b-c'];

      validTextIds.forEach(id => {
        expect(LibUtils.isValidTextId(id)).toBe(true);
      });
    });

    it('should return false for invalid text IDs', () => {
      const invalidTextIds = [
        '', // Empty
        'abc 123', // Contains space
        'abc.123', // Contains period
        'abc#123', // Contains special character
        'abc@123', // Contains special character
      ];

      invalidTextIds.forEach(id => {
        expect(LibUtils.isValidTextId(id)).toBe(false);
      });
    });
  });

  describe('normalizeIdToString', () => {
    it('should handle extreme values', () => {
      // Arrange
      const extremeValues = [
        [BigInt('9007199254740991'), '9007199254740991'], // MAX_SAFE_INTEGER
        [BigInt('18446744073709551615'), '18446744073709551615'], // uint64 max
        [Number.MAX_SAFE_INTEGER, String(Number.MAX_SAFE_INTEGER)],
        [0, '0'],
        [1e20, '100000000000000000000'], // Scientific notation to string
        [0xff, '255'], // Hex to string
      ];

      // Act & Assert
      extremeValues.forEach(([value, expected]) => {
        expect(LibUtils.normalizeIdToString(value as any)).toBe(expected);
      });
    });

    it('should convert bigint to string', () => {
      // Arrange
      const bigIntValue = BigInt('12345678901234567890');

      // Act
      const result = LibUtils.normalizeIdToString(bigIntValue);

      // Assert
      expect(result).toBe('12345678901234567890');
      expect(typeof result).toBe('string');
    });

    it('should convert number to string', () => {
      // Arrange
      const numberValue = 12345;

      // Act
      const result = LibUtils.normalizeIdToString(numberValue);

      // Assert
      expect(result).toBe('12345');
      expect(typeof result).toBe('string');
    });

    it('should return string as is', () => {
      // Arrange
      const stringValue = '12345abc';

      // Act
      const result = LibUtils.normalizeIdToString(stringValue);

      // Assert
      expect(result).toBe('12345abc');
      expect(typeof result).toBe('string');
    });
  });

  describe('deepEqual', () => {
    it('should handle circular references', () => {
      // Arrange
      const obj1: any = { a: 1 };
      const obj2: any = { a: 1 };

      // Creating circular references
      obj1.self = obj1;
      obj2.self = obj2;

      // Act & Assert
      const [circularError] = safeRun(() => LibUtils.deepEqual(obj1, obj2));
      expect(circularError).toBeUndefined(); // Should not cause stack overflow
      // Expected result might be false because deepEqual may not handle circular references
      // This test mainly checks if the function doesn't cause an error
    });

    it('should handle objects with prototype chain', () => {
      // Arrange
      class TestClass {
        prop = 'value';
      }

      const obj1 = new TestClass();
      const obj2 = new TestClass();
      const obj3 = { prop: 'value' }; // Similar object but without prototype

      // Act & Assert
      expect(LibUtils.deepEqual(obj1, obj2)).toBe(true);
      expect(LibUtils.deepEqual(obj1, obj3)).toBe(true); // Should compare only own properties
    });

    it('should handle edge cases for primitives', () => {
      // Arrange
      const edgeCases = [
        [0, -0], // Zero and minus zero
        [NaN, NaN], // NaN should be equal to NaN
        [Infinity, Infinity],
        [-Infinity, -Infinity],
        [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
        [Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER],
      ];

      // Act & Assert
      edgeCases.forEach(([a, b]) => {
        expect(LibUtils.deepEqual(a, b)).toBe(true);
      });
    });

    it('should return true for identical primitives', () => {
      // Arrange
      const testCases = [
        [1, 1],
        ['test', 'test'],
        [true, true],
        [null, null],
        [undefined, undefined],
      ];

      // Act & Assert
      testCases.forEach(([a, b]) => {
        expect(LibUtils.deepEqual(a, b)).toBe(true);
      });
    });

    it('should return false for different primitives', () => {
      // Arrange
      const testCases = [
        [1, 2],
        ['test', 'different'],
        [true, false],
        [null, undefined],
        [1, '1'],
      ];

      // Act & Assert
      testCases.forEach(([a, b]) => {
        expect(LibUtils.deepEqual(a, b)).toBe(false);
      });
    });

    it('should return true for equal objects', () => {
      // Arrange
      const obj1 = { a: 1, b: 'test', c: true };
      const obj2 = { a: 1, b: 'test', c: true };

      // Act
      const result = LibUtils.deepEqual(obj1, obj2);

      // Assert
      expect(result).toBe(true);
    });

    it('should return false for objects with different values', () => {
      // Arrange
      const obj1 = { a: 1, b: 'test', c: true };
      const obj2 = { a: 1, b: 'different', c: true };

      // Act
      const result = LibUtils.deepEqual(obj1, obj2);

      // Assert
      expect(result).toBe(false);
    });

    it('should return false for objects with different keys', () => {
      // Arrange
      const obj1 = { a: 1, b: 'test', c: true };
      const obj2 = { a: 1, b: 'test', d: true };

      // Act
      const result = LibUtils.deepEqual(obj1, obj2);

      // Assert
      expect(result).toBe(false);
    });

    it('should return false for objects with different number of keys', () => {
      // Arrange
      const obj1 = { a: 1, b: 'test', c: true };
      const obj2 = { a: 1, b: 'test' };

      // Act
      const result = LibUtils.deepEqual(obj1, obj2);

      // Assert
      expect(result).toBe(false);
    });

    it('should handle nested objects correctly', () => {
      // Arrange
      const obj1 = { a: 1, b: { c: 2, d: { e: 3 } } };
      const obj2 = { a: 1, b: { c: 2, d: { e: 3 } } };
      const obj3 = { a: 1, b: { c: 2, d: { e: 4 } } };

      // Act & Assert
      expect(LibUtils.deepEqual(obj1, obj2)).toBe(true);
      expect(LibUtils.deepEqual(obj1, obj3)).toBe(false);
    });

    it('should handle arrays correctly', () => {
      // Arrange
      const arr1 = [1, 2, 3];
      const arr2 = [1, 2, 3];
      const arr3 = [1, 2, 4];

      // Act & Assert
      expect(LibUtils.deepEqual(arr1, arr2)).toBe(true);
      expect(LibUtils.deepEqual(arr1, arr3)).toBe(false);
    });

    it('should handle complex nested structures', () => {
      // Arrange
      const complex1 = {
        a: 1,
        b: [1, 2, { c: 3 }],
        d: { e: 4, f: [5, 6] },
      };

      const complex2 = {
        a: 1,
        b: [1, 2, { c: 3 }],
        d: { e: 4, f: [5, 6] },
      };

      const complex3 = {
        a: 1,
        b: [1, 2, { c: 3 }],
        d: { e: 4, f: [5, 7] }, // Different value here
      };

      // Act & Assert
      expect(LibUtils.deepEqual(complex1, complex2)).toBe(true);
      expect(LibUtils.deepEqual(complex1, complex3)).toBe(false);
    });
  });
});
