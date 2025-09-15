/**
 * VP-012: SelectiveDiscoveryStrategy Tests
 * Comprehensive test coverage for context-based optimization
 */

import { safeRun } from '@vytches/ddd-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SimpleContainer } from '../../../src/containers/simple-container';
import type { IPerformanceContext } from '../../../src/performance/abstractions/performance-strategy.interface';
import { SelectiveDiscoveryStrategy } from '../../../src/performance/strategies/selective-discovery-strategy';

describe('SelectiveDiscoveryStrategy', () => {
  let strategy: SelectiveDiscoveryStrategy;

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
    strategy = new SelectiveDiscoveryStrategy();
  });

  describe('Strategy Identity', () => {
    it('should have correct strategy metadata', () => {
      expect(strategy.strategyId).toBe('selective-discovery');
      expect(strategy.displayName).toBe('Selective Discovery');
      expect(strategy.description).toContain('Context-based discovery optimization');
    });
  });

  describe('canHandle', () => {
    it('should handle contexts with specified target contexts', () => {
      const context: IPerformanceContext = {
        container: createMockContainer(),
        performanceMode: 'production',
        discoveryPlugins: [],
        contexts: ['order-context', 'payment-context'],
      };

      expect(strategy.canHandle(context)).toBe(true);
    });

    it('should not handle contexts without target contexts', () => {
      const context: IPerformanceContext = {
        performanceMode: 'production',
        discoveryPlugins: [],
        container: createMockContainer(),
        contexts: undefined,
      };

      expect(strategy.canHandle(context)).toBe(false);
    });

    it('should not handle contexts with empty contexts array', () => {
      const context: IPerformanceContext = {
        performanceMode: 'production',
        discoveryPlugins: [],
        container: createMockContainer(),
        contexts: [],
      };

      expect(strategy.canHandle(context)).toBe(false);
    });
  });

  describe('optimize', () => {
    it('should execute selective discovery successfully', async () => {
      const mockPlugin = createMockPlugin('OrderPlugin', [
        {
          type: 'command',
          messageType: { name: 'CreateOrder' },
          handlerType: { name: 'CreateOrderHandler' },
          metadata: { context: 'order-context' },
        },
      ]);

      const context: IPerformanceContext = {
        performanceMode: 'production',
        discoveryPlugins: [mockPlugin],
        container: createMockContainer(),
        contexts: ['order-context'],
      };

      const result = await strategy.optimize(context);

      expect(result.handlers).toHaveLength(1);
      expect(result.metrics.success).toBe(true);
      expect(result.metrics.strategyUsed).toBe('selective-discovery');
      expect(result.metrics.discoveryTime).toBeGreaterThan(0);
      expect(result.metrics.metadata?.contextsProcessed).toBe(1);
    });

    it('should filter handlers by contexts correctly', async () => {
      const mockPlugin = createMockPlugin('MixedPlugin', [
        {
          type: 'command',
          messageType: { name: 'CreateOrder' },
          handlerType: { name: 'CreateOrderHandler' },
          metadata: { context: 'order-context' },
        },
        {
          type: 'command',
          messageType: { name: 'ProcessPayment' },
          handlerType: { name: 'ProcessPaymentHandler' },
          metadata: { context: 'payment-context' },
        },
        {
          type: 'command',
          messageType: { name: 'UpdateInventory' },
          handlerType: { name: 'UpdateInventoryHandler' },
          metadata: { context: 'inventory-context' },
        },
      ]);

      const context: IPerformanceContext = {
        performanceMode: 'production',
        discoveryPlugins: [mockPlugin],
        container: createMockContainer(),
        contexts: ['order-context'],
      };

      const result = await strategy.optimize(context);

      expect(result.handlers).toHaveLength(1);
      expect((result?.handlers?.[0]?.metadata as any)?.context).toBe('order-context');
    });

    it('should include core and common handlers regardless of context', async () => {
      const mockPlugin = createMockPlugin('CorePlugin', [
        {
          type: 'command',
          messageType: { name: 'CoreCommand' },
          handlerType: { name: 'CoreHandler' },
          metadata: { context: 'core' },
        },
        {
          type: 'command',
          messageType: { name: 'CommonCommand' },
          handlerType: { name: 'CommonHandler' },
          metadata: { context: 'common' },
        },
        {
          type: 'command',
          messageType: { name: 'FilteredCommand' },
          handlerType: { name: 'FilteredHandler' },
          metadata: { context: 'filtered-context' },
        },
      ]);

      const context: IPerformanceContext = {
        performanceMode: 'production',
        discoveryPlugins: [mockPlugin],
        container: createMockContainer(),
        contexts: ['order-context'],
      };

      const result = await strategy.optimize(context);

      expect(result.handlers).toHaveLength(2);
      expect(result.handlers.map(h => (h.metadata as any)?.context)).toEqual(
        expect.arrayContaining(['core', 'common'])
      );
    });

    it('should skip plugins based on context hints', async () => {
      const orderPlugin = createMockPlugin('OrderPlugin', [], ['order-context']);
      const paymentPlugin = createMockPlugin('PaymentPlugin', [], ['payment-context']);

      const context: IPerformanceContext = {
        performanceMode: 'production',
        discoveryPlugins: [orderPlugin, paymentPlugin],
        container: createMockContainer(),
        contexts: ['order-context'],
      };

      const result = await strategy.optimize(context);

      expect(orderPlugin.discoverHandlers).toHaveBeenCalled();
      expect(paymentPlugin.discoverHandlers).not.toHaveBeenCalled();
      expect(result.metrics.metadata?.pluginsSkipped).toBe(1);
    });

    it('should apply handler limit correctly', async () => {
      const mockPlugin = createMockPlugin('LargePlugin', [
        {
          type: 'command',
          messageType: { name: 'Command1' },
          handlerType: { name: 'Handler1' },
          metadata: { context: 'order-context' },
        },
        {
          type: 'command',
          messageType: { name: 'Command2' },
          handlerType: { name: 'Handler2' },
          metadata: { context: 'order-context' },
        },
        {
          type: 'command',
          messageType: { name: 'Command3' },
          handlerType: { name: 'Handler3' },
          metadata: { context: 'order-context' },
        },
        {
          type: 'command',
          messageType: { name: 'Command4' },
          handlerType: { name: 'Handler4' },
          metadata: { context: 'order-context' },
        },
        {
          type: 'command',
          messageType: { name: 'Command5' },
          handlerType: { name: 'Handler5' },
          metadata: { context: 'order-context' },
        },
      ]);

      const context: IPerformanceContext = {
        performanceMode: 'production',
        discoveryPlugins: [mockPlugin],
        contexts: ['order-context'],
        container: createMockContainer(),
        maxHandlers: 3,
      };

      const result = await strategy.optimize(context);

      expect(result.handlers).toHaveLength(3);
      expect(result.metrics.success).toBe(true);
    });

    it('should handle timeout correctly', async () => {
      const slowPlugin = {
        name: 'SlowPlugin',
        constructor: { name: 'SlowPlugin' },
        isAvailable: () => true,
        discoverHandlers: vi.fn().mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return [];
        }),
      };

      const context: IPerformanceContext = {
        performanceMode: 'production',
        discoveryPlugins: [slowPlugin],
        contexts: ['order-context'],
        container: createMockContainer(),
        timeout: 50,
      };

      const result = await strategy.optimize(context);

      expect(result.metrics.success).toBe(false);
      expect(result.metrics.error).toContain('timeout');
    });

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
          metadata: { context: 'order-context' },
        },
      ]);

      const context: IPerformanceContext = {
        performanceMode: 'production',
        discoveryPlugins: [errorPlugin, goodPlugin],
        container: createMockContainer(),
        contexts: ['order-context'],
      };

      const result = await strategy.optimize(context);

      // Should continue with good plugin despite error plugin failure
      expect(result.handlers).toHaveLength(1);
      expect(result.metrics.success).toBe(true);
      expect(goodPlugin.discoverHandlers).toHaveBeenCalled();
    });

    it('should remove duplicate handlers', async () => {
      const plugin1 = createMockPlugin('Plugin1', [
        {
          type: 'command',
          messageType: { name: 'DuplicateCommand' },
          handlerType: { name: 'DuplicateHandler' },
          metadata: { context: 'order-context' },
        },
      ]);

      const plugin2 = createMockPlugin('Plugin2', [
        {
          type: 'command',
          messageType: { name: 'DuplicateCommand' },
          handlerType: { name: 'DuplicateHandler' },
          metadata: { context: 'order-context' },
        },
      ]);

      const context: IPerformanceContext = {
        performanceMode: 'production',
        discoveryPlugins: [plugin1, plugin2],
        container: createMockContainer(),
        contexts: ['order-context'],
      };

      const result = await strategy.optimize(context);

      expect(result.handlers).toHaveLength(1);
      expect(result.metrics.success).toBe(true);
    });
  });

  describe('validatePrerequisites', () => {
    it('should validate prerequisites correctly', async () => {
      const validContext: IPerformanceContext = {
        performanceMode: 'production',
        discoveryPlugins: [createMockPlugin('TestPlugin')],
        contexts: ['order-context'],
        container: createMockContainer(),
      };

      const isValid = await strategy.validatePrerequisites(validContext);
      expect(isValid).toBe(true);
    });

    it('should fail validation without plugins', async () => {
      const invalidContext: IPerformanceContext = {
        performanceMode: 'production',
        discoveryPlugins: [],
        contexts: ['order-context'],
        container: createMockContainer(),
      };

      const isValid = await strategy.validatePrerequisites(invalidContext);
      expect(isValid).toBe(false);
    });

    it('should fail validation without contexts', async () => {
      const invalidContext: IPerformanceContext = {
        performanceMode: 'production',
        discoveryPlugins: [createMockPlugin('TestPlugin')],
        contexts: undefined,
        container: createMockContainer(),
      };

      const isValid = await strategy.validatePrerequisites(invalidContext);
      expect(isValid).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle strategy execution errors', async () => {
      const context: IPerformanceContext = {
        performanceMode: 'production',
        discoveryPlugins: [],
        container: createMockContainer(),
        contexts: ['order-context'],
      };

      // Force an error by providing invalid context
      const [strategyError] = safeRun(() => strategy.canHandle(null as any));
      expect(strategyError).toBeUndefined(); // canHandle should not throw

      const result = await strategy.optimize(context);
      expect(result.metrics.success).toBe(true);
      expect(result.handlers).toHaveLength(0);
    });
  });
});
