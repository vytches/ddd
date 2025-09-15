/* eslint-disable @typescript-eslint/no-empty-function */
/**
 * VP-012: PerformanceOrchestrator Integration Tests
 * Comprehensive test coverage for strategy orchestration
 */

import { safeRun } from '@vytches/ddd-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SimpleContainer } from '../../../src/containers/simple-container';
import type { IHandlerDiscoveryPlugin } from '../../../src/discovery/handler-discovery.interface';
import { PerformanceOrchestrator } from '../../../src/performance/orchestration/performance-orchestrator';
import type {
  HandlerRegistry,
  PerformanceConfigurationOptions,
} from '../../../src/performance/performance-types';

describe('PerformanceOrchestrator Integration Tests', () => {
  let orchestrator: PerformanceOrchestrator;
  let container: SimpleContainer;
  let mockPlugins: IHandlerDiscoveryPlugin[];

  // Mock constructor functions for testing
  const createMockConstructor = (name: string) => {
    const mockFn = function () {} as any;
    Object.defineProperty(mockFn, 'name', {
      value: name,
      configurable: true,
    });
    return mockFn;
  };

  // Mock container for testing
  const createMockContainer = () => new SimpleContainer();

  // Helper function to create mock plugins
  const createMockPlugin = (name: string, handlers: any[] = [], supportedContexts?: string[]) => ({
    name,
    constructor: { name },
    isAvailable: () => true,
    discoverHandlers: vi.fn().mockResolvedValue(handlers),
    ...(supportedContexts && { supportedContexts }),
  });

  beforeEach(() => {
    orchestrator = new PerformanceOrchestrator();
    container = createMockContainer();

    mockPlugins = [
      {
        name: 'MockPlugin1',
        isAvailable: vi.fn().mockReturnValue(true),
        discoverHandlers: vi.fn().mockResolvedValue([
          {
            type: 'command',
            messageType: createMockConstructor('TestCommand1'),
            handlerType: createMockConstructor('TestHandler1'),
            metadata: { context: 'test-context' },
          },
        ]),
      },
      {
        name: 'MockPlugin2',
        isAvailable: vi.fn().mockReturnValue(true),
        discoverHandlers: vi.fn().mockResolvedValue([
          {
            type: 'query',
            messageType: createMockConstructor('TestQuery1'),
            handlerType: createMockConstructor('TestQueryHandler1'),
            metadata: { context: 'test-context' },
          },
        ]),
      },
    ];
  });

  describe('Strategy Registration and Discovery', () => {
    it('should register all VP-012 Phase 2 strategies by default', () => {
      const strategies = orchestrator.getRegisteredStrategies();

      const strategyIds = strategies.map(s => s.id);
      expect(strategyIds).toEqual(
        expect.arrayContaining([
          'standard-discovery',
          'selective-discovery',
          'cached-discovery',
          'parallel-discovery',
          'pre-compiled-registry',
        ])
      );
      expect(strategies).toHaveLength(5);
    });

    it('should provide detailed strategy information', () => {
      const strategies = orchestrator.getRegisteredStrategies();

      strategies.forEach(strategy => {
        expect(strategy.id).toBeTruthy();
        expect(strategy.displayName).toBeTruthy();
        expect(strategy.description).toBeTruthy();
      });
    });

    it('should retrieve strategy by ID', () => {
      const parallelStrategy = orchestrator.getStrategy('parallel-discovery');
      expect(parallelStrategy).toBeTruthy();
      expect(parallelStrategy?.strategyId).toBe('parallel-discovery');

      const nonExistentStrategy = orchestrator.getStrategy('non-existent');
      expect(nonExistentStrategy).toBeNull();
    });
  });

  describe('PreCompiledRegistryStrategy Selection', () => {
    it('should select pre-compiled registry strategy when skipDiscovery and registry provided', async () => {
      const registry: HandlerRegistry = {
        commands: [
          {
            id: 'cmd-1',
            messageType: createMockConstructor('PreCompiledCommand'),
            handlerType: createMockConstructor('PreCompiledHandler'),
          },
        ],
        queries: [],
        events: [],
        domainServices: [],
      };

      const config: PerformanceConfigurationOptions = {
        performanceMode: 'enterprise',
        skipDiscovery: true,
        preCompiledRegistry: registry,
      };

      const result = await orchestrator.optimize(config, container, []);

      expect(result.strategyUsed).toBe('pre-compiled-registry');
      expect(result.handlers).toHaveLength(1);
      expect(result.handlers[0]?.messageType?.name).toBe('PreCompiledCommand');
      expect(result.metrics.success).toBe(true);
      expect(result.metrics.metadata?.discoverySkipped).toBe(true);
    });

    it('should validate pre-compiled registry structure', async () => {
      const invalidRegistry = {
        commands: 'not-an-array',
      };

      const config: PerformanceConfigurationOptions = {
        performanceMode: 'enterprise',
        skipDiscovery: true,
        preCompiledRegistry: invalidRegistry as any,
      };

      // Should fallback to standard discovery due to invalid registry
      const result = await orchestrator.optimize(config, container, mockPlugins);
      expect(result.strategyUsed).toBe('standard-discovery');
    });
  });

  describe('SelectiveDiscoveryStrategy Selection', () => {
    it('should select selective discovery strategy when contexts specified', async () => {
      const config: PerformanceConfigurationOptions = {
        performanceMode: 'production',
        contexts: ['test-context', 'order-context'],
      };

      const result = await orchestrator.optimize(config, container, mockPlugins);

      expect(result.strategyUsed).toBe('selective-discovery');
      expect(result.handlers).toHaveLength(2);
      expect(result.metrics.success).toBe(true);
      expect(result.metrics.metadata?.contextsRequested).toBe(2);
    });

    it('should filter handlers by specified contexts', async () => {
      const mixedContextPlugins = [
        createMockPlugin('MixedContextPlugin', [
          {
            type: 'command',
            messageType: createMockConstructor('OrderCommand'),
            handlerType: createMockConstructor('OrderHandler'),
            metadata: { context: 'order-context' },
          },
          {
            type: 'command',
            messageType: createMockConstructor('PaymentCommand'),
            handlerType: createMockConstructor('PaymentHandler'),
            metadata: { context: 'payment-context' },
          },
        ]),
      ];

      const config: PerformanceConfigurationOptions = {
        performanceMode: 'production',
        contexts: ['order-context'],
      };

      const result = await orchestrator.optimize(config, container, mixedContextPlugins);

      expect(result.strategyUsed).toBe('selective-discovery');
      expect(result.handlers).toHaveLength(1);
      expect((result.handlers[0]?.metadata as any)?.context).toBe('order-context');
    });
  });

  describe('ParallelDiscoveryStrategy Selection', () => {
    it('should select parallel discovery strategy in enterprise mode with parallel processing', async () => {
      const config: PerformanceConfigurationOptions = {
        performanceMode: 'enterprise',
        parallelRegistration: true,
      };

      const result = await orchestrator.optimize(config, container, mockPlugins);

      expect(result.strategyUsed).toBe('parallel-discovery');
      expect(result.handlers).toHaveLength(2);
      expect(result.metrics.success).toBe(true);
      expect(result.metrics.metadata?.parallelPlugins).toBe(2);
    });

    it('should not select parallel strategy with single plugin', async () => {
      const singlePlugin = mockPlugins.slice(0, 1);

      const config: PerformanceConfigurationOptions = {
        performanceMode: 'enterprise',
        parallelRegistration: true,
      };

      const result = await orchestrator.optimize(config, container, singlePlugin);

      expect(result.strategyUsed).not.toBe('parallel-discovery');
      expect(result.strategyUsed).toBe('standard-discovery'); // Should fallback
    });

    it('should measure parallel execution performance', async () => {
      const slowPlugins = [
        {
          name: 'SlowPlugin1',
          isAvailable: () => true,
          discoverHandlers: vi.fn().mockImplementation(async () => {
            await new Promise(resolve => setTimeout(resolve, 100));
            return [
              {
                type: 'command',
                messageType: createMockConstructor('SlowCommand1'),
                handlerType: createMockConstructor('SlowHandler1'),
              },
            ];
          }),
        },
        {
          name: 'SlowPlugin2',
          isAvailable: () => true,
          discoverHandlers: vi.fn().mockImplementation(async () => {
            await new Promise(resolve => setTimeout(resolve, 100));
            return [
              {
                type: 'command',
                messageType: createMockConstructor('SlowCommand2'),
                handlerType: createMockConstructor('SlowHandler2'),
              },
            ];
          }),
        },
      ];

      const config: PerformanceConfigurationOptions = {
        performanceMode: 'enterprise',
        parallelRegistration: true,
      };

      const startTime = performance.now();
      const result = await orchestrator.optimize(config, container, slowPlugins);
      const executionTime = performance.now() - startTime;

      expect(result.strategyUsed).toBe('parallel-discovery');
      expect(executionTime).toBeLessThan(150); // Should be faster than sequential (200ms)
      expect(result.metrics.metadata?.parallelSpeedup).toBeGreaterThan(1);
    });
  });

  describe('CachedDiscoveryStrategy Selection', () => {
    it('should select cached discovery strategy in production with autoOptimize', async () => {
      const config: PerformanceConfigurationOptions = {
        performanceMode: 'production',
        autoOptimize: true,
      };

      const result = await orchestrator.optimize(config, container, mockPlugins);

      expect(result.strategyUsed).toBe('cached-discovery');
      expect(result.handlers).toHaveLength(2);
      expect(result.metrics.success).toBe(true);
      expect(result.metrics.metadata?.cacheHit).toBe(false); // First execution
    });

    it('should use cached results on subsequent calls', async () => {
      const config: PerformanceConfigurationOptions = {
        performanceMode: 'production',
        autoOptimize: true,
      };

      // First call - cache miss
      const result1 = await orchestrator.optimize(config, container, mockPlugins);
      expect(result1.metrics.metadata?.cacheHit).toBe(false);

      // Second call - cache hit
      const result2 = await orchestrator.optimize(config, container, mockPlugins);
      expect(result2.metrics.metadata?.cacheHit).toBe(true);

      // Plugins should only be called once
      expect(mockPlugins[0]?.discoverHandlers).toHaveBeenCalledTimes(1);
      expect(mockPlugins[1]?.discoverHandlers).toHaveBeenCalledTimes(1);
    });

    it('should also select cached strategy in enterprise mode without parallel processing', async () => {
      const config: PerformanceConfigurationOptions = {
        performanceMode: 'enterprise',
        autoOptimize: true,
        parallelRegistration: false,
      };

      const result = await orchestrator.optimize(config, container, mockPlugins);

      expect(result.strategyUsed).toBe('cached-discovery');
      expect(result.metrics.success).toBe(true);
    });
  });

  describe('StandardDiscoveryStrategy Fallback', () => {
    it('should fallback to standard discovery when no optimizations apply', async () => {
      const config: PerformanceConfigurationOptions = {
        performanceMode: 'development',
        // No optimizations enabled
      };

      const result = await orchestrator.optimize(config, container, mockPlugins);

      expect(result.strategyUsed).toBe('standard-discovery');
      expect(result.handlers).toHaveLength(2);
      expect(result.metrics.success).toBe(true);
    });

    it('should use standard discovery when all other strategies are unavailable', async () => {
      const config: PerformanceConfigurationOptions = {
        performanceMode: 'enterprise',
        parallelRegistration: true,
        // Single plugin will make parallel strategy unavailable
      };

      const result = await orchestrator.optimize(config, container, mockPlugins.slice(0, 1));

      expect(result.strategyUsed).toBe('standard-discovery');
      expect(result.handlers).toHaveLength(1);
    });
  });

  describe('Strategy Priority and Selection Logic', () => {
    it('should prioritize pre-compiled registry over all other strategies', async () => {
      const registry: HandlerRegistry = {
        commands: [
          {
            id: 'cmd-1',
            messageType: createMockConstructor('PreCompiledCmd'),
            handlerType: createMockConstructor('PreCompiledHandler'),
          },
        ],
        queries: [],
        events: [],
        domainServices: [],
      };

      const config: PerformanceConfigurationOptions = {
        performanceMode: 'enterprise',
        skipDiscovery: true,
        preCompiledRegistry: registry,
        contexts: ['test-context'], // Would trigger selective
        autoOptimize: true, // Would trigger cached
        parallelRegistration: true, // Would trigger parallel
      };

      const result = await orchestrator.optimize(config, container, mockPlugins);

      expect(result.strategyUsed).toBe('pre-compiled-registry');
    });

    it('should prioritize selective discovery over cached/parallel when contexts specified', async () => {
      const config: PerformanceConfigurationOptions = {
        performanceMode: 'production',
        contexts: ['test-context'], // Should trigger selective
        autoOptimize: true, // Would also trigger cached
      };

      const result = await orchestrator.optimize(config, container, mockPlugins);

      expect(result.strategyUsed).toBe('selective-discovery');
    });

    it('should prioritize parallel over cached in enterprise mode', async () => {
      const config: PerformanceConfigurationOptions = {
        performanceMode: 'enterprise',
        parallelRegistration: true, // Should trigger parallel
        autoOptimize: true, // Would also trigger cached
      };

      const result = await orchestrator.optimize(config, container, mockPlugins);

      expect(result.strategyUsed).toBe('parallel-discovery');
    });
  });

  describe('Configuration and Timeout Handling', () => {
    it('should handle timeout configuration correctly', async () => {
      const slowPlugin = {
        name: 'SlowPlugin',
        isAvailable: () => true,
        discoverHandlers: vi.fn().mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 200));
          return [];
        }),
      };

      const config: PerformanceConfigurationOptions = {
        performanceMode: 'production',
        timeout: 100,
        autoOptimize: true,
      };

      const result = await orchestrator.optimize(config, container, [slowPlugin]);

      expect(result.metrics.success).toBe(false);
      expect(result.metrics.error).toContain('timeout');
    });

    it('should handle maxHandlers configuration', async () => {
      const largePlugin = {
        name: 'LargePlugin',
        constructor: { name: 'LargePlugin' },
        isAvailable: () => true,
        discoverHandlers: vi.fn().mockResolvedValue(
          Array.from({ length: 10 }, (_, i) => ({
            type: 'command',
            messageType: { name: `Command${i}` },
            handlerType: { name: `Handler${i}` },
          }))
        ),
      };

      const config: PerformanceConfigurationOptions = {
        performanceMode: 'production',
        maxHandlers: 5,
      };

      const result = await orchestrator.optimize(config, container, [largePlugin]);

      expect(result.handlers).toHaveLength(5);
      expect(result.metrics.success).toBe(true);
    });
  });

  describe('Error Handling and Graceful Degradation', () => {
    it('should fallback to standard discovery when primary strategy fails', async () => {
      const failingPlugin = {
        name: 'FailingPlugin',
        constructor: { name: 'FailingPlugin' },
        isAvailable: () => true,
        discoverHandlers: vi.fn().mockRejectedValue(new Error('Plugin failed')),
      };

      // Force cached strategy selection, but with critical failure that should trigger fallback
      const config: PerformanceConfigurationOptions = {
        performanceMode: 'production',
        autoOptimize: true,
      };

      // Create a scenario where strategy itself fails critically (strategy throws)
      // Mock the cache to throw an error during optimization that isn't caught
      const originalOptimize = (orchestrator as any).strategies.get('cached-discovery').optimize;
      (orchestrator as any).strategies.get('cached-discovery').optimize = vi
        .fn()
        .mockRejectedValue(new Error('Strategy optimization failed'));

      const result = await orchestrator.optimize(config, container, [failingPlugin]);

      // Restore original method
      (orchestrator as any).strategies.get('cached-discovery').optimize = originalOptimize;

      // Should fallback gracefully
      expect(result.strategyUsed).toBe('standard-discovery');
      expect(result.metrics.metadata?.fallbackUsed).toBe(true);
      expect(result.metrics.metadata?.originalStrategy).toBe('cached-discovery');
      expect(result.metrics.error).toContain('Primary strategy failed');
    });

    it('should handle multiple strategy failures with final fallback', async () => {
      // Create a scenario where multiple strategies might fail
      const config: PerformanceConfigurationOptions = {
        performanceMode: 'enterprise',
        parallelRegistration: true,
        autoOptimize: true,
      };

      const result = await orchestrator.optimize(config, container, []);

      // Should succeed with some strategy (even with empty plugins)
      expect(result.metrics.success).toBe(true);
      expect(result.handlers).toHaveLength(0);
    });

    it('should handle invalid configuration gracefully', async () => {
      const config: PerformanceConfigurationOptions = {
        performanceMode: 'invalid' as any,
      };

      const [optimizeError] = await safeRun(
        async () => await orchestrator.optimize(config, container, mockPlugins)
      );

      expect(optimizeError).toBeUndefined(); // Should not throw
    });
  });

  describe('Strategy Validation', () => {
    it('should validate all strategies correctly', async () => {
      const context = {
        container,
        discoveryPlugins: mockPlugins,
        performanceMode: 'enterprise' as const,
        parallelProcessing: true,
        contexts: ['test-context'],
        skipDiscovery: true,
        preCompiledRegistry: {
          commands: [],
          queries: [],
          events: [],
          domainServices: [],
        },
      };

      const validation = await orchestrator.validateStrategies(context);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should report strategy validation errors', async () => {
      const invalidContext = {
        container,
        discoveryPlugins: [], // Empty plugins will cause some strategies to fail validation
        performanceMode: 'development' as const,
      };

      const validation = await orchestrator.validateStrategies(invalidContext);

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Integration with Different Container Types', () => {
    it('should work with different container implementations', async () => {
      const customContainer = new SimpleContainer();
      customContainer.registerInstance('testService', { name: 'Test' });

      const config: PerformanceConfigurationOptions = {
        performanceMode: 'production',
      };

      const result = await orchestrator.optimize(config, customContainer, mockPlugins);

      expect(result.metrics.success).toBe(true);
      expect(result.handlers).toHaveLength(2);
    });
  });

  describe('Performance Metrics Collection', () => {
    it('should provide comprehensive performance metrics', async () => {
      const config: PerformanceConfigurationOptions = {
        performanceMode: 'enterprise',
        parallelRegistration: true,
      };

      const result = await orchestrator.optimize(config, container, mockPlugins);

      expect(result.metrics.discoveryTime).toBeGreaterThan(0);
      expect(result.metrics.handlersFound).toBe(2);
      expect(result.metrics.memoryUsage).toBeDefined();
      expect(result.metrics.strategyUsed).toBe('parallel-discovery');
      expect(result.metrics.timestamp).toBeInstanceOf(Date);
      expect(result.metrics.success).toBe(true);
      expect(result.metrics.metadata).toBeDefined();
    });

    it('should track memory usage correctly', async () => {
      const config: PerformanceConfigurationOptions = {
        performanceMode: 'production',
        autoOptimize: true,
      };

      const result = await orchestrator.optimize(config, container, mockPlugins);

      expect(typeof result.metrics.memoryUsage).toBe('number');
      // Memory usage can be positive or negative (GC effects)
    });
  });
});
