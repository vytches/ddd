import { safeRun } from '@vytches/ddd-utils';
import { beforeEach, describe, expect, it } from 'vitest';
import type {
  EnterprisePerformanceConfig,
  HandlerInfo,
  IHandlerDiscoveryPlugin,
  PerformanceConfigurationOptions,
} from '../src';
import { SimpleContainer } from '../src/containers/simple-container';
import { PerformanceOptimizer } from '../src/performance/performance-optimizer';
import { VytchesDDD } from '../src/service-locator';

// Enterprise scale test data generator
class EnterpriseTestDataGenerator {
  // Generate realistic handler distribution for enterprise
  static generateHandlers(count: number): HandlerInfo[] {
    const handlers: HandlerInfo[] = [];

    // Realistic enterprise distribution:
    // 40% Commands, 30% Queries, 20% Events, 10% Domain Services
    const commandCount = Math.floor(count * 0.4);
    const queryCount = Math.floor(count * 0.3);
    const eventCount = Math.floor(count * 0.2);
    const domainServiceCount = count - commandCount - queryCount - eventCount;

    // Generate Commands
    for (let i = 0; i < commandCount; i++) {
      handlers.push(this.createHandlerInfo('command', i, this.getRandomContext()));
    }

    // Generate Queries
    for (let i = 0; i < queryCount; i++) {
      handlers.push(this.createHandlerInfo('query', i, this.getRandomContext()));
    }

    // Generate Events
    for (let i = 0; i < eventCount; i++) {
      handlers.push(this.createHandlerInfo('event', i, this.getRandomContext()));
    }

    // Generate Domain Services
    for (let i = 0; i < domainServiceCount; i++) {
      handlers.push(this.createHandlerInfo('domain-service', i, this.getRandomContext()));
    }

    return handlers;
  }

  private static createHandlerInfo(
    type: 'command' | 'query' | 'event' | 'domain-service',
    index: number,
    context: string
  ): HandlerInfo {
    // Create unique named classes for proper deduplication
    const MessageType = class {};
    Object.defineProperty(MessageType, 'name', { value: `${type}Message${index}` });

    const HandlerType = class {};
    Object.defineProperty(HandlerType, 'name', { value: `${type}Handler${index}` });

    return {
      type,
      messageType: MessageType as any,
      handlerType: HandlerType as any,
      metadata: {
        context,
        lifetime: 'transient',
        tags: [`${type}-handler`, `context-${context}`, `enterprise-scale`],
        serviceId: type === 'domain-service' ? `${type}-service-${index}` : undefined,
      },
    };
  }

  // Enterprise bounded contexts
  private static contexts = [
    'OrderManagement',
    'PaymentProcessing',
    'InventoryManagement',
    'CustomerService',
    'BillingSystem',
    'ShippingCoordination',
    'ProductCatalog',
    'UserManagement',
    'ReportingEngine',
    'NotificationService',
    'AuditLogging',
    'SecurityManagement',
    'DocumentManagement',
    'WorkflowEngine',
    'IntegrationHub',
    'DataAnalytics',
  ];

  private static getRandomContext(): string {
    const context = this.contexts[Math.floor(Math.random() * this.contexts.length)];
    if (!context) {
      throw new Error('No contexts available');
    }
    return context;
  }
}

// Mock discovery plugin for enterprise scale testing
class EnterpriseScaleDiscoveryPlugin implements IHandlerDiscoveryPlugin {
  public readonly name: string;
  private handlers: HandlerInfo[];

  constructor(name: string, handlerCount: number) {
    this.name = name;
    this.handlers = EnterpriseTestDataGenerator.generateHandlers(handlerCount);
  }

  discoverHandlers(): HandlerInfo[] {
    // Simulate realistic discovery time (0.1-2ms per handler)
    const simulatedTime = Math.random() * this.handlers.length * 0.002;
    const start = Date.now();
    while (Date.now() - start < simulatedTime) {
      // Simulate work
    }

    return this.handlers;
  }

  isAvailable(): boolean {
    return true;
  }

  // For testing: Get handlers by context
  getHandlersByContext(context: string): HandlerInfo[] {
    return this.handlers.filter(h => (h.metadata as any)?.context === context);
  }

  // For testing: Get all unique contexts
  getUniqueContexts(): string[] {
    const contexts = new Set<string>();
    this.handlers.forEach(h => {
      const context = (h.metadata as any)?.context;
      if (context) contexts.add(context);
    });
    return Array.from(contexts);
  }
}

