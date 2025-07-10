/**
 * Simple integration tests for Domain Services DI metadata
 * (without external DI package dependencies)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DomainServiceDiscoveryPlugin, DIDomainServiceMetadataRegistry, DomainService, getDIDomainServiceMetadata, isDomainServicePendingDIRegistration } from '../../src';
import { ServiceLifetime } from '@vytches-ddd/di';

// Simple test base class
class TestDomainService {
  constructor(public readonly serviceId: string) {}
}

describe('Domain Services DI Metadata Integration', () => {
  beforeEach(() => {
    DIDomainServiceMetadataRegistry.clear();
  });

  describe('Complete DI workflow', () => {
    it('should handle the full DI metadata workflow', () => {
      // 1. Define service with DI options
      @DomainService({
        serviceId: 'completeWorkflowService',
        lifetime: ServiceLifetime.Singleton,
        context: 'WorkflowContext',
        tags: ['workflow', 'integration'],
        autoRegister: true,
        dependencies: ['dependency1', 'dependency2'],
        transactional: true,
        publishesEvents: true,
        caching: { enabled: true, ttl: 300 }
      })
      class CompleteWorkflowService extends TestDomainService {
        constructor() {
          super('completeWorkflowService');
        }
      }

      // 2. Verify decorator created proper metadata
      const diMetadata = getDIDomainServiceMetadata(CompleteWorkflowService);
      expect(diMetadata).toBeDefined();
      expect(diMetadata?.serviceId).toBe('completeWorkflowService');
      expect(diMetadata?.lifetime).toBe(ServiceLifetime.Singleton);
      expect(diMetadata?.context).toBe('WorkflowContext');
      expect(diMetadata?.tags).toEqual(['workflow', 'integration']);
      expect(diMetadata?.autoRegister).toBe(true);
      expect(diMetadata?.dependencies).toEqual(['dependency1', 'dependency2']);
      expect(diMetadata?.transactional).toBe(true);
      expect(diMetadata?.publishesEvents).toBe(true);
      expect(diMetadata?.caching).toEqual({ enabled: true, ttl: 300 });

      // 3. Verify service is marked for DI registration
      expect(isDomainServicePendingDIRegistration(CompleteWorkflowService)).toBe(true);

      // 4. Verify service is registered in metadata registry
      const registeredService = DIDomainServiceMetadataRegistry.getService('completeWorkflowService');
      expect(registeredService).toBeDefined();
      expect(registeredService?.serviceType).toBe(CompleteWorkflowService);

      // 5. Verify discovery plugin can find the service
      const plugin = new DomainServiceDiscoveryPlugin();
      expect(plugin.isAvailable()).toBe(true);
    });

    it('should maintain backward compatibility throughout workflow', () => {
      // 1. Define legacy service
      @DomainService('legacyWorkflowService')
      class LegacyWorkflowService extends TestDomainService {
        constructor() {
          super('legacyWorkflowService');
        }
      }

      // 2. Define service with legacy options but no DI
      @DomainService({
        serviceId: 'legacyOptionsService',
        dependencies: ['oldDep'],
        transactional: true
      })
      class LegacyOptionsService extends TestDomainService {
        constructor() {
          super('legacyOptionsService');
        }
      }

      // 3. Verify no DI metadata created for legacy services
      expect(getDIDomainServiceMetadata(LegacyWorkflowService)).toBeUndefined();
      expect(getDIDomainServiceMetadata(LegacyOptionsService)).toBeUndefined();

      // 4. Verify not marked for DI registration
      expect(isDomainServicePendingDIRegistration(LegacyWorkflowService)).toBe(false);
      expect(isDomainServicePendingDIRegistration(LegacyOptionsService)).toBe(false);

      // 5. Verify not in DI metadata registry
      expect(DIDomainServiceMetadataRegistry.getService('legacyWorkflowService')).toBeUndefined();
      expect(DIDomainServiceMetadataRegistry.getService('legacyOptionsService')).toBeUndefined();
    });

    it('should handle mixed legacy and DI services correctly', async () => {
      // Mix of legacy and DI-enhanced services
      @DomainService('legacy1')
      class _Legacy1 extends TestDomainService {
        constructor() { super('legacy1'); }
      }

      @DomainService({
        serviceId: 'legacy2',
        transactional: true
      })
      class _Legacy2 extends TestDomainService {
        constructor() { super('legacy2'); }
      }

      @DomainService({
        serviceId: 'di1',
        lifetime: ServiceLifetime.Singleton,
        autoRegister: true
      })
      class _DI1 extends TestDomainService {
        constructor() { super('di1'); }
      }

      @DomainService({
        serviceId: 'di2',
        context: 'TestContext',
        tags: ['test'],
        autoRegister: true
      })
      class _DI2 extends TestDomainService {
        constructor() { super('di2'); }
      }

      // Discovery should only find DI-enhanced services
      const plugin = new DomainServiceDiscoveryPlugin();
      const handlers = await plugin.discoverHandlers();

      const domainServiceHandlers = handlers.filter(h => h.type === 'domain-service');
      expect(domainServiceHandlers).toHaveLength(2);

      const serviceIds = domainServiceHandlers.map(h => h.metadata.serviceId);
      expect(serviceIds).toContain('di1');
      expect(serviceIds).toContain('di2');
      expect(serviceIds).not.toContain('legacy1');
      expect(serviceIds).not.toContain('legacy2');
    });

    it('should provide rich metadata for discovery and registration', async () => {
      @DomainService({
        serviceId: 'richMetadataService',
        lifetime: ServiceLifetime.Scoped,
        context: 'RichContext',
        tags: ['rich', 'metadata', 'example'],
        autoRegister: true,
        dependencies: ['dep1', 'dep2', 'dep3'],
        contextResolver: 'explicit',
        fallbackToGlobal: false,
        transactional: true,
        async: true,
        publishesEvents: true,
        caching: { enabled: true, ttl: 600 }
      })
      class _RichMetadataService extends TestDomainService {
        constructor() {
          super('richMetadataService');
        }
      }

      const plugin = new DomainServiceDiscoveryPlugin();
      const handlers = await plugin.discoverHandlers();

      const serviceHandler = handlers.find(h => h.metadata.serviceId === 'richMetadataService');
      expect(serviceHandler).toBeDefined();

      const metadata = serviceHandler?.metadata;
      expect(metadata.lifetime).toBe(ServiceLifetime.Scoped);
      expect(metadata.context).toBe('RichContext');
      expect(metadata.tags).toEqual(['rich', 'metadata', 'example']);
      expect(metadata.dependencies).toEqual(['dep1', 'dep2', 'dep3']);
      expect(metadata.contextResolver).toBe('explicit');
      expect(metadata.fallbackToGlobal).toBe(false);
      expect(metadata.transactional).toBe(true);
      expect(metadata.async).toBe(true);
      expect(metadata.publishesEvents).toBe(true);
      expect(metadata.caching).toEqual({ enabled: true, ttl: 600 });
      expect(metadata.createdAt).toBeInstanceOf(Date);
    });
  });

  describe('Registry operations', () => {
    it('should support all registry query operations', () => {
      @DomainService({
        serviceId: 'contextA1',
        context: 'ContextA',
        tags: ['contextA', 'service1']
      })
      class ContextA1 extends TestDomainService {
        constructor() { super('contextA1'); }
      }

      @DomainService({
        serviceId: 'contextA2',
        context: 'ContextA',
        tags: ['contextA', 'service2']
      })
      class _ContextA2 extends TestDomainService {
        constructor() { super('contextA2'); }
      }

      @DomainService({
        serviceId: 'contextB1',
        context: 'ContextB',
        tags: ['contextB', 'service1']
      })
      class _ContextB1 extends TestDomainService {
        constructor() { super('contextB1'); }
      }

      // Test context-based queries
      const contextAServices = DIDomainServiceMetadataRegistry.getServicesByContext('ContextA');
      expect(contextAServices).toHaveLength(2);
      expect(contextAServices.map(s => s.serviceId)).toEqual(['contextA1', 'contextA2']);

      const contextBServices = DIDomainServiceMetadataRegistry.getServicesByContext('ContextB');
      expect(contextBServices).toHaveLength(1);
      expect(contextBServices[0]?.serviceId).toBe('contextB1');

      // Test tag-based queries
      const service1Tagged = DIDomainServiceMetadataRegistry.getServicesByTag('service1');
      expect(service1Tagged).toHaveLength(2);
      expect(service1Tagged.map(s => s.serviceId)).toEqual(['contextA1', 'contextB1']);

      const contextATagged = DIDomainServiceMetadataRegistry.getServicesByTag('contextA');
      expect(contextATagged).toHaveLength(2);
      expect(contextATagged.map(s => s.serviceId)).toEqual(['contextA1', 'contextA2']);

      // Test individual service retrieval
      const specificService = DIDomainServiceMetadataRegistry.getService('contextA1');
      expect(specificService).toBeDefined();
      expect(specificService?.serviceType).toBe(ContextA1);

      // Test existence check
      expect(DIDomainServiceMetadataRegistry.hasService('contextA1')).toBe(true);
      expect(DIDomainServiceMetadataRegistry.hasService('nonExistent')).toBe(false);

      // Test get all services
      const allServices = DIDomainServiceMetadataRegistry.getAllServices();
      expect(allServices).toHaveLength(3);
    });
  });
});
