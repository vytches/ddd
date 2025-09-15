/**
 * VP-012: CachedDiscoveryStrategy Tests
 * Comprehensive test coverage for LRU cache with TTL
 */

import { safeRun } from '@vytches/ddd-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SimpleContainer } from '../../../src/containers/simple-container';
import type { IPerformanceContext } from '../../../src/performance/abstractions/performance-strategy.interface';
import { CachedDiscoveryStrategy } from '../../../src/performance/strategies/cached-discovery-strategy';

describe('CachedDiscoveryStrategy', () => {
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

  let strategy: CachedDiscoveryStrategy;
  let mockPlugin: any;

  beforeEach(() => {
    strategy = new CachedDiscoveryStrategy({
      maxEntries: 5,
      defaultTtl: 1000, // 1 second for testing
      enableStats: true,
      persistent: false,
    });

    mockPlugin = createMockPlugin('TestPlugin', [
      {
        type: 'command',
        messageType: { name: 'TestCommand' },
        handlerType: { name: 'TestHandler' },
        metadata: { context: 'test-context' },
      },
    ]);
  });

  afterEach(() => {
    strategy.clearCache();
  });

  describe('Strategy Identity', () => {
    it('should have correct strategy metadata', () => {
      expect(strategy.strategyId).toBe('cached-discovery');
      expect(strategy.displayName).toBe('Cached Discovery');
      expect(strategy.description).toContain('LRU cache with TTL optimization');
    });
  });

  describe('canHandle', () => {
    it('should handle production and enterprise modes without parallel processing', () => {
      const productionContext: IPerformanceContext = {
        performanceMode: 'production',
        discoveryPlugins: [],
        parallelProcessing: false,
        container: createMockContainer(),
      };

      expect(strategy.canHandle(productionContext)).toBe(true);

      const enterpriseContext: IPerformanceContext = {
        performanceMode: 'enterprise',
        discoveryPlugins: [],
        parallelProcessing: false,
        container: createMockContainer(),
      };

      expect(strategy.canHandle(enterpriseContext)).toBe(true);
    });

    it('should not handle development mode', () => {
      const context: IPerformanceContext = {
        performanceMode: 'development',
        discoveryPlugins: [],
        container: createMockContainer(),
        parallelProcessing: false,
      };

      expect(strategy.canHandle(context)).toBe(false);
    });

    it('should not handle parallel processing contexts', () => {
      const context: IPerformanceContext = {
        performanceMode: 'production',
        discoveryPlugins: [],
        container: createMockContainer(),
        parallelProcessing: true,
      };

      expect(strategy.canHandle(context)).toBe(false);
    });
  });

  describe('Cache Operations', () => {
    it('should cache discovery results on first call', async () => {
      const context: IPerformanceContext = {
        performanceMode: 'production',
        container: createMockContainer(),
        discoveryPlugins: [mockPlugin],
      };

      // First call - cache miss
      const result1 = await strategy.optimize(context);
      expect(mockPlugin.discoverHandlers).toHaveBeenCalledTimes(1);
      expect(result1.metrics.metadata?.cacheHit).toBe(false);
      expect(result1.handlers).toHaveLength(1);

      // Second call - cache hit
      const result2 = await strategy.optimize(context);
      expect(mockPlugin.discoverHandlers).toHaveBeenCalledTimes(1); // Not called again
      expect(result2.metrics.metadata?.cacheHit).toBe(true);
      expect(result2.handlers).toHaveLength(1);
    });

    it('should respect TTL and expire cached entries', async () => {
      const shortTtlStrategy = new CachedDiscoveryStrategy({
        maxEntries: 5,
        defaultTtl: 50, // 50ms for testing
        enableStats: true,
      });

      const context: IPerformanceContext = {
        performanceMode: 'production',
        container: createMockContainer(),
        discoveryPlugins: [mockPlugin],
      };

      // First call - cache miss
      await shortTtlStrategy.optimize(context);
      expect(mockPlugin.discoverHandlers).toHaveBeenCalledTimes(1);

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 100));

      // Third call - cache miss due to expiration
      await shortTtlStrategy.optimize(context);
      expect(mockPlugin.discoverHandlers).toHaveBeenCalledTimes(2);

      shortTtlStrategy.clearCache();
    });

    it('should implement LRU eviction correctly', async () => {
      const smallCacheStrategy = new CachedDiscoveryStrategy({
        maxEntries: 2,
        defaultTtl: 10000, // Long TTL
        enableStats: true,
      });

      const contexts = [1, 2, 3].map(i => ({
        performanceMode: 'production' as const,
        discoveryPlugins: [
          createMockPlugin(`Plugin${i}`, [
            {
              type: 'command',
              messageType: { name: `Command${i}` },
              handlerType: { name: `Handler${i}` },
            },
          ]),
        ],
        contexts: [`context-${i}`],
        container: createMockContainer(),
      }));

      // Fill cache to capacity
      await smallCacheStrategy.optimize(contexts[0]!);
      await smallCacheStrategy.optimize(contexts[1]!);

      // Add third item - should evict first
      await smallCacheStrategy.optimize(contexts[2]!);

      // Access first context again - should be cache miss
      const result = await smallCacheStrategy.optimize(contexts[0]!);
      expect(result.metrics.metadata?.cacheHit).toBe(false);

      smallCacheStrategy.clearCache();
    });

    it('should generate deterministic cache keys', async () => {
      const context1: IPerformanceContext = {
        performanceMode: 'production',
        discoveryPlugins: [mockPlugin],
        contexts: ['order-context', 'payment-context'],
        maxHandlers: 100,
        container: createMockContainer(),
      };

      const context2: IPerformanceContext = {
        performanceMode: 'production',
        discoveryPlugins: [mockPlugin],
        contexts: ['payment-context', 'order-context'], // Different order
        maxHandlers: 100,
        container: createMockContainer(),
      };

      await strategy.optimize(context1);
      const result2 = await strategy.optimize(context2);

      // Should be cache hit because contexts are sorted
      expect(result2.metrics.metadata?.cacheHit).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle plugin errors gracefully', async () => {
      const errorPlugin = {
        name: 'ErrorPlugin',
        constructor: { name: 'ErrorPlugin' },
        isAvailable: () => true,
        discoverHandlers: vi.fn().mockRejectedValue(new Error('Plugin failed')),
      };

      const goodPlugin = createMockPlugin('GoodPlugin', [
        {
          type: 'command',
          messageType: { name: 'GoodCommand' },
          handlerType: { name: 'GoodHandler' },
        },
      ]);

      const context: IPerformanceContext = {
        performanceMode: 'production',
        discoveryPlugins: [errorPlugin, goodPlugin],
        container: createMockContainer(),
      };

      const result = await strategy.optimize(context);

      expect(result.handlers).toHaveLength(1);
      expect(result.metrics.success).toBe(true);
    });

    it('should handle timeout correctly', async () => {
      const slowPlugin = {
        name: 'SlowPlugin',
        constructor: { name: 'SlowPlugin' },
        isAvailable: () => true,
        discoverHandlers: vi.fn().mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 200));
          return [];
        }),
      };

      const context: IPerformanceContext = {
        performanceMode: 'production',
        discoveryPlugins: [slowPlugin],
        container: createMockContainer(),
        timeout: 100,
      };

      const result = await strategy.optimize(context);

      expect(result.metrics.success).toBe(false);
      expect(result.metrics.error).toContain('timeout');
    });

    it('should handle cache key generation errors', async () => {
      const invalidPlugin = {
        name: 'InvalidPlugin',
        constructor: { name: null }, // Invalid constructor name
        isAvailable: () => true,
        discoverHandlers: vi.fn().mockResolvedValue([]),
      };

      const context: IPerformanceContext = {
        performanceMode: 'production',
        container: createMockContainer(),
        discoveryPlugins: [invalidPlugin],
      };

      const [optimizeError] = await safeRun(async () => await strategy.optimize(context));
      expect(optimizeError).toBeUndefined(); // Should handle gracefully
    });
  });

  describe('Cache Statistics', () => {
    it('should provide cache statistics when enabled', async () => {
      const context: IPerformanceContext = {
        performanceMode: 'production',
        container: createMockContainer(),
        discoveryPlugins: [mockPlugin],
      };

      const result = await strategy.optimize(context);
      const cacheStats = result.metrics.metadata?.cacheStats as any;

      expect(cacheStats).toBeDefined();
      expect(typeof cacheStats?.totalEntries).toBe('number');
      expect(typeof cacheStats?.maxEntries).toBe('number');
      expect(typeof cacheStats?.utilizationRatio).toBe('number');
    });

    it('should not provide statistics when disabled', async () => {
      const noStatsStrategy = new CachedDiscoveryStrategy({
        maxEntries: 5,
        defaultTtl: 1000,
        enableStats: false,
      });

      const context: IPerformanceContext = {
        performanceMode: 'production',
        container: createMockContainer(),
        discoveryPlugins: [mockPlugin],
      };

      const result = await noStatsStrategy.optimize(context);
      expect(result.metrics.metadata?.cacheStats).toEqual({});

      noStatsStrategy.clearCache();
    });
  });

  describe('Handler Limit and Deduplication', () => {
    it('should apply handler limit correctly', async () => {
      const largePlugin = createMockPlugin('LargePlugin', [
        { type: 'command', messageType: { name: 'Command1' }, handlerType: { name: 'Handler1' } },
        { type: 'command', messageType: { name: 'Command2' }, handlerType: { name: 'Handler2' } },
        { type: 'command', messageType: { name: 'Command3' }, handlerType: { name: 'Handler3' } },
        { type: 'command', messageType: { name: 'Command4' }, handlerType: { name: 'Handler4' } },
        { type: 'command', messageType: { name: 'Command5' }, handlerType: { name: 'Handler5' } },
      ]);

      const context: IPerformanceContext = {
        performanceMode: 'production',
        discoveryPlugins: [largePlugin],
        container: createMockContainer(),
        maxHandlers: 3,
      };

      const result = await strategy.optimize(context);
      expect(result.handlers).toHaveLength(3);
    });

    it('should remove duplicate handlers', async () => {
      const duplicatePlugin = createMockPlugin('DuplicatePlugin', [
        {
          type: 'command',
          messageType: { name: 'DuplicateCommand' },
          handlerType: { name: 'DuplicateHandler' },
        },
        {
          type: 'command',
          messageType: { name: 'DuplicateCommand' },
          handlerType: { name: 'DuplicateHandler' },
        },
        {
          type: 'command',
          messageType: { name: 'UniqueCommand' },
          handlerType: { name: 'UniqueHandler' },
        },
      ]);

      const context: IPerformanceContext = {
        performanceMode: 'production',
        container: createMockContainer(),
        discoveryPlugins: [duplicatePlugin],
      };

      const result = await strategy.optimize(context);
      expect(result.handlers).toHaveLength(2);
    });
  });

  describe('validatePrerequisites', () => {
    it('should validate prerequisites correctly', async () => {
      const validContext: IPerformanceContext = {
        performanceMode: 'production',
        discoveryPlugins: [mockPlugin],
        container: createMockContainer(),
      };

      const isValid = await strategy.validatePrerequisites(validContext);
      expect(isValid).toBe(true);
    });

    it('should fail validation without plugins', async () => {
      const invalidContext: IPerformanceContext = {
        performanceMode: 'production',
        discoveryPlugins: [],
        container: createMockContainer(),
      };

      const isValid = await strategy.validatePrerequisites(invalidContext);
      expect(isValid).toBe(false);
    });

    it('should fail validation for development mode', async () => {
      const invalidContext: IPerformanceContext = {
        performanceMode: 'development',
        discoveryPlugins: [mockPlugin],
        container: createMockContainer(),
      };

      const isValid = await strategy.validatePrerequisites(invalidContext);
      expect(isValid).toBe(false);
    });
  });

  describe('Cache Management', () => {
    it('should clear cache completely', async () => {
      const context: IPerformanceContext = {
        performanceMode: 'production',
        container: createMockContainer(),
        discoveryPlugins: [mockPlugin],
      };

      // Add entry to cache
      await strategy.optimize(context);

      // Clear cache
      strategy.clearCache();

      // Next call should be cache miss
      const result = await strategy.optimize(context);
      expect(result.metrics.metadata?.cacheHit).toBe(false);
    });

    it('should handle concurrent cache operations', async () => {
      const context: IPerformanceContext = {
        performanceMode: 'production',
        container: createMockContainer(),
        discoveryPlugins: [mockPlugin],
      };

      // Execute multiple operations concurrently
      const promises = Array.from({ length: 5 }, () => strategy.optimize(context));
      const results = await Promise.all(promises);

      // All should succeed
      results.forEach(result => {
        expect(result.metrics.success).toBe(true);
        expect(result.handlers).toHaveLength(1);
      });

      // Plugin should only be called once
      expect(mockPlugin.discoverHandlers).toHaveBeenCalledTimes(1);
    });
  });
});
