import type { IDependencyContainer } from '@vytches/ddd-di';
import { safeRun } from '@vytches/ddd-utils';
import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { ICommand, ICommandHandler, LoggingMiddleware } from '../../src';
import { EnhancedCommandBus, ICommandBus } from '../../src';

// Test command implementation
class TestCommand implements ICommand {
  constructor(public readonly data: string) {}
}

// Test command handler
class TestCommandHandler implements ICommandHandler<TestCommand> {
  async execute(_command: TestCommand): Promise<void> {
    // Mock implementation
  }
}

describe('EnhancedCommandBus', () => {
  let enhancedCommandBus: EnhancedCommandBus;
  let mockContainer: IDependencyContainer;
  let mockHandler: TestCommandHandler;

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

    mockHandler = new TestCommandHandler();
    // REL-009 (2026-05-08): retry is now opt-in (was default-on). Tests below
    // assert `metrics.errors === 3` which depends on retry being active with
    // maxAttempts=3 — opt in explicitly to preserve that behavior.
    enhancedCommandBus = new EnhancedCommandBus(mockContainer, {
      resilience: {
        retry: { enabled: true, maxAttempts: 3 },
      },
    });
  });

  describe('constructor', () => {
    it('should extend ICommandBus', () => {
      expect(enhancedCommandBus).toBeInstanceOf(ICommandBus);
    });

    it('should initialize metrics with default values', () => {
      const metrics = enhancedCommandBus.getMetrics();
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
      });
    });
  });

  describe('execute', () => {
    beforeEach(() => {
      // Mock Reflect.getMetadata
      vi.spyOn(Reflect, 'getMetadata').mockImplementation((key: string) => {
        if (key === 'di:command-handler') {
          return {
            serviceId: 'testHandler',
            handlerType: TestCommandHandler,
          };
        }
        return undefined;
      });

      (mockContainer.resolve as Mock).mockReturnValue(mockHandler);
    });

    it('should execute command successfully and update metrics', async () => {
      const command = new TestCommand('test-data');
      const executeSpy = vi.spyOn(mockHandler, 'execute').mockResolvedValue(undefined);

      await enhancedCommandBus.execute(command);

      expect(executeSpy).toHaveBeenCalledWith(command);

      const metrics = enhancedCommandBus.getMetrics();
      expect(metrics.executionCount).toBe(1);
      expect(metrics.totalExecutionTime).toBeGreaterThan(0);
      expect(metrics.errors).toBe(0);
      expect(metrics.averageExecutionTime).toBeGreaterThan(0);
    });

    it('should handle multiple executions and update metrics correctly', async () => {
      const command1 = new TestCommand('test-data-1');
      const command2 = new TestCommand('test-data-2');

      vi.spyOn(mockHandler, 'execute').mockResolvedValue(undefined);

      await enhancedCommandBus.execute(command1);
      await enhancedCommandBus.execute(command2);

      const metrics = enhancedCommandBus.getMetrics();
      expect(metrics.executionCount).toBe(2);
      expect(metrics.totalExecutionTime).toBeGreaterThan(0);
      expect(metrics.errors).toBe(0);
      expect(metrics.averageExecutionTime).toBe(metrics.totalExecutionTime / 2);
    });

    it('should increment error count when execution fails', async () => {
      const command = new TestCommand('test-data');
      const error = new Error('Execution failed');

      vi.spyOn(mockHandler, 'execute').mockRejectedValue(error);

      const [executeError] = await safeRun(() => enhancedCommandBus.execute(command));
      expect(executeError?.message).toContain('Execution failed'); // V2 wraps with retry logic

      const metrics = enhancedCommandBus.getMetrics();
      expect(metrics.executionCount).toBe(0); // Failed executions don't count as successful
      expect(metrics.errors).toBe(3); // V2 implementation with retry patterns
    });

    it('should handle mixed success and error executions', async () => {
      const command1 = new TestCommand('success');
      const command2 = new TestCommand('error');
      const command3 = new TestCommand('success');

      vi.spyOn(mockHandler, 'execute')
        .mockResolvedValueOnce(undefined) // First success
        .mockRejectedValue(new Error('Failed')); // All subsequent calls fail (for retries)

      await enhancedCommandBus.execute(command1);
      const [executeError] = await safeRun(() => enhancedCommandBus.execute(command2));
      expect(executeError?.message).toContain('Failed'); // V2 wraps with retry logic

      // Reset mock for command3 to succeed
      vi.spyOn(mockHandler, 'execute').mockResolvedValue(undefined);
      await enhancedCommandBus.execute(command3);

      const metrics = enhancedCommandBus.getMetrics();
      expect(metrics.executionCount).toBe(2);
      expect(metrics.errors).toBe(3); // V2 implementation with retry patterns
      expect(metrics.averageExecutionTime).toBeGreaterThan(0);
    });

    it('should measure execution time accurately', async () => {
      const command = new TestCommand('test-data');
      const delay = 100;

      vi.spyOn(mockHandler, 'execute').mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, delay));
      });

      const startTime = performance.now();
      await enhancedCommandBus.execute(command);
      const endTime = performance.now();

      const metrics = enhancedCommandBus.getMetrics();
      expect(metrics.totalExecutionTime).toBeGreaterThanOrEqual(delay - 10); // Allow some tolerance
      expect(metrics.totalExecutionTime).toBeLessThan(endTime - startTime + 10);
    });
  });

  describe('getMetrics', () => {
    beforeEach(() => {
      vi.spyOn(Reflect, 'getMetadata').mockImplementation((key: string) => {
        if (key === 'di:command-handler') {
          return {
            serviceId: 'testHandler',
            handlerType: TestCommandHandler,
          };
        }
        return undefined;
      });
      (mockContainer.resolve as Mock).mockReturnValue(mockHandler);
    });

    it('should return initial metrics', () => {
      const metrics = enhancedCommandBus.getMetrics();

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
      });
    });

    it('should calculate average execution time correctly', async () => {
      const command1 = new TestCommand('test-1');
      const command2 = new TestCommand('test-2');

      vi.spyOn(mockHandler, 'execute').mockResolvedValue(undefined);

      await enhancedCommandBus.execute(command1);
      await enhancedCommandBus.execute(command2);

      const metrics = enhancedCommandBus.getMetrics();
      expect(metrics.averageExecutionTime).toBe(metrics.totalExecutionTime / 2);
    });

    it('should return zero average when no executions', () => {
      const metrics = enhancedCommandBus.getMetrics();
      expect(metrics.averageExecutionTime).toBe(0);
    });

    it('should return current metrics snapshot', async () => {
      const command = new TestCommand('test-data');
      vi.spyOn(mockHandler, 'execute').mockResolvedValue(undefined);

      const initialMetrics = enhancedCommandBus.getMetrics();
      expect(initialMetrics.executionCount).toBe(0);

      await enhancedCommandBus.execute(command);

      const afterMetrics = enhancedCommandBus.getMetrics();
      expect(afterMetrics.executionCount).toBe(1);

      // Initial metrics should remain unchanged
      expect(initialMetrics.executionCount).toBe(0);
    });
  });

  describe('resetMetrics', () => {
    beforeEach(() => {
      vi.spyOn(Reflect, 'getMetadata').mockImplementation((key: string) => {
        if (key === 'di:command-handler') {
          return {
            serviceId: 'testHandler',
            handlerType: TestCommandHandler,
          };
        }
        return undefined;
      });
      (mockContainer.resolve as Mock).mockReturnValue(mockHandler);
    });

    it('should reset all metrics to zero', async () => {
      const command = new TestCommand('test-data');
      vi.spyOn(mockHandler, 'execute').mockResolvedValue(undefined);

      // Execute some commands to generate metrics
      await enhancedCommandBus.execute(command);
      await enhancedCommandBus.execute(command);

      let metrics = enhancedCommandBus.getMetrics();
      expect(metrics.executionCount).toBe(2);
      expect(metrics.totalExecutionTime).toBeGreaterThan(0);

      // Reset metrics
      enhancedCommandBus.resetMetrics();

      metrics = enhancedCommandBus.getMetrics();
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
      });
    });

    it('should reset error count', async () => {
      const command = new TestCommand('test-data');
      vi.spyOn(mockHandler, 'execute').mockRejectedValue(new Error('Test error'));

      // Generate some errors (each command failure triggers 3 retries in V2)
      const [error1] = await safeRun(() => enhancedCommandBus.execute(command));
      expect(error1).toBeDefined();

      let metrics = enhancedCommandBus.getMetrics();
      expect(metrics.errors).toBe(3); // V2 implementation with retry patterns

      // Reset metrics
      enhancedCommandBus.resetMetrics();

      metrics = enhancedCommandBus.getMetrics();
      expect(metrics.errors).toBe(0);
    }, 10000); // Increase timeout for V2 retry behavior

    it('should allow metrics to accumulate again after reset', async () => {
      const command = new TestCommand('test-data');
      vi.spyOn(mockHandler, 'execute').mockResolvedValue(undefined);

      // Execute and reset
      await enhancedCommandBus.execute(command);
      enhancedCommandBus.resetMetrics();

      // Execute again
      await enhancedCommandBus.execute(command);
      await enhancedCommandBus.execute(command);

      const metrics = enhancedCommandBus.getMetrics();
      expect(metrics.executionCount).toBe(2);
      expect(metrics.totalExecutionTime).toBeGreaterThan(0);
    });
  });

  describe('middleware integration', () => {
    it('should work with additional middleware', async () => {
      const command = new TestCommand('test-data');
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
      const loggingMiddleware = enhancedCommandBus['middlewares'][0] as LoggingMiddleware;
      const originalHandle = loggingMiddleware.handle.bind(loggingMiddleware);
      vi.spyOn(loggingMiddleware, 'handle').mockImplementation(async (context, next) => {
        executionOrder.push('logging-start');
        const result = await originalHandle(context, next);
        executionOrder.push('logging-end');
        return result;
      });

      enhancedCommandBus.use(customMiddleware);

      vi.spyOn(Reflect, 'getMetadata').mockImplementation((key: string) => {
        if (key === 'di:command-handler') {
          return {
            serviceId: 'testHandler',
            handlerType: TestCommandHandler,
          };
        }
        return undefined;
      });

      (mockContainer.resolve as Mock).mockReturnValue(mockHandler);
      vi.spyOn(mockHandler, 'execute').mockImplementation(async () => {
        executionOrder.push('handler');
      });

      await enhancedCommandBus.execute(command);

      expect(executionOrder).toEqual([
        'logging-start',
        'custom-start',
        'handler',
        'custom-end',
        'logging-end',
      ]);
    });
  });

  describe('performance monitoring', () => {
    it('should track performance consistently across multiple operations', async () => {
      const commands = Array.from({ length: 10 }, (_, i) => new TestCommand(`test-${i}`));

      vi.spyOn(Reflect, 'getMetadata').mockImplementation((key: string) => {
        if (key === 'di:command-handler') {
          return {
            serviceId: 'testHandler',
            handlerType: TestCommandHandler,
          };
        }
        return undefined;
      });

      (mockContainer.resolve as Mock).mockReturnValue(mockHandler);
      vi.spyOn(mockHandler, 'execute').mockResolvedValue(undefined);

      // Execute multiple commands
      for (const command of commands) {
        await enhancedCommandBus.execute(command);
      }

      const metrics = enhancedCommandBus.getMetrics();
      expect(metrics.executionCount).toBe(10);
      expect(metrics.totalExecutionTime).toBeGreaterThan(0);
      expect(metrics.averageExecutionTime).toBe(metrics.totalExecutionTime / 10);
      expect(metrics.errors).toBe(0);
    });
  });

  describe('cross-context name collision prevention (VP-007)', () => {
    it('should route to correct handler when two contexts define classes with identical names', async () => {
      class UpdateUserReadModelCommand implements ICommand {
        constructor(public readonly contextA = true) {}
      }

      const ContextBCommand = class UpdateUserReadModelCommand implements ICommand {
        constructor(public readonly contextB = true) {}
      };

      const handlerA = { execute: vi.fn().mockResolvedValue('context-a') };
      const handlerB = { execute: vi.fn().mockResolvedValue('context-b') };

      enhancedCommandBus.register(UpdateUserReadModelCommand, handlerA);
      enhancedCommandBus.register(ContextBCommand, handlerB);

      const resultA = await enhancedCommandBus.execute(new UpdateUserReadModelCommand());
      const resultB = await enhancedCommandBus.execute(new ContextBCommand());

      expect(resultA).toBe('context-a');
      expect(resultB).toBe('context-b');
      expect(handlerA.execute).toHaveBeenCalledTimes(1);
      expect(handlerB.execute).toHaveBeenCalledTimes(1);
    });

    it('should still resolve handler registered by string name (BC)', async () => {
      const handler = { execute: vi.fn().mockResolvedValue('by-string') };
      enhancedCommandBus.register('LegacyCommand', handler);

      class LegacyCommand implements ICommand {}
      const result = await enhancedCommandBus.execute(new LegacyCommand());

      expect(result).toBe('by-string');
    });
  });
});
