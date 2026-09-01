import type { IDependencyContainer } from '@vytches/ddd-di';
import { internalLogger } from '@vytches/ddd-contracts/internal';
import { safeRun } from '@vytches/ddd-utils';
import 'reflect-metadata';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { ICommand, ICommandHandler } from '../../src';
import {
  EnhancedCommandBus,
  HandlerNotFoundError,
  ICommandBus,
  LoggingMiddleware,
} from '../../src';

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

    it('does not install LoggingMiddleware by default (VS-018)', () => {
      expect(enhancedCommandBus['middlewares']).toEqual([]);
    });

    it('installs LoggingMiddleware only when enableExecutionLogging is explicitly true (VS-018)', () => {
      const loggingBus = new EnhancedCommandBus(mockContainer, { enableExecutionLogging: true });
      expect(loggingBus['middlewares']).toHaveLength(1);
      expect(loggingBus['middlewares'][0]).toBeInstanceOf(LoggingMiddleware);
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

      // VS-018: LoggingMiddleware is opt-in (no longer installed by default),
      // so this test explicitly enables it to exercise middleware ordering.
      const loggingCommandBus = new EnhancedCommandBus(mockContainer, {
        enableExecutionLogging: true,
      });

      // Mock LoggingMiddleware to track execution
      const loggingMiddleware = loggingCommandBus['middlewares'][0] as LoggingMiddleware;
      const originalHandle = loggingMiddleware.handle.bind(loggingMiddleware);
      vi.spyOn(loggingMiddleware, 'handle').mockImplementation(async (context, next) => {
        executionOrder.push('logging-start');
        const result = await originalHandle(context, next);
        executionOrder.push('logging-end');
        return result;
      });

      loggingCommandBus.use(customMiddleware);

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

      await loggingCommandBus.execute(command);

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

  describe('typed handler maps (no execute-probe misclassification)', () => {
    it('invokes a factory even when the factory function itself carries an `execute` property', async () => {
      // Local bus WITHOUT retry — file-level bus opts into retry resilience.
      const bus = new EnhancedCommandBus(mockContainer);
      class ProbeCommand implements ICommand {}
      const realHandler = { execute: vi.fn().mockResolvedValue('from-factory') };
      const factory = Object.assign(() => realHandler, { execute: vi.fn() });

      bus.registerFactory(ProbeCommand, factory as unknown as () => typeof realHandler);

      const result = await bus.execute(new ProbeCommand());
      expect(result).toBe('from-factory');
      expect(factory.execute).not.toHaveBeenCalled();
    });

    it('last registration wins across register/registerFactory kinds', async () => {
      const bus = new EnhancedCommandBus(mockContainer);
      class SwapCommand implements ICommand {}
      const instance = { execute: vi.fn().mockResolvedValue('instance') };
      const factoryHandler = { execute: vi.fn().mockResolvedValue('factory') };

      bus.register(SwapCommand, instance);
      bus.registerFactory(SwapCommand, () => factoryHandler);
      expect(await bus.execute(new SwapCommand())).toBe('factory');

      bus.register(SwapCommand, instance);
      expect(await bus.execute(new SwapCommand())).toBe('instance');
    });
  });

  describe('stale handler factory eviction (VS-003)', () => {
    class StaleCommand implements ICommand {}

    // Local bus WITHOUT retry resilience — the file-level bus opts into retry,
    // which would re-attempt (and thus mask) the eviction behavior under test.
    let bus: EnhancedCommandBus;
    beforeEach(() => {
      bus = new EnhancedCommandBus(mockContainer);
    });

    it('should throw HandlerNotFoundError when a registered factory throws', async () => {
      bus.registerFactory(StaleCommand, () => {
        throw new Error('dead moduleRef');
      });

      await expect(bus.execute(new StaleCommand())).rejects.toBeInstanceOf(HandlerNotFoundError);
    });

    it('should evict the stale factory so the next call re-resolves from the container', async () => {
      const goodHandler = { execute: vi.fn().mockResolvedValue('recovered') };
      vi.spyOn(Reflect, 'getMetadata').mockImplementation((key: string) => {
        if (key === 'di:command-handler') {
          return { handlerType: class {} };
        }
        return undefined;
      });
      (mockContainer.resolve as Mock).mockReturnValue(goodHandler);

      let calls = 0;
      bus.registerFactory(StaleCommand, () => {
        calls++;
        throw new Error('dead moduleRef');
      });

      await expect(bus.execute(new StaleCommand())).rejects.toBeInstanceOf(HandlerNotFoundError);

      const result = await bus.execute(new StaleCommand());
      expect(result).toBe('recovered');
      expect(calls).toBe(1);
    });
  });

  describe('reset (VS-003)', () => {
    it('should evict all registered handlers and cached resolutions', async () => {
      // Local bus WITHOUT retry — see note in stale-factory eviction block.
      const bus = new EnhancedCommandBus(mockContainer);
      class ResettableCommand implements ICommand {}
      const handler = { execute: vi.fn().mockResolvedValue('before-reset') };
      bus.register(ResettableCommand, handler);

      expect(await bus.execute(new ResettableCommand())).toBe('before-reset');

      bus.reset();

      vi.spyOn(Reflect, 'getMetadata').mockReturnValue(undefined);
      await expect(bus.execute(new ResettableCommand())).rejects.toBeInstanceOf(
        HandlerNotFoundError
      );
    });
  });

  describe('VP-010 #1 — cache-cleanup timer unref', () => {
    it('should call unref() on the cleanup interval when cache is enabled at construction', () => {
      const unrefSpy = vi.fn();
      const fakeInterval = { unref: unrefSpy } as unknown as ReturnType<typeof setInterval>;
      const setIntervalSpy = vi
        .spyOn(global, 'setInterval')
        .mockReturnValueOnce(fakeInterval as unknown as NodeJS.Timeout);

      const bus = new EnhancedCommandBus(mockContainer, { enableCache: true });

      expect(setIntervalSpy).toHaveBeenCalledTimes(1);
      expect(unrefSpy).toHaveBeenCalledTimes(1);

      // Cleanup: restore spies and dispose bus safely
      setIntervalSpy.mockRestore();
      // bus.dispose() would call clearInterval on the fake — just reset
      bus['cacheCleanupInterval'] = undefined;
    });

    it('should call unref() on the cleanup interval when enableCache(true) is called on a no-cache bus', () => {
      const unrefSpy = vi.fn();
      const fakeInterval = { unref: unrefSpy } as unknown as ReturnType<typeof setInterval>;
      const setIntervalSpy = vi
        .spyOn(global, 'setInterval')
        .mockReturnValueOnce(fakeInterval as unknown as NodeJS.Timeout);

      const bus = new EnhancedCommandBus(mockContainer, { enableCache: false });
      // setInterval should NOT have been called yet (cache off)
      expect(setIntervalSpy).not.toHaveBeenCalled();

      bus.enableCache(true);

      expect(setIntervalSpy).toHaveBeenCalledTimes(1);
      expect(unrefSpy).toHaveBeenCalledTimes(1);

      setIntervalSpy.mockRestore();
      bus['cacheCleanupInterval'] = undefined;
    });
  });

  describe('VP-010 #2 — enableCache default is false', () => {
    it('should NOT start a cache-cleanup interval when constructed without explicit enableCache', () => {
      const setIntervalSpy = vi.spyOn(global, 'setInterval');
      const bus = new EnhancedCommandBus(mockContainer);
      // Metrics logging middleware uses setInterval? No — only cache does.
      // Assert no interval was registered (cacheEnabled defaults to false).
      const internalInterval = (bus as unknown as { cacheCleanupInterval?: unknown })
        .cacheCleanupInterval;
      expect(internalInterval).toBeUndefined();
      setIntervalSpy.mockRestore();
      bus.dispose();
    });

    it('should NOT start a cache-cleanup interval when enableCache is explicitly false', () => {
      const bus = new EnhancedCommandBus(mockContainer, { enableCache: false });
      const internalInterval = (bus as unknown as { cacheCleanupInterval?: unknown })
        .cacheCleanupInterval;
      expect(internalInterval).toBeUndefined();
      bus.dispose();
    });

    it('should start a cache-cleanup interval when enableCache is explicitly true', () => {
      const bus = new EnhancedCommandBus(mockContainer, { enableCache: true });
      const internalInterval = (bus as unknown as { cacheCleanupInterval?: unknown })
        .cacheCleanupInterval;
      expect(internalInterval).toBeDefined();
      bus.dispose();
    });
  });

  describe('VP-010 #4 — stale-bus hint in HandlerNotFoundError message', () => {
    it('should include stale-bus hint in error message when factory throws', async () => {
      const bus = new EnhancedCommandBus(mockContainer);
      class HintCommand implements ICommand {}

      bus.registerFactory(HintCommand, () => {
        throw new Error('dead moduleRef');
      });

      const [error] = await safeRun(() => bus.execute(new HintCommand()));
      expect(error).toBeInstanceOf(HandlerNotFoundError);
      expect((error as HandlerNotFoundError).message).toContain('hint');
      expect((error as HandlerNotFoundError).message).toContain('useFactory');
    });
  });

  describe('VP-010 #5 — IDisposableBus contract', () => {
    it('EnhancedCommandBus exposes a dispose() method', () => {
      const bus = new EnhancedCommandBus(mockContainer);
      expect(typeof bus.dispose).toBe('function');
      bus.dispose();
    });

    it('dispose() can be called on a bus with no active interval (no-op)', () => {
      const bus = new EnhancedCommandBus(mockContainer, { enableCache: false });
      expect(() => bus.dispose()).not.toThrow();
    });

    it('EnhancedCommandBus satisfies the IDisposableBus shape', () => {
      // Type-level: IDisposableBus requires dispose(): void
      const bus: import('../../src').IDisposableBus = new EnhancedCommandBus(mockContainer);
      expect(typeof bus.dispose).toBe('function');
      bus.dispose();
    });
  });

  // VP-010 #6 — regression: reset() evicts factories so a new module starts clean
  describe('VP-010 #6 — reset evicts factories; new module starts clean', () => {
    it('should not execute stale factory after reset(), and fresh factory registered after reset() works', async () => {
      const bus = new EnhancedCommandBus(mockContainer);
      class ResetRegressionCommand implements ICommand {}

      // "Module 1": register a factory that will become stale
      const staleHandler = { execute: vi.fn().mockResolvedValue('stale') };
      bus.registerFactory(ResetRegressionCommand, () => staleHandler);

      expect(await bus.execute(new ResetRegressionCommand())).toBe('stale');

      // Simulate module teardown — VytchesExplorerService.onModuleDestroy calls reset()
      bus.reset();

      // After reset, the stale factory is gone; executing should throw
      const [errorAfterReset] = await safeRun(() => bus.execute(new ResetRegressionCommand()));
      expect(errorAfterReset).toBeInstanceOf(HandlerNotFoundError);

      // "Module 2": register a fresh factory (new module lifecycle)
      const freshHandler = { execute: vi.fn().mockResolvedValue('fresh') };
      bus.registerFactory(ResetRegressionCommand, () => freshHandler);

      expect(await bus.execute(new ResetRegressionCommand())).toBe('fresh');
      expect(staleHandler.execute).toHaveBeenCalledTimes(1); // only called pre-reset
    });
  });

  // VP-012a — executeInParallel used to push settled results in completion
  // order instead of input order once concurrencyLimit forced interleaving.
  describe('executeMany (VP-012a — parallel results ordering)', () => {
    class OrderedCommand implements ICommand {
      constructor(
        public readonly seq: number,
        public readonly delayMs: number
      ) {}
    }

    beforeEach(() => {
      vi.spyOn(Reflect, 'getMetadata').mockImplementation((key: string) => {
        if (key === 'di:command-handler') {
          return { serviceId: 'orderedHandler', handlerType: OrderedCommand };
        }
        return undefined;
      });
    });

    it('returns results in input order even when later commands settle before earlier ones', async () => {
      const handler = {
        execute: vi.fn().mockImplementation(async (command: OrderedCommand) => {
          await new Promise(resolve => setTimeout(resolve, command.delayMs));
          return command.seq;
        }),
      };
      (mockContainer.resolve as Mock).mockReturnValue(handler);

      // executeMany caps concurrency at 5 internally. Delays are strictly
      // decreasing so later-index commands consistently finish first,
      // forcing completion order to diverge from input order.
      const delays = [70, 60, 50, 40, 30, 20, 10];
      const commands = delays.map((delayMs, seq) => new OrderedCommand(seq, delayMs));

      const results = await enhancedCommandBus.executeMany<OrderedCommand, number>(commands);

      expect(results).toEqual([0, 1, 2, 3, 4, 5, 6]);
    });

    it('selects the same winning index regardless of which promise actually settles first (single indexed race)', async () => {
      // VP-012a collapsed a probe-race + index-race pair into one indexed
      // race. This exercises several distinct settlement orderings —
      // strictly increasing delays (completion order == input order),
      // strictly decreasing (fully reversed), a non-monotonic shuffle, and
      // all-equal delays (ties, where FIFO microtask scheduling decides) —
      // and asserts results[] is correct (i.e. the race always resolves to
      // an actually-settled index) under every one of them.
      const delayPatterns: number[][] = [
        [5, 10, 15, 20, 25, 30, 35], // increasing
        [70, 60, 50, 40, 30, 20, 10], // decreasing
        [20, 5, 30, 10, 25, 15, 35], // shuffled / non-monotonic
        [10, 10, 10, 10, 10, 10, 10], // ties
      ];

      for (const delays of delayPatterns) {
        const handler = {
          execute: vi.fn().mockImplementation(async (command: OrderedCommand) => {
            await new Promise(resolve => setTimeout(resolve, command.delayMs));
            return command.seq;
          }),
        };
        (mockContainer.resolve as Mock).mockReturnValue(handler);

        const commands = delays.map((delayMs, seq) => new OrderedCommand(seq, delayMs));
        const results = await enhancedCommandBus.executeMany<OrderedCommand, number>(commands);

        expect(results).toEqual(delays.map((_, seq) => seq));
      }
    });

    it('surfaces a rejected command as a rejection instead of silently swallowing it', async () => {
      // Regression guard for the "do NOT add a rejection handler to the
      // indexed race" note on executeInParallel: a rejected command must
      // still abort executeMany with that rejection, not be lost into an
      // unhandledRejection while the batch quietly completes.
      // Local bus WITHOUT retry — the file-level bus opts into retry, which
      // would delay (but not hide) the rejection; disabling it keeps this
      // test focused on propagation, not retry timing.
      const bus = new EnhancedCommandBus(mockContainer);

      const handler = {
        execute: vi.fn().mockImplementation(async (command: OrderedCommand) => {
          if (command.seq === 2) {
            throw new Error('boom-seq-2');
          }
          await new Promise(resolve => setTimeout(resolve, command.delayMs));
          return command.seq;
        }),
      };
      (mockContainer.resolve as Mock).mockReturnValue(handler);

      const delays = [30, 20, 10, 40, 25, 15, 35];
      const commands = delays.map((delayMs, seq) => new OrderedCommand(seq, delayMs));

      await expect(bus.executeMany<OrderedCommand, number>(commands)).rejects.toThrow('boom-seq-2');
    });
  });

  // VF-025 AC11 — registerTyped()/registerFactoryTyped() are thin, delegating
  // compile-time-safe wrappers: same runtime behavior as register()/
  // registerFactory(), just a narrower parameter type at the call site.
  describe('registerTyped / registerFactoryTyped (VF-025 AC11)', () => {
    class TypedCommand implements ICommand {}

    it('registerTyped() delegates to register() — handler resolves and executes', async () => {
      const bus = new EnhancedCommandBus(mockContainer);
      const handler = { execute: vi.fn().mockResolvedValue('typed-instance') };

      bus.registerTyped(TypedCommand, handler);

      const result = await bus.execute(new TypedCommand());
      expect(result).toBe('typed-instance');
    });

    it('registerTyped() accepts a string key, same as register()', async () => {
      const bus = new EnhancedCommandBus(mockContainer);
      const handler = { execute: vi.fn().mockResolvedValue('typed-by-string') };

      bus.registerTyped('TypedStringCommand', handler);

      class TypedStringCommand implements ICommand {}
      const result = await bus.execute(new TypedStringCommand());
      expect(result).toBe('typed-by-string');
    });

    it('registerFactoryTyped() delegates to registerFactory() — factory is invoked lazily', async () => {
      const bus = new EnhancedCommandBus(mockContainer);
      const handler = { execute: vi.fn().mockResolvedValue('typed-factory') };
      const factory = vi.fn().mockReturnValue(handler);

      bus.registerFactoryTyped(TypedCommand, factory);
      expect(factory).not.toHaveBeenCalled();

      const result = await bus.execute(new TypedCommand());
      expect(result).toBe('typed-factory');
      expect(factory).toHaveBeenCalledTimes(1);
    });

    it('registerTyped() and register() are interchangeable — last write still wins across kinds', async () => {
      const bus = new EnhancedCommandBus(mockContainer);
      const instance = { execute: vi.fn().mockResolvedValue('instance') };
      const factoryHandler = { execute: vi.fn().mockResolvedValue('factory') };

      bus.registerTyped(TypedCommand, instance);
      bus.registerFactoryTyped(TypedCommand, () => factoryHandler);

      expect(await bus.execute(new TypedCommand())).toBe('factory');
    });
  });

  // VF-025 AC11 — silent-overwrite diagnostic on register()/registerFactory().
  // Non-blocking: the overwrite always succeeds, this only asserts the warning.
  describe('overwrite warning (VF-025 AC11)', () => {
    class WarnCommand implements ICommand {}
    let warnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      warnSpy = vi.spyOn(internalLogger, 'warn').mockImplementation(() => undefined);
    });

    afterEach(() => {
      warnSpy.mockRestore();
    });

    it('does not warn on first registration (no false positive)', () => {
      const bus = new EnhancedCommandBus(mockContainer);
      bus.register(WarnCommand, { execute: vi.fn() });
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('does not warn on first registerFactory() call (no false positive)', () => {
      const bus = new EnhancedCommandBus(mockContainer);
      bus.registerFactory(WarnCommand, () => ({ execute: vi.fn() }));
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('warns when register() overwrites an existing instance registration (same kind)', () => {
      const bus = new EnhancedCommandBus(mockContainer);
      bus.register(WarnCommand, { execute: vi.fn() });
      warnSpy.mockClear();

      bus.register(WarnCommand, { execute: vi.fn() });

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('overwriting'),
        expect.objectContaining({
          commandName: 'WarnCommand',
          previousKind: 'instance',
          incomingKind: 'instance',
        })
      );
    });

    it('warns when registerFactory() overwrites an existing factory registration (same kind)', () => {
      const bus = new EnhancedCommandBus(mockContainer);
      bus.registerFactory(WarnCommand, () => ({ execute: vi.fn() }));
      warnSpy.mockClear();

      bus.registerFactory(WarnCommand, () => ({ execute: vi.fn() }));

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('overwriting'),
        expect.objectContaining({
          commandName: 'WarnCommand',
          previousKind: 'factory',
          incomingKind: 'factory',
        })
      );
    });

    it('warns when registerFactory() replaces an existing instance registration (instance -> factory)', async () => {
      const bus = new EnhancedCommandBus(mockContainer);
      bus.register(WarnCommand, { execute: vi.fn().mockResolvedValue('instance') });
      warnSpy.mockClear();

      const newHandler = { execute: vi.fn().mockResolvedValue('factory') };
      bus.registerFactory(WarnCommand, () => newHandler);

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('overwriting'),
        expect.objectContaining({
          commandName: 'WarnCommand',
          previousKind: 'instance',
          incomingKind: 'factory',
        })
      );
      // Non-blocking: the overwrite still takes effect.
      expect(await bus.execute(new WarnCommand())).toBe('factory');
    });

    it('warns when register() replaces an existing factory registration (factory -> instance)', async () => {
      const bus = new EnhancedCommandBus(mockContainer);
      bus.registerFactory(WarnCommand, () => ({ execute: vi.fn().mockResolvedValue('factory') }));
      warnSpy.mockClear();

      const newHandler = { execute: vi.fn().mockResolvedValue('instance') };
      bus.register(WarnCommand, newHandler);

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('overwriting'),
        expect.objectContaining({
          commandName: 'WarnCommand',
          previousKind: 'factory',
          incomingKind: 'instance',
        })
      );
      // Non-blocking: the overwrite still takes effect.
      expect(await bus.execute(new WarnCommand())).toBe('instance');
    });

    it('warns with the string key when registration uses a string commandType', () => {
      const bus = new EnhancedCommandBus(mockContainer);
      bus.register('StringKeyCommand', { execute: vi.fn() });
      warnSpy.mockClear();

      bus.register('StringKeyCommand', { execute: vi.fn() });

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('overwriting'),
        expect.objectContaining({ commandName: 'StringKeyCommand' })
      );
    });

    it('does not warn for a different command key sharing no registration history', () => {
      const bus = new EnhancedCommandBus(mockContainer);
      class OtherCommand implements ICommand {}
      bus.register(WarnCommand, { execute: vi.fn() });
      warnSpy.mockClear();

      bus.register(OtherCommand, { execute: vi.fn() });

      expect(warnSpy).not.toHaveBeenCalled();
    });
  });
});
