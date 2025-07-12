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
      const fn = () => {
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
        const [error, value] = safeRun<any, any>(fn);

        // Assert
        expect(value).toEqual(expected);
        expect(error).toBeUndefined();
      });
    });

    it('should handle various error types from synchronous functions', () => {
      const errorTypes = [
        new Error('standard error'),
        new TypeError('type error'),
        new SyntaxError('syntax error'),
        'string as error',
        { message: 'object as error' },
      ];

      errorTypes.forEach(expectedError => {
        // Arrange
        const fn = () => {
          throw expectedError;
        };

        // Act
        const [error, value] = safeRun(fn);

        // Assert
        expect(value).toBeUndefined();
        expect(error).toBe(expectedError);
      });
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
        const [error, value] = await safeRun<any, any>(fn);

        // Assert
        expect(value).toEqual(expected);
        expect(error).toBeUndefined();
      }
    });

    it('should handle various error types from asynchronous functions', async () => {
      // Arrange
      const errorTypes = [
        new Error('standard async error'),
        new TypeError('type async error'),
        new SyntaxError('syntax async error'),
        'string as async error',
        { message: 'object as async error' },
      ];

      for (const expectedError of errorTypes) {
        // Arrange (continued)
        const fn = async () => {
          throw expectedError;
        };

        // Act
        const [error, value] = await safeRun(fn);

        // Assert
        expect(value).toBeUndefined();
        expect(error).toBe(expectedError);
      }
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

  // Edge cases and integration tests
  describe('edge cases and integration', () => {
    it('should correctly identify promises returned by functions', async () => {
      // Arrange
      const fnReturningPromise = () => Promise.resolve('direct promise');

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
      const mockFn = vi.fn().mockReturnValue('multiple calls');

      // Act - First call
      const [error1, value1] = safeRun(mockFn);

      // Assert - First call
      expect(value1).toBe('multiple calls');
      expect(error1).toBeUndefined();
      expect(mockFn).toHaveBeenCalledTimes(1);

      // Act - Second call
      const [error2, value2] = safeRun(mockFn);

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
