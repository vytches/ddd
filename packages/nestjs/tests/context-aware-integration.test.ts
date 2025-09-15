import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { VytchesDDDModule } from '../src/vytches-ddd.module';
import { VytchesExplorerService } from '../src/services/vytches-explorer.service';

// Mock the lazy-loaded modules
vi.mock('@vytches/ddd-cqrs', async () => {
  const mockBus = vi.fn().mockImplementation(() => ({
    register: vi.fn(),
    execute: vi.fn(),
  }));
  return {
    CommandBus: mockBus,
    QueryBus: mockBus,
    EnhancedCommandBus: mockBus,
    EnhancedQueryBus: mockBus,
  };
});

vi.mock('@vytches/ddd-events', async () => ({
  UnifiedEventBus: vi.fn().mockImplementation(() => ({
    publish: vi.fn(),
    subscribe: vi.fn(),
  })),
}));

vi.mock('@vytches/ddd-di', async () => ({
  SimpleContainer: vi.fn().mockImplementation(() => ({
    register: vi.fn(),
    resolve: vi.fn(),
  })),
  VytchesDDD: {
    configure: vi.fn(),
    resolve: vi.fn(),
    configureContext: vi.fn(),
  },
  PerformanceOptimizer: vi.fn().mockImplementation(() => ({
    optimizeConfiguration: vi.fn().mockResolvedValue({
      handlersFound: 0,
      startupTime: 50,
      optimized: true,
    }),
    getMetrics: vi.fn().mockReturnValue({
      handlersFound: 0,
      startupTime: 50,
      optimized: true,
    }),
    generateReport: vi.fn().mockReturnValue('Mock performance report'),
  })),
  PerformanceMonitor: vi.fn().mockImplementation(() => ({
    startMeasurement: vi.fn(),
    endMeasurement: vi.fn(),
    updateHandlerCount: vi.fn(),
    generateReport: vi.fn().mockReturnValue('Mock monitoring report'),
    getMetrics: vi.fn().mockReturnValue({
      handlersFound: 0,
      startupTime: 50,
      optimized: true,
    }),
    checkPerformanceTargets: vi.fn().mockReturnValue(true),
  })),
}));