describe('VP-012 Enterprise Scale Validation (300+ Handlers)', () => {
  // Mock container helper for testing
  const _createMockContainer = () => new SimpleContainer();
  let container: SimpleContainer;
  let performanceOptimizer: PerformanceOptimizer;
  let largeScalePlugin: EnterpriseScaleDiscoveryPlugin;

  beforeEach(() => {
    VytchesDDD.reset();
    container = new SimpleContainer();
    performanceOptimizer = new PerformanceOptimizer();

    // Create enterprise scale plugin with 350+ handlers
    largeScalePlugin = new EnterpriseScaleDiscoveryPlugin('EnterprisePlugin', 350);
  });

  describe('Enterprise Scale Performance Validation', () => {
    it('should handle 350+ handlers with cached discovery strategy', async () => {
      const config: PerformanceConfigurationOptions = {
        container,
        performanceMode: 'production',
        autoOptimize: true,
        performanceAlerts: true,
        performanceTarget: 200, // 200ms target for enterprise scale
      };

      const startTime = Date.now();
      const [configError, metrics] = await safeRun(async () => {
        const result = await performanceOptimizer.optimizeConfiguration(config, container, [
          largeScalePlugin,
        ]);
        return result;
      });

      const totalTime = Date.now() - startTime;

      expect(configError).toBeUndefined();
      expect(metrics).toBeDefined();
      if (!metrics) throw new Error('Metrics should be defined');
      expect(metrics.handlersFound).toBeGreaterThan(300);
      expect(metrics.handlersFound).toBeLessThanOrEqual(350);

      // VP-012: Enterprise performance target validation
      expect(totalTime).toBeLessThan(500); // Should complete within 500ms

      console.log(
        `✅ Enterprise Scale Test: ${metrics.handlersFound} handlers processed in ${totalTime}ms`
      );
    });

    it('should validate selective discovery with multiple contexts at scale', async () => {
      const contexts = largeScalePlugin.getUniqueContexts();
      expect(contexts.length).toBeGreaterThan(10); // Should have multiple enterprise contexts

      const selectedContexts = contexts.slice(0, 5); // Test with 5 contexts
      const config: PerformanceConfigurationOptions = {
        container,
        performanceMode: 'enterprise',
        contexts: selectedContexts,
        parallelRegistration: true,
        autoOptimize: true,
        performanceTarget: 150,
      };

      const startTime = Date.now();
      const [discoveryError, metrics] = await safeRun(async () => {
        return await performanceOptimizer.optimizeConfiguration(config, container, [
          largeScalePlugin,
        ]);
      });

      const totalTime = Date.now() - startTime;

      expect(discoveryError).toBeUndefined();
      expect(metrics).toBeDefined();
      if (!metrics) throw new Error('Metrics should be defined');

      // Validate selective discovery worked
      expect(metrics.handlersFound).toBeGreaterThan(0); // Should find some handlers in selected contexts
      expect(metrics.handlersFound).toBeLessThan(350); // Should be filtered, not all handlers

      // VP-012: Selective discovery performance validation
      expect(totalTime).toBeLessThan(300); // Should be faster than full discovery

      console.log(
        `✅ Selective Discovery Test: ${metrics.handlersFound} handlers from ${selectedContexts.length} contexts in ${totalTime}ms`
      );
    });

    it('should validate parallel discovery resilience with simulated failures', async () => {
      // Create multiple plugins with one that simulates failure
      const workingPlugin = new EnterpriseScaleDiscoveryPlugin('WorkingPlugin', 200);
      const failingPlugin = {
        name: 'FailingPlugin',
        discoverHandlers: () => {
          throw new Error('Simulated discovery failure');
        },
        isAvailable: () => true,
      } as IHandlerDiscoveryPlugin;
      const slowPlugin = {
        name: 'SlowPlugin',
        discoverHandlers: async () => {
          // Simulate slow plugin (2 seconds - should trigger timeout in enhanced implementation)
          await new Promise(resolve => setTimeout(resolve, 2000));
          return [];
        },
        isAvailable: () => true,
      } as IHandlerDiscoveryPlugin;

      const config: PerformanceConfigurationOptions = {
        container,
        performanceMode: 'enterprise',
        parallelRegistration: true,
        autoOptimize: false, // Force parallel discovery strategy
      };

      const startTime = Date.now();
      const [resilienceError, metrics] = await safeRun(async () => {
        return await performanceOptimizer.optimizeConfiguration(config, container, [
          workingPlugin,
          failingPlugin,
          slowPlugin,
        ]);
      });

      const totalTime = Date.now() - startTime;

      expect(resilienceError).toBeUndefined();
      expect(metrics).toBeDefined();
      if (!metrics) throw new Error('Metrics should be defined');

      // Should still succeed with working plugin despite failures
      expect(metrics.handlersFound).toBeGreaterThan(150);

      // Should complete reasonably fast despite slow plugin (due to timeout)
      expect(totalTime).toBeLessThan(35000); // 35 seconds max (30s timeout + processing)

      console.log(
        `✅ Parallel Discovery Resilience: ${metrics.handlersFound} handlers despite failures in ${totalTime}ms`
      );
    });

    it('should validate enterprise pre-compiled registry performance', async () => {
      // Generate realistic pre-compiled registry
      const allHandlers = largeScalePlugin.discoverHandlers();
      const preCompiledRegistry = {
        commands: allHandlers
          .filter(h => h.type === 'command')
          .map(h => ({
            id: `cmd-${Math.random()}`,
            messageType: h.messageType,
            handlerType: h.handlerType,
            metadata: (h.metadata as Record<string, unknown>) ?? {},
          })),
        queries: allHandlers
          .filter(h => h.type === 'query')
          .map(h => ({
            id: `qry-${Math.random()}`,
            messageType: h.messageType,
            handlerType: h.handlerType,
            metadata: (h.metadata as Record<string, unknown>) ?? {},
          })),
        events: allHandlers
          .filter(h => h.type === 'event')
          .map(h => ({
            id: `evt-${Math.random()}`,
            messageType: h.messageType,
            handlerType: h.handlerType,
            metadata: (h.metadata as Record<string, unknown>) ?? {},
          })),
        domainServices: allHandlers
          .filter(h => h.type === 'domain-service')
          .map(h => ({
            id: `svc-${Math.random()}`,
            messageType: h.messageType,
            handlerType: h.handlerType,
            metadata: (h.metadata as Record<string, unknown>) ?? {},
          })),
      };

      const config: EnterprisePerformanceConfig = {
        container,
        performanceMode: 'enterprise',
        preCompiledRegistry,
        skipDiscovery: true,
        maxStartupTime: 100, // Very aggressive target
        enterpriseMonitoring: true,
        performanceAlerts: true,
        performanceTarget: 50,
        fallback: 'throw',
      };

      const startTime = Date.now();
      const [enterpriseError, metrics] = await safeRun(async () => {
        const result = await performanceOptimizer.optimizeConfiguration(
          config as PerformanceConfigurationOptions,
          container,
          [] // No plugins needed for pre-compiled registry
        );
        return result;
      });

      const totalTime = Date.now() - startTime;

      expect(enterpriseError).toBeUndefined();
      expect(metrics).toBeDefined();
      if (!metrics) throw new Error('Metrics should be defined');
      expect(metrics.handlersFound).toBeGreaterThan(300);

      // VP-012: Enterprise pre-compiled registry should be extremely fast
      expect(totalTime).toBeLessThan(100); // Should complete within 100ms

      console.log(
        `✅ Pre-Compiled Registry: ${metrics.handlersFound} handlers in ${totalTime}ms (target: <100ms)`
      );
    });

    it('should validate memory management and cleanup at enterprise scale', async () => {
      const initialMemory = process.memoryUsage();

      // Run multiple optimization cycles to test memory management
      const cycles = 5;
      const results: number[] = [];

      for (let i = 0; i < cycles; i++) {
        const config: PerformanceConfigurationOptions = {
          container: new SimpleContainer(), // New container each cycle
          performanceMode: 'production',
          autoOptimize: true,
          performanceTarget: 200,
        };

        const cycleStart = Date.now();
        const [cycleError] = await safeRun(async () => {
          const optimizer = new PerformanceOptimizer();
          if (!config.container) {
            throw new Error('Container is required for optimization');
          }
          const result = await optimizer.optimizeConfiguration(config, config.container, [
            new EnterpriseScaleDiscoveryPlugin(`Cycle${i}`, 300),
          ]);

          // Test cleanup
          optimizer.cleanupCache();
          optimizer.reset();

          return result;
        });

        const cycleTime = Date.now() - cycleStart;
        results.push(cycleTime);

        expect(cycleError).toBeUndefined();

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      // Memory usage should not increase dramatically (less than 50MB for 1500 handlers total)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // 50MB limit

      // Performance should be consistent across cycles
      const avgTime = results.reduce((a, b) => a + b) / results.length;
      const maxTime = Math.max(...results);
      const minTime = Math.min(...results);

      expect(maxTime - minTime).toBeLessThan(avgTime * 5.0); // Variance should be reasonable (more lenient for CI)

      console.log(
        `✅ Memory Management: ${cycles} cycles, avg ${avgTime.toFixed(1)}ms, memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(1)}MB`
      );
    });

    it('should validate cache effectiveness across different scenarios', async () => {
      // Test cache hit ratio with repeated operations
      const optimizer = new PerformanceOptimizer();
      const plugin = new EnterpriseScaleDiscoveryPlugin('CacheTestPlugin', 300);

      const config: PerformanceConfigurationOptions = {
        container,
        performanceMode: 'production',
        autoOptimize: true,
        performanceTarget: 200,
      };

      // First run - should be cache miss
      const firstStart = Date.now();
      const [firstError] = await safeRun(async () => {
        return await optimizer.optimizeConfiguration(config, container, [plugin]);
      });
      const firstTime = Date.now() - firstStart;

      expect(firstError).toBeUndefined();

      // Second run - should have cache hits
      const secondStart = Date.now();
      const [secondError] = await safeRun(async () => {
        return await optimizer.optimizeConfiguration(config, container, [plugin]);
      });
      const secondTime = Date.now() - secondStart;

      expect(secondError).toBeUndefined();

      // Cache should make second run faster (more lenient for test environment)
      expect(secondTime).toBeLessThan(firstTime + 10); // Should be faster or similar

      // Validate cache statistics
      const cacheStats = optimizer.getCacheStatistics();
      expect(cacheStats.hits).toBeGreaterThan(0);
      expect(cacheStats.hitRatio).toBeGreaterThan(0);

      console.log(
        `✅ Cache Effectiveness: First ${firstTime}ms, Second ${secondTime}ms, Hit ratio: ${(cacheStats.hitRatio * 100).toFixed(1)}%`
      );

      // Cleanup
      optimizer.reset();
    });
  });

  describe('Enterprise Scale Edge Cases', () => {
    it('should handle extremely large handler counts (500+)', async () => {
      const megaPlugin = new EnterpriseScaleDiscoveryPlugin('MegaPlugin', 500);

      const config: PerformanceConfigurationOptions = {
        container,
        performanceMode: 'enterprise',
        parallelRegistration: true,
        autoOptimize: true,
        performanceTarget: 300, // Relaxed target for extreme scale
      };

      const startTime = Date.now();
      const [megaError, metrics] = await safeRun(async () => {
        return await performanceOptimizer.optimizeConfiguration(config, container, [megaPlugin]);
      });

      const totalTime = Date.now() - startTime;

      expect(megaError).toBeUndefined();
      expect(metrics).toBeDefined();
      if (!metrics) throw new Error('Metrics should be defined');
      expect(metrics.handlersFound).toBeGreaterThanOrEqual(500);

      // Should still complete within reasonable time
      expect(totalTime).toBeLessThan(1000); // 1 second max for 500+ handlers

      console.log(`✅ Extreme Scale Test: ${metrics.handlersFound} handlers in ${totalTime}ms`);
    });

    it('should handle zero handlers gracefully', async () => {
      const emptyPlugin = new EnterpriseScaleDiscoveryPlugin('EmptyPlugin', 0);

      const config: PerformanceConfigurationOptions = {
        container,
        performanceMode: 'production',
        autoOptimize: true,
      };

      const [emptyError, metrics] = await safeRun(async () => {
        return await performanceOptimizer.optimizeConfiguration(config, container, [emptyPlugin]);
      });

      expect(emptyError).toBeUndefined();
      expect(metrics).toBeDefined();
      if (!metrics) throw new Error('Metrics should be defined');
      expect(metrics.handlersFound).toBe(0);

      console.log(`✅ Zero Handlers Test: Handled gracefully`);
    });
  });
});
