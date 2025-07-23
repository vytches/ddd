import { describe, it, expect, vi } from 'vitest';
import {
  safeRun,
  safeRunTest,
  expectError,
  expectSuccess,
  safeRunWithTimeout,
  type SafeRunResult,
} from '../../src';
// Local test implementation to avoid circular dependency
interface TestDomainErrorOptions {
  code: string;
  data?: Record<string, unknown>;
}

class TestDomainError extends Error {
  public readonly code: string;
  public data?: Record<string, unknown>;

  constructor(message: string, options: TestDomainErrorOptions = { code: 'DEFAULT' }) {
    super(message);
    this.name = 'TestDomainError';
    this.code = options.code;
    // @ts-expect-error expecting data to be optional
    this.data = options.data;
  }
}

class TestValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TestValidationError';
  }
}

describe('safeRun', () => {
  describe('synchronous operations', () => {
    it('should return success result for successful operation', () => {
      const result = safeRun(() => 'success');
      const [error, value] = result;

      expect(error).toBeUndefined();
      expect(value).toBe('success');
    });

    it('should return error result for failed operation', () => {
      const testError = new Error('test error');
      const result = safeRun(() => {
        throw testError;
      });
      const [error, value] = result;

      expect(error).toBe(testError);
      expect(value).toBeUndefined();
    });

    it('should handle complex objects', () => {
      const testObject = { id: 1, name: 'test', data: [1, 2, 3] };
      const result = safeRun(() => testObject);
      const [error, value] = result;

      expect(error).toBeUndefined();
      expect(value).toEqual(testObject);
    });
  });

  describe('asynchronous operations', () => {
    it('should return success result for successful async operation', async () => {
      const result = await safeRun(async () => 'async success');
      const [error, value] = result;

      expect(error).toBeUndefined();
      expect(value).toBe('async success');
    });

    it('should return error result for failed async operation', async () => {
      const testError = new Error('async error');
      const result = await safeRun(async () => {
        throw testError;
      });
      const [error, value] = result;

      expect(error).toBe(testError);
      expect(value).toBeUndefined();
    });

    it('should handle async operations with delay', async () => {
      const result = await safeRun(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'delayed success';
      });
      const [error, value] = result;

      expect(error).toBeUndefined();
      expect(value).toBe('delayed success');
    });
  });

  describe('type safety', () => {
    it('should maintain type safety for success values', () => {
      interface TestInterface {
        id: number;
        name: string;
      }

      const testData: TestInterface = { id: 1, name: 'test' };
      const result: SafeRunResult<TestInterface> = safeRun(() => testData);
      const [error, value] = result;

      if (!error && value) {
        // TypeScript should infer the correct type
        expect(value.id).toBe(1);
        expect(value.name).toBe('test');
      }
    });

    it('should maintain type safety for error types', () => {
      const result: SafeRunResult<string, TestValidationError> = safeRun(() => {
        throw new TestValidationError('validation failed');
      });
      const [error] = result;

      if (error) {
        expect(error instanceof TestValidationError).toBe(true);
        expect(error.message).toBe('validation failed');
      }
    });
  });
});

describe('safeRunTest', () => {
  it('should add test context to BaseError instances', () => {
    const testContext = 'UserService.createUser test';
    const result = safeRunTest(() => {
      throw new TestDomainError('domain validation failed', { code: 'DOMAIN_ERROR' });
    }, testContext) as SafeRunResult<never, TestDomainError>;

    const [error, value] = result;
    expect(error).toBeInstanceOf(TestDomainError);
    expect((error as TestDomainError).data).toBeDefined();
    expect(((error as TestDomainError).data as { testContext?: string })?.testContext).toBe(
      testContext
    );
    expect(value).toBeUndefined();
  });

  it('should add test context to BaseError instances in async operations', async () => {
    const testContext = 'OrderService.processOrder test';
    const result = (await safeRunTest(async () => {
      throw new TestDomainError('async domain error', { code: 'ASYNC_ERROR' });
    }, testContext)) as SafeRunResult<never, TestDomainError>;

    const [error, value] = result;
    expect(error).toBeInstanceOf(TestDomainError);
    expect((error as TestDomainError).data).toBeDefined();
    expect(((error as TestDomainError).data as { testContext?: string })?.testContext).toBe(
      testContext
    );
    expect(value).toBeUndefined();
  });

  it('should not modify non-BaseError instances', () => {
    const testContext = 'test context';
    const originalError = new Error('regular error');
    const result = safeRunTest(() => {
      throw originalError;
    }, testContext) as SafeRunResult<never, Error>;

    const [error, value] = result;
    expect(error).toBe(originalError);
    expect((error as any).data?.testContext).toBeUndefined();
  });

  it('should work without context parameter', () => {
    const result = safeRunTest(() => 'success without context') as SafeRunResult<string>;
    const [error, value] = result;

    expect(error).toBeUndefined();
    expect(value).toBe('success without context');
  });
});

