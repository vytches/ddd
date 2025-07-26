/**
 * Simple integration tests for Domain Services DI metadata
 * (without external DI package dependencies)
 *
 * NOTE: DIDomainServiceMetadataRegistry and DomainServiceDiscoveryPlugin
 * have been moved to @vytches/ddd-di package. These tests are preserved
 * for reference but are currently disabled.
 */

import { describe, it, expect } from 'vitest';

describe.skip('Domain Services DI Metadata Integration', () => {
  it('DI integration functionality has been moved to @vytches/ddd-di package', () => {
    // All DI integration tests should be performed in the @vytches/ddd-di package
    // This file is kept for reference only
    expect(true).toBe(true);
  });
});

/* Original tests preserved for reference:

import { describe, it, expect, beforeEach } from 'vitest';
import {
  // DomainServiceDiscoveryPlugin, // Moved to @vytches/ddd-di
  // DIDomainServiceMetadataRegistry, // Moved to @vytches/ddd-di
  DomainService,
  getDIDomainServiceMetadata,
  isDomainServicePendingDIRegistration,
} from '../../src';
import { ServiceLifetime } from '@vytches/ddd-di';

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
        caching: { enabled: true, ttl: 300 },
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

      // 3. Verify pending DI registration
      expect(isDomainServicePendingDIRegistration(CompleteWorkflowService)).toBe(true);

      // 4. Verify service was registered in registry
      const registeredService =
        DIDomainServiceMetadataRegistry.getService('completeWorkflowService');
      expect(registeredService).toBeDefined();
      expect(registeredService?.serviceType).toBe(CompleteWorkflowService);
      expect(registeredService?.metadata).toEqual(diMetadata);
    });
  });

  describe('Decorator mode detection', () => {
    it('should handle legacy string ID mode', () => {
      @DomainService('legacyService')
      class LegacyService extends TestDomainService {
        constructor() {
          super('legacyService');
        }
      }

      expect(getDIDomainServiceMetadata(LegacyService)).toBeUndefined();
      expect(isDomainServicePendingDIRegistration(LegacyService)).toBe(false);
      expect(DIDomainServiceMetadataRegistry.getService('legacyService')).toBeUndefined();
    });

    it('should handle legacy options mode', () => {
      @DomainService({
        serviceId: 'legacyOptionsService',
        transactional: true,
        publishesEvents: true,
      })
      class LegacyOptionsService extends TestDomainService {
        constructor() {
          super('legacyOptionsService');
        }
      }

      expect(getDIDomainServiceMetadata(LegacyOptionsService)).toBeUndefined();
      expect(isDomainServicePendingDIRegistration(LegacyOptionsService)).toBe(false);
      expect(DIDomainServiceMetadataRegistry.getService('legacyOptionsService')).toBeUndefined();
    });

    it('should handle DI-enhanced mode', () => {
      @DomainService({
        serviceId: 'diEnhancedService',
        lifetime: ServiceLifetime.Transient,
      })
      class DIEnhancedService extends TestDomainService {
        constructor() {
          super('diEnhancedService');
        }
      }

      expect(getDIDomainServiceMetadata(DIEnhancedService)).toBeDefined();
      expect(isDomainServicePendingDIRegistration(DIEnhancedService)).toBe(true);
      expect(DIDomainServiceMetadataRegistry.getService('diEnhancedService')).toBeDefined();
    });
  });

  describe('Selective DI registration', () => {
    it('should not mark for DI registration when autoRegister is false', () => {
      @DomainService({
        serviceId: 'manualRegisterService',
        lifetime: ServiceLifetime.Singleton,
        autoRegister: false,
      })
      class ManualRegisterService extends TestDomainService {
        constructor() {
          super('manualRegisterService');
        }
      }

      const diMetadata = getDIDomainServiceMetadata(ManualRegisterService);
      expect(diMetadata).toBeDefined();
      expect(diMetadata?.autoRegister).toBe(false);
      expect(isDomainServicePendingDIRegistration(ManualRegisterService)).toBe(false);
    });

    it('should mark for DI registration by default', () => {
      @DomainService({
        serviceId: 'autoRegisterService',
        lifetime: ServiceLifetime.Singleton,
      })
      class AutoRegisterService extends TestDomainService {
        constructor() {
          super('autoRegisterService');
        }
      }

      const diMetadata = getDIDomainServiceMetadata(AutoRegisterService);
      expect(diMetadata).toBeDefined();
      expect(diMetadata?.autoRegister).toBe(true);
      expect(isDomainServicePendingDIRegistration(AutoRegisterService)).toBe(true);
    });
  });

  describe('Plugin discovery readiness', () => {
    it('should prepare services for discovery plugin', async () => {
      @DomainService({
        serviceId: 'discoverableService1',
        lifetime: ServiceLifetime.Singleton,
        context: 'TestContext',
        tags: ['discoverable', 'test'],
        autoRegister: true,
      })
      class DiscoverableService1 extends TestDomainService {
        constructor() {
          super('discoverableService1');
        }
      }

      @DomainService({
        serviceId: 'discoverableService2',
        lifetime: ServiceLifetime.Transient,
        context: 'TestContext',
        tags: ['discoverable', 'test'],
        autoRegister: true,
      })
      class DiscoverableService2 extends TestDomainService {
        constructor() {
          super('discoverableService2');
        }
      }

      @DomainService({
        serviceId: 'nonDiscoverableService',
        lifetime: ServiceLifetime.Singleton,
        autoRegister: false,
      })
      class _NonDiscoverableService extends TestDomainService {
        constructor() {
          super('nonDiscoverableService');
        }
      }

      // Simulate what discovery plugin would do
      const autoRegisterServices = DIDomainServiceMetadataRegistry.getAllServices().filter(
        s => s.metadata.autoRegister !== false
      );

      expect(autoRegisterServices).toHaveLength(2);
      expect(autoRegisterServices.map(s => s.serviceId)).toContain('discoverableService1');
      expect(autoRegisterServices.map(s => s.serviceId)).toContain('discoverableService2');
      expect(autoRegisterServices.map(s => s.serviceId)).not.toContain('nonDiscoverableService');
    });
  });

  describe('Registry queries', () => {
    beforeEach(() => {
      // Set up test services
      @DomainService({
        serviceId: 'contextA1',
        context: 'ContextA',
        tags: ['service1', 'contextA'],
      })
      class _ContextA1Service extends TestDomainService {
        constructor() {
          super('contextA1');
        }
      }

      @DomainService({
        serviceId: 'contextA2',
        context: 'ContextA',
        tags: ['service2', 'contextA'],
      })
      class _ContextA2Service extends TestDomainService {
        constructor() {
          super('contextA2');
        }
      }

      @DomainService({
        serviceId: 'contextB1',
        context: 'ContextB',
        tags: ['service1', 'contextB'],
      })
      class _ContextB1Service extends TestDomainService {
        constructor() {
          super('contextB1');
        }
      }
    });

    it('should query services by context', () => {
      const contextAServices = DIDomainServiceMetadataRegistry.getServicesByContext('ContextA');
      expect(contextAServices).toHaveLength(2);
      expect(contextAServices.map(s => s.serviceId)).toContain('contextA1');
      expect(contextAServices.map(s => s.serviceId)).toContain('contextA2');

      const contextBServices = DIDomainServiceMetadataRegistry.getServicesByContext('ContextB');
      expect(contextBServices).toHaveLength(1);
      expect(contextBServices[0]?.serviceId).toBe('contextB1');
    });

    it('should query services by tag', () => {
      const service1Tagged = DIDomainServiceMetadataRegistry.getServicesByTag('service1');
      expect(service1Tagged).toHaveLength(2);
      expect(service1Tagged.map(s => s.serviceId)).toContain('contextA1');
      expect(service1Tagged.map(s => s.serviceId)).toContain('contextB1');

      const contextATagged = DIDomainServiceMetadataRegistry.getServicesByTag('contextA');
      expect(contextATagged).toHaveLength(2);
      expect(contextATagged.map(s => s.serviceId)).toContain('contextA1');
      expect(contextATagged.map(s => s.serviceId)).toContain('contextA2');
    });

    it('should retrieve individual services', () => {
      const specificService = DIDomainServiceMetadataRegistry.getService('contextA1');
      expect(specificService).toBeDefined();
      expect(specificService?.metadata.context).toBe('ContextA');
      expect(specificService?.metadata.tags).toContain('service1');
    });

    it('should check service existence', () => {
      expect(DIDomainServiceMetadataRegistry.hasService('contextA1')).toBe(true);
      expect(DIDomainServiceMetadataRegistry.hasService('nonExistent')).toBe(false);
    });

    it('should get all services', () => {
      const allServices = DIDomainServiceMetadataRegistry.getAllServices();
      expect(allServices.length).toBeGreaterThanOrEqual(3);
      expect(allServices.map(s => s.serviceId)).toContain('contextA1');
      expect(allServices.map(s => s.serviceId)).toContain('contextA2');
      expect(allServices.map(s => s.serviceId)).toContain('contextB1');
    });
  });
});

*/
