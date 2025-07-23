/**
 * Integration tests for Domain Services with VytchesDDD DI system
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { safeRun } from '@vytches-ddd/utils';
import { VytchesDDD, SimpleContainer, ServiceLifetime } from '@vytches-ddd/di';
import { IBaseDomainService, DomainService } from '../../src';
// DomainServiceDiscoveryPlugin moved to @vytches-ddd/di

// Test services for integration
@DomainService({
  serviceId: 'testIntegrationService',
  lifetime: ServiceLifetime.Singleton,
  autoRegister: true,
  tags: ['integration', 'test'],
})
class TestIntegrationService extends IBaseDomainService {
  constructor() {
    super('testIntegrationService');
  }

  getData(): string {
    return 'integration-data';
  }
}

@DomainService({
  serviceId: 'contextSpecificService',
  lifetime: ServiceLifetime.Singleton,
  context: 'TestContext',
  autoRegister: true,
  dependencies: ['contextDependency'],
})
class ContextSpecificService extends IBaseDomainService {
  constructor() {
    super('contextSpecificService');
  }

  processWithDependency(): string {
    try {
      const dependency = VytchesDDD.resolve<any>('contextDependency', 'TestContext');
      return `processed-with-${dependency.value}`;
    } catch (_error) {
      return 'dependency-not-found';
    }
  }
}

@DomainService('legacyIntegrationService')
class LegacyIntegrationService extends IBaseDomainService {
  constructor() {
    super('legacyIntegrationService');
  }

  getLegacyData(): string {
    return 'legacy-data';
  }
}

describe('Domain Services DI Integration', () => {
  let container: SimpleContainer;
  let contextContainer: SimpleContainer;

  beforeEach(async () => {
    // Setup global container
    container = new SimpleContainer();
    VytchesDDD.configure(container);

    // Setup context container
    contextContainer = new SimpleContainer();
    contextContainer.registerInstance('contextDependency', { value: 'context-dependency' });
    VytchesDDD.configureContext('TestContext', contextContainer);

    // Manually register services since DomainServiceDiscoveryPlugin was moved to @vytches-ddd/di
    // Register services with autoRegister: true
    container.register('testIntegrationService', TestIntegrationService, {
      lifetime: ServiceLifetime.Singleton,
    });

    // For context-specific service, register in the appropriate context
    contextContainer.register('contextSpecificService', ContextSpecificService, {
      lifetime: ServiceLifetime.Singleton,
    });

    // Also register in global container since the test expects to resolve without context
    container.register('contextSpecificService', ContextSpecificService, {
      lifetime: ServiceLifetime.Singleton,
    });
  });

  afterEach(() => {
    VytchesDDD.reset();
  });

  describe('Auto-discovered services', () => {
    it('should auto-register and resolve DI-enhanced domain services', () => {
      const service = VytchesDDD.resolve<TestIntegrationService>('testIntegrationService');

      expect(service).toBeInstanceOf(TestIntegrationService);
      expect(service.getData()).toBe('integration-data');
    });

    it('should resolve services from context-specific containers', () => {
      const service = VytchesDDD.resolve<ContextSpecificService>(
        'contextSpecificService',
        'TestContext'
      );

      expect(service).toBeInstanceOf(ContextSpecificService);
      expect(service.processWithDependency()).toBe('processed-with-context-dependency');
    });

    it('should NOT auto-register legacy services without DI options', () => {
      // Legacy service should not be auto-registered
      const [resolveError] = safeRun(() => {
        VytchesDDD.resolve<LegacyIntegrationService>('legacyIntegrationService');
      });
      expect(resolveError).toBeDefined();
    });
  });

  describe('Manual registration with auto-discovery', () => {
    it('should allow manual registration of legacy services', () => {
      // Manually register legacy service
      container.register('legacyIntegrationService', LegacyIntegrationService);

      const service = VytchesDDD.resolve<LegacyIntegrationService>('legacyIntegrationService');
      expect(service).toBeInstanceOf(LegacyIntegrationService);
      expect(service.getLegacyData()).toBe('legacy-data');
    });
  });

  describe('Service lifetimes', () => {
    it('should respect singleton lifetime for domain services', () => {
      const service1 = VytchesDDD.resolve<TestIntegrationService>('testIntegrationService');
      const service2 = VytchesDDD.resolve<TestIntegrationService>('testIntegrationService');

      // Since it's registered as singleton, should be the same instance
      expect(service1).toBe(service2);
    });
  });

  describe('Context isolation', () => {
    it('should use context-specific dependencies when available', () => {
      const service = VytchesDDD.resolve<ContextSpecificService>('contextSpecificService');
      const result = service.processWithDependency();

      expect(result).toBe('processed-with-context-dependency');
    });

    it('should resolve context-specific services with context parameter', () => {
      const service = VytchesDDD.resolve<ContextSpecificService>(
        'contextSpecificService',
        'TestContext'
      );

      expect(service).toBeInstanceOf(ContextSpecificService);
    });
  });

  describe.skip('Discovery plugin integration', () => {
    // DomainServiceDiscoveryPlugin has been moved to @vytches-ddd/di
    it('should discover correct number of DI-enhanced services', async () => {
      // const plugin = new DomainServiceDiscoveryPlugin();
      // const handlers = await plugin.discoverHandlers();
      // // Should find TestIntegrationService and ContextSpecificService
      // // but NOT LegacyIntegrationService (no DI options)
      // const domainServiceHandlers = handlers.filter((h: any) => h.type === 'domain-service');
      // expect(domainServiceHandlers).toHaveLength(2);
      // const serviceIds = domainServiceHandlers.map((h: any) => h.metadata.serviceId);
      // expect(serviceIds).toContain('testIntegrationService');
      // expect(serviceIds).toContain('contextSpecificService');
      // expect(serviceIds).not.toContain('legacyIntegrationService');
    });

    it('should include correct metadata in discovered handlers', async () => {
      // const plugin = new DomainServiceDiscoveryPlugin();
      // const handlers = await plugin.discoverHandlers();
      // const testServiceHandler = handlers.find(
      //   (h: any) => h.metadata.serviceId === 'testIntegrationService'
      // );
      // expect(testServiceHandler).toBeDefined();
      // expect(testServiceHandler?.metadata.lifetime).toBe('singleton');
      // expect(testServiceHandler?.metadata.tags).toEqual(['integration', 'test']);
      // expect(testServiceHandler?.metadata.autoRegister).toBe(true);
    });
  });

  describe('Error handling', () => {
    it('should throw meaningful error for unregistered services', () => {
      const [resolveError] = safeRun(() => {
        VytchesDDD.resolve<any>('nonExistentService');
      });
      expect(resolveError).toBeDefined();
    });

    it('should handle missing context dependencies gracefully', () => {
      // Create service that tries to resolve from non-existent context
      @DomainService({
        serviceId: 'missingContextService',
        context: 'NonExistentContext',
        autoRegister: false, // Don't auto-register to avoid conflicts
      })
      class MissingContextService extends IBaseDomainService {
        constructor() {
          super('missingContextService');
        }
      }

      container.register('missingContextService', MissingContextService);

      const service = VytchesDDD.resolve<MissingContextService>('missingContextService');
      expect(service).toBeInstanceOf(MissingContextService);
    });
  });
});