describe('expectError', () => {
  it('should return error when expected error type is thrown', () => {
    const result: SafeRunResult<string, TestValidationError> = safeRun(() => {
      throw new TestValidationError('validation error');
    });

    const errorExtractor = expectError(TestValidationError);
    const error = errorExtractor(result);

    expect(error).toBeInstanceOf(TestValidationError);
    expect(error.message).toBe('validation error');
  });

  it('should throw when no error occurs', () => {
    const result: SafeRunResult<string> = safeRun(() => 'success');
    const errorExtractor = expectError(Error);

    const [extractorError] = safeRun(() => errorExtractor(result));
    expect(extractorError?.message).toBe(
      'Expected error of type Error, but operation succeeded with value: success'
    );
  });

  it('should throw when wrong error type is thrown', () => {
    const result: SafeRunResult<string> = safeRun(() => {
      throw new Error('wrong type');
    });
    const errorExtractor = expectError(TestValidationError);

    const [wrongTypeError] = safeRun(() => errorExtractor(result));
    expect(wrongTypeError?.message).toBe(
      'Expected error of type TestValidationError, but got Error: wrong type'
    );
  });

  it('should work with BaseError hierarchy', () => {
    const result: SafeRunResult<string, TestDomainError> = safeRun(() => {
      throw new TestDomainError('domain error', { code: 'DOMAIN_ERROR' });
    });

    const errorExtractor = expectError(TestDomainError);
    const error = errorExtractor(result);

    expect(error).toBeInstanceOf(TestDomainError);
    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe('DOMAIN_ERROR');
  });
});

describe('expectSuccess', () => {
  it('should return value when operation succeeds', () => {
    const testValue = { id: 1, name: 'test' };
    const result: SafeRunResult<typeof testValue> = safeRun(() => testValue);

    const value = expectSuccess(result);
    expect(value).toEqual(testValue);
  });

  it('should throw when operation fails', () => {
    const result: SafeRunResult<string> = safeRun(() => {
      throw new Error('operation failed');
    });

    const [successError] = safeRun(() => expectSuccess(result));
    expect(successError?.message).toBe(
      'Expected successful operation, but got error: operation failed'
    );
  });

  it('should throw when value is undefined', () => {
    // Simulate undefined value (edge case)
    const result: SafeRunResult<string> = [undefined, undefined];

    const [undefinedError] = safeRun(() => expectSuccess(result));
    expect(undefinedError?.message).toBe('Expected successful operation, but got undefined value');
  });

  it('should handle falsy values correctly', () => {
    const falsyValues = [0, '', false, null];

    falsyValues.forEach(falsyValue => {
      const result: SafeRunResult<typeof falsyValue> = safeRun(() => falsyValue);
      const value = expectSuccess(result);
      expect(value).toBe(falsyValue);
    });
  });
});

describe('safeRunWithTimeout', () => {
  it('should return success result for fast operations', async () => {
    const result = await safeRunWithTimeout(async () => 'fast operation', 1000);
    const [error, value] = result;

    expect(error).toBeUndefined();
    expect(value).toBe('fast operation');
  });

  it('should return timeout error for slow operations', async () => {
    const result = await safeRunWithTimeout(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      return 'slow operation';
    }, 50);
    const [error, value] = result;

    expect(error).toBeInstanceOf(Error);
    expect(error?.message).toContain('Operation timed out after 50ms');
    expect(value).toBeUndefined();
  });

  it('should include context in timeout error message', async () => {
    const testContext = 'UserRepository.save';
    const result = await safeRunWithTimeout(
      async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return 'slow operation';
      },
      50,
      testContext
    );
    const [error, value] = result;

    expect(error?.message).toContain(`Operation timed out after 50ms in context: ${testContext}`);
  });

  it('should return original error when operation fails before timeout', async () => {
    const originalError = new TestDomainError('operation failed', { code: 'OPERATION_FAILED' });
    const result = await safeRunWithTimeout(async () => {
      throw originalError;
    }, 1000);
    const [error, value] = result;

    expect(error).toBe(originalError);
    expect(value).toBeUndefined();
  });

  it('should add test context to BaseError instances', async () => {
    const testContext = 'AggregateService.test';
    const result = await safeRunWithTimeout(
      async () => {
        throw new TestDomainError('async domain error', { code: 'ASYNC_DOMAIN_ERROR' });
      },
      1000,
      testContext
    );

    const [error, value] = result;
    expect(error).toBeInstanceOf(TestDomainError);
    expect((error as TestDomainError).data).toBeDefined();
    expect(((error as TestDomainError).data as { testContext?: string })?.testContext).toBe(
      testContext
    );
  });
});

describe('integration with existing testing patterns', () => {
  it('should work with vi.spyOn patterns', () => {
    const mockFn = vi.fn().mockImplementation(() => {
      throw new Error('mocked error');
    });

    const result = safeRun(() => mockFn());
    const [error, value] = result;

    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(error).toBeInstanceOf(Error);
    expect(error?.message).toBe('mocked error');
    expect(value).toBeUndefined();
  });

  it('should work with async vi.spyOn patterns', async () => {
    const mockAsyncFn = vi.fn().mockResolvedValue('mocked success');

    const result = await safeRun(async () => mockAsyncFn());
    const [error, value] = result;

    expect(mockAsyncFn).toHaveBeenCalledTimes(1);
    expect(error).toBeUndefined();
    expect(value).toBe('mocked success');
  });

  it('should integrate with existing DDD patterns', () => {
    // Simulate aggregate operation
    const aggregateOperation = () => {
      // Business logic that might throw domain errors
      const isValid = false;
      if (!isValid) {
        throw new TestDomainError('Invalid aggregate state', { code: 'INVALID_STATE' });
      }
      return { id: 1, state: 'valid' };
    };

    const result = safeRunTest(
      aggregateOperation,
      'AggregateRoot.businessOperation'
    ) as SafeRunResult<{ id: number; state: string }, TestDomainError>;
    const error = expectError(TestDomainError)(result);

    expect(error.code).toBe('INVALID_STATE');
    expect((error.data as { testContext?: string })?.testContext).toBe(
      'AggregateRoot.businessOperation'
    );
  });
});
