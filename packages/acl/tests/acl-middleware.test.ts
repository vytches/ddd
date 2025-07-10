/* eslint-disable @typescript-eslint/no-inferrable-types */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Result } from '@vytches-ddd/utils';
import { ACLError, BaseACLMiddleware } from '../src';
import type { ACLMiddleware, ExecuteOptions } from '../src';

// Test domain model
interface TestDomainModel {
  id: string;
  name: string;
  amount: number;
}

// Concrete middleware implementations for testing
class LoggingMiddleware extends BaseACLMiddleware {
  public executionLog: Array<{ operation: string; phase: 'before' | 'after' }> = [];

  async execute<T>(
    operation: string,
    _domainModel: any,
    _options: ExecuteOptions,
    next: () => Promise<Result<T, ACLError>>
  ): Promise<Result<T, ACLError>> {
    this.executionLog.push({ operation, phase: 'before' });

    try {
      const result = await next();
      this.executionLog.push({ operation, phase: 'after' });
      return result;
    } catch (error) {
      this.executionLog.push({ operation, phase: 'after' });
      throw error;
    }
  }
}

class ValidationMiddleware extends BaseACLMiddleware {
  constructor(private validOperations: string[] = []) {
    super();
  }

  async execute<T>(
    operation: string,
    _domainModel: any,
    _options: ExecuteOptions,
    next: () => Promise<Result<T, ACLError>>
  ): Promise<Result<T, ACLError>> {
    if (this.validOperations.length > 0 && !this.validOperations.includes(operation)) {
      return Result.fail(ACLError.unsupportedOperation('ValidationMiddleware', operation));
    }

    return await next();
  }
}

class TimingMiddleware extends BaseACLMiddleware {
  public lastExecutionTime: number = 0;

  async execute<T>(
    _operation: string,
    _domainModel: any,
    _options: ExecuteOptions,
    next: () => Promise<Result<T, ACLError>>
  ): Promise<Result<T, ACLError>> {
    const startTime = Date.now();

    try {
      const result = await next();
      this.lastExecutionTime = Date.now() - startTime;
      return result;
    } catch (error) {
      this.lastExecutionTime = Date.now() - startTime;
      throw error;
    }
  }
}

class ErrorHandlingMiddleware extends BaseACLMiddleware {
  constructor(private shouldCatchErrors: boolean = true) {
    super();
  }

  async execute<T>(
    operation: string,
    _domainModel: any,
    _options: ExecuteOptions,
    next: () => Promise<Result<T, ACLError>>
  ): Promise<Result<T, ACLError>> {
    try {
      return await next();
    } catch (error) {
      if (this.shouldCatchErrors) {
        return Result.fail(
          ACLError.operationFailed('ErrorHandlingMiddleware', operation, error as Error)
        );
      }
      throw error;
    }
  }
}

class TransformingMiddleware extends BaseACLMiddleware {
  constructor(private transformation: (result: any) => any) {
    super();
  }

  async execute<T>(
    _operation: string,
    _domainModel: any,
    _options: ExecuteOptions,
    next: () => Promise<Result<T, ACLError>>
  ): Promise<Result<T, ACLError>> {
    const result = await next();

    if (result.isSuccess) {
      const transformedValue = this.transformation(result.value);
      return Result.ok(transformedValue);
    }

    return result;
  }
}

class ConditionalMiddleware extends BaseACLMiddleware {
  constructor(
    private condition: (operation: string, domainModel: any) => boolean,
    private onConditionMet: () => Promise<Result<any, ACLError>>
  ) {
    super();
  }

  async execute<T>(
    operation: string,
    domainModel: any,
    _options: ExecuteOptions,
    next: () => Promise<Result<T, ACLError>>
  ): Promise<Result<T, ACLError>> {
    if (this.condition(operation, domainModel)) {
      return (await this.onConditionMet()) as Result<T, ACLError>;
    }

    return await next();
  }
}

describe('BaseACLMiddleware', () => {
  describe('abstract class behavior', () => {
    it('should be abstract and require implementation of execute method', () => {
      // This test verifies the abstract nature through concrete implementations
      const loggingMiddleware = new LoggingMiddleware();
      expect(loggingMiddleware).toBeInstanceOf(BaseACLMiddleware);
      expect(typeof loggingMiddleware.execute).toBe('function');
    });

    it('should implement ACLMiddleware interface', () => {
      const middleware: ACLMiddleware = new LoggingMiddleware();
      expect(typeof middleware.execute).toBe('function');
    });
  });
});

