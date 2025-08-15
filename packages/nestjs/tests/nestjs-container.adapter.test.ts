import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ModuleRef } from '@nestjs/core';
import { NestJSContainerAdapter } from '../src/adapters/nestjs-container.adapter';
// ServiceLifetime will be imported dynamically when needed
import { safeRun } from '@vytches/ddd-utils';

describe('NestJSContainerAdapter', () => {
  let adapter: NestJSContainerAdapter;
  let mockModuleRef: ModuleRef;

  beforeEach(() => {
    // Create mock ModuleRef
    mockModuleRef = {
      get: vi.fn(),
    } as any;

    adapter = new NestJSContainerAdapter(mockModuleRef);
  });

  describe('constructor', () => {
    it('should create adapter without ModuleRef', () => {
      const adapterWithoutRef = new NestJSContainerAdapter();
      expect(adapterWithoutRef).toBeDefined();
    });

    it('should create adapter with ModuleRef', () => {
      expect(adapter).toBeDefined();
    });
  });

  describe('setModuleRef', () => {
    it('should update ModuleRef', () => {
      const newAdapter = new NestJSContainerAdapter();
      const newModuleRef = { get: vi.fn() } as any;

      newAdapter.setModuleRef(newModuleRef);
      // Test that it doesn't throw
      expect(() => newAdapter.setModuleRef(newModuleRef)).not.toThrow();
    });
  });

  describe('register', () => {
    it('should register a service with default lifetime', () => {
      class TestService {}

      adapter.register('testService', TestService);

      expect(adapter.isRegistered('testService')).toBe(true);
    });

    it('should register a service with singleton lifetime', () => {
      class TestService {}

      adapter.register('testService', TestService, {
        lifetime: 'singleton',
      });

      expect(adapter.isRegistered('testService')).toBe(true);
    });

    it('should register a service with tags', () => {
      class TestService {}

      adapter.register('testService', TestService, {
        tags: ['test', 'service'],
      });

      const services = adapter.getServicesByTag('test');
      expect(services).toHaveLength(1);
      expect(services[0]?.token).toBe('testService');
    });
  });

  describe('registerFactory', () => {
    it('should register a factory function', () => {
      const factory = () => ({ value: 'test' });

      adapter.registerFactory('testFactory', factory);

      expect(adapter.isRegistered('testFactory')).toBe(true);
    });

    it('should register a factory with options', () => {
      const factory = () => ({ value: 'test' });

      adapter.registerFactory('testFactory', factory, {
        lifetime: 'singleton',
        tags: ['factory'],
      });

      const services = adapter.getServicesByTag('factory');
      expect(services).toHaveLength(1);
    });
  });

  describe('registerInstance', () => {
    it('should register an instance', () => {
      const instance = { value: 'test' };

      adapter.registerInstance('testInstance', instance);

      expect(adapter.isRegistered('testInstance')).toBe(true);
      expect(adapter.resolve('testInstance')).toBe(instance);
    });

    it('should register an instance with tags', () => {
      const instance = { value: 'test' };

      adapter.registerInstance('testInstance', instance, {
        tags: ['instance'],
      });

      const services = adapter.getServicesByTag('instance');
      expect(services).toHaveLength(1);
    });
  });

  describe('resolve', () => {
    it('should resolve from NestJS container first', () => {
      const nestService = { value: 'from-nest' };
      (mockModuleRef.get as any).mockReturnValue(nestService);

      const result = adapter.resolve('nestService');

      expect(result).toBe(nestService);
      expect(mockModuleRef.get).toHaveBeenCalledWith('nestService', { strict: false });
    });

    it('should resolve from internal container if not in NestJS', () => {
      (mockModuleRef.get as any).mockImplementation(() => {
        throw new Error('Not found');
      });

      const instance = { value: 'internal' };
      adapter.registerInstance('internalService', instance);

      const result = adapter.resolve('internalService');

      expect(result).toBe(instance);
    });

    it('should resolve singleton only once', () => {
      let callCount = 0;
      const factory = () => {
        callCount++;
        return { id: callCount };
      };

      adapter.registerFactory('singletonService', factory, {
        lifetime: 'singleton',
      });

      const first = adapter.resolve('singletonService');
      const second = adapter.resolve('singletonService');

      expect(first).toBe(second);
      expect(callCount).toBe(1);
    });

    it('should resolve transient with new instance each time', () => {
      let callCount = 0;
      const factory = () => {
        callCount++;
        return { id: callCount };
      };

      adapter.registerFactory('transientService', factory, {
        lifetime: 'transient',
      });

      const first = adapter.resolve('transientService');
      const second = adapter.resolve('transientService');

      expect(first).not.toBe(second);
      expect(callCount).toBe(2);
    });

    it('should throw error for unregistered service', () => {
      (mockModuleRef.get as any).mockImplementation(() => {
        throw new Error('Not found');
      });

      const [error] = safeRun(() => adapter.resolve('unknownService'));

      expect(error).toBeDefined();
      expect(error?.message).toContain('unknownService');
    });

    it('should create instance with dependency injection', () => {
      class DependencyService {
        value = 'dependency';
      }

      class MainService {
        constructor(public dep: DependencyService) {}
      }

      adapter.register('dependency', DependencyService);
      adapter.register('main', MainService);

      // Mock Reflect.getMetadata to return constructor parameters
      const originalGetMetadata = Reflect.getMetadata;
      Reflect.getMetadata = vi.fn((key, target) => {
        if (key === 'design:paramtypes' && target === MainService) {
          return [DependencyService];
        }
        return originalGetMetadata(key, target);
      });

      const mainService = adapter.resolve<MainService>('main');

      expect(mainService).toBeDefined();
      expect(mainService.dep).toBeDefined();
      expect(mainService.dep.value).toBe('dependency');

      // Restore original
      Reflect.getMetadata = originalGetMetadata;
    });
  });

  describe('isRegistered', () => {
    it('should return true for registered service', () => {
      adapter.registerInstance('test', {});
      expect(adapter.isRegistered('test')).toBe(true);
    });

    it('should return false for unregistered service', () => {
      (mockModuleRef.get as any).mockImplementation(() => {
        throw new Error('Not found');
      });

      expect(adapter.isRegistered('unknown')).toBe(false);
    });

    it('should check NestJS container', () => {
      (mockModuleRef.get as any).mockReturnValue({});

      expect(adapter.isRegistered('nestService')).toBe(true);
    });
  });

  describe('getServices', () => {
    it('should return all registered services', () => {
      adapter.registerInstance('service1', {});
      adapter.registerInstance('service2', {});
      adapter.registerFactory('service3', () => ({}));

      const services = adapter.getServices();

      expect(services).toHaveLength(3);
      expect(services.map(s => s.token)).toContain('service1');
      expect(services.map(s => s.token)).toContain('service2');
      expect(services.map(s => s.token)).toContain('service3');
    });
  });

  describe('getServicesByTag', () => {
    it('should return services with specific tag', () => {
      adapter.registerInstance('service1', {}, { tags: ['api'] });
      adapter.registerInstance('service2', {}, { tags: ['db'] });
      adapter.registerInstance('service3', {}, { tags: ['api', 'v2'] });

      const apiServices = adapter.getServicesByTag('api');

      expect(apiServices).toHaveLength(2);
      expect(apiServices.map(s => s.token)).toContain('service1');
      expect(apiServices.map(s => s.token)).toContain('service3');
    });

    it('should return empty array for unknown tag', () => {
      adapter.registerInstance('service1', {}, { tags: ['api'] });

      const services = adapter.getServicesByTag('unknown');

      expect(services).toHaveLength(0);
    });
  });

  describe('createScope', () => {
    it('should create scoped container', () => {
      adapter.registerInstance(
        'singleton',
        { value: 'singleton' },
        {
          lifetime: 'singleton',
        }
      );

      const scoped = adapter.createScope('test-scope');

      expect(scoped).toBeDefined();
      expect(scoped.isRegistered('singleton')).toBe(true);
    });

    it('should share singleton services', () => {
      const instance = { value: 'shared' };
      adapter.registerInstance('singleton', instance);

      const scoped = adapter.createScope();
      const resolved = scoped.resolve('singleton');

      expect(resolved).toBe(instance);
    });
  });

  describe('dispose', () => {
    it('should clear all services and instances', () => {
      (mockModuleRef.get as any).mockImplementation(() => {
        throw new Error('Not found');
      });

      adapter.registerInstance('service1', {});
      adapter.registerInstance('service2', {});

      adapter.dispose();

      expect(adapter.getServices()).toHaveLength(0);
      expect(adapter.isRegistered('service1')).toBe(false);
      expect(adapter.isRegistered('service2')).toBe(false);
    });
  });
});
