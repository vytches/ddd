import { safeRun } from '@vytches/ddd-utils';
import { beforeEach, describe, expect, it } from 'vitest';
import { SimpleContainer } from '../src/containers/simple-container';
import type {
  EnterprisePerformanceConfig,
  HandlerRegistry,
  PerformanceConfigurationOptions,
} from '../src/performance/performance-types';
import { VytchesDDD } from '../src/service-locator';

describe('VP-012 Performance Optimization', () => {
  // Mock container helper for testing
  const createMockContainer = () => new SimpleContainer();
  beforeEach(() => {
    VytchesDDD.reset();
  });

  describe('Legacy API backward compatibility', () => {
    it('should configure DI container with legacy API', () => {
      const container = new SimpleContainer();

      // Legacy configuration should work without breaking changes
      expect(() => {
        VytchesDDD.configure(container);
      }).not.toThrow();

      expect(VytchesDDD.getGlobalContainer()).toBe(container);
    });
  });

  describe('Performance-optimized configuration', () => {
    it('should configure DI with performance optimization', async () => {
      const container = new SimpleContainer();
      const options: PerformanceConfigurationOptions = {
        container,
        performanceMode: 'production',
        autoOptimize: true,
        performanceAlerts: true,
        performanceTarget: 200,
      };

      const [error] = await safeRun(async () => await VytchesDDD.configureOptimized(options));
      expect(error).toBeUndefined();

      // Should have global container configured
      expect(VytchesDDD.getGlobalContainer()).toBe(container);

      // Should have performance metrics available
      const metrics = VytchesDDD.getPerformanceMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.performanceMode).toBe('production');
      expect(metrics.timestamp).toBeInstanceOf(Date);
    });

    it('should validate performance targets', async () => {
      const container = new SimpleContainer();
      const options: PerformanceConfigurationOptions = {
        container,
        performanceMode: 'development',
        autoOptimize: false,
        performanceTarget: 100,
      };

      const [configError] = await safeRun(async () => await VytchesDDD.configureOptimized(options));
      expect(configError).toBeUndefined();

      const metrics = VytchesDDD.getPerformanceMetrics();
      expect(metrics.performanceMode).toBe('development');
      expect(metrics.optimized).toBe(false);
      expect(metrics.suggestions).toBeDefined();
    });
  });

  describe('Enterprise performance configuration', () => {
    it('should configure for enterprise with pre-compiled registry', async () => {
      const container = new SimpleContainer();
      const preCompiledRegistry: HandlerRegistry = {
        commands: [
          {
            id: 'test-command',
            messageType: class TestCommand {} as any,
            handlerType: class TestCommandHandler {} as any,
            metadata: { context: 'test' },
          },
        ],
        queries: [],
        events: [],
        domainServices: [],
      };

      const config: EnterprisePerformanceConfig = {
        container,
        performanceMode: 'enterprise',
        preCompiledRegistry,
        skipDiscovery: true,
        maxStartupTime: 100,
        enterpriseMonitoring: true,
        performanceAlerts: true,
        performanceTarget: 50,
        fallback: 'throw',
      };

      const [enterpriseError] = await safeRun(
        async () => await VytchesDDD.configureForEnterprise(config)
      );
      expect(enterpriseError).toBeUndefined();

      const metrics = VytchesDDD.getPerformanceMetrics();
      expect(metrics.performanceMode).toBe('enterprise');
      expect(metrics.optimized).toBe(true);
      expect(metrics.handlersFound).toBeGreaterThan(0);
    });

    it('should throw error for invalid enterprise configuration', async () => {
      const container = new SimpleContainer();
      const invalidConfig = {
        container,
        performanceMode: 'development', // Invalid for enterprise
        skipDiscovery: true,
        preCompiledRegistry: undefined,
      } as unknown as EnterprisePerformanceConfig;

      const [configError] = await safeRun(
        async () => await VytchesDDD.configureForEnterprise(invalidConfig)
      );
      expect(configError).toBeDefined();
      expect(configError?.message).toContain(
        'Enterprise configuration requires preCompiledRegistry for maximum performance'
      );
    });

    it('should require pre-compiled registry for enterprise', async () => {
      const container = new SimpleContainer();
      const invalidConfig = {
        container,
        performanceMode: 'enterprise',
        skipDiscovery: true,
        preCompiledRegistry: undefined,
        // Missing preCompiledRegistry
      } as unknown as EnterprisePerformanceConfig;

      const [registryError] = await safeRun(
        async () => await VytchesDDD.configureForEnterprise(invalidConfig)
      );
      expect(registryError).toBeDefined();
      expect(registryError?.message).toContain(
        'Enterprise configuration requires preCompiledRegistry for maximum performance'
      );
    });
  });

  describe('Performance metrics', () => {
    it('should provide detailed performance metrics', async () => {
      const container = new SimpleContainer();
      const options: PerformanceConfigurationOptions = {
        container,
        performanceMode: 'production',
        autoOptimize: true,
      };

      const [metricsError] = await safeRun(
        async () => await VytchesDDD.configureOptimized(options)
      );
      expect(metricsError).toBeUndefined();

      const metrics = VytchesDDD.getPerformanceMetrics();

      expect(metrics).toMatchObject({
        discoveryTime: expect.any(Number),
        registrationTime: expect.any(Number),
        startupTime: expect.any(Number),
        handlersFound: expect.any(Number),
        performanceMode: 'production',
        optimized: expect.any(Boolean),
        projectedAt300Handlers: expect.any(String),
        recommendOptimization: expect.any(Boolean),
        suggestions: expect.any(Array),
        timestamp: expect.any(Date),
      });
    });

    it('should generate optimization suggestions for large handler counts', async () => {
      const container = new SimpleContainer();

      // Manually simulate performance monitor state with large handler count but not optimized
      // This tests the suggestion generation logic directly
      const options: PerformanceConfigurationOptions = {
        container,
        performanceMode: 'development',
        autoOptimize: false, // Keep not optimized to trigger suggestions
      };

      const [largeHandlerError] = await safeRun(
        async () => await VytchesDDD.configureOptimized(options)
      );
      expect(largeHandlerError).toBeUndefined();

      // Get the performance optimizer and manually trigger suggestion generation
      const performanceOptimizer = (VytchesDDD as any).serviceLocator.performanceOptimizer;
      performanceOptimizer.monitor.updateHandlerCount(150, 'development', false);

      const metrics = VytchesDDD.getPerformanceMetrics();

      expect(metrics.handlersFound).toBe(150);
      expect(metrics.recommendOptimization).toBe(true);
      expect(metrics.suggestions.length).toBeGreaterThan(0);
      expect(metrics.suggestions.some(s => s.includes('compile-time registry'))).toBe(true);
    });
  });

  describe('API compatibility', () => {
    it('should maintain backward compatibility for existing users', () => {
      const container = new SimpleContainer();

      // Old API should continue working
      VytchesDDD.configure(container);
      expect(VytchesDDD.getGlobalContainer()).toBe(container);
    });

    it('should provide new performance APIs for advanced users', async () => {
      const container = new SimpleContainer();

      // New APIs should be available
      expect(typeof VytchesDDD.configureOptimized).toBe('function');
      expect(typeof VytchesDDD.configureForEnterprise).toBe('function');
      expect(typeof VytchesDDD.getPerformanceMetrics).toBe('function');

      // Performance API should work
      const [apiError] = await safeRun(
        async () =>
          await VytchesDDD.configureOptimized({
            container,
            performanceMode: 'development',
          })
      );
      expect(apiError).toBeUndefined();

      const metrics = VytchesDDD.getPerformanceMetrics();
      expect(metrics).toBeDefined();
    });
  });
});
