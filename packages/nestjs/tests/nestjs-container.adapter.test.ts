import type { ModuleRef } from '@nestjs/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NestJSContainerAdapter } from '../src/adapters/nestjs-container.adapter';
import { safeRun } from '@vytches/ddd-utils';
// eslint-disable-next-line @nx/enforce-module-boundaries -- Required for testing
import {
  CircularDependencyError,
  ContainerServiceNotFoundError,
  InvalidRegistrationError,
  ServiceLifetime,
} from '@vytches/ddd-di';
// eslint-disable-next-line @nx/enforce-module-boundaries -- Required for testing
import type { ServiceFactory, ServiceToken } from '@vytches/ddd-di';

describe('NestJSContainerAdapter', () => {
  let adapter: NestJSContainerAdapter;
  let mockModuleRef: { get: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    // Create mock ModuleRef
    mockModuleRef = {
      get: vi.fn(),
    } as { get: ReturnType<typeof vi.fn> };

    adapter = new NestJSContainerAdapter(mockModuleRef as unknown as ModuleRef);
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
      const newModuleRef = { get: vi.fn() };

      newAdapter.setModuleRef(newModuleRef as unknown as ModuleRef);
      // Test that it doesn't throw
      expect(() => newAdapter.setModuleRef(newModuleRef as unknown as ModuleRef)).not.toThrow();
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
        lifetime: ServiceLifetime.Singleton,
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
        lifetime: ServiceLifetime.Singleton,
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
      mockModuleRef.get.mockReturnValue(nestService);

      const result = adapter.resolve('nestService');

      expect(result).toBe(nestService);
      expect(mockModuleRef.get).toHaveBeenCalledWith('nestService', { strict: false });
    });

    it('should resolve from internal container if not in NestJS', () => {
      mockModuleRef.get.mockImplementation(() => {
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
        lifetime: ServiceLifetime.Singleton,
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
        lifetime: ServiceLifetime.Transient,
      });

      const first = adapter.resolve('transientService');
      const second = adapter.resolve('transientService');

      expect(first).not.toBe(second);
      expect(callCount).toBe(2);
    });

    it('should throw error for unregistered service', () => {
      mockModuleRef.get.mockImplementation(() => {
        throw new Error('Not found');
      });

      const [error] = safeRun(() => adapter.resolve('unknownService'));

      expect(error).toBeInstanceOf(ContainerServiceNotFoundError);
      expect(error?.message).toContain('unknownService');
    });

    it('should create instance with dependency injection', () => {
      class DependencyService {
        value = 'dependency';
      }

      class MainService {
        constructor(public dep: DependencyService) {}
      }

      // VF-030: constructor dependencies resolve by token REFERENCE — the
      // dependency must be registered under its class token.
      adapter.register(DependencyService, DependencyService);
      adapter.register('main', MainService as new (...args: unknown[]) => MainService);

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
      mockModuleRef.get.mockImplementation(() => {
        throw new Error('Not found');
      });

      expect(adapter.isRegistered('unknown')).toBe(false);
    });

    it('should check NestJS container', () => {
      mockModuleRef.get.mockReturnValue({});

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
          lifetime: ServiceLifetime.Singleton,
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
      mockModuleRef.get.mockImplementation(() => {
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

  describe('token identity (VF-030 D1/D2/D8)', () => {
    // Adapter without ModuleRef so isRegistered/resolve exercise ONLY the
    // internal reference-keyed maps.
    let localAdapter: NestJSContainerAdapter;

    beforeEach(() => {
      localAdapter = new NestJSContainerAdapter();
    });

    it('should keep two same-named classes isolated', () => {
      const ClassA = (() =>
        class Service {
          readonly kind = 'A';
        })();
      const ClassB = (() =>
        class Service {
          readonly kind = 'B';
        })();

      localAdapter.registerFactory(ClassA, () => new ClassA());
      localAdapter.registerFactory(ClassB, () => new ClassB());

      expect(localAdapter.resolve(ClassA).kind).toBe('A');
      expect(localAdapter.resolve(ClassB).kind).toBe('B');
    });

    it('should treat distinct symbols with the same description as distinct registrations', () => {
      const symbolA = Symbol('Service');
      const symbolB = Symbol('Service');

      localAdapter.registerInstance(symbolA, { value: 'a' });
      localAdapter.registerInstance(symbolB, { value: 'b' });

      expect(localAdapter.resolve<{ value: string }>(symbolA).value).toBe('a');
      expect(localAdapter.resolve<{ value: string }>(symbolB).value).toBe('b');
    });

    it('should store the REAL token in the service descriptor', () => {
      const symbolToken = Symbol('symbol-service');
      class ClassToken {}

      localAdapter.registerInstance(symbolToken, { value: 'symbol' });
      localAdapter.register(ClassToken, ClassToken);

      const tokens = localAdapter.getServices().map(descriptor => descriptor.token);

      expect(tokens).toContain(symbolToken);
      expect(tokens).toContain(ClassToken);
      expect(tokens).not.toContain('Symbol(symbol-service)');
      expect(tokens).not.toContain('ClassToken');
    });
  });

  describe('lifetime parity with SimpleContainer (VF-030 D5)', () => {
    let localAdapter: NestJSContainerAdapter;

    beforeEach(() => {
      localAdapter = new NestJSContainerAdapter();
    });

    it('singleton: should resolve to the same instance on every resolve', () => {
      class SingletonService {}
      localAdapter.register(SingletonService, SingletonService, {
        lifetime: ServiceLifetime.Singleton,
      });

      expect(localAdapter.resolve(SingletonService)).toBe(localAdapter.resolve(SingletonService));
    });

    it('singleton: should share materialized instances with created scopes', () => {
      class SingletonService {}
      localAdapter.register(SingletonService, SingletonService, {
        lifetime: ServiceLifetime.Singleton,
      });

      const parentInstance = localAdapter.resolve(SingletonService);
      const scope = localAdapter.createScope('request');

      expect(scope.resolve(SingletonService)).toBe(parentInstance);
    });

    it('scoped: should resolve to the same instance within one adapter instance', () => {
      class ScopedService {}
      localAdapter.register(ScopedService, ScopedService, {
        lifetime: ServiceLifetime.Scoped,
      });

      expect(localAdapter.resolve(ScopedService)).toBe(localAdapter.resolve(ScopedService));
    });

    it('scoped: should resolve to distinct instances across createScope boundaries', () => {
      class ScopedService {}
      localAdapter.register(ScopedService, ScopedService, {
        lifetime: ServiceLifetime.Scoped,
      });

      const rootInstance = localAdapter.resolve(ScopedService);
      const scopeA = localAdapter.createScope('request-a');
      const scopeB = localAdapter.createScope('request-b');

      const scopeAInstance = scopeA.resolve(ScopedService);
      const scopeBInstance = scopeB.resolve(ScopedService);

      // Fresh scoped cache per scope — never a copy of the parent's instance
      expect(scopeAInstance).not.toBe(rootInstance);
      expect(scopeBInstance).not.toBe(rootInstance);
      expect(scopeAInstance).not.toBe(scopeBInstance);

      // ...but stable WITHIN each scope (never silently transient)
      expect(scopeA.resolve(ScopedService)).toBe(scopeAInstance);
      expect(scopeB.resolve(ScopedService)).toBe(scopeBInstance);
    });

    it('transient: should resolve to a new instance on every resolve', () => {
      class TransientService {}
      localAdapter.register(TransientService, TransientService, {
        lifetime: ServiceLifetime.Transient,
      });

      expect(localAdapter.resolve(TransientService)).not.toBe(
        localAdapter.resolve(TransientService)
      );
    });
  });

  describe('error types (VF-030 D6/D7)', () => {
    let localAdapter: NestJSContainerAdapter;

    beforeEach(() => {
      localAdapter = new NestJSContainerAdapter();
    });

    it('should throw ContainerServiceNotFoundError for an unregistered token', () => {
      const [error] = safeRun(() => localAdapter.resolve('missing'));

      expect(error).toBeInstanceOf(ContainerServiceNotFoundError);
    });

    it('should throw InvalidRegistrationError for a null token', () => {
      class TestService {}

      const [error] = safeRun(() =>
        localAdapter.register(null as unknown as ServiceToken, TestService)
      );

      expect(error).toBeInstanceOf(InvalidRegistrationError);
    });

    it('should throw InvalidRegistrationError when a registration has nothing to build', () => {
      localAdapter.registerFactory('broken', undefined as unknown as ServiceFactory);

      const [error] = safeRun(() => localAdapter.resolve('broken'));

      expect(error).toBeInstanceOf(InvalidRegistrationError);
    });

    it('should THROW on failed constructor-dependency resolution instead of creating a ghost instance', () => {
      class UnregisteredDependency {
        constructor(public readonly required: string) {}
      }
      class MainService {
        constructor(public readonly dep: unknown) {}
      }

      localAdapter.register(MainService, MainService);

      const originalGetMetadata = Reflect.getMetadata;
      Reflect.getMetadata = vi.fn((key, target) => {
        if (key === 'design:paramtypes' && target === MainService) {
          return [UnregisteredDependency];
        }
        return originalGetMetadata(key, target);
      });

      try {
        const [error] = safeRun(() => localAdapter.resolve(MainService));

        // Pre-VF-030 the adapter silently constructed `new UnregisteredDependency()`
        // (a zero-arg ghost). Now the failure is loud and typed.
        expect(error).toBeInstanceOf(ContainerServiceNotFoundError);
      } finally {
        Reflect.getMetadata = originalGetMetadata;
      }
    });

    it('should throw CircularDependencyError on circular constructor dependencies', () => {
      class ServiceA {
        constructor(public readonly b: unknown) {}
      }
      class ServiceB {
        constructor(public readonly a: unknown) {}
      }

      localAdapter.register(ServiceA, ServiceA);
      localAdapter.register(ServiceB, ServiceB);

      const originalGetMetadata = Reflect.getMetadata;
      Reflect.getMetadata = vi.fn((key, target) => {
        if (key === 'design:paramtypes' && target === ServiceA) {
          return [ServiceB];
        }
        if (key === 'design:paramtypes' && target === ServiceB) {
          return [ServiceA];
        }
        return originalGetMetadata(key, target);
      });

      try {
        const [error] = safeRun(() => localAdapter.resolve(ServiceA));

        expect(error).toBeInstanceOf(CircularDependencyError);
      } finally {
        Reflect.getMetadata = originalGetMetadata;
      }
    });
  });
});
