import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EnhancedQueryBus } from './enhanced-query-bus';
import type { IQuery, IQueryHandler } from '../interfaces';

describe('EnhancedQueryBus', () => {
  class TestQuery implements IQuery<string> {
    constructor(public readonly id: string) {}
  }

  let enhancedQueryBus: EnhancedQueryBus;
  let mockHandler: IQueryHandler<TestQuery, string>;

  beforeEach(() => {
    enhancedQueryBus = new EnhancedQueryBus();
    mockHandler = {
      execute: vi.fn().mockResolvedValue('mocked-result'),
    };
  });

  describe('constructor', () => {
    it('should create enhanced query bus without handler resolver', () => {
      const bus = new EnhancedQueryBus();
      expect(bus).toBeInstanceOf(EnhancedQueryBus);
    });

    it('should create enhanced query bus with handler resolver', () => {
      const resolver = vi.fn();
      const bus = new EnhancedQueryBus(resolver);
      expect(bus).toBeInstanceOf(EnhancedQueryBus);
    });

    it('should automatically add logging middleware', () => {
      const bus = new EnhancedQueryBus();
      expect(bus).toBeInstanceOf(EnhancedQueryBus);
      // LoggingMiddleware is added in constructor, we can't directly test it
      // but we can verify it's working through execution
    });
  });

  describe('execute with metrics', () => {
    it('should execute query and update metrics', async () => {
      const query = new TestQuery('test-id');
      enhancedQueryBus.register(TestQuery, mockHandler);

      const metricsBefore = enhancedQueryBus.getMetrics();
      expect(metricsBefore.executionCount).toBe(0);

      const result = await enhancedQueryBus.execute(query);

      expect(result).toBe('mocked-result');

      const metricsAfter = enhancedQueryBus.getMetrics();
      expect(metricsAfter.executionCount).toBe(1);
      expect(metricsAfter.totalExecutionTime).toBeGreaterThan(0);
      expect(metricsAfter.averageExecutionTime).toBeGreaterThan(0);
      expect(metricsAfter.errors).toBe(0);
    });

    it('should track multiple executions', async () => {
      const query = new TestQuery('test-id');
      enhancedQueryBus.register(TestQuery, mockHandler);

      await enhancedQueryBus.execute(query);
      await enhancedQueryBus.execute(query);
      await enhancedQueryBus.execute(query);

      const metrics = enhancedQueryBus.getMetrics();
      expect(metrics.executionCount).toBe(3);
      expect(metrics.totalExecutionTime).toBeGreaterThanOrEqual(0);
      expect(metrics.averageExecutionTime).toBeGreaterThanOrEqual(0);
      expect(metrics.errors).toBe(0);
    });

    it('should track errors in metrics', async () => {
      const query = new TestQuery('test-id');
      const errorHandler: IQueryHandler<TestQuery, string> = {
        execute: vi.fn().mockRejectedValue(new Error('Test error')),
      };

      enhancedQueryBus.register(TestQuery, errorHandler);

      await expect(enhancedQueryBus.execute(query)).rejects.toThrow('Test error');

      const metrics = enhancedQueryBus.getMetrics();
      expect(metrics.executionCount).toBe(0); // Should not increment on error
      expect(metrics.errors).toBe(1);
    });

    it('should calculate average execution time correctly', async () => {
      const query = new TestQuery('test-id');
      const slowHandler: IQueryHandler<TestQuery, string> = {
        execute: vi.fn().mockImplementation(() =>
          new Promise(resolve => setTimeout(() => resolve('slow-result'), 10))
        ),
      };

      enhancedQueryBus.register(TestQuery, slowHandler);

      await enhancedQueryBus.execute(query);
      await enhancedQueryBus.execute(query);

      const metrics = enhancedQueryBus.getMetrics();
      expect(metrics.executionCount).toBe(2);
      expect(metrics.averageExecutionTime).toBeGreaterThanOrEqual(0);
      expect(metrics.averageExecutionTime).toBe(metrics.totalExecutionTime / 2);
    });

    it('should return correct result while tracking metrics', async () => {
      const query = new TestQuery('test-id');
      const expectedResult = 'expected-result';
      const handler: IQueryHandler<TestQuery, string> = {
        execute: vi.fn().mockResolvedValue(expectedResult),
      };

      enhancedQueryBus.register(TestQuery, handler);

      const result = await enhancedQueryBus.execute(query);

      expect(result).toBe(expectedResult);

      const metrics = enhancedQueryBus.getMetrics();
      expect(metrics.executionCount).toBe(1);
    });
  });

  describe('getMetrics', () => {
    it('should return initial metrics', () => {
      const metrics = enhancedQueryBus.getMetrics();

      expect(metrics).toEqual({
        executionCount: 0,
        totalExecutionTime: 0,
        errors: 0,
        averageExecutionTime: 0,
      });
    });

    it('should return metrics after execution', async () => {
      const query = new TestQuery('test-id');
      enhancedQueryBus.register(TestQuery, mockHandler);

      await enhancedQueryBus.execute(query);

      const metrics = enhancedQueryBus.getMetrics();
      expect(metrics.executionCount).toBe(1);
      expect(metrics.totalExecutionTime).toBeGreaterThanOrEqual(0);
      expect(metrics.averageExecutionTime).toBeGreaterThanOrEqual(0);
      expect(metrics.errors).toBe(0);
    });

    it('should handle zero executions for average calculation', () => {
      const metrics = enhancedQueryBus.getMetrics();
      expect(metrics.averageExecutionTime).toBe(0);
    });
  });

  describe('resetMetrics', () => {
    it('should reset all metrics to zero', async () => {
      const query = new TestQuery('test-id');
      enhancedQueryBus.register(TestQuery, mockHandler);

      // Execute some queries to generate metrics
      await enhancedQueryBus.execute(query);
      await enhancedQueryBus.execute(query);

      const metricsBeforeReset = enhancedQueryBus.getMetrics();
      expect(metricsBeforeReset.executionCount).toBe(2);
      expect(metricsBeforeReset.totalExecutionTime).toBeGreaterThan(0);

      enhancedQueryBus.resetMetrics();

      const metricsAfterReset = enhancedQueryBus.getMetrics();
      expect(metricsAfterReset).toEqual({
        executionCount: 0,
        totalExecutionTime: 0,
        errors: 0,
        averageExecutionTime: 0,
      });
    });
  });

  describe('inheritance behavior', () => {
    it('should inherit all base QueryBus functionality', () => {
      expect(enhancedQueryBus.register).toBeDefined();
      expect(enhancedQueryBus.registerFactory).toBeDefined();
      expect(enhancedQueryBus.use).toBeDefined();
      expect(enhancedQueryBus.discoverHandlers).toBeDefined();
    });

    it('should work with middleware from base class', async () => {
      const query = new TestQuery('test-id');
      const customMiddleware = {
        handle: vi.fn().mockImplementation(async (context, next) => next()),
      };

      enhancedQueryBus.register(TestQuery, mockHandler);
      enhancedQueryBus.use(customMiddleware);

      await enhancedQueryBus.execute(query);

      expect(customMiddleware.handle).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should increment error count and rethrow error', async () => {
      const query = new TestQuery('test-id');
      const error = new Error('Test error');
      const errorHandler: IQueryHandler<TestQuery, string> = {
        execute: vi.fn().mockRejectedValue(error),
      };

      enhancedQueryBus.register(TestQuery, errorHandler);

      await expect(enhancedQueryBus.execute(query)).rejects.toThrow(error);

      const metrics = enhancedQueryBus.getMetrics();
      expect(metrics.errors).toBe(1);
      expect(metrics.executionCount).toBe(0);
    });

    it('should handle multiple errors correctly', async () => {
      const query = new TestQuery('test-id');
      const errorHandler: IQueryHandler<TestQuery, string> = {
        execute: vi.fn().mockRejectedValue(new Error('Test error')),
      };

      enhancedQueryBus.register(TestQuery, errorHandler);

      await expect(enhancedQueryBus.execute(query)).rejects.toThrow();
      await expect(enhancedQueryBus.execute(query)).rejects.toThrow();
      await expect(enhancedQueryBus.execute(query)).rejects.toThrow();

      const metrics = enhancedQueryBus.getMetrics();
      expect(metrics.errors).toBe(3);
      expect(metrics.executionCount).toBe(0);
    });
  });

  describe('mixed success and error scenarios', () => {
    it('should track both successful executions and errors separately', async () => {
      const query = new TestQuery('test-id');
      const successHandler: IQueryHandler<TestQuery, string> = {
        execute: vi.fn().mockResolvedValue('success-result'),
      };
      const errorHandler: IQueryHandler<TestQuery, string> = {
        execute: vi.fn().mockRejectedValue(new Error('Test error')),
      };

      // Register success handler and execute
      enhancedQueryBus.register(TestQuery, successHandler);
      await enhancedQueryBus.execute(query);
      await enhancedQueryBus.execute(query);

      // Switch to error handler
      enhancedQueryBus.register(TestQuery, errorHandler);
      await expect(enhancedQueryBus.execute(query)).rejects.toThrow();

      const metrics = enhancedQueryBus.getMetrics();
      expect(metrics.executionCount).toBe(2);
      expect(metrics.errors).toBe(1);
      expect(metrics.totalExecutionTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('type safety', () => {
    it('should maintain type safety for query results', async () => {
      class NumberQuery implements IQuery<number> {
        constructor(public readonly value: number) {}
      }

      const numberHandler: IQueryHandler<NumberQuery, number> = {
        execute: vi.fn().mockResolvedValue(42),
      };

      enhancedQueryBus.register(NumberQuery, numberHandler);

      const result = await enhancedQueryBus.execute(new NumberQuery(1));

      // TypeScript should infer this as number
      expect(typeof result).toBe('number');
      expect(result).toBe(42);
    });
  });
});
