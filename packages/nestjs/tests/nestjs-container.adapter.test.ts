import type { ModuleRef } from '@nestjs/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NestJSContainerAdapter } from '../src/adapters/nestjs-container.adapter';
import { safeRun } from '@vytches/ddd-utils';
// eslint-disable-next-line @nx/enforce-module-boundaries -- Required for spying on the internal diagnostics seam
import { internalLogger } from '@vytches/ddd-contracts/internal';
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

    it('should prefer the INTERNAL registration when a token is registered in both containers (VP-006b registry-first)', () => {
      const internalInstance = { source: 'internal' };
      const nestInstance = { source: 'nest' };
      mockModuleRef.get.mockReturnValue(nestInstance);

      adapter.registerInstance('dualService', internalInstance);

      expect(adapter.resolve('dualService')).toBe(internalInstance);
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

    it('should read design:paramtypes only ONCE per implementation across resolves (VP-006b lazy cache)', () => {
      class CachedDependency {
        value = 'dep';
      }
      class CachedMainService {
        constructor(public dep: CachedDependency) {}
      }

      // Both default (Transient) — createInstance runs on EVERY resolve,
      // yet the reflection read must happen only on the first one.
      adapter.register(CachedDependency, CachedDependency);
      adapter.register(
        'cachedMain',
        CachedMainService as new (...args: unknown[]) => CachedMainService
      );

      const originalGetMetadata = Reflect.getMetadata;
      const getMetadataSpy = vi.fn((key, target) => {
        if (key === 'design:paramtypes' && target === CachedMainService) {
          return [CachedDependency];
        }
        return originalGetMetadata(key, target);
      });
      Reflect.getMetadata = getMetadataSpy;

      try {
        const first = adapter.resolve<CachedMainService>('cachedMain');
        const second = adapter.resolve<CachedMainService>('cachedMain');

        // Transient: two distinct instantiations actually happened
        expect(first).not.toBe(second);
        expect(first.dep).toBeInstanceOf(CachedDependency);
        expect(second.dep).toBeInstanceOf(CachedDependency);

        const mainReads = getMetadataSpy.mock.calls.filter(
          ([key, target]) => key === 'design:paramtypes' && target === CachedMainService
        );
        expect(mainReads).toHaveLength(1);

        // Empty metadata (undefined -> []) is cached too — the dependency
        // was instantiated twice but read only once.
        const depReads = getMetadataSpy.mock.calls.filter(
          ([key, target]) => key === 'design:paramtypes' && target === CachedDependency
        );
        expect(depReads).toHaveLength(1);
      } finally {
        Reflect.getMetadata = originalGetMetadata;
      }
    });
  });

  describe('dual-registration divergence guard (VP-006b)', () => {
    it('should warn exactly ONCE per token when internal and NestJS registrations diverge', () => {
      const warnSpy = vi.spyOn(internalLogger, 'warn').mockImplementation(() => undefined);

      try {
        const internalInstance = { source: 'internal' };
        mockModuleRef.get.mockReturnValue({ source: 'nest' });

        adapter.registerInstance('divergentService', internalInstance);

        // Registry-first: internal wins on every resolve, warn fires once
        expect(adapter.resolve('divergentService')).toBe(internalInstance);
        expect(adapter.resolve('divergentService')).toBe(internalInstance);
        expect(adapter.resolve('divergentService')).toBe(internalInstance);

        expect(warnSpy).toHaveBeenCalledTimes(1);
      } finally {
        warnSpy.mockRestore();
      }
    });

    it('should never throw and never warn when the NestJS probe fails or returns the same instance', () => {
      const warnSpy = vi.spyOn(internalLogger, 'warn').mockImplementation(() => undefined);

      try {
        // Probe throws — token only known internally
        mockModuleRef.get.mockImplementation(() => {
          throw new Error('Not found');
        });
        const internalOnly = { source: 'internal-only' };
        adapter.registerInstance('internalOnlyService', internalOnly);
        expect(adapter.resolve('internalOnlyService')).toBe(internalOnly);

        // Probe returns the SAME instance — dual-registered but convergent
        const shared = { source: 'shared' };
        mockModuleRef.get.mockReset();
        mockModuleRef.get.mockReturnValue(shared);
        adapter.registerInstance('sharedService', shared);
        expect(adapter.resolve('sharedService')).toBe(shared);

        expect(warnSpy).not.toHaveBeenCalled();
      } finally {
        warnSpy.mockRestore();
      }
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

    describe('copy-on-write snapshot semantics (VP-006b OQ-2 / VF-030 D5)', () => {
      // Adapters without ModuleRef so isRegistered/resolve exercise ONLY the
      // internal reference-keyed maps, never the NestJS fallback.
      let parent: NestJSContainerAdapter;

      beforeEach(() => {
        parent = new NestJSContainerAdapter();
      });

      it('parent registrations made AFTER scope creation are invisible in the scope', () => {
        parent.registerInstance('before', { value: 'before' });

        const scope = parent.createScope('request');
        parent.registerInstance('after', { value: 'after' });

        expect(scope.isRegistered('before')).toBe(true);
        expect(scope.isRegistered('after')).toBe(false);
        expect(scope.getServices().map(s => s.token)).toEqual(['before']);

        // Parent sees both
        expect(parent.getServices()).toHaveLength(2);
        expect(parent.resolve<{ value: string }>('after').value).toBe('after');
      });

      it('scope registrations do not leak into the parent or a sibling scope', () => {
        parent.registerInstance('shared', { value: 'shared' });

        const scopeA = parent.createScope('a');
        const scopeB = parent.createScope('b');

        scopeA.registerInstance('scope-a-only', { value: 'a' });

        expect(scopeA.isRegistered('scope-a-only')).toBe(true);
        expect(parent.isRegistered('scope-a-only')).toBe(false);
        expect(scopeB.isRegistered('scope-a-only')).toBe(false);
        expect(parent.getServices()).toHaveLength(1);
        expect(scopeB.getServices()).toHaveLength(1);
      });

      it('singleton materialized in the parent AFTER scope creation is not shared with the scope', () => {
        class LateSingleton {}
        parent.register(LateSingleton, LateSingleton, {
          lifetime: ServiceLifetime.Singleton,
        });

        const scope = parent.createScope('request');
        const parentInstance = parent.resolve(LateSingleton);
        const scopeInstance = scope.resolve(LateSingleton);

        // Materialized-singleton set is snapshotted at creation time — the
        // parent's later materialization stays on the parent's side.
        expect(scopeInstance).not.toBe(parentInstance);
        expect(scope.resolve(LateSingleton)).toBe(scopeInstance);
        expect(parent.resolve(LateSingleton)).toBe(parentInstance);
      });

      it('singleton materialized in a scope does not leak into the parent', () => {
        class ScopeFirstSingleton {}
        parent.register(ScopeFirstSingleton, ScopeFirstSingleton, {
          lifetime: ServiceLifetime.Singleton,
        });

        const scope = parent.createScope('request');
        const scopeInstance = scope.resolve(ScopeFirstSingleton);
        const parentInstance = parent.resolve(ScopeFirstSingleton);

        expect(parentInstance).not.toBe(scopeInstance);
        expect(parent.resolve(ScopeFirstSingleton)).toBe(parentInstance);
        expect(scope.resolve(ScopeFirstSingleton)).toBe(scopeInstance);
      });

      it('parent.dispose() does not clear a live scope snapshot', () => {
        const instance = { value: 'survivor' };
        parent.registerInstance('survivor', instance);

        const scope = parent.createScope('request');
        parent.dispose();

        expect(parent.getServices()).toHaveLength(0);
        expect(scope.isRegistered('survivor')).toBe(true);
        expect(scope.resolve('survivor')).toBe(instance);
        expect(scope.getServices()).toHaveLength(1);
      });
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

    it('scope.dispose() does not clear parent maps', () => {
      // Adapter without ModuleRef so assertions exercise ONLY the internal
      // reference-keyed maps (VF-030 D5 scope semantics, VP-006b OQ-2).
      const parent = new NestJSContainerAdapter();

      const singletonInstance = { value: 'materialized-singleton' };
      parent.registerInstance('singleton', singletonInstance, {
        lifetime: ServiceLifetime.Singleton,
      });

      class ScopedService {}
      parent.register(ScopedService, ScopedService, {
        lifetime: ServiceLifetime.Scoped,
      });

      // Materialize the parent's scoped cache too
      const parentScopedInstance = parent.resolve(ScopedService);

      const scope = parent.createScope('request');
      expect(scope.resolve('singleton')).toBe(singletonInstance);
      scope.resolve(ScopedService);

      expect(scope.dispose).toBeDefined();
      scope.dispose?.();

      // Parent services map survives
      expect(parent.getServices()).toHaveLength(2);
      expect(parent.isRegistered('singleton')).toBe(true);
      expect(parent.isRegistered(ScopedService)).toBe(true);

      // Parent singletonInstances map survives — same materialized instance
      expect(parent.resolve('singleton')).toBe(singletonInstance);

      // Parent scopedInstances cache survives — same instance as before
      expect(parent.resolve(ScopedService)).toBe(parentScopedInstance);
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
