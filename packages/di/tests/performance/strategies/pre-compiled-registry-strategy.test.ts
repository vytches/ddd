/**
 * VP-012: PreCompiledRegistryStrategy Tests
 * Comprehensive test coverage for zero-discovery enterprise mode
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SimpleContainer } from '../../../src/containers/simple-container';
import type { IPerformanceContext } from '../../../src/performance/abstractions/performance-strategy.interface';
import type { HandlerRegistry } from '../../../src/performance/performance-types';
import { PreCompiledRegistryStrategy } from '../../../src/performance/strategies/pre-compiled-registry-strategy';

describe('PreCompiledRegistryStrategy', () => {
  // Mock container helper for testing
  const createMockContainer = () => new SimpleContainer();

  // Mock constructor functions for testing
  const createMockConstructor = (name: string) => {
    const constructor = class {} as any;
    Object.defineProperty(constructor, 'name', {
      value: name,
      writable: false,
      enumerable: false,
      configurable: true,
    });
    return constructor;
  };

  // Helper function to create mock plugins
  const createMockPlugin = (name: string, handlers: any[] = [], supportedContexts?: string[]) => ({
    name,
    constructor: { name },
    isAvailable: () => true,
    discoverHandlers: vi.fn().mockResolvedValue(handlers),
    ...(supportedContexts && { supportedContexts }),
  });

  let strategy: PreCompiledRegistryStrategy;
  let validRegistry: HandlerRegistry;

  beforeEach(() => {
    strategy = new PreCompiledRegistryStrategy();

    validRegistry = {
      commands: [
        {
          id: 'cmd-1',
          messageType: createMockConstructor('CreateOrder'),
          handlerType: createMockConstructor('CreateOrderHandler'),
          metadata: { context: 'order-context' },
        },
        {
          id: 'cmd-2',
          messageType: createMockConstructor('UpdateOrder'),
          handlerType: createMockConstructor('UpdateOrderHandler'),
          metadata: { context: 'order-context' },
        },
      ],
      queries: [
        {
          id: 'qry-1',
          messageType: createMockConstructor('GetOrder'),
          handlerType: createMockConstructor('GetOrderHandler'),
          metadata: { context: 'order-context' },
        },
      ],
      events: [
        {
          id: 'evt-1',
          messageType: createMockConstructor('OrderCreated'),
          handlerType: createMockConstructor('OrderCreatedHandler'),
          metadata: { context: 'order-context' },
        },
        {
          id: 'evt-2',
          messageType: createMockConstructor('OrderUpdated'),
          handlerType: createMockConstructor('OrderUpdatedHandler'),
          metadata: { context: 'inventory-context' },
        },
      ],
      domainServices: [
        {
          id: 'svc-1',
          messageType: createMockConstructor('OrderValidationService'),
          handlerType: createMockConstructor('OrderValidationServiceImpl'),
          metadata: { context: 'core' },
        },
      ],
    };
  });

  describe('Strategy Identity', () => {
    it('should have correct strategy metadata', () => {
      expect(strategy.strategyId).toBe('pre-compiled-registry');
      expect(strategy.displayName).toBe('Pre-Compiled Registry');
      expect(strategy.description).toContain('Zero-discovery enterprise mode');
      expect(strategy.description).toContain('compile-time generated handler registry');
    });
  });

  describe('canHandle', () => {
    it('should handle context with skipDiscovery and valid registry', () => {
      const context: IPerformanceContext = {
        performanceMode: 'enterprise',
        discoveryPlugins: [],
        skipDiscovery: true,
        container: createMockContainer(),
        preCompiledRegistry: validRegistry,
      };

      expect(strategy.canHandle(context)).toBe(true);
    });

    it('should not handle context without skipDiscovery', () => {
      const context: IPerformanceContext = {
        performanceMode: 'enterprise',
        discoveryPlugins: [],
        skipDiscovery: false,
        container: createMockContainer(),
        preCompiledRegistry: validRegistry,
      };

      expect(strategy.canHandle(context)).toBe(false);
    });

    it('should not handle context without preCompiledRegistry', () => {
      const context: IPerformanceContext = {
        performanceMode: 'enterprise',
        discoveryPlugins: [],
        skipDiscovery: true,
        container: createMockContainer(),
        preCompiledRegistry: null,
      };

      expect(strategy.canHandle(context)).toBe(false);
    });

    it('should not handle context with invalid registry structure', () => {
      const invalidRegistry = {
        commands: 'not-an-array',
        queries: [],
        events: [],
        domainServices: [],
      };

      const context: IPerformanceContext = {
        performanceMode: 'enterprise',
        discoveryPlugins: [],
        skipDiscovery: true,
        container: createMockContainer(),
        preCompiledRegistry: invalidRegistry as any,
      };

      expect(strategy.canHandle(context)).toBe(false);
    });
  });

  describe('Registry Transformation', () => {
    it('should transform registry to handlers correctly', async () => {
      const context: IPerformanceContext = {
        performanceMode: 'enterprise',
        discoveryPlugins: [],
        skipDiscovery: true,
        container: createMockContainer(),
        preCompiledRegistry: validRegistry,
      };

      const result = await strategy.optimize(context);

      expect(result.handlers).toHaveLength(6); // 2 commands + 1 query + 2 events + 1 service
      expect(result.metrics.success).toBe(true);
      expect(result.metrics.strategyUsed).toBe('pre-compiled-registry');
      expect(result.metrics.discoveryTime).toBeGreaterThan(0);
      expect(result.metrics.metadata?.discoverySkipped).toBe(true);
      expect(result.metrics.metadata?.registryTransformation).toBe('pre-compiled');
    });

    it('should provide detailed registry statistics', async () => {
      const context: IPerformanceContext = {
        performanceMode: 'enterprise',
        container: createMockContainer(),
        discoveryPlugins: [createMockPlugin('SkippedPlugin')],
        skipDiscovery: true,
        preCompiledRegistry: validRegistry,
      };

      const result = await strategy.optimize(context);

      const metadata = result.metrics.metadata;
      expect(metadata?.totalRegistryEntries).toBe(6);
      expect((metadata as any)?.handlerTypeDistribution?.commands).toBe(2);
      expect((metadata as any)?.handlerTypeDistribution?.queries).toBe(1);
      expect((metadata as any)?.handlerTypeDistribution?.events).toBe(2);
      expect((metadata as any)?.handlerTypeDistribution?.services).toBe(1);
      expect(metadata?.pluginsSkipped).toBe(1);
      expect(metadata?.performanceGain).toBe('maximum');
    });

    it('should track context distribution correctly', async () => {
      const context: IPerformanceContext = {
        performanceMode: 'enterprise',
        discoveryPlugins: [],
        skipDiscovery: true,
        container: createMockContainer(),
        preCompiledRegistry: validRegistry,
      };

      const result = await strategy.optimize(context);

      const contextDistribution = result.metrics.metadata?.contextDistribution;
      expect(contextDistribution).toBeDefined();
      expect((contextDistribution as any)?.['order-context']).toBe(4); // 2 commands + 1 query + 1 event
      expect((contextDistribution as any)?.['inventory-context']).toBe(1); // 1 event
      expect((contextDistribution as any)?.['core']).toBe(1); // 1 service
    });

    it('should handle registry entries with missing metadata', async () => {
      const registryWithMissingMetadata = {
        ...validRegistry,
        commands: [
          {
            id: 'cmd-1',
            messageType: { name: 'CreateOrder' },
            handlerType: { name: 'CreateOrderHandler' },
            // No metadata
          },
        ],
      };

      const context: IPerformanceContext = {
        performanceMode: 'enterprise',
        discoveryPlugins: [],
        skipDiscovery: true,
        container: createMockContainer(),
        preCompiledRegistry: registryWithMissingMetadata,
      };

      const result = await strategy.optimize(context);

      expect(result.handlers).toHaveLength(5); // 1 command + 1 query + 2 events + 1 service
      expect(result.metrics.success).toBe(true);

      const contextDistribution = result.metrics.metadata?.contextDistribution;
      expect((contextDistribution as any)?.['default']).toBe(1); // Command without context
    });

    it('should skip invalid registry entries', async () => {
      const registryWithInvalidEntries = {
        commands: [
          {
            id: 'cmd-valid',
            messageType: createMockConstructor('ValidCommand'),
            handlerType: createMockConstructor('ValidHandler'),
          },
          {
            id: 'cmd-invalid',
            // Missing messageType and handlerType
          },
        ],
        queries: [],
        events: [],
        domainServices: [],
      };

      const context: IPerformanceContext = {
        performanceMode: 'enterprise',
        discoveryPlugins: [],
        skipDiscovery: true,
        container: createMockContainer(),
        preCompiledRegistry: registryWithInvalidEntries as any,
      };

      const result = await strategy.optimize(context);

      expect(result.handlers).toHaveLength(1); // Only valid entry
      expect(result.metrics.success).toBe(true);
    });
  });

  describe('Context Filtering', () => {
    it('should filter handlers by specified contexts', async () => {
      const context: IPerformanceContext = {
        performanceMode: 'enterprise',
        discoveryPlugins: [],
        skipDiscovery: true,
        preCompiledRegistry: validRegistry,
        container: createMockContainer(),
        contexts: ['order-context'],
      };

      const result = await strategy.optimize(context);

      // Should include order-context handlers + core handlers
      expect(result.handlers).toHaveLength(5); // 4 order-context + 1 core

      const contexts = result.handlers.map(h => (h.metadata as any)?.context);
      expect(contexts).toEqual(expect.arrayContaining(['order-context', 'core']));
    });

    it('should always include core and common handlers', async () => {
      const registryWithCoreHandlers = {
        ...validRegistry,
        events: [
          {
            id: 'core-evt',
            messageType: createMockConstructor('CoreEvent'),
            handlerType: createMockConstructor('CoreHandler'),
            metadata: { context: 'core' },
          },
          {
            id: 'common-evt',
            messageType: createMockConstructor('CommonEvent'),
            handlerType: createMockConstructor('CommonHandler'),
            metadata: { context: 'common' },
          },
        ],
      };

      const context: IPerformanceContext = {
        performanceMode: 'enterprise',
        discoveryPlugins: [],
        skipDiscovery: true,
        preCompiledRegistry: registryWithCoreHandlers,
        container: createMockContainer(),
        contexts: ['non-existent-context'],
      };

      const result = await strategy.optimize(context);

      // Should include core and common handlers even with non-matching context
      expect(result.handlers.length).toBeGreaterThan(0);
      const contexts = result.handlers.map(h => (h.metadata as any)?.context);
      expect(contexts).toEqual(expect.arrayContaining(['core', 'common']));
    });
  });

  describe('Handler Limiting and Prioritization', () => {
    it('should apply handler limit with prioritization', async () => {
      const largeRegistry: HandlerRegistry = {
        commands: Array.from({ length: 5 }, (_, i) => ({
          id: `cmd-${i}`,
          messageType: createMockConstructor(`Command${i}`),
          handlerType: createMockConstructor(`Handler${i}`),
          metadata: { context: 'order-context' },
        })),
        queries: Array.from({ length: 5 }, (_, i) => ({
          id: `qry-${i}`,
          messageType: createMockConstructor(`Query${i}`),
          handlerType: createMockConstructor(`QueryHandler${i}`),
          metadata: { context: 'order-context' },
        })),
        events: Array.from({ length: 5 }, (_, i) => ({
          id: `evt-${i}`,
          messageType: createMockConstructor(`Event${i}`),
          handlerType: createMockConstructor(`EventHandler${i}`),
          metadata: { context: 'order-context' },
        })),
        domainServices: [
          {
            id: 'core-svc',
            messageType: createMockConstructor('CoreService'),
            handlerType: createMockConstructor('CoreServiceImpl'),
            metadata: { context: 'core' },
          },
        ],
      };

      const context: IPerformanceContext = {
        performanceMode: 'enterprise',
        discoveryPlugins: [],
        skipDiscovery: true,
        preCompiledRegistry: largeRegistry,
        container: createMockContainer(),
        maxHandlers: 10,
      };

      const result = await strategy.optimize(context);

      expect(result.handlers).toHaveLength(10);
      expect(result.metrics.success).toBe(true);

      // Core handlers should be prioritized
      const coreHandlers = result.handlers.filter(h => (h.metadata as any)?.context === 'core');
      expect(coreHandlers.length).toBeGreaterThan(0);
    });

    it('should prioritize handlers by type correctly', async () => {
      const context: IPerformanceContext = {
        performanceMode: 'enterprise',
        discoveryPlugins: [],
        skipDiscovery: true,
        preCompiledRegistry: validRegistry,
        container: createMockContainer(),
        maxHandlers: 3,
      };

      const result = await strategy.optimize(context);

      expect(result.handlers).toHaveLength(3);

      // Should prioritize commands and include core service
      const types = result.handlers.map(h => h.type);
      expect(types).toEqual(expect.arrayContaining(['domain-service', 'command']));
    });
  });

  describe('Validation and Cleanup', () => {
    it('should remove duplicate handlers', async () => {
      const registryWithDuplicates = {
        commands: [
          {
            id: 'cmd-1',
            messageType: { name: 'DuplicateCommand' },
            handlerType: { name: 'DuplicateHandler' },
          },
          {
            id: 'cmd-2',
            messageType: { name: 'DuplicateCommand' },
            handlerType: { name: 'DuplicateHandler' },
          },
        ],
        queries: [],
        events: [],
        domainServices: [],
      };

      const context: IPerformanceContext = {
        performanceMode: 'enterprise',
        discoveryPlugins: [],
        skipDiscovery: true,
        container: createMockContainer(),
        preCompiledRegistry: registryWithDuplicates,
      };

      const result = await strategy.optimize(context);

      expect(result.handlers).toHaveLength(1); // Duplicate removed
      expect(result.metrics.success).toBe(true);
    });

    it('should validate handler structure', async () => {
      const registryWithInvalidHandlers = {
        commands: [
          {
            id: 'valid-cmd',
            messageType: { name: 'ValidCommand' },
            handlerType: { name: 'ValidHandler' },
          },
          {
            id: 'invalid-cmd',
            messageType: null,
            handlerType: undefined,
          },
        ],
        queries: [],
        events: [],
        domainServices: [],
      };

      const context: IPerformanceContext = {
        performanceMode: 'enterprise',
        discoveryPlugins: [],
        skipDiscovery: true,
        container: createMockContainer(),
        preCompiledRegistry: registryWithInvalidHandlers as any,
      };

      const result = await strategy.optimize(context);

      expect(result.handlers).toHaveLength(1); // Invalid handler skipped
      expect(result.handlers[0]?.messageType.name).toBe('ValidCommand');
    });
  });

  describe('Error Handling', () => {
    it('should handle registry transformation errors gracefully', async () => {
      const malformedRegistry = {
        commands: [
          {
            id: 'cmd-1',
            messageType: createMockConstructor('TestCommand'),
            handlerType: createMockConstructor('TestHandler'),
          },
        ],
        queries: 'not-an-array', // Invalid
        events: [],
        domainServices: [],
      };

      const context: IPerformanceContext = {
        performanceMode: 'enterprise',
        discoveryPlugins: [],
        skipDiscovery: true,
        container: createMockContainer(),
        preCompiledRegistry: malformedRegistry as any,
      };

      const result = await strategy.optimize(context);

      expect(result.metrics.success).toBe(false); // Strategy should detect invalid registry structure
      expect(result.metrics.error).toBeDefined();
      expect(result.handlers).toHaveLength(0);
    });

    it('should handle missing registry gracefully', async () => {
      const context: IPerformanceContext = {
        performanceMode: 'enterprise',
        discoveryPlugins: [],
        skipDiscovery: true,
        container: createMockContainer(),
        preCompiledRegistry: null,
      };

      const result = await strategy.optimize(context);

      expect(result.metrics.success).toBe(false);
      expect(result.handlers).toHaveLength(0);
    });
  });

  describe('validatePrerequisites', () => {
    it('should validate prerequisites correctly', async () => {
      const validContext: IPerformanceContext = {
        performanceMode: 'enterprise',
        discoveryPlugins: [],
        skipDiscovery: true,
        preCompiledRegistry: validRegistry,
        container: createMockContainer(),
      };

      const isValid = await strategy.validatePrerequisites(validContext);
      expect(isValid).toBe(true);
    });

    it('should fail validation without skipDiscovery', async () => {
      const invalidContext: IPerformanceContext = {
        performanceMode: 'enterprise',
        discoveryPlugins: [],
        skipDiscovery: false,
        preCompiledRegistry: validRegistry,
        container: createMockContainer(),
      };

      const isValid = await strategy.validatePrerequisites(invalidContext);
      expect(isValid).toBe(false);
    });

    it('should fail validation without preCompiledRegistry', async () => {
      const invalidContext: IPerformanceContext = {
        performanceMode: 'enterprise',
        discoveryPlugins: [],
        skipDiscovery: true,
        preCompiledRegistry: null,
        container: createMockContainer(),
      };

      const isValid = await strategy.validatePrerequisites(invalidContext);
      expect(isValid).toBe(false);
    });

    it('should fail validation with invalid registry structure', async () => {
      const invalidRegistry = { invalid: 'structure' };

      const invalidContext: IPerformanceContext = {
        performanceMode: 'enterprise',
        discoveryPlugins: [],
        container: createMockContainer(),
        skipDiscovery: true,
        preCompiledRegistry: invalidRegistry as any,
      };

      const isValid = await strategy.validatePrerequisites(invalidContext);
      expect(isValid).toBe(false);
    });
  });

  describe('Registry Statistics and Metadata', () => {
    it('should provide comprehensive metadata', async () => {
      const context: IPerformanceContext = {
        performanceMode: 'enterprise',
        container: createMockContainer(),
        discoveryPlugins: [
          createMockPlugin('Plugin1'),
          createMockPlugin('Plugin2'),
          createMockPlugin('Plugin3'),
        ],
        skipDiscovery: true,
        preCompiledRegistry: validRegistry,
      };

      const result = await strategy.optimize(context);

      const metadata = result.metrics.metadata;
      expect(metadata?.performanceMode).toBe('enterprise');
      expect(metadata?.registryTransformation).toBe('pre-compiled');
      expect(metadata?.totalRegistryEntries).toBe(6);
      expect(metadata?.discoverySkipped).toBe(true);
      expect(metadata?.pluginsSkipped).toBe(3);
      expect(metadata?.performanceGain).toBe('maximum');

      expect(metadata?.handlerTypeDistribution).toEqual({
        commands: 2,
        queries: 1,
        events: 2,
        services: 1,
      });
    });

    it('should handle empty registry sections', async () => {
      const emptyRegistry = {
        commands: [],
        queries: [],
        events: [],
        domainServices: [],
      };

      const context: IPerformanceContext = {
        performanceMode: 'enterprise',
        discoveryPlugins: [],
        skipDiscovery: true,
        container: createMockContainer(),
        preCompiledRegistry: emptyRegistry,
      };

      const result = await strategy.optimize(context);

      expect(result.handlers).toHaveLength(0);
      expect(result.metrics.success).toBe(true);
      expect(result.metrics.metadata?.totalRegistryEntries).toBe(0);
    });
  });
});
