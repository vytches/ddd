import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EnhancedCommandBus } from './enhanced-command-bus';
import type { ICommand, ICommandHandler } from '../interfaces';
import { LoggingMiddleware } from '../middleware';

describe('EnhancedCommandBus', () => {
  class TestCommand implements ICommand {
    constructor(public readonly data: string) {}
  }

  class TestCommandHandler implements ICommandHandler<TestCommand> {
    async execute(_command: TestCommand): Promise<void> {
      // Mock implementation
    }
  }

  let enhancedCommandBus: EnhancedCommandBus;
  let mockHandler: ICommandHandler<TestCommand>;

  beforeEach(() => {
    enhancedCommandBus = new EnhancedCommandBus();
    mockHandler = {
      execute: vi.fn().mockResolvedValue(undefined),
    };
  });

  describe('constructor', () => {
    it('should create enhanced command bus without handler resolver', () => {
      const bus = new EnhancedCommandBus();
      expect(bus).toBeInstanceOf(EnhancedCommandBus);
    });

    it('should create enhanced command bus with handler resolver', () => {
      const resolver = vi.fn();
      const bus = new EnhancedCommandBus(resolver);
      expect(bus).toBeInstanceOf(EnhancedCommandBus);
    });

    it('should automatically add logging middleware', () => {
      const bus = new EnhancedCommandBus();
      expect(bus).toBeInstanceOf(EnhancedCommandBus);
      // LoggingMiddleware is added in constructor, we can't directly test it
      // but we can verify it's working through execution
    });
  });

  describe('execute with metrics', () => {
    it('should execute command and update metrics', async () => {
      const command = new TestCommand('test');
      enhancedCommandBus.register(TestCommand, mockHandler);

      const metricsBefore = enhancedCommandBus.getMetrics();
      expect(metricsBefore.executionCount).toBe(0);

      await enhancedCommandBus.execute(command);

      const metricsAfter = enhancedCommandBus.getMetrics();
      expect(metricsAfter.executionCount).toBe(1);
      expect(metricsAfter.totalExecutionTime).toBeGreaterThan(0);
      expect(metricsAfter.averageExecutionTime).toBeGreaterThan(0);
      expect(metricsAfter.errors).toBe(0);
    });

    it('should track multiple executions', async () => {
      const command = new TestCommand('test');
      enhancedCommandBus.register(TestCommand, mockHandler);

      await enhancedCommandBus.execute(command);
      await enhancedCommandBus.execute(command);
      await enhancedCommandBus.execute(command);

      const metrics = enhancedCommandBus.getMetrics();
      expect(metrics.executionCount).toBe(3);
      expect(metrics.totalExecutionTime).toBeGreaterThanOrEqual(0);
      expect(metrics.averageExecutionTime).toBeGreaterThanOrEqual(0);
      expect(metrics.errors).toBe(0);
    });

    it('should track errors in metrics', async () => {
      const command = new TestCommand('test');
      const errorHandler: ICommandHandler<TestCommand> = {
        execute: vi.fn().mockRejectedValue(new Error('Test error')),
      };

      enhancedCommandBus.register(TestCommand, errorHandler);

      await expect(enhancedCommandBus.execute(command)).rejects.toThrow('Test error');

      const metrics = enhancedCommandBus.getMetrics();
      expect(metrics.executionCount).toBe(0); // Should not increment on error
      expect(metrics.errors).toBe(1);
    });

    it('should calculate average execution time correctly', async () => {
      const command = new TestCommand('test');
      const slowHandler: ICommandHandler<TestCommand> = {
        execute: vi.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 10))),
      };

      enhancedCommandBus.register(TestCommand, slowHandler);

      await enhancedCommandBus.execute(command);
      await enhancedCommandBus.execute(command);

      const metrics = enhancedCommandBus.getMetrics();
      expect(metrics.executionCount).toBe(2);
      expect(metrics.averageExecutionTime).toBeGreaterThanOrEqual(0);
      expect(metrics.averageExecutionTime).toBe(metrics.totalExecutionTime / 2);
    });
  });

  describe('getMetrics', () => {
    it('should return initial metrics', () => {
      const metrics = enhancedCommandBus.getMetrics();

      expect(metrics).toEqual({
        executionCount: 0,
        totalExecutionTime: 0,
        errors: 0,
        averageExecutionTime: 0,
      });
    });

    it('should return metrics after execution', async () => {
      const command = new TestCommand('test');
      enhancedCommandBus.register(TestCommand, mockHandler);

      await enhancedCommandBus.execute(command);

      const metrics = enhancedCommandBus.getMetrics();
      expect(metrics.executionCount).toBe(1);
      expect(metrics.totalExecutionTime).toBeGreaterThanOrEqual(0);
      expect(metrics.averageExecutionTime).toBeGreaterThanOrEqual(0);
      expect(metrics.errors).toBe(0);
    });

    it('should handle zero executions for average calculation', () => {
      const metrics = enhancedCommandBus.getMetrics();
      expect(metrics.averageExecutionTime).toBe(0);
    });
  });

  describe('resetMetrics', () => {
    it('should reset all metrics to zero', async () => {
      const command = new TestCommand('test');
      enhancedCommandBus.register(TestCommand, mockHandler);

      // Execute some commands to generate metrics
      await enhancedCommandBus.execute(command);
      await enhancedCommandBus.execute(command);

      const metricsBeforeReset = enhancedCommandBus.getMetrics();
      expect(metricsBeforeReset.executionCount).toBe(2);
      expect(metricsBeforeReset.totalExecutionTime).toBeGreaterThanOrEqual(0);

      enhancedCommandBus.resetMetrics();

      const metricsAfterReset = enhancedCommandBus.getMetrics();
      expect(metricsAfterReset).toEqual({
        executionCount: 0,
        totalExecutionTime: 0,
        errors: 0,
        averageExecutionTime: 0,
      });
    });
  });

  describe('inheritance behavior', () => {
    it('should inherit all base CommandBus functionality', () => {
      expect(enhancedCommandBus.register).toBeDefined();
      expect(enhancedCommandBus.registerFactory).toBeDefined();
      expect(enhancedCommandBus.use).toBeDefined();
      expect(enhancedCommandBus.discoverHandlers).toBeDefined();
    });

    it('should work with middleware from base class', async () => {
      const command = new TestCommand('test');
      const customMiddleware = {
        handle: vi.fn().mockImplementation(async (context, next) => next()),
      };

      enhancedCommandBus.register(TestCommand, mockHandler);
      enhancedCommandBus.use(customMiddleware);

      await enhancedCommandBus.execute(command);

      expect(customMiddleware.handle).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should increment error count and rethrow error', async () => {
      const command = new TestCommand('test');
      const error = new Error('Test error');
      const errorHandler: ICommandHandler<TestCommand> = {
        execute: vi.fn().mockRejectedValue(error),
      };

      enhancedCommandBus.register(TestCommand, errorHandler);

      await expect(enhancedCommandBus.execute(command)).rejects.toThrow(error);

      const metrics = enhancedCommandBus.getMetrics();
      expect(metrics.errors).toBe(1);
      expect(metrics.executionCount).toBe(0);
    });

    it('should handle multiple errors correctly', async () => {
      const command = new TestCommand('test');
      const errorHandler: ICommandHandler<TestCommand> = {
        execute: vi.fn().mockRejectedValue(new Error('Test error')),
      };

      enhancedCommandBus.register(TestCommand, errorHandler);

      await expect(enhancedCommandBus.execute(command)).rejects.toThrow();
      await expect(enhancedCommandBus.execute(command)).rejects.toThrow();
      await expect(enhancedCommandBus.execute(command)).rejects.toThrow();

      const metrics = enhancedCommandBus.getMetrics();
      expect(metrics.errors).toBe(3);
      expect(metrics.executionCount).toBe(0);
    });
  });

  describe('mixed success and error scenarios', () => {
    it('should track both successful executions and errors separately', async () => {
      const command = new TestCommand('test');
      const successHandler: ICommandHandler<TestCommand> = {
        execute: vi.fn().mockResolvedValue(undefined),
      };
      const errorHandler: ICommandHandler<TestCommand> = {
        execute: vi.fn().mockRejectedValue(new Error('Test error')),
      };

      // Register success handler and execute
      enhancedCommandBus.register(TestCommand, successHandler);
      await enhancedCommandBus.execute(command);
      await enhancedCommandBus.execute(command);

      // Switch to error handler
      enhancedCommandBus.register(TestCommand, errorHandler);
      await expect(enhancedCommandBus.execute(command)).rejects.toThrow();

      const metrics = enhancedCommandBus.getMetrics();
      expect(metrics.executionCount).toBe(2);
      expect(metrics.errors).toBe(1);
      expect(metrics.totalExecutionTime).toBeGreaterThanOrEqual(0);
    });
  });
});
