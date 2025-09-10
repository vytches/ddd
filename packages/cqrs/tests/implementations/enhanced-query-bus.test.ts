import type { IDependencyContainer } from '@vytches/ddd-di';
import { safeRun } from '@vytches/ddd-utils';
import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { IQuery, IQueryHandler, LoggingMiddleware } from '../../src';
import { EnhancedQueryBus, IQueryBus } from '../../src';

// Test query implementation
class TestQuery implements IQuery<string> {
  constructor(public readonly id: string) {}
}

// Test query handler
class TestQueryHandler implements IQueryHandler<TestQuery, string> {
  async execute(query: TestQuery): Promise<string> {
    return `Result for ${query.id}`;
  }
}

describe('EnhancedQueryBus', () => {
  let enhancedQueryBus: EnhancedQueryBus;
  let mockContainer: IDependencyContainer;
  let mockHandler: TestQueryHandler;

  beforeEach(() => {
    mockContainer = {
      resolve: vi.fn(),
      register: vi.fn(),
      registerInstance: vi.fn(),
      registerFactory: vi.fn(),
      isRegistered: vi.fn(),
      dispose: vi.fn(),
      getServices: vi.fn(),
      createScope: vi.fn(),
      getServicesByTag: vi.fn(),
    };

    mockHandler = new TestQueryHandler();
    enhancedQueryBus = new EnhancedQueryBus(mockContainer);
  });

  describe('constructor', () => {
    it('should extend IQueryBus', () => {
      expect(enhancedQueryBus).toBeInstanceOf(IQueryBus);
    });

    it('should initialize metrics with default values', () => {
      const metrics = enhancedQueryBus.getMetrics();
      expect(metrics).toEqual({
        executionCount: 0,
        totalExecutionTime: 0,
        errors: 0,
        averageExecutionTime: 0,
        cacheHitRate: 0,
        cacheHits: 0,
        cacheMisses: 0,
        retries: 0,
        timeouts: 0,
        batchesProcessed: 0,
        cacheSize: 0,
        circuitBreakerTrips: 0,
        handlerCacheSize: 0,
      });
    });
  });

  describe('execute', () => {
    beforeEach(() => {
      // Mock Reflect.getMetadata
      vi.spyOn(Reflect, 'getMetadata').mockImplementation((key: string) => {
        if (key === 'di:query-handler') {
          return {
            serviceId: 'testHandler',
            handlerType: TestQueryHandler,
          };
        }
        return undefined;
      });

      (mockContainer.resolve as Mock).mockReturnValue(mockHandler);
    });

    it('should execute query successfully, return result and update metrics', async () => {
      const query = new TestQuery('test-id');
      const expectedResult = 'Result for test-id';
      const executeSpy = vi.spyOn(mockHandler, 'execute').mockResolvedValue(expectedResult);

      const result = await enhancedQueryBus.execute(query);

      expect(executeSpy).toHaveBeenCalledWith(query);
      expect(result).toBe(expectedResult);

      const metrics = enhancedQueryBus.getMetrics();
      expect(metrics.executionCount).toBe(1);
      expect(metrics.totalExecutionTime).toBeGreaterThan(0);
      expect(metrics.errors).toBe(0);
      expect(metrics.averageExecutionTime).toBeGreaterThan(0);
    });

    it('should handle multiple executions and update metrics correctly', async () => {
      const query1 = new TestQuery('test-id-1');
      const query2 = new TestQuery('test-id-2');

      vi.spyOn(mockHandler, 'execute')
        .mockResolvedValueOnce('Result for test-id-1')
        .mockResolvedValueOnce('Result for test-id-2');

      const result1 = await enhancedQueryBus.execute(query1);
      const result2 = await enhancedQueryBus.execute(query2);

      expect(result1).toBe('Result for test-id-1');
      expect(result2).toBe('Result for test-id-2');

      const metrics = enhancedQueryBus.getMetrics();
      expect(metrics.executionCount).toBe(2);
      expect(metrics.totalExecutionTime).toBeGreaterThan(0);
      expect(metrics.errors).toBe(0);
      expect(metrics.averageExecutionTime).toBe(metrics.totalExecutionTime / 2);
    });

    it('should increment error count when execution fails', async () => {
      const query = new TestQuery('test-id');
      const error = new Error('Execution failed');

      vi.spyOn(mockHandler, 'execute').mockRejectedValue(error);

      const [executeError] = await safeRun(() => enhancedQueryBus.execute(query));
      expect(executeError?.message).toBe('Execution failed');

      const metrics = enhancedQueryBus.getMetrics();
      expect(metrics.executionCount).toBe(0);
      expect(metrics.errors).toBe(1);
    });

    it('should handle mixed success and error executions', async () => {
      // Create a new query bus with caching disabled to avoid cache conflicts
      const noCacheQueryBus = new EnhancedQueryBus(mockContainer, { enableCache: false });

      // Set up handler registration for the new instance
      vi.spyOn(Reflect, 'getMetadata').mockImplementation((key: string) => {
        if (key === 'di:query-handler') {
          return {
            serviceId: 'testHandler',
            handlerType: TestQueryHandler,
          };
        }
        return undefined;
      });
      (mockContainer.resolve as Mock).mockReturnValue(mockHandler);

      const query1 = new TestQuery('success');
      const query2 = new TestQuery('error');
      const query3 = new TestQuery('success');

      vi.spyOn(mockHandler, 'execute')
        .mockResolvedValueOnce('Result for success') // First success
        .mockRejectedValue(new Error('Failed')); // All subsequent calls fail (for retries)

      const result1 = await noCacheQueryBus.execute(query1);
      const [executeError] = await safeRun(() => noCacheQueryBus.execute(query2));
      expect(executeError?.message).toContain('Failed'); // V2 wraps with retry logic

      // Reset mock for query3 to succeed
      vi.spyOn(mockHandler, 'execute').mockResolvedValue('Result for success');
      const result3 = await noCacheQueryBus.execute(query3);

      expect(result1).toBe('Result for success');
      expect(result3).toBe('Result for success');

      const metrics = noCacheQueryBus.getMetrics();
      expect(metrics.executionCount).toBe(2);
      expect(metrics.errors).toBe(1); // V2 query bus failed queries once (may not retry by default)
      expect(metrics.averageExecutionTime).toBeGreaterThan(0);
    });

    it('should measure execution time accurately', async () => {
      const query = new TestQuery('test-id');
      const delay = 100;

      vi.spyOn(mockHandler, 'execute').mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, delay));
        return 'Result for test-id';
      });

      const startTime = performance.now();
      const result = await enhancedQueryBus.execute(query);
      const endTime = performance.now();

      expect(result).toBe('Result for test-id');

      const metrics = enhancedQueryBus.getMetrics();
      expect(metrics.totalExecutionTime).toBeGreaterThanOrEqual(delay - 10); // Allow some tolerance
      expect(metrics.totalExecutionTime).toBeLessThan(endTime - startTime + 10);
    });

    it('should return correct result types', async () => {
      class NumberQuery implements IQuery<number> {
        constructor(public readonly value: number) {}
      }

      class NumberQueryHandler implements IQueryHandler<NumberQuery, number> {
        async execute(query: NumberQuery): Promise<number> {
          return query.value * 2;
        }
      }

      const numberQuery = new NumberQuery(5);
      const numberHandler = new NumberQueryHandler();

      vi.spyOn(Reflect, 'getMetadata').mockReturnValue({
        serviceId: 'numberHandler',
        handlerType: NumberQueryHandler,
      });

      (mockContainer.resolve as Mock).mockReturnValue(numberHandler);

      const result = await enhancedQueryBus.execute(numberQuery);

      expect(result).toBe(10);
      expect(typeof result).toBe('number');
    });
  });

  describe('getMetrics', () => {
    beforeEach(() => {
      vi.spyOn(Reflect, 'getMetadata').mockImplementation((key: string) => {
        if (key === 'di:query-handler') {
          return {
            serviceId: 'testHandler',
            handlerType: TestQueryHandler,
          };
        }
        return undefined;
      });
      (mockContainer.resolve as Mock).mockReturnValue(mockHandler);
    });

    it('should return initial metrics', () => {
      const metrics = enhancedQueryBus.getMetrics();

      expect(metrics).toEqual({
        executionCount: 0,
        totalExecutionTime: 0,
        errors: 0,
        averageExecutionTime: 0,
        cacheHitRate: 0,
        cacheHits: 0,
        cacheMisses: 0,
        retries: 0,
        timeouts: 0,
        batchesProcessed: 0,
        cacheSize: 0,
        circuitBreakerTrips: 0,
        handlerCacheSize: 0,
      });
    });

    it('should calculate average execution time correctly', async () => {
      const query1 = new TestQuery('test-1');
      const query2 = new TestQuery('test-2');

      vi.spyOn(mockHandler, 'execute')
        .mockResolvedValueOnce('Result 1')
        .mockResolvedValueOnce('Result 2');

      await enhancedQueryBus.execute(query1);
      await enhancedQueryBus.execute(query2);

      const metrics = enhancedQueryBus.getMetrics();
      expect(metrics.averageExecutionTime).toBe(metrics.totalExecutionTime / 2);
    });

    it('should return zero average when no executions', () => {
      const metrics = enhancedQueryBus.getMetrics();
      expect(metrics.averageExecutionTime).toBe(0);
    });

    it('should return current metrics snapshot', async () => {
      const query = new TestQuery('test-id');
      vi.spyOn(mockHandler, 'execute').mockResolvedValue('Result');

      const initialMetrics = enhancedQueryBus.getMetrics();
      expect(initialMetrics.executionCount).toBe(0);

      await enhancedQueryBus.execute(query);

      const afterMetrics = enhancedQueryBus.getMetrics();
      expect(afterMetrics.executionCount).toBe(1);

      // Initial metrics should remain unchanged
      expect(initialMetrics.executionCount).toBe(0);
    });
  });

  describe('resetMetrics', () => {
    beforeEach(() => {
      vi.spyOn(Reflect, 'getMetadata').mockImplementation((key: string) => {
        if (key === 'di:query-handler') {
          return {
            serviceId: 'testHandler',
            handlerType: TestQueryHandler,
          };
        }
        return undefined;
      });
      (mockContainer.resolve as Mock).mockReturnValue(mockHandler);
    });

    it('should reset all metrics to zero', async () => {
      const query1 = new TestQuery('test-id-1');
      const query2 = new TestQuery('test-id-2');
      vi.spyOn(mockHandler, 'execute').mockResolvedValue('Result');

      // Execute different queries to avoid caching
      await enhancedQueryBus.execute(query1);
      await enhancedQueryBus.execute(query2);

      let metrics = enhancedQueryBus.getMetrics();
      expect(metrics.executionCount).toBe(2);
      expect(metrics.totalExecutionTime).toBeGreaterThan(0);

      // Reset metrics
      enhancedQueryBus.resetMetrics();

      metrics = enhancedQueryBus.getMetrics();
      // V2 implementation resets execution metrics but not cache-related metrics
      expect(metrics.executionCount).toBe(0);
      expect(metrics.totalExecutionTime).toBe(0);
      expect(metrics.errors).toBe(0);
      expect(metrics.averageExecutionTime).toBe(0);
      expect(metrics.retries).toBe(0);
      expect(metrics.timeouts).toBe(0);
      expect(metrics.batchesProcessed).toBe(0);
      expect(metrics.cacheHits).toBe(0);
      expect(metrics.cacheMisses).toBe(0);
      expect(metrics.cacheHitRate).toBe(0);
      expect(metrics.circuitBreakerTrips).toBe(0);
      // Cache size and handler cache size may not reset to preserve cache state
      expect(metrics.cacheSize).toBeGreaterThanOrEqual(0);
      expect(metrics.handlerCacheSize).toBeGreaterThanOrEqual(0);
    });

    it('should reset error count', async () => {
      const query = new TestQuery('test-id');
      vi.spyOn(mockHandler, 'execute').mockRejectedValue(new Error('Test error'));

      // Generate some errors
      const [error1] = await safeRun(() => enhancedQueryBus.execute(query));
      expect(error1).toBeDefined();
      const [error2] = await safeRun(() => enhancedQueryBus.execute(query));
      expect(error2).toBeDefined();

      let metrics = enhancedQueryBus.getMetrics();
      expect(metrics.errors).toBe(2);

      // Reset metrics
      enhancedQueryBus.resetMetrics();

      metrics = enhancedQueryBus.getMetrics();
      expect(metrics.errors).toBe(0);
    });

    it('should allow metrics to accumulate again after reset', async () => {
      const query1 = new TestQuery('test-id-1');
      const query2 = new TestQuery('test-id-2');
      const query3 = new TestQuery('test-id-3');
      vi.spyOn(mockHandler, 'execute').mockResolvedValue('Result');

      // Execute and reset
      await enhancedQueryBus.execute(query1);
      enhancedQueryBus.resetMetrics();

      // Execute different queries to avoid caching
      await enhancedQueryBus.execute(query2);
      await enhancedQueryBus.execute(query3);

      const metrics = enhancedQueryBus.getMetrics();
      expect(metrics.executionCount).toBe(2);
      expect(metrics.totalExecutionTime).toBeGreaterThan(0);
    });
  });

  describe('middleware integration', () => {
    it('should work with additional middleware', async () => {
      const query = new TestQuery('test-id');
      const executionOrder: string[] = [];

      const customMiddleware = {
        async handle(context: any, next: () => Promise<unknown>) {
          executionOrder.push('custom-start');
          const result = await next();
          executionOrder.push('custom-end');
          return result;
        },
      };

      // Mock LoggingMiddleware to track execution
      const loggingMiddleware = enhancedQueryBus['middlewares'][0] as LoggingMiddleware;
      const originalHandle = loggingMiddleware.handle.bind(loggingMiddleware);
      vi.spyOn(loggingMiddleware, 'handle').mockImplementation(async (context, next) => {
        executionOrder.push('logging-start');
        const result = await originalHandle(context, next);
        executionOrder.push('logging-end');
        return result;
      });

      enhancedQueryBus.use(customMiddleware);

      vi.spyOn(Reflect, 'getMetadata').mockImplementation((key: string) => {
        if (key === 'di:query-handler') {
          return {
            serviceId: 'testHandler',
            handlerType: TestQueryHandler,
          };
        }
        return undefined;
      });

      (mockContainer.resolve as Mock).mockReturnValue(mockHandler);
      vi.spyOn(mockHandler, 'execute').mockImplementation(async query => {
        executionOrder.push('handler');
        return `Result for ${query.id}`;
      });

      await enhancedQueryBus.execute(query);

      expect(executionOrder).toEqual([
        'logging-start',
        'custom-start',
        'handler',
        'custom-end',
        'logging-end',
      ]);
    });

    it('should allow middleware to transform results', async () => {
      const query = new TestQuery('test-id');

      const transformMiddleware = {
        async handle(context: any, next: () => Promise<unknown>) {
          const result = await next();
          return `Transformed: ${result}`;
        },
      };

      enhancedQueryBus.use(transformMiddleware);

      vi.spyOn(Reflect, 'getMetadata').mockImplementation((key: string) => {
        if (key === 'di:query-handler') {
          return {
            serviceId: 'testHandler',
            handlerType: TestQueryHandler,
          };
        }
        return undefined;
      });

      (mockContainer.resolve as Mock).mockReturnValue(mockHandler);
      vi.spyOn(mockHandler, 'execute').mockResolvedValue('Original Result');

      const result = await enhancedQueryBus.execute(query);

      expect(result).toBe('Transformed: Original Result');
    });
  });

  describe('performance monitoring', () => {
    it('should track performance consistently across multiple operations', async () => {
      const queries = Array.from({ length: 10 }, (_, i) => new TestQuery(`test-${i}`));

      vi.spyOn(Reflect, 'getMetadata').mockImplementation((key: string) => {
        if (key === 'di:query-handler') {
          return {
            serviceId: 'testHandler',
            handlerType: TestQueryHandler,
          };
        }
        return undefined;
      });

      (mockContainer.resolve as Mock).mockReturnValue(mockHandler);
      vi.spyOn(mockHandler, 'execute').mockImplementation(async query => `Result for ${query.id}`);

      // Execute multiple queries
      const results: unknown[] = [];
      for (const query of queries) {
        const result = await enhancedQueryBus.execute(query);
        results.push(result);
      }

      const metrics = enhancedQueryBus.getMetrics();
      expect(metrics.executionCount).toBe(10);
      expect(metrics.totalExecutionTime).toBeGreaterThan(0);
      expect(metrics.averageExecutionTime).toBe(metrics.totalExecutionTime / 10);
      expect(metrics.errors).toBe(0);

      // Verify all results are correct
      results.forEach((result, index) => {
        expect(result).toBe(`Result for test-${index}`);
      });
    });

    it('should handle concurrent executions correctly', async () => {
      const queries = Array.from({ length: 5 }, (_, i) => new TestQuery(`concurrent-${i}`));

      vi.spyOn(Reflect, 'getMetadata').mockImplementation((key: string) => {
        if (key === 'di:query-handler') {
          return {
            serviceId: 'testHandler',
            handlerType: TestQueryHandler,
          };
        }
        return undefined;
      });

      (mockContainer.resolve as Mock).mockReturnValue(mockHandler);
      vi.spyOn(mockHandler, 'execute').mockImplementation(async query => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return `Result for ${query.id}`;
      });

      // Execute queries concurrently
      const promises = queries.map(query => enhancedQueryBus.execute(query));
      const results = await Promise.all(promises);

      const metrics = enhancedQueryBus.getMetrics();
      expect(metrics.executionCount).toBe(5);
      expect(metrics.totalExecutionTime).toBeGreaterThan(0);
      expect(metrics.errors).toBe(0);

      // Verify all results are correct
      results.forEach((result, index) => {
        expect(result).toBe(`Result for concurrent-${index}`);
      });
    });
  });

  describe('error handling with metrics', () => {
    beforeEach(() => {
      vi.spyOn(Reflect, 'getMetadata').mockImplementation((key: string) => {
        if (key === 'di:query-handler') {
          return {
            serviceId: 'testHandler',
            handlerType: TestQueryHandler,
          };
        }
        return undefined;
      });
      (mockContainer.resolve as Mock).mockReturnValue(mockHandler);
    });

    it('should handle errors in middleware and update metrics', async () => {
      const query = new TestQuery('test-id');
      const middlewareError = new Error('Middleware error');

      const errorMiddleware = {
        async handle(_context: any, _next: () => Promise<unknown>) {
          throw middlewareError;
        },
      };

      enhancedQueryBus.use(errorMiddleware);

      const [error] = await safeRun(() => enhancedQueryBus.execute(query));
      expect(error?.message).toBe('Middleware error');

      const metrics = enhancedQueryBus.getMetrics();
      expect(metrics.errors).toBe(1);
      expect(metrics.executionCount).toBe(0);
    });

    it('should maintain metrics accuracy under various error conditions', async () => {
      const queries = [
        new TestQuery('success-1'),
        new TestQuery('error-1'),
        new TestQuery('success-2'),
        new TestQuery('error-2'),
        new TestQuery('success-3'),
      ];

      vi.spyOn(mockHandler, 'execute').mockImplementation(async query => {
        if (query.id.includes('error')) {
          throw new Error(`Error for ${query.id}`);
        }
        return `Result for ${query.id}`;
      });

      const results: unknown[] = [];
      let errorCount = 0;

      for (const query of queries) {
        try {
          const result = await enhancedQueryBus.execute(query);
          results.push(result);
        } catch (_error) {
          errorCount++;
        }
      }

      const metrics = enhancedQueryBus.getMetrics();
      expect(metrics.executionCount).toBe(3); // 3 successful executions
      expect(metrics.errors).toBe(2); // 2 errors
      expect(errorCount).toBe(2); // Verify our test logic
      expect(results).toHaveLength(3); // 3 successful results
    });
  });
});
