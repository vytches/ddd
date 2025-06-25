import { describe, it, expect, vi } from 'vitest';
import { Result } from './result';

describe('Result', () => {
  describe('creation', () => {
    it('should create successful result', () => {
      // Arrange
      const value = 10;

      // Act
      const result = Result.ok(value);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.isFailure).toBe(false);
      expect(result.value).toBe(value);
    });

    it('should create successful result with undefined value', () => {
      // Arrange & Act
      const result = Result.ok();

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.isFailure).toBe(false);
      expect(result.value).toBeUndefined();
    });

    it('should create failure result', () => {
      // Arrange
      const error = new Error('Something went wrong');

      // Act
      const result = Result.fail<number>(error);

      // Assert
      expect(result.isSuccess).toBe(false);
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(error);
    });

    it('should throw when accessing value of failure result', () => {
      // Arrange
      const error = new Error('Error');
      const result = Result.fail<number>(error);

      // Act & Assert
      expect(() => result.value).toThrow(
        'Cannot get value of a failure result',
      );
    });

    it('should throw when accessing error of success result', () => {
      // Arrange
      const result = Result.ok<number>(42);

      // Act & Assert
      expect(() => result.error).toThrow(
        'Cannot get error of a success result',
      );
    });
  });

  describe('try', () => {
    it('should return success when function succeeds', () => {
      // Arrange
      const fn = () => 42;

      // Act
      const result = Result.try(fn);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(42);
    });

    it('should return failure when function throws', () => {
      // Arrange
      const error = new Error('Test error');
      const fn = () => {
        throw error;
      };

      // Act
      const result = Result.try(fn);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(error);
    });

    it('should wrap non-Error exceptions in an Error object', () => {
      // Arrange
      const fn = () => {
        throw 'string error';
      };

      // Act
      const result = Result.try(fn);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error.message).toBe('string error');
    });
  });

  describe('map', () => {
    it('should transform success value', () => {
      // Arrange
      const initialValue = 10;
      const transformFn = (x: number) => x * 2;

      // Act
      const result = Result.ok(initialValue).map(transformFn);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(20);
    });

    it('should not transform failure result', () => {
      // Arrange
      const error = new Error('Error');
      const transformFn = (x: number) => x * 2;

      // Act
      const result = Result.fail<number>(error).map(transformFn);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(error);
    });
  });

  describe('flatMap', () => {
    it('should transform success value with function returning success', () => {
      // Arrange
      const initialValue = 10;
      const transformFn = (x: number) => Result.ok(x * 2);

      // Act
      const result = Result.ok(initialValue).flatMap(transformFn);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(20);
    });

    it('should transform success value with function returning failure', () => {
      // Arrange
      const initialValue = 10;
      const error = new Error('Transformed error');
      const transformFn = (_: number) => Result.fail<number>(error);

      // Act
      const result = Result.ok(initialValue).flatMap(transformFn);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(error);
    });

    it('should not transform failure result', () => {
      // Arrange
      const error = new Error('Original error');
      const transformFn = (x: number) => Result.ok(x * 2);

      // Act
      const result = Result.fail<number>(error).flatMap(transformFn);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(error);
    });
  });

  describe('match', () => {
    it('should call onSuccess for success result', () => {
      // Arrange
      const value = 42;
      const onSuccess = vi.fn((x) => `Success: ${x}`);
      const onFailure = vi.fn((e) => `Error: ${e.message}`);

      // Act
      const result = Result.ok(value).match(onSuccess, onFailure);

      // Assert
      expect(onSuccess).toHaveBeenCalledWith(value);
      expect(onFailure).not.toHaveBeenCalled();
      expect(result).toBe('Success: 42');
    });

    it('should call onFailure for failure result', () => {
      // Arrange
      const error = new Error('Test error');
      const onSuccess = vi.fn((x) => `Success: ${x}`);
      const onFailure = vi.fn((e) => `Error: ${e.message}`);

      // Act
      const result = Result.fail<number>(error).match(onSuccess, onFailure);

      // Assert
      expect(onSuccess).not.toHaveBeenCalled();
      expect(onFailure).toHaveBeenCalledWith(error);
      expect(result).toBe('Error: Test error');
    });
  });

  describe('tap and tapError', () => {
    it('should execute side effect on success result', () => {
      // Arrange
      const value = 42;
      const sideEffect = vi.fn();

      // Act
      const result = Result.ok(value).tap(sideEffect);

      // Assert
      expect(sideEffect).toHaveBeenCalledWith(value);
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(value);
    });

    it('should not execute side effect on failure result', () => {
      // Arrange
      const error = new Error('Test error');
      const sideEffect = vi.fn();

      // Act
      const result = Result.fail<number>(error).tap(sideEffect);

      // Assert
      expect(sideEffect).not.toHaveBeenCalled();
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(error);
    });

    it('should execute error side effect on failure result', () => {
      // Arrange
      const error = new Error('Test error');
      const sideEffect = vi.fn();

      // Act
      const result = Result.fail<number>(error).tapError(sideEffect);

      // Assert
      expect(sideEffect).toHaveBeenCalledWith(error);
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(error);
    });

    it('should not execute error side effect on success result', () => {
      // Arrange
      const value = 42;
      const sideEffect = vi.fn();

      // Act
      const result = Result.ok(value).tapError(sideEffect);

      // Assert
      expect(sideEffect).not.toHaveBeenCalled();
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(value);
    });
  });

  describe('async methods', () => {
    it('should handle tryAsync with successful promise', async () => {
      // Arrange
      const expectedValue = 42;
      const fn = async () => expectedValue;

      // Act
      const result = await Result.tryAsync(fn);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(expectedValue);
    });

    it('should handle tryAsync with rejected promise', async () => {
      // Arrange
      const error = new Error('Async error');
      const fn = async () => {
        throw error;
      };

      // Act
      const result = await Result.tryAsync(fn);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(error);
    });

    it('should handle mapAsync with successful transformation', async () => {
      // Arrange
      const initialValue = 10;
      const fn = async (x: number) => x * 2;

      // Act
      const result = await Result.ok(initialValue).mapAsync(fn);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(20);
    });

    it('should handle mapAsync with failing transformation', async () => {
      // Arrange
      const initialValue = 10;
      const error = new Error('Async transformation error');
      const fn = async (_: number) => {
        throw error;
      };

      // Act
      const result = await Result.ok(initialValue).mapAsync(fn);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(error);
    });

    it('should handle flatMapAsync with successful transformation', async () => {
      // Arrange
      const initialValue = 10;
      const fn = async (x: number) => Result.ok(x * 2);

      // Act
      const result = await Result.ok(initialValue).flatMapAsync(fn);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(20);
    });

    it('should handle flatMapAsync with transformation returning failure', async () => {
      // Arrange
      const initialValue = 10;
      const error = new Error('Async flat transformation error');
      const fn = async (_: number) => Result.fail<number>(error);

      // Act
      const result = await Result.ok(initialValue).flatMapAsync(fn);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(error);
    });

    it('should not transform failure result with mapAsync', async () => {
      // Arrange
      const error = new Error('Original error');
      const fn = async (x: number) => x * 2;

      // Act
      const result = await Result.fail<number>(error).mapAsync(fn);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(error);
    });

    it('should not transform failure result with flatMapAsync', async () => {
      // Arrange
      const error = new Error('Original error');
      const fn = async (x: number) => Result.ok(x * 2);

      // Act
      const result = await Result.fail<number>(error).flatMapAsync(fn);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(error);
    });
  });

  describe('complex usage', () => {
    it('should handle chain of operations with success', () => {
      // Arrange
      const initialValue = 10;

      // Act
      const result = Result.ok(initialValue)
        .map((x) => x * 2)
        .flatMap((x) => Result.ok(x + 5))
        .tap((x) => {
          /* noop */
        });

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(25);
    });

    it('should handle chain of operations with failure', () => {
      // Arrange
      const initialValue = 10;
      const error = new Error('Chain error');

      // Act
      const result = Result.ok(initialValue)
        .map((x) => x * 2)
        .flatMap((_) => Result.fail<number>(error))
        .map((x) => x + 5)
        .tap((x) => {
          /* noop */
        });

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(error);
    });

    it('should handle complex async chain with success', async () => {
      // Arrange
      const initialValue = 10;

      // Act
      const result = await Result.ok(initialValue)
        .map((x) => x * 2)
        .flatMapAsync(async (x) => Result.ok(x + 5))
        .then((r) => r.mapAsync(async (x) => x * 2));

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(50);
    });

    it('should handle complex async chain with failure', async () => {
      // Arrange
      const initialValue = 10;
      const error = new Error('Async chain error');

      // Act
      const result = await Result.ok(initialValue)
        .mapAsync(async (x) => x * 2)
        .then((r) => r.flatMapAsync(async (_) => Result.fail<number>(error)))
        .then((r) => r.mapAsync(async (x) => x * 2));

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(error);
    });
  });

  describe('type handling', () => {
    it('should handle complex objects', () => {
      // Arrange
      type User = { id: number; name: string };
      const user: User = { id: 1, name: 'John' };

      // Act
      const result = Result.ok<User>(user).map((u) => ({
        ...u,
        name: u.name.toUpperCase(),
      }));

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value).toEqual({ id: 1, name: 'JOHN' });
    });

    it('should handle custom error types', () => {
      // Arrange
      class ValidationError extends Error {
        constructor(
          public readonly field: string,
          message: string,
        ) {
          super(message);
          this.name = 'ValidationError';
        }
      }

      const error = new ValidationError('name', 'Name is required');

      // Act
      const result = Result.fail<unknown, ValidationError>(error);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).instanceOf(ValidationError);
      expect(result.error).toBe(error);
      expect(result.error.field).toBe('name');
    });
  });
});