describe('Concrete Middleware Implementations', () => {
  let mockNext: () => Promise<Result<any, ACLError>>;
  let testDomainModel: TestDomainModel;
  let testOptions: ExecuteOptions;

  beforeEach(() => {
    testDomainModel = {
      id: 'test-123',
      name: 'Test Item',
      amount: 100,
    };

    testOptions = {
      timeout: 5000,
      correlationId: 'corr-123',
    };

    mockNext = vi.fn().mockResolvedValue(Result.ok({ success: true, data: 'test-data' }));
  });

  describe('LoggingMiddleware', () => {
    let middleware: LoggingMiddleware;

    beforeEach(() => {
      middleware = new LoggingMiddleware();
    });

    it('should log operation execution phases', async () => {
      await middleware.execute('CREATE', testDomainModel, testOptions, mockNext);

      expect(middleware.executionLog).toEqual([
        { operation: 'CREATE', phase: 'before' },
        { operation: 'CREATE', phase: 'after' },
      ]);
    });

    it('should call next and return its result', async () => {
      const result = await middleware.execute('CREATE', testDomainModel, testOptions, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(result.isSuccess).toBe(true);
      expect(result.value).toEqual({ success: true, data: 'test-data' });
    });

    it('should log even when next throws an error', async () => {
      const errorNext = vi.fn().mockRejectedValue(new Error('Test error'));

      await expect(
        middleware.execute('CREATE', testDomainModel, testOptions, errorNext)
      ).rejects.toThrow('Test error');

      expect(middleware.executionLog).toEqual([
        { operation: 'CREATE', phase: 'before' },
        { operation: 'CREATE', phase: 'after' },
      ]);
    });

    it('should track multiple operations', async () => {
      await middleware.execute('CREATE', testDomainModel, testOptions, mockNext);
      await middleware.execute('UPDATE', testDomainModel, testOptions, mockNext);

      expect(middleware.executionLog).toEqual([
        { operation: 'CREATE', phase: 'before' },
        { operation: 'CREATE', phase: 'after' },
        { operation: 'UPDATE', phase: 'before' },
        { operation: 'UPDATE', phase: 'after' },
      ]);
    });
  });

  describe('ValidationMiddleware', () => {
    it('should allow all operations when no restrictions set', async () => {
      const middleware = new ValidationMiddleware();

      const result = await middleware.execute(
        'ANY_OPERATION',
        testDomainModel,
        testOptions,
        mockNext
      );

      expect(result.isSuccess).toBe(true);
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should allow valid operations', async () => {
      const middleware = new ValidationMiddleware(['CREATE', 'UPDATE']);

      const createResult = await middleware.execute(
        'CREATE',
        testDomainModel,
        testOptions,
        mockNext
      );
      const updateResult = await middleware.execute(
        'UPDATE',
        testDomainModel,
        testOptions,
        mockNext
      );

      expect(createResult.isSuccess).toBe(true);
      expect(updateResult.isSuccess).toBe(true);
      expect(mockNext).toHaveBeenCalledTimes(2);
    });

    it('should reject invalid operations', async () => {
      const middleware = new ValidationMiddleware(['CREATE', 'UPDATE']);

      const result = await middleware.execute('DELETE', testDomainModel, testOptions, mockNext);

      expect(result.isFailure).toBe(true);
      expect(result.error).toBeInstanceOf(ACLError);
      expect(result.error.message).toContain("Operation 'DELETE' is not supported");
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle empty valid operations list', async () => {
      const middleware = new ValidationMiddleware([]);

      const result = await middleware.execute('CREATE', testDomainModel, testOptions, mockNext);

      expect(result.isSuccess).toBe(true);
      expect(mockNext).toHaveBeenCalledTimes(1);
    });
  });

  describe('TimingMiddleware', () => {
    let middleware: TimingMiddleware;

    beforeEach(() => {
      middleware = new TimingMiddleware();
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should measure execution time', async () => {
      const slowNext = vi.fn().mockImplementation(async () => {
        vi.advanceTimersByTime(100);
        return Result.ok({ data: 'test' });
      });

      await middleware.execute('CREATE', testDomainModel, testOptions, slowNext);

      expect(middleware.lastExecutionTime).toBe(100);
    });

    it('should measure time even when operation fails', async () => {
      const failingNext = vi.fn().mockImplementation(async () => {
        vi.advanceTimersByTime(50);
        throw new Error('Operation failed');
      });

      await expect(
        middleware.execute('CREATE', testDomainModel, testOptions, failingNext)
      ).rejects.toThrow('Operation failed');

      expect(middleware.lastExecutionTime).toBe(50);
    });

    it('should update timing for each execution', async () => {
      const firstNext = vi.fn().mockImplementation(async () => {
        vi.advanceTimersByTime(30);
        return Result.ok({ data: 'first' });
      });

      const secondNext = vi.fn().mockImplementation(async () => {
        vi.advanceTimersByTime(70);
        return Result.ok({ data: 'second' });
      });

      await middleware.execute('CREATE', testDomainModel, testOptions, firstNext);
      expect(middleware.lastExecutionTime).toBe(30);

      await middleware.execute('UPDATE', testDomainModel, testOptions, secondNext);
      expect(middleware.lastExecutionTime).toBe(70);
    });
  });

  describe('ErrorHandlingMiddleware', () => {
    it('should catch and convert errors to ACLError by default', async () => {
      const middleware = new ErrorHandlingMiddleware();
      const errorNext = vi.fn().mockRejectedValue(new Error('Network timeout'));

      const result = await middleware.execute('CREATE', testDomainModel, testOptions, errorNext);

      expect(result.isFailure).toBe(true);
      expect(result.error).toBeInstanceOf(ACLError);
      expect(result.error.message).toContain("Operation 'CREATE' failed");
      expect(result.error.contextName).toBe('ErrorHandlingMiddleware');
    });

    it('should pass through successful results', async () => {
      const middleware = new ErrorHandlingMiddleware();

      const result = await middleware.execute('CREATE', testDomainModel, testOptions, mockNext);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toEqual({ success: true, data: 'test-data' });
    });

    it('should rethrow errors when configured not to catch', async () => {
      const middleware = new ErrorHandlingMiddleware(false);
      const errorNext = vi.fn().mockRejectedValue(new Error('Network timeout'));

      await expect(
        middleware.execute('CREATE', testDomainModel, testOptions, errorNext)
      ).rejects.toThrow('Network timeout');
    });

    it('should handle different error types', async () => {
      const middleware = new ErrorHandlingMiddleware();
      const customError = new TypeError('Invalid type');
      const errorNext = vi.fn().mockRejectedValue(customError);

      const result = await middleware.execute('CREATE', testDomainModel, testOptions, errorNext);

      expect(result.isFailure).toBe(true);
      expect(result.error.message).toContain('Invalid type');
    });
  });

  describe('TransformingMiddleware', () => {
    it('should transform successful results', async () => {
      const transform = (result: any) => ({ ...result, transformed: true });
      const middleware = new TransformingMiddleware(transform);

      const result = await middleware.execute('CREATE', testDomainModel, testOptions, mockNext);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toEqual({
        success: true,
        data: 'test-data',
        transformed: true,
      });
    });

    it('should not transform failed results', async () => {
      const transform = (result: any) => ({ ...result, transformed: true });
      const middleware = new TransformingMiddleware(transform);
      const failingNext = vi
        .fn()
        .mockResolvedValue(
          Result.fail(ACLError.operationFailed('TestContext', 'CREATE', new Error('Test error')))
        );

      const result = await middleware.execute('CREATE', testDomainModel, testOptions, failingNext);

      expect(result.isFailure).toBe(true);
      expect(result.error).toBeInstanceOf(ACLError);
      // Should not have transformation applied
      expect((result.error as any).transformed).toBeUndefined();
    });

    it('should handle complex transformations', async () => {
      const transform = (result: any) => ({
        original: result,
        timestamp: '2023-01-01',
        processedBy: 'TransformingMiddleware',
      });
      const middleware = new TransformingMiddleware(transform);

      const result = await middleware.execute('CREATE', testDomainModel, testOptions, mockNext);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toEqual({
        original: { success: true, data: 'test-data' },
        timestamp: '2023-01-01',
        processedBy: 'TransformingMiddleware',
      });
    });
  });

  describe('ConditionalMiddleware', () => {
    it('should call next when condition is not met', async () => {
      const condition = (operation: string) => operation === 'SPECIAL_OP';
      const onConditionMet = vi.fn().mockResolvedValue(Result.ok({ special: true }));
      const middleware = new ConditionalMiddleware(condition, onConditionMet);

      const result = await middleware.execute('CREATE', testDomainModel, testOptions, mockNext);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toEqual({ success: true, data: 'test-data' });
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(onConditionMet).not.toHaveBeenCalled();
    });

    it('should execute condition handler when condition is met', async () => {
      const condition = (operation: string) => operation === 'SPECIAL_OP';
      const onConditionMet = vi.fn().mockResolvedValue(Result.ok({ special: true }));
      const middleware = new ConditionalMiddleware(condition, onConditionMet);

      const result = await middleware.execute('SPECIAL_OP', testDomainModel, testOptions, mockNext);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toEqual({ special: true });
      expect(mockNext).not.toHaveBeenCalled();
      expect(onConditionMet).toHaveBeenCalledTimes(1);
    });

    it('should pass domain model to condition function', async () => {
      const condition = vi.fn().mockReturnValue(false);
      const onConditionMet = vi.fn().mockResolvedValue(Result.ok({}));
      const middleware = new ConditionalMiddleware(condition, onConditionMet);

      await middleware.execute('CREATE', testDomainModel, testOptions, mockNext);

      expect(condition).toHaveBeenCalledWith('CREATE', testDomainModel);
    });

    it('should handle conditional failures', async () => {
      const condition = (operation: string) => operation === 'FAILING_OP';
      const onConditionMet = vi
        .fn()
        .mockResolvedValue(
          Result.fail(
            ACLError.operationFailed(
              'ConditionalMiddleware',
              'FAILING_OP',
              new Error('Condition failed')
            )
          )
        );
      const middleware = new ConditionalMiddleware(condition, onConditionMet);

      const result = await middleware.execute('FAILING_OP', testDomainModel, testOptions, mockNext);

      expect(result.isFailure).toBe(true);
      expect(result.error).toBeInstanceOf(ACLError);
      expect(result.error.message).toContain('Condition failed');
    });
  });

  describe('Middleware Chain Simulation', () => {
    it('should support multiple middleware in sequence', async () => {
      const loggingMiddleware = new LoggingMiddleware();
      const timingMiddleware = new TimingMiddleware();
      const validationMiddleware = new ValidationMiddleware(['CREATE']);

      vi.useFakeTimers();

      // Simulate middleware chain: logging -> timing -> validation -> next
      const chainedNext = async () => {
        return await validationMiddleware.execute(
          'CREATE',
          testDomainModel,
          testOptions,
          async () => {
            vi.advanceTimersByTime(25);
            return await mockNext();
          }
        );
      };

      const timedNext = async () => {
        return await timingMiddleware.execute('CREATE', testDomainModel, testOptions, chainedNext);
      };

      const result = await loggingMiddleware.execute(
        'CREATE',
        testDomainModel,
        testOptions,
        timedNext
      );

      expect(result.isSuccess).toBe(true);
      expect(loggingMiddleware.executionLog).toEqual([
        { operation: 'CREATE', phase: 'before' },
        { operation: 'CREATE', phase: 'after' },
      ]);
      expect(timingMiddleware.lastExecutionTime).toBe(25);

      vi.useRealTimers();
    });

    it('should short-circuit on middleware failure', async () => {
      const loggingMiddleware = new LoggingMiddleware();
      const validationMiddleware = new ValidationMiddleware(['UPDATE']); // Will reject 'CREATE'
      const timingMiddleware = new TimingMiddleware();

      // Chain: logging -> validation (fails) -> timing (should not execute)
      const chainedNext = async () => {
        return await timingMiddleware.execute('CREATE', testDomainModel, testOptions, mockNext);
      };

      const validationNext = async () => {
        return await validationMiddleware.execute(
          'CREATE',
          testDomainModel,
          testOptions,
          chainedNext
        );
      };

      const result = await loggingMiddleware.execute(
        'CREATE',
        testDomainModel,
        testOptions,
        validationNext
      );

      expect(result.isFailure).toBe(true);
      expect(loggingMiddleware.executionLog).toEqual([
        { operation: 'CREATE', phase: 'before' },
        { operation: 'CREATE', phase: 'after' },
      ]);
      expect(timingMiddleware.lastExecutionTime).toBe(0); // Should not have been called
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});
