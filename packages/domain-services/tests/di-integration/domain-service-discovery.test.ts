/**
 * Tests for Domain Service DI Integration
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  IBaseDomainService,
  // DIDomainServiceMetadataRegistry, // Moved to @vytches/ddd-di
  // DomainServiceDiscoveryPlugin, // Moved to @vytches/ddd-di
  DomainService,
  getDIDomainServiceMetadata,
  isDomainServicePendingDIRegistration,
} from '../../src';
import { ServiceLifetime } from '@vytches/ddd-di';

// Simple test base class
class TestDomainService extends IBaseDomainService {
  constructor(serviceId = 'test') {
    super(serviceId);
  }
}

describe('Domain Service DI Integration', () => {
  beforeEach(() => {
    // DIDomainServiceMetadataRegistry.clear(); // Moved to @vytches/ddd-di
  });

  describe('@DomainService decorator with DI options', () => {
    it('should create DI metadata for enhanced options', () => {
      @DomainService({
        serviceId: 'testService',
        lifetime: ServiceLifetime.Singleton,
        context: 'TestContext',
        tags: ['test', 'domain'],
        autoRegister: true,
      })
      class TestService extends TestDomainService {}

      const diMetadata = getDIDomainServiceMetadata(TestService);

      expect(diMetadata).toBeDefined();
      expect(diMetadata?.serviceId).toBe('testService');
      expect(diMetadata?.lifetime).toBe(ServiceLifetime.Singleton);
      expect(diMetadata?.context).toBe('TestContext');
      expect(diMetadata?.tags).toEqual(['test', 'domain']);
      expect(diMetadata?.autoRegister).toBe(true);
    });

    it('should maintain backward compatibility for simple string ID', () => {
      @DomainService('simpleService')
      class SimpleService extends TestDomainService {}

      const diMetadata = getDIDomainServiceMetadata(SimpleService);
      expect(diMetadata).toBeUndefined();

      expect(isDomainServicePendingDIRegistration(SimpleService)).toBe(false);
    });

    it('should maintain backward compatibility for legacy options', () => {
      @DomainService({
        serviceId: 'legacyService',
        transactional: true,
        publishesEvents: true,
      })
      class _LegacyService extends TestDomainService {}

      const diMetadata = getDIDomainServiceMetadata(_LegacyService);
      expect(diMetadata).toBeUndefined();

      expect(isDomainServicePendingDIRegistration(_LegacyService)).toBe(false);
    });

    it('should mark services as pending DI registration', () => {
      @DomainService({
        serviceId: 'pendingService',
        lifetime: ServiceLifetime.Transient,
        autoRegister: true,
      })
      class PendingService extends TestDomainService {}

      expect(isDomainServicePendingDIRegistration(PendingService)).toBe(true);
    });

    it.skip('should register metadata in DIDomainServiceMetadataRegistry', () => {
      // This functionality has been moved to @vytches/ddd-di
      // @DomainService({
      //   serviceId: 'registryService',
      //   lifetime: ServiceLifetime.Singleton,
      //   context: 'Registry',
      // })
      // class RegistryService extends TestDomainService {}
      // const registeredService = DIDomainServiceMetadataRegistry.getService('registryService');
      // expect(registeredService).toBeDefined();
      // expect(registeredService?.serviceType).toBe(RegistryService);
    });
  });

  describe.skip('DomainServiceDiscoveryPlugin', () => {
    // This functionality has been moved to @vytches/ddd-di
    // let plugin: DomainServiceDiscoveryPlugin;

    // beforeEach(() => {
    //   plugin = new DomainServiceDiscoveryPlugin();
    // });

    it('should be available when domain services package is loaded', () => {
      // expect(plugin.isAvailable()).toBe(true);
    });

    it('should have correct plugin name', () => {
      // expect(plugin.name).toBe('DomainService');
    });

    it('should discover domain services with DI integration', async () => {
      // @DomainService({
      //   serviceId: 'discoverableService',
      //   lifetime: ServiceLifetime.Singleton,
      //   context: 'Discovery',
      //   tags: ['discoverable'],
      //   autoRegister: true,
      // })
      // class DiscoverableService extends TestDomainService {}
      // const handlers = await plugin.discoverHandlers();
      // expect(handlers).toHaveLength(1);
      // const handler = handlers[0];
      // expect(handler?.type).toBe('domain-service');
      // expect(handler?.handlerType).toBe(DiscoverableService);
      // expect(handler?.metadata.serviceId).toBe('discoverableService');
      // expect(handler?.metadata.lifetime).toBe(ServiceLifetime.Singleton);
      // expect(handler?.metadata.context).toBe('Discovery');
      // expect(handler?.metadata.tags).toEqual(['discoverable']);
    });

    it('should not discover services without autoRegister', async () => {
      // @DomainService({
      //   serviceId: 'nonAutoService',
      //   lifetime: ServiceLifetime.Singleton,
      //   autoRegister: false,
      // })
      // class _NonAutoService extends TestDomainService {}
      // const handlers = await plugin.discoverHandlers();
      // expect(handlers).toHaveLength(0);
    });

    it('should not discover legacy services without DI integration', async () => {
      // @DomainService('legacyService')
      // class _LegacyService extends TestDomainService {}
      // const handlers = await plugin.discoverHandlers();
      // expect(handlers).toHaveLength(0);
    });
  });

  describe.skip('DIDomainServiceMetadataRegistry', () => {
    // This functionality has been moved to @vytches/ddd-di
    // beforeEach(() => {
    //   DIDomainServiceMetadataRegistry.clear();
    // });

    it('should store and retrieve services by ID', () => {
      // @DomainService({
      //   serviceId: 'storageService',
      //   lifetime: ServiceLifetime.Transient,
      // })
      // class StorageService extends TestDomainService {}
      // const retrieved = DIDomainServiceMetadataRegistry.getService('storageService');
      // expect(retrieved).toBeDefined();
      // expect(retrieved?.serviceType).toBe(StorageService);
    });

    it('should retrieve services by context', () => {
      // @DomainService({
      //   serviceId: 'contextService1',
      //   context: 'ContextA',
      // })
      // class _ContextServiceA extends TestDomainService {}
      // @DomainService({
      //   serviceId: 'contextService2',
      //   context: 'ContextB',
      // })
      // class _ContextServiceB extends TestDomainService {}
      // const contextAServices = DIDomainServiceMetadataRegistry.getServicesByContext('ContextA');
      // expect(contextAServices).toHaveLength(1);
      // expect(contextAServices[0]?.serviceId).toBe('contextService1');
    });

    it('should retrieve services by tag', () => {
      // @DomainService({
      //   serviceId: 'taggedService1',
      //   tags: ['order', 'business'],
      // })
      // class _TaggedService1 extends TestDomainService {}
      // @DomainService({
      //   serviceId: 'taggedService2',
      //   tags: ['user', 'business'],
      // })
      // class _TaggedService2 extends TestDomainService {}
      // const businessServices = DIDomainServiceMetadataRegistry.getServicesByTag('business');
      // expect(businessServices).toHaveLength(2);
      // const orderServices = DIDomainServiceMetadataRegistry.getServicesByTag('order');
      // expect(orderServices).toHaveLength(1);
      // expect(orderServices[0]?.serviceId).toBe('taggedService1');
    });
  });
});
