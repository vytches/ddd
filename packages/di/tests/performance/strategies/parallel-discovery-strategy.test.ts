/**
 * VP-012: ParallelDiscoveryStrategy Tests
 * Comprehensive test coverage for Promise.allSettled implementation
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SimpleContainer } from '../../../src/containers/simple-container';
import type { IPerformanceContext } from '../../../src/performance/abstractions/performance-strategy.interface';
import { ParallelDiscoveryStrategy } from '../../../src/performance/strategies/parallel-discovery-strategy';

describe('ParallelDiscoveryStrategy', () => {
  // Mock container helper for testing
  const createMockContainer = () => new SimpleContainer();

  // Helper function to create mock plugins
  const createMockPlugin = (name: string, handlers: any[] = [], supportedContexts?: string[]) => ({
    name,
    constructor: { name },
    isAvailable: () => true,
    discoverHandlers: vi.fn().mockResolvedValue(handlers),
    ...(supportedContexts && { supportedContexts }),
  });

  let strategy: ParallelDiscoveryStrategy;

  beforeEach(() => {
    strategy = new ParallelDiscoveryStrategy();
  });

  describe('Strategy Identity', () => {
    it('should have correct strategy metadata', () => {
      expect(strategy.strategyId).toBe('parallel-discovery');
      expect(strategy.displayName).toBe('Parallel Discovery');
      expect(strategy.description).toContain('Promise.allSettled');
      expect(strategy.description).toContain('concurrent plugin processing');
    });
  });

  describe('canHandle', () => {
    it('should handle enterprise mode with parallel processing and multiple plugins', () => {
      const context: IPerformanceContext = {
        performanceMode: 'enterprise',
        parallelProcessing: true,
        discoveryPlugins: [createMockPlugin('Plugin1'), createMockPlugin('Plugin2')],
        container: createMockContainer(),
      };

      expect(strategy.canHandle(context)).toBe(true);
    });

    it('should not handle non-enterprise mode', () => {
      const context: IPerformanceContext = {
        performanceMode: 'production',
        parallelProcessing: true,
        discoveryPlugins: [createMockPlugin('Plugin1'), createMockPlugin('Plugin2')],
        container: createMockContainer(),
      };

      expect(strategy.canHandle(context)).toBe(false);
    });

    it('should not handle context without parallel processing', () => {
      const context: IPerformanceContext = {
        performanceMode: 'enterprise',
        parallelProcessing: false,
        discoveryPlugins: [createMockPlugin('Plugin1'), createMockPlugin('Plugin2')],
        container: createMockContainer(),
      };

      expect(strategy.canHandle(context)).toBe(false);
    });

    it('should not handle context with single plugin', () => {
      const context: IPerformanceContext = {
        performanceMode: 'enterprise',
        parallelProcessing: true,
        discoveryPlugins: [createMockPlugin('Plugin1')],
        container: createMockContainer(),
      };

      expect(strategy.canHandle(context)).toBe(false);
    });
  });

  describe('Parallel Discovery', () => {
    it('should execute plugins in parallel using Promise.allSettled', async () => {
      const plugin1 = {
        name: 'Plugin1',
        constructor: { name: 'Plugin1' },
        isAvailable: () => true,
        discoverHandlers: vi.fn().mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return [
            {
              type: 'command',
              messageType: { name: 'Command1' },
              handlerType: { name: 'Handler1' },
            },
          ];
        }),
      };

      const plugin2 = {
        name: 'Plugin2',
        constructor: { name: 'Plugin2' },
        isAvailable: () => true,
        discoverHandlers: vi.fn().mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 50));
          return [
            {
              type: 'query',
              messageType: { name: 'Query1' },
              handlerType: { name: 'QueryHandler1' },
            },
          ];
        }),
      };

      const context: IPerformanceContext = {
        performanceMode: 'enterprise',
        parallelProcessing: true,
        discoveryPlugins: [plugin1, plugin2],
        container: createMockContainer(),
      };

      const startTime = performance.now();
      const result = await strategy.optimize(context);
      const executionTime = performance.now() - startTime;

      // Should complete in parallel time (closer to 100ms than 150ms)
      expect(executionTime).toBeLessThan(140); // Allow some overhead

      expect(result.handlers).toHaveLength(2);
      expect(result.metrics.success).toBe(true);
      expect(result.metrics.metadata?.successfulPlugins).toBe(2);
      expect(result.metrics.metadata?.parallelSpeedup).toBeGreaterThan(1);

      // Both plugins should have been called
      expect(plugin1.discoverHandlers).toHaveBeenCalledTimes(1);
      expect(plugin2.discoverHandlers).toHaveBeenCalledTimes(1);
    });

    it('should isolate plugin failures using Promise.allSettled', async () => {
      const successPlugin = {
        name: 'SuccessPlugin',
        constructor: { name: 'SuccessPlugin' },
        isAvailable: () => true,
        discoverHandlers: vi.fn().mockResolvedValue([
          {
            type: 'command',
            messageType: { name: 'Command1' },
            handlerType: { name: 'Handler1' },
          },
        ]),
      };

      const failurePlugin = {
        name: 'FailurePlugin',
        constructor: { name: 'FailurePlugin' },
        isAvailable: () => true,
        discoverHandlers: vi.fn().mockRejectedValue(new Error('Plugin failed')),
      };

      const context: IPerformanceContext = {
        performanceMode: 'enterprise',
        parallelProcessing: true,
        discoveryPlugins: [successPlugin, failurePlugin],
        container: createMockContainer(),
      };

      const result = await strategy.optimize(context);

      // Should succeed with handlers from successful plugin
      expect(result.handlers).toHaveLength(1);
      expect(result.metrics.success).toBe(true);
      expect(result.metrics.metadata?.successfulPlugins).toBe(1);
      expect(result.metrics.metadata?.failedPlugins).toBe(1);
    });

    it('should provide detailed parallel execution statistics', async () => {
      const fastPlugin = {
        name: 'FastPlugin',
        constructor: { name: 'FastPlugin' },
        isAvailable: () => true,
        discoverHandlers: vi.fn().mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 30));
          return [
            {
              type: 'command',
              messageType: { name: 'FastCommand' },
              handlerType: { name: 'FastHandler' },
            },
          ];
        }),
      };

      const slowPlugin = {
        name: 'SlowPlugin',
        constructor: { name: 'SlowPlugin' },
        isAvailable: () => true,
        discoverHandlers: vi.fn().mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 80));
          return [
            {
              type: 'command',
              messageType: { name: 'SlowCommand1' },
              handlerType: { name: 'SlowHandler1' },
            },
            {
              type: 'command',
              messageType: { name: 'SlowCommand2' },
              handlerType: { name: 'SlowHandler2' },
            },
          ];
        }),
      };

      const context: IPerformanceContext = {
        performanceMode: 'enterprise',
        parallelProcessing: true,
        discoveryPlugins: [fastPlugin, slowPlugin],
        container: createMockContainer(),
      };

      const result = await strategy.optimize(context);

      expect(result.metrics.success).toBe(true);
      expect(result.metrics.metadata?.parallelPlugins).toBe(2);
      expect(result.metrics.metadata?.longestPluginTime).toBeGreaterThan(70);
      expect(result.metrics.metadata?.shortestPluginTime).toBeLessThan(50);
      expect(result.metrics.metadata?.totalSequentialTime).toBeGreaterThan(100);
      expect(result.metrics.metadata?.parallelSpeedup).toBeGreaterThan(1);
      expect(result.metrics.metadata?.parallelEfficiency).toBeGreaterThan(0);

      const handlerDistribution = result.metrics.metadata?.handlerDistribution as any;
      expect(handlerDistribution?.min).toBe(1);
      expect(handlerDistribution?.max).toBe(2);
      expect(handlerDistribution?.total).toBe(3);
    });

    it('should handle timeout with AbortSignal', async () => {
      const hangingPlugin = {
        name: 'HangingPlugin',
        constructor: { name: 'HangingPlugin' },
        isAvailable: () => true,
        discoverHandlers: vi.fn().mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 1000)); // Long delay
          return [];
        }),
      };

      const fastPlugin = {
        name: 'FastPlugin',
        constructor: { name: 'FastPlugin' },
        isAvailable: () => true,
        discoverHandlers: vi.fn().mockResolvedValue([
          {
            type: 'command',
            messageType: { name: 'FastCommand' },
            handlerType: { name: 'FastHandler' },
          },
        ]),
      };

      const context: IPerformanceContext = {
        performanceMode: 'enterprise',
        parallelProcessing: true,
        discoveryPlugins: [hangingPlugin, fastPlugin],
        container: createMockContainer(),
        timeout: 200,
      };

      const result = await strategy.optimize(context);

      // Should complete with timeout
      expect(result.metrics.discoveryTime).toBeLessThan(300);
      expect(result.metrics.metadata?.failedPlugins).toBeGreaterThan(0);
    });

    it('should filter handlers by contexts', async () => {
      const plugin1 = {
        name: 'Plugin1',
        constructor: { name: 'Plugin1' },
        isAvailable: () => true,
        discoverHandlers: vi.fn().mockResolvedValue([
          {
            type: 'command',
            messageType: { name: 'OrderCommand' },
            handlerType: { name: 'OrderHandler' },
            metadata: { context: 'order-context' },
          },
          {
            type: 'command',
            messageType: { name: 'PaymentCommand' },
            handlerType: { name: 'PaymentHandler' },
            metadata: { context: 'payment-context' },
          },
        ]),
      };

      const plugin2 = {
        name: 'Plugin2',
        constructor: { name: 'Plugin2' },
        isAvailable: () => true,
        discoverHandlers: vi.fn().mockResolvedValue([
          {
            type: 'command',
            messageType: { name: 'InventoryCommand' },
            handlerType: { name: 'InventoryHandler' },
            metadata: { context: 'inventory-context' },
          },
        ]),
      };

      const context: IPerformanceContext = {
        performanceMode: 'enterprise',
        parallelProcessing: true,
        discoveryPlugins: [plugin1, plugin2],
        container: createMockContainer(),
        contexts: ['order-context'],
      };

      const result = await strategy.optimize(context);

      expect(result.handlers).toHaveLength(1);
      expect((result.handlers[0]?.metadata as any)?.context).toBe('order-context');
    });

    it('should apply handler limit correctly', async () => {
      const plugin1 = {
        name: 'Plugin1',
        constructor: { name: 'Plugin1' },
        isAvailable: () => true,
        discoverHandlers: vi.fn().mockResolvedValue([
          { type: 'command', messageType: { name: 'Command1' }, handlerType: { name: 'Handler1' } },
          { type: 'command', messageType: { name: 'Command2' }, handlerType: { name: 'Handler2' } },
          { type: 'command', messageType: { name: 'Command3' }, handlerType: { name: 'Handler3' } },
        ]),
      };

      const plugin2 = {
        name: 'Plugin2',
        constructor: { name: 'Plugin2' },
        isAvailable: () => true,
        discoverHandlers: vi.fn().mockResolvedValue([
          { type: 'command', messageType: { name: 'Command4' }, handlerType: { name: 'Handler4' } },
          { type: 'command', messageType: { name: 'Command5' }, handlerType: { name: 'Handler5' } },
        ]),
      };

      const context: IPerformanceContext = {
        performanceMode: 'enterprise',
        parallelProcessing: true,
        discoveryPlugins: [plugin1, plugin2],
        container: createMockContainer(),
        maxHandlers: 3,
      };

      const result = await strategy.optimize(context);

      expect(result.handlers).toHaveLength(3);
      expect(result.metrics.success).toBe(true);
    });

    it('should remove duplicate handlers across plugins', async () => {
      const plugin1 = {
        name: 'Plugin1',
        constructor: { name: 'Plugin1' },
        isAvailable: () => true,
        discoverHandlers: vi.fn().mockResolvedValue([
          {
            type: 'command',
            messageType: { name: 'DuplicateCommand' },
            handlerType: { name: 'DuplicateHandler' },
          },
          {
            type: 'command',
            messageType: { name: 'UniqueCommand1' },
            handlerType: { name: 'UniqueHandler1' },
          },
        ]),
      };

      const plugin2 = {
        name: 'Plugin2',
        constructor: { name: 'Plugin2' },
        isAvailable: () => true,
        discoverHandlers: vi.fn().mockResolvedValue([
          {
            type: 'command',
            messageType: { name: 'DuplicateCommand' },
            handlerType: { name: 'DuplicateHandler' },
          },
          {
            type: 'command',
            messageType: { name: 'UniqueCommand2' },
            handlerType: { name: 'UniqueHandler2' },
          },
        ]),
      };

      const context: IPerformanceContext = {
        performanceMode: 'enterprise',
        parallelProcessing: true,
        discoveryPlugins: [plugin1, plugin2],
        container: createMockContainer(),
      };

      const result = await strategy.optimize(context);

      expect(result.handlers).toHaveLength(3); // 1 duplicate removed
      expect(result.metrics.success).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle all plugins failing gracefully', async () => {
      const failPlugin1 = {
        name: 'FailPlugin1',
        constructor: { name: 'FailPlugin1' },
        isAvailable: () => true,
        discoverHandlers: vi.fn().mockRejectedValue(new Error('Plugin 1 failed')),
      };

      const failPlugin2 = {
        name: 'FailPlugin2',
        constructor: { name: 'FailPlugin2' },
        isAvailable: () => true,
        discoverHandlers: vi.fn().mockRejectedValue(new Error('Plugin 2 failed')),
      };

      const context: IPerformanceContext = {
        performanceMode: 'enterprise',
        parallelProcessing: true,
        discoveryPlugins: [failPlugin1, failPlugin2],
        container: createMockContainer(),
      };

      const result = await strategy.optimize(context);

      expect(result.handlers).toHaveLength(0);
      expect(result.metrics.success).toBe(true); // Strategy succeeds even with no handlers
      expect(result.metrics.metadata?.failedPlugins).toBe(2);
      expect(result.metrics.metadata?.successfulPlugins).toBe(0);
    });

    it('should handle strategy execution errors', async () => {
      const context: IPerformanceContext = {
        performanceMode: 'enterprise',
        parallelProcessing: true,
        discoveryPlugins: [], // No plugins to cause different error path
        container: createMockContainer(),
      };

      const result = await strategy.optimize(context);

      expect(result.metrics.success).toBe(true);
      expect(result.handlers).toHaveLength(0);
    });
  });

  describe('validatePrerequisites', () => {
    it('should validate prerequisites correctly', async () => {
      const validContext: IPerformanceContext = {
        performanceMode: 'enterprise',
        parallelProcessing: true,
        discoveryPlugins: [createMockPlugin('Plugin1'), createMockPlugin('Plugin2')],
        container: createMockContainer(),
      };

      const isValid = await strategy.validatePrerequisites(validContext);
      expect(isValid).toBe(true);
    });

    it('should fail validation for non-enterprise mode', async () => {
      const invalidContext: IPerformanceContext = {
        performanceMode: 'production',
        parallelProcessing: true,
        discoveryPlugins: [createMockPlugin('Plugin1'), createMockPlugin('Plugin2')],
        container: createMockContainer(),
      };

      const isValid = await strategy.validatePrerequisites(invalidContext);
      expect(isValid).toBe(false);
    });

    it('should fail validation without parallel processing', async () => {
      const invalidContext: IPerformanceContext = {
        performanceMode: 'enterprise',
        parallelProcessing: false,
        discoveryPlugins: [createMockPlugin('Plugin1'), createMockPlugin('Plugin2')],
        container: createMockContainer(),
      };

      const isValid = await strategy.validatePrerequisites(invalidContext);
      expect(isValid).toBe(false);
    });

    it('should fail validation with single plugin', async () => {
      const invalidContext: IPerformanceContext = {
        performanceMode: 'enterprise',
        parallelProcessing: true,
        discoveryPlugins: [createMockPlugin('Plugin1')],
        container: createMockContainer(),
      };

      const isValid = await strategy.validatePrerequisites(invalidContext);
      expect(isValid).toBe(false);
    });
  });

  describe('Performance Metrics', () => {
    it('should calculate parallel efficiency correctly', async () => {
      const plugin1 = {
        name: 'Plugin1',
        constructor: { name: 'Plugin1' },
        isAvailable: () => true,
        discoverHandlers: vi.fn().mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return [
            {
              type: 'command',
              messageType: { name: 'Command1' },
              handlerType: { name: 'Handler1' },
            },
          ];
        }),
      };

      const plugin2 = {
        name: 'Plugin2',
        constructor: { name: 'Plugin2' },
        isAvailable: () => true,
        discoverHandlers: vi.fn().mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return [
            {
              type: 'command',
              messageType: { name: 'Command2' },
              handlerType: { name: 'Handler2' },
            },
          ];
        }),
      };

      const context: IPerformanceContext = {
        performanceMode: 'enterprise',
        parallelProcessing: true,
        discoveryPlugins: [plugin1, plugin2],
        container: createMockContainer(),
      };

      const result = await strategy.optimize(context);

      // With 2 plugins taking ~100ms each, parallel execution should be ~100ms
      // Sequential would be ~200ms, so speedup should be ~2.0
      const efficiency = result.metrics.metadata?.parallelEfficiency;
      expect(efficiency).toBeGreaterThan(0.8); // Allow for overhead
      expect(efficiency).toBeLessThanOrEqual(1.0);

      const speedup = result.metrics.metadata?.parallelSpeedup;
      expect(speedup).toBeGreaterThan(1.5);
    });
  });
});
