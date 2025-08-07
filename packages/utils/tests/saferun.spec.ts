import { describe, it, expect, vi } from 'vitest';
import { safeRun } from '../src/saferun';

describe('safeRun', () => {
  // Synchronous function tests
  describe('synchronous functions', () => {
    it('should return the value and undefined for error when synchronous function succeeds', () => {
      // Arrange
      const fn = () => 'success';

      // Act
      const [error, value] = safeRun(fn);

      // Assert
      expect(value).toBe('success');
      expect(error).toBeUndefined();
    });

    it('should return undefined for value and the error when synchronous function throws', () => {
      // Arrange
      const expectedError = new Error('synchronous error');
      const fn = (): void => {
        throw expectedError;
      };

      // Act
      const [error, value] = safeRun(fn);

      // Assert
      expect(value).toBeUndefined();
      expect(error).toBe(expectedError);
    });

    it('should handle various return value types from synchronous functions', () => {
      const testCases = [
        { fn: () => 42, expected: 42 },
        { fn: () => true, expected: true },
        { fn: () => ({ key: 'value' }), expected: { key: 'value' } },
        { fn: () => null, expected: null },
        { fn: () => undefined, expected: undefined },
      ];

      testCases.forEach(({ fn, expected }) => {
        // Arrange - (already set up in testCases)

        // Act
        const [error, value] = safeRun(fn as () => unknown);

        // Assert
        expect(value).toEqual(expected);
        expect(error).toBeUndefined();
      });
    });

    it('should handle various error types from synchronous functions', () => {
      // Test actual Error instances
      const errorInstances = [
        new Error('standard error'),
        new TypeError('type error'),
        new SyntaxError('syntax error'),
      ];

      errorInstances.forEach(expectedError => {
        // Arrange
        const fn = (): void => {
          throw expectedError;
        };

        // Act
        const [error, value] = safeRun(fn);

        // Assert - should preserve original error
        expect(value).toBeUndefined();
        expect(error).toBe(expectedError);
      });

      // Test non-Error types (should be converted to Error)
      const fnThrowingString = (): void => {
        throw 'string as error';
      };
      const [stringError] = safeRun(fnThrowingString);
      expect(stringError).toBeInstanceOf(Error);
      expect(stringError?.message).toBe('string as error');

      const fnThrowingObject = (): void => {
        throw { message: 'object as error' };
      };
      const [objectError] = safeRun(fnThrowingObject);
      expect(objectError).toBeInstanceOf(Error);
      expect(objectError?.message).toBe('object as error'); // Uses message property
    });
  });

  // Asynchronous function tests
  describe('asynchronous functions', () => {
    it('should return the value and undefined for error when asynchronous function succeeds', async () => {
      // Arrange
      const fn = async () => 'async success';

      // Act
      const [error, value] = await safeRun(fn);

      // Assert
      expect(value).toBe('async success');
      expect(error).toBeUndefined();
    });

    it('should return undefined for value and the error when asynchronous function rejects', async () => {
      // Arrange
      const expectedError = new Error('asynchronous error');
      const fn = async () => {
        throw expectedError;
      };

      // Act
      const [error, value] = await safeRun(fn);

      // Assert
      expect(value).toBeUndefined();
      expect(error).toBe(expectedError);
    });

    it('should handle various return value types from asynchronous functions', async () => {
      // Arrange
      const testCases = [
        { fn: async () => 42, expected: 42 },
        { fn: async () => true, expected: true },
        { fn: async () => ({ key: 'value' }), expected: { key: 'value' } },
        { fn: async () => null, expected: null },
        { fn: async () => undefined, expected: undefined },
      ];

      for (const { fn, expected } of testCases) {
        // Act
        const [error, value] = await safeRun(fn as () => Promise<unknown>);

        // Assert
        expect(value).toEqual(expected);
        expect(error).toBeUndefined();
      }
    });

    it('should handle various error types from asynchronous functions', async () => {
      // Test actual Error instances
      const errorInstances = [
        new Error('standard async error'),
        new TypeError('type async error'),
        new SyntaxError('syntax async error'),
      ];

      for (const expectedError of errorInstances) {
        // Arrange
        const fn = async () => {
          throw expectedError;
        };

        // Act
        const [error, value] = await safeRun(fn);

        // Assert - should preserve original error
        expect(value).toBeUndefined();
        expect(error).toBe(expectedError);
      }

      // Test non-Error types (should be converted to Error)
      const fnRejectingString = async () => {
        throw 'string as async error';
      };
      const [stringError] = await safeRun(fnRejectingString);
      expect(stringError).toBeInstanceOf(Error);
      expect(stringError?.message).toBe('string as async error');

      const fnRejectingObject = async () => {
        throw { message: 'object as async error' };
      };
      const [objectError] = await safeRun(fnRejectingObject);
      expect(objectError).toBeInstanceOf(Error);
      expect(objectError?.message).toBe('object as async error'); // Uses message property
    });

    it('should handle promises that reject after a delay', async () => {
      // Arrange
      const expectedError = new Error('delayed error');
      const fn = async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        throw expectedError;
      };

      // Act
      const [error, value] = await safeRun(fn);

      // Assert
      expect(value).toBeUndefined();
      expect(error).toBe(expectedError);
    });

    it('should handle promises that resolve after a delay', async () => {
      // Arrange
      const fn = async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'delayed success';
      };

      // Act
      const [error, value] = await safeRun(fn);

      // Assert
      expect(value).toBe('delayed success');
      expect(error).toBeUndefined();
    });
  });

  // Type resolution tests
  describe('type resolution', () => {
    interface TestResult {
      id: string;
      value: string;
    }

    it('should properly resolve async function return types without Promise wrapper', async () => {
      // Arrange - simulate the user's original issue
      const asyncMethod = async (): Promise<TestResult> => {
        return { id: '123', value: 'test' };
      };

      // Act
      const [error, result] = await safeRun(() => asyncMethod());

      // Assert - This test verifies TypeScript type resolution
      // The result should be TestResult | undefined, NOT Promise<TestResult> | undefined
      expect(error).toBeUndefined();
      expect(result).toEqual({ id: '123', value: 'test' });

      // These property accesses should work without type assertions
      if (result) {
        expect(result.id).toBe('123');
        expect(result.value).toBe('test');
      }
    });

    it('should distinguish between sync and async function types', async () => {
      // Arrange
      const syncMethod = (): string => 'sync result';
      const asyncMethod = async (): Promise<string> => 'async result';

      // Act
      const syncResult = safeRun(() => syncMethod()); // Should return tuple directly
      const asyncResult = safeRun(() => asyncMethod()); // Should return Promise<tuple>

      // Assert
      // Sync result should be available immediately
      const [syncError, syncValue] = syncResult;
      expect(syncError).toBeUndefined();
      expect(syncValue).toBe('sync result');

      // Async result needs to be awaited
      expect(asyncResult).toBeInstanceOf(Promise);
      const [asyncError, asyncValue] = await asyncResult;
      expect(asyncError).toBeUndefined();
      expect(asyncValue).toBe('async result');
    });

    it('should NOT wrap sync function results in Promise', () => {
      // Arrange - synchroniczna funkcja zwracająca obiekt
      interface SyncResult {
        name: string;
        age: number;
      }

      const syncFunction = (): SyncResult => ({
        name: 'John',
        age: 30,
      });

      // Act - wywołanie synchroniczne
      const [error, result] = safeRun(() => syncFunction());

      // Assert - result powinien być SyncResult | undefined, NIE Promise<SyncResult>
      expect(error).toBeUndefined();
      expect(result).toEqual({ name: 'John', age: 30 });

      // Te właściwości powinny być dostępne bezpośrednio (bez await)
      if (result) {
        // TypeScript poprawnie rozpoznaje typ jako SyncResult
        expect(result.name).toBe('John');
        expect(result.age).toBe(30);

        // @ts-expect-error - result nie jest Promise, więc then nie istnieje
        expect(result.then).toBeUndefined();
      }
    });
  });

  // Edge cases and integration tests
  describe('edge cases and integration', () => {
    it('should handle non-Error objects thrown', () => {
      // Arrange - function throwing a string
      const fnThrowingString = (): void => {
        throw 'This is a string error';
      };

      // Act
      const [error1, value1] = safeRun(fnThrowingString);

      // Assert - should convert to Error
      expect(value1).toBeUndefined();
      expect(error1).toBeInstanceOf(Error);
      expect(error1?.message).toBe('This is a string error');
    });

    it('should handle non-Error objects rejected in promises', async () => {
      // Test object with code and details
      const fnRejectingWithCode = async () => {
        return Promise.reject({ code: 'ERROR_CODE', details: 'Something went wrong' });
      };

      const [errorWithCode] = await safeRun(fnRejectingWithCode);
      expect(errorWithCode).toBeInstanceOf(Error);
      expect(errorWithCode?.message).toBe('Something went wrong'); // Uses details property

      // Test object with only code
      const fnRejectingCodeOnly = async () => {
        return Promise.reject({ code: 'VALIDATION_ERROR' });
      };

      const [errorCodeOnly] = await safeRun(fnRejectingCodeOnly);
      expect(errorCodeOnly).toBeInstanceOf(Error);
      expect(errorCodeOnly?.message).toBe('VALIDATION_ERROR'); // Uses code property

      // Test plain object without special properties
      const fnRejectingPlainObject = async () => {
        return Promise.reject({ foo: 'bar', baz: 123 });
      };

      const [plainObjectError] = await safeRun(fnRejectingPlainObject);
      expect(plainObjectError).toBeInstanceOf(Error);
      expect(plainObjectError?.message).toBe('{"foo":"bar","baz":123}'); // JSON stringified
    });

    it('should handle Promise-like objects (thenables)', async () => {
      // Arrange - custom thenable object
      const thenable = {
        then: (resolve: (value: string) => void) => {
          resolve('thenable result');
        },
      };

      const fnReturningThenable = () => thenable;

      // Act
      const result = safeRun(fnReturningThenable);

      // Assert - should treat as Promise
      expect(result).toBeInstanceOf(Promise);
      const [error, value] = await result;
      expect(error).toBeUndefined();
      expect(value).toBe('thenable result');
    });

    it('should correctly identify promises returned by functions', async () => {
      // Arrange
      const fnReturningPromise = (): Promise<string> => Promise.resolve('direct promise');

      // Act
      const result = safeRun(fnReturningPromise);

      // Assert
      expect(result).toBeInstanceOf(Promise);

      const [error, value] = await result;
      expect(value).toBe('direct promise');
      expect(error).toBeUndefined();
    });

    it('should handle the case when fn is called multiple times', () => {
      // Arrange
      const mockFn = vi.fn((): string => 'multiple calls');

      // Act - First call
      const result1 = safeRun(mockFn);
      const [error1, value1] = result1 as readonly [Error | undefined, string | undefined];

      // Assert - First call
      expect(value1).toBe('multiple calls');
      expect(error1).toBeUndefined();
      expect(mockFn).toHaveBeenCalledTimes(1);

      // Act - Second call
      const result2 = safeRun(mockFn);
      const [error2, value2] = result2 as readonly [Error | undefined, string | undefined];

      // Assert - Second call
      expect(value2).toBe('multiple calls');
      expect(error2).toBeUndefined();
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('should handle nested safeRun calls', () => {
      // Arrange
      const innerFn = () => 'inner function';
      const outerFn = () => {
        const [innerError, innerValue] = safeRun(innerFn);
        return innerValue;
      };

      // Act
      const [outerError, outerValue] = safeRun(outerFn);

      // Assert
      expect(outerValue).toBe('inner function');
      expect(outerError).toBeUndefined();
    });

    it('should handle asynchronous nested safeRun calls', async () => {
      // Arrange
      const innerFn = async () => 'inner async function';
      const outerFn = async () => {
        const [innerError, innerValue] = await safeRun(innerFn);
        return innerValue;
      };

      // Act
      const [outerError, outerValue] = await safeRun(outerFn);

      // Assert
      expect(outerValue).toBe('inner async function');
      expect(outerError).toBeUndefined();
    });

    it('should handle mixed nested safeRun calls (sync inside async)', async () => {
      // Arrange
      const innerFn = () => 'inner sync function';
      const outerFn = async () => {
        const [innerError, innerValue] = safeRun(innerFn);
        return innerValue;
      };

      // Act
      const [outerError, outerValue] = await safeRun(outerFn);

      // Assert
      expect(outerValue).toBe('inner sync function');
      expect(outerError).toBeUndefined();
    });
  });
});