describe('VytchesDDDModule - Context-Aware Integration', () => {
  let module: TestingModule;

  afterEach(async () => {
    if (module) {
      await module.close();
    }
    vi.clearAllMocks();
  });

  describe('forContext', () => {
    it('should create context-specific module with bridgeToNestJS disabled', async () => {
      module = await Test.createTestingModule({
        imports: [
          VytchesDDDModule.forContext('UserManagement', {
            bridgeToNestJS: false,
            performance: { performanceTarget: 100 },
          }),
        ],
      }).compile();

      expect(module).toBeDefined();

      // Should provide context-specific explorer service
      const explorer = module.get(`VytchesExplorerService_UserManagement`);
      expect(explorer).toBeDefined();
      expect(explorer).toBeInstanceOf(VytchesExplorerService);

      // Should provide context-specific buses
      const commandBus = module.get(`ICommandBus_UserManagement`);
      expect(commandBus).toBeDefined();

      const queryBus = module.get(`IQueryBus_UserManagement`);
      expect(queryBus).toBeDefined();

      const eventBus = module.get(`IEventBus_UserManagement`);
      expect(eventBus).toBeDefined();
    });

    it('should create context-specific module with bridgeToNestJS enabled', async () => {
      module = await Test.createTestingModule({
        imports: [
          VytchesDDDModule.forContext('OrderProcessing', {
            bridgeToNestJS: true,
            handlers: {
              include: ['*CommandHandler', '*QueryHandler'],
              prefix: 'Order',
            },
            performance: {
              performanceMode: 'production',
              autoOptimize: true,
            },
          }),
        ],
      }).compile();

      expect(module).toBeDefined();

      // Should provide context-specific services
      const explorer = module.get(`VytchesExplorerService_OrderProcessing`);
      expect(explorer).toBeDefined();

      // Should provide bridge services for handlers
      const commandHandlers = module.get(`Order_CommandHandlers`);
      expect(commandHandlers).toBeDefined();

      const queryHandlers = module.get(`Order_QueryHandlers`);
      expect(queryHandlers).toBeDefined();

      const eventHandlers = module.get(`Order_EventHandlers`);
      expect(eventHandlers).toBeDefined();
    });

    it('should support context with custom providers', async () => {
      const customProvider = {
        provide: 'CustomContextService',
        useValue: { context: 'UserManagement' },
      };

      module = await Test.createTestingModule({
        imports: [
          VytchesDDDModule.forContext('UserManagement', {
            providers: [customProvider],
            performance: { performanceTarget: 150 },
          }),
        ],
      }).compile();

      expect(module).toBeDefined();

      // Should provide custom service
      const customService = module.get('CustomContextService');
      expect(customService).toEqual({ context: 'UserManagement' });

      // Should still provide context services
      const explorer = module.get(`VytchesExplorerService_UserManagement`);
      expect(explorer).toBeDefined();
    });

    it('should configure context with proper performance settings', async () => {
      const performanceConfig = {
        performanceMode: 'enterprise' as const,
        autoOptimize: true,
        performanceTarget: 75,
      };

      module = await Test.createTestingModule({
        imports: [
          VytchesDDDModule.forContext('HighPerformanceContext', {
            bridgeToNestJS: true,
            performance: performanceConfig,
          }),
        ],
      }).compile();

      expect(module).toBeDefined();

      const explorer = module.get(`VytchesExplorerService_HighPerformanceContext`);
      expect(explorer).toBeInstanceOf(VytchesExplorerService);

      // Explorer should be configured with context options
      const contextConfig = explorer.getContextConfiguration();
      expect(contextConfig).toBeDefined();
      expect(contextConfig?.context).toBe('HighPerformanceContext');
      expect(contextConfig?.bridgeToNestJS).toBe(true);
    });
  });

  describe('forContexts', () => {
    it('should create multi-context module with global settings', async () => {
      module = await Test.createTestingModule({
        imports: [
          VytchesDDDModule.forContexts({
            globalBridgeToNestJS: true,
            enableContexts: true,
            contexts: {
              UserManagement: {
                performance: { performanceTarget: 100 },
              },
              OrderProcessing: {
                bridgeToNestJS: false, // Override global setting
                handlers: { include: ['*Order*'] },
              },
            },
          }),
        ],
      }).compile();

      expect(module).toBeDefined();

      // Should provide services for UserManagement context (with global bridgeToNestJS)
      const userExplorer = module.get(`VytchesExplorerService_UserManagement`);
      expect(userExplorer).toBeDefined();

      const userCommandHandlers = module.get(`UserManagement_CommandHandlers`);
      expect(userCommandHandlers).toBeDefined();

      // Should provide services for OrderProcessing context (bridgeToNestJS overridden to false)
      const orderExplorer = module.get(`VytchesExplorerService_OrderProcessing`);
      expect(orderExplorer).toBeDefined();

      // OrderProcessing should NOT have bridge handlers (bridgeToNestJS: false)
      // The module should not have registered bridge providers
      const shouldThrow = (() => {
        try {
          module.get(`OrderProcessing_CommandHandlers`);
          return false; // Should not reach here
        } catch (error) {
          // Expected to throw because bridgeToNestJS: false
          return true;
        }
      })();
      expect(shouldThrow).toBe(true);
    });

    it('should handle empty contexts configuration', async () => {
      module = await Test.createTestingModule({
        imports: [
          VytchesDDDModule.forContexts({
            globalBridgeToNestJS: false,
            enableContexts: true,
            contexts: {},
          }),
        ],
      }).compile();

      expect(module).toBeDefined();
      // Should still create a valid module even with no contexts
    });
  });

  describe('Context Configuration', () => {
    it('should configure explorer service with context options', async () => {
      const contextOptions = {
        bridgeToNestJS: true,
        handlers: {
          include: ['*Handler'],
          exclude: ['*TestHandler'],
          prefix: 'User',
        },
        performance: { performanceTarget: 100 },
      };

      module = await Test.createTestingModule({
        imports: [VytchesDDDModule.forContext('UserManagement', contextOptions)],
      }).compile();

      const explorer = module.get(`VytchesExplorerService_UserManagement`);
      const config = explorer.getContextConfiguration();

      expect(config).toBeDefined();
      expect(config?.context).toBe('UserManagement');
      expect(config?.bridgeToNestJS).toBe(true);
      expect(config?.handlers?.include).toEqual(['*Handler']);
      expect(config?.handlers?.exclude).toEqual(['*TestHandler']);
      expect(config?.handlers?.prefix).toBe('User');
    });
  });

  describe('Handler Discovery', () => {
    it('should discover context-specific handlers', async () => {
      module = await Test.createTestingModule({
        imports: [
          VytchesDDDModule.forContext('TestContext', {
            bridgeToNestJS: true,
          }),
        ],
      }).compile();

      const explorer = module.get(`VytchesExplorerService_TestContext`);

      // Test handler discovery methods
      const commandHandlers = await explorer.discoverContextHandlers('TestContext', 'command');
      expect(Array.isArray(commandHandlers)).toBe(true);

      const queryHandlers = await explorer.discoverContextHandlers('TestContext', 'query');
      expect(Array.isArray(queryHandlers)).toBe(true);

      const eventHandlers = await explorer.discoverContextHandlers('TestContext', 'event');
      expect(Array.isArray(eventHandlers)).toBe(true);

      // Test comprehensive discovery
      const allHandlers = await explorer.discoverAllContextHandlers();
      expect(Array.isArray(allHandlers)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle context configuration errors gracefully', async () => {
      // This should not throw during module creation
      module = await Test.createTestingModule({
        imports: [
          VytchesDDDModule.forContext('InvalidContext', {
            bridgeToNestJS: true,
            handlers: {
              include: ['*Invalid*'],
              exclude: [],
            },
          }),
        ],
      }).compile();

      expect(module).toBeDefined();

      const explorer = module.get(`VytchesExplorerService_InvalidContext`);

      // Should handle discovery errors gracefully
      const handlers = await explorer.discoverContextHandlers('NonExistentContext', 'command');
      expect(handlers).toEqual([]);
    });
  });

  describe('Performance Integration', () => {
    it('should apply context-specific performance settings', async () => {
      const performanceOptions = {
        performanceMode: 'production' as const,
        autoOptimize: true,
        performanceTarget: 50,
        contexts: ['HighPerformanceContext'],
      };

      module = await Test.createTestingModule({
        imports: [
          VytchesDDDModule.forContext('HighPerformanceContext', {
            performance: performanceOptions,
            monitoring: {
              enabled: true,
              warnAt: 40,
              errorAt: 80,
            },
          }),
        ],
      }).compile();

      expect(module).toBeDefined();

      const explorer = module.get(`VytchesExplorerService_HighPerformanceContext`);
      expect(explorer).toBeInstanceOf(VytchesExplorerService);

      // Should have performance configuration applied
      const config = explorer.getContextConfiguration();
      expect(config?.context).toBe('HighPerformanceContext');
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain compatibility with existing forRoot', async () => {
      module = await Test.createTestingModule({
        imports: [VytchesDDDModule.forRoot()],
      }).compile();

      expect(module).toBeDefined();

      // Should still provide the original VytchesExplorerService
      const explorer = module.get(VytchesExplorerService);
      expect(explorer).toBeInstanceOf(VytchesExplorerService);
    });

    it('should maintain compatibility with existing forTesting', async () => {
      module = await Test.createTestingModule({
        imports: [VytchesDDDModule.forTesting()],
      }).compile();

      expect(module).toBeDefined();

      // Should provide bus services through string tokens
      const commandBus = module.get('ICommandBus');
      expect(commandBus).toBeDefined();

      const queryBus = module.get('IQueryBus');
      expect(queryBus).toBeDefined();

      const eventBus = module.get('IEventBus');
      expect(eventBus).toBeDefined();
    });
  });
});
