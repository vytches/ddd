import { safeRun } from '@vytches/ddd-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CircularDependencyError,
  ContainerDisposedError,
  ServiceAlreadyRegisteredError,
  ServiceLifetime,
  ContainerServiceNotFoundError,
  SimpleContainer,
} from '../../src';

// Helper: produce a class whose .name is '' (truly anonymous — not bound to a variable)
function makeAnonymousClass(): new () => object {
  return new Function('return class {}')() as new () => object;
}

describe('SimpleContainer', () => {
  // Mock container helper for testing
  const createMockContainer = () => new SimpleContainer();
  let container: SimpleContainer;

  beforeEach(() => {
    container = new SimpleContainer();
  });

  afterEach(() => {
    container.dispose();
  });

  describe('register and resolve', () => {
    it('should register and resolve a transient service', () => {
      class TestService {
        public id = Math.random();
      }

      container.register('TestService', TestService);

      const instance1 = container.resolve<TestService>('TestService');
      const instance2 = container.resolve<TestService>('TestService');

      expect(instance1).toBeInstanceOf(TestService);
      expect(instance2).toBeInstanceOf(TestService);
      expect(instance1.id).not.toBe(instance2.id); // Different instances
    });

    it('should register and resolve a singleton service', () => {
      class TestService {
        public id = Math.random();
      }

      container.register('TestService', TestService, { lifetime: ServiceLifetime.Singleton });

      const instance1 = container.resolve<TestService>('TestService');
      const instance2 = container.resolve<TestService>('TestService');

      expect(instance1).toBeInstanceOf(TestService);
      expect(instance2).toBeInstanceOf(TestService);
      expect(instance1.id).toBe(instance2.id); // Same instance
    });

    it('should register and resolve a scoped service', () => {
      class TestService {
        public id = Math.random();
      }

      container.register('TestService', TestService, { lifetime: ServiceLifetime.Scoped });

      const instance1 = container.resolve<TestService>('TestService');
      const instance2 = container.resolve<TestService>('TestService');

      expect(instance1).toBeInstanceOf(TestService);
      expect(instance2).toBeInstanceOf(TestService);
      expect(instance1.id).toBe(instance2.id); // Same instance in same scope
    });
  });

  describe('registerFactory', () => {
    it('should register and resolve a factory service', () => {
      class TestService {
        constructor(public value: string) {}
      }

      container.registerFactory('TestService', () => new TestService('factory-created'));

      const instance = container.resolve<TestService>('TestService');

      expect(instance).toBeInstanceOf(TestService);
      expect(instance.value).toBe('factory-created');
    });

    it('should pass container to factory function', () => {
      class Dependency {
        public value = 'dependency';
      }

      class TestService {
        constructor(public dep: Dependency) {}
      }

      container.registerInstance('Dependency', new Dependency());
      container.registerFactory('TestService', c => {
        const dep = c.resolve<Dependency>('Dependency');
        return new TestService(dep);
      });

      const instance = container.resolve<TestService>('TestService');

      expect(instance).toBeInstanceOf(TestService);
      expect(instance.dep.value).toBe('dependency');
    });
  });

  describe('registerInstance', () => {
    it('should register and resolve an instance', () => {
      class TestService {
        public id = Math.random();
      }

      const originalInstance = new TestService();
      container.registerInstance('TestService', originalInstance);

      const resolvedInstance = container.resolve<TestService>('TestService');

      expect(resolvedInstance).toBe(originalInstance);
    });
  });

  describe('isRegistered', () => {
    it('should return true for registered services', () => {
      class TestService {}

      container.register('TestService', TestService);

      expect(container.isRegistered('TestService')).toBe(true);
    });

    it('should return false for unregistered services', () => {
      expect(container.isRegistered('UnregisteredService')).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should throw ContainerServiceNotFoundError for unregistered service', () => {
      const [serviceNotFoundError] = safeRun(() => {
        container.resolve('UnregisteredService');
      });
      expect(serviceNotFoundError).toBeInstanceOf(ContainerServiceNotFoundError);
    });

    it('should throw ServiceAlreadyRegisteredError for duplicate registration', () => {
      class TestService {}

      container.register('TestService', TestService);

      const [duplicateError] = safeRun(() => {
        container.register('TestService', TestService);
      });
      expect(duplicateError).toBeInstanceOf(ServiceAlreadyRegisteredError);
    });

    it('should throw CircularDependencyError for circular dependencies', () => {
      class ServiceA {
        constructor(_serviceB: ServiceB) {
          // Test class for circular dependency detection
        }
      }

      class ServiceB {
        constructor(_serviceA: ServiceA) {
          // Test class for circular dependency detection
        }
      }

      container.registerFactory('ServiceA', c => {
        const serviceB = c.resolve<ServiceB>('ServiceB');
        return new ServiceA(serviceB);
      });

      container.registerFactory('ServiceB', c => {
        const serviceA = c.resolve<ServiceA>('ServiceA');
        return new ServiceB(serviceA);
      });

      const [circularError] = safeRun(() => {
        container.resolve('ServiceA');
      });
      expect(circularError).toBeInstanceOf(CircularDependencyError);
    });
  });

  describe('scoped containers', () => {
    it('should create a scoped container', () => {
      const scopedContainer = container.createScope('test-scope');

      expect(scopedContainer).toBeInstanceOf(SimpleContainer);
      expect(scopedContainer).not.toBe(container);
    });

    it('should resolve from parent container if not found in scope', () => {
      class TestService {}

      container.register('TestService', TestService);

      const scopedContainer = container.createScope('test-scope');
      const instance = scopedContainer.resolve<TestService>('TestService');

      expect(instance).toBeInstanceOf(TestService);
    });

    it('should resolve from scoped container if registered in scope', () => {
      class TestService {
        constructor(public source: string) {}
      }

      container.registerFactory('TestService', () => new TestService('parent'));

      const scopedContainer = container.createScope('test-scope');
      scopedContainer.registerFactory('TestService', () => new TestService('scoped'));

      const parentInstance = container.resolve<TestService>('TestService');
      const scopedInstance = scopedContainer.resolve<TestService>('TestService');

      expect(parentInstance.source).toBe('parent');
      expect(scopedInstance.source).toBe('scoped');
    });
  });

  describe('getServices', () => {
    it('should return all registered services', () => {
      class ServiceA {}
      class ServiceB {}

      container.register('ServiceA', ServiceA);
      container.register('ServiceB', ServiceB);

      const services = container.getServices();

      expect(services).toHaveLength(2);
      expect(services.some(s => s.token === 'ServiceA')).toBe(true);
      expect(services.some(s => s.token === 'ServiceB')).toBe(true);
    });
  });

  describe('getServicesByTag', () => {
    it('should return services with specific tag', () => {
      class ServiceA {}
      class ServiceB {}
      class ServiceC {}

      container.register('ServiceA', ServiceA, { tags: ['domain'] });
      container.register('ServiceB', ServiceB, { tags: ['infrastructure'] });
      container.register('ServiceC', ServiceC, { tags: ['domain', 'core'] });

      const domainServices = container.getServicesByTag('domain');
      const infrastructureServices = container.getServicesByTag('infrastructure');

      expect(domainServices).toHaveLength(2);
      expect(infrastructureServices).toHaveLength(1);
    });
  });

  describe('dispose', () => {
    it('should dispose the container', () => {
      class TestService {}

      container.register('TestService', TestService);
      container.dispose();

      const [disposedError] = safeRun(() => {
        container.resolve('TestService');
      });
      expect(disposedError).toBeInstanceOf(ContainerDisposedError);
    });

    it('should dispose singleton instances with dispose method', () => {
      let disposed = false;

      class TestService {
        dispose() {
          disposed = true;
        }
      }

      container.register('TestService', TestService, { lifetime: ServiceLifetime.Singleton });
      container.resolve<TestService>('TestService'); // Create instance

      container.dispose();

      expect(disposed).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // D-3/A — tryResolve
  // ---------------------------------------------------------------------------
  describe('tryResolve', () => {
    it('returns the resolved instance when service is registered', () => {
      class TestService {}
      container.register('TestService', TestService);

      const result = container.tryResolve<TestService>('TestService');

      expect(result).toBeInstanceOf(TestService);
    });

    it('returns undefined when service is not registered', () => {
      const result = container.tryResolve('MissingService');

      expect(result).toBeUndefined();
    });

    it('still throws CircularDependencyError on cycles (never swallows it)', () => {
      container.registerFactory('A', c => c.resolve('B'));
      container.registerFactory('B', c => c.resolve('A'));

      const [err] = safeRun(() => container.tryResolve('A'));

      expect(err).toBeInstanceOf(CircularDependencyError);
    });

    it('resolves from parent scope when not found locally', () => {
      class TestService {}
      container.register('TestService', TestService);

      const scope = container.createScope('test') as SimpleContainer;
      const result = scope.tryResolve<TestService>('TestService');

      expect(result).toBeInstanceOf(TestService);
    });

    it('returns undefined when not found in scope or parent', () => {
      const scope = container.createScope('test') as SimpleContainer;

      const result = scope.tryResolve('AbsentService');

      expect(result).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // VF-030 D1 — anonymous classes are distinct tokens (reference identity)
  // ---------------------------------------------------------------------------
  describe('anonymous class tokens — reference identity (OQ-6 contract)', () => {
    it('two distinct anonymous classes register and resolve independently', () => {
      const ClassA = makeAnonymousClass();
      const ClassB = makeAnonymousClass();

      const instanceA = new ClassA();
      const instanceB = new ClassB();

      container.registerInstance(ClassA, instanceA);
      const [secondRegErr] = safeRun(() => container.registerInstance(ClassB, instanceB));

      // Must NOT throw ServiceAlreadyRegisteredError (distinct keys)
      expect(secondRegErr).toBeUndefined();
      expect(container.resolve(ClassA)).toBe(instanceA);
      expect(container.resolve(ClassB)).toBe(instanceB);
    });

    it('the same anonymous class is stable across multiple resolve calls', () => {
      const ClassA = makeAnonymousClass();
      container.register(ClassA, ClassA, { lifetime: ServiceLifetime.Singleton });

      const i1 = container.resolve(ClassA);
      const i2 = container.resolve(ClassA);

      expect(i1).toBe(i2);
    });

    it('named class tokens still work correctly', () => {
      class Named {}
      container.register(Named, Named);

      expect(container.resolve(Named)).toBeInstanceOf(Named);
    });
  });

  // ---------------------------------------------------------------------------
  // D-2/C — Set-based O(1) cycle detection; DFS order preserved in error message
  // ---------------------------------------------------------------------------
  describe('circular dependency detection — DFS order preserved', () => {
    it('CircularDependencyError message lists tokens in DFS resolution order', () => {
      container.registerFactory('A', c => c.resolve('B'));
      container.registerFactory('B', c => c.resolve('A'));

      const [err] = safeRun(() => container.resolve('A'));

      expect(err).toBeInstanceOf(CircularDependencyError);
      expect((err as Error).message).toContain('A -> B -> A');
    });

    it('three-node cycle message is ordered correctly', () => {
      container.registerFactory('X', c => c.resolve('Y'));
      container.registerFactory('Y', c => c.resolve('Z'));
      container.registerFactory('Z', c => c.resolve('X'));

      const [err] = safeRun(() => container.resolve('X'));

      expect(err).toBeInstanceOf(CircularDependencyError);
      expect((err as Error).message).toContain('X -> Y -> Z -> X');
    });
  });

  // ---------------------------------------------------------------------------
  // D-4 — no double retention for registerInstance
  // ---------------------------------------------------------------------------
  describe('registerInstance — no double retention (D-4)', () => {
    it('registered instance is returned by resolve (same reference)', () => {
      const instance = { value: 42 };
      container.registerInstance('svc', instance);

      expect(container.resolve('svc')).toBe(instance);
    });

    it('repeated resolve calls return the same reference', () => {
      const instance = { value: 1 };
      container.registerInstance('svc', instance);

      expect(container.resolve('svc')).toBe(container.resolve('svc'));
    });

    it('dispose does NOT call dispose() on an instance that was registered but never resolved', () => {
      let disposed = false;
      const instance = {
        dispose() {
          disposed = true;
        },
      };

      container.registerInstance('svc', instance);
      container.dispose(); // instance never resolved → not in singletonInstances yet

      expect(disposed).toBe(false);
    });

    it('dispose DOES call dispose() on an instance that was resolved at least once', () => {
      let disposed = false;
      const instance = {
        dispose() {
          disposed = true;
        },
      };

      container.registerInstance('svc', instance);
      container.resolve('svc'); // populates singletonInstances via resolveInternal caching
      container.dispose();

      expect(disposed).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // VF-030 D1/D2 — token identity is reference-based, never name-based
  // ---------------------------------------------------------------------------
  describe('token identity — reference-based, never name-based (UX-C4 contract)', () => {
    // Factory producing classes that all share the SAME .name ('UserRepository')
    // but are distinct references — e.g. two bounded contexts each defining
    // their own UserRepository.
    function makeUserRepositoryClass(marker: string): new () => { marker: string } {
      class UserRepository {
        public readonly marker = marker;
      }
      return UserRepository;
    }

    it('two DIFFERENT classes both named "UserRepository" register independently', () => {
      const AuthUserRepository = makeUserRepositoryClass('auth');
      const BillingUserRepository = makeUserRepositoryClass('billing');

      // Same .name, different references — must NOT collide
      expect(AuthUserRepository.name).toBe(BillingUserRepository.name);
      expect(AuthUserRepository).not.toBe(BillingUserRepository);

      container.register(AuthUserRepository, AuthUserRepository, {
        lifetime: ServiceLifetime.Singleton,
      });
      const [secondRegErr] = safeRun(() =>
        container.register(BillingUserRepository, BillingUserRepository, {
          lifetime: ServiceLifetime.Singleton,
        })
      );

      expect(secondRegErr).toBeUndefined();
    });

    it('resolving one same-named class NEVER returns the other class instance', () => {
      const AuthUserRepository = makeUserRepositoryClass('auth');
      const BillingUserRepository = makeUserRepositoryClass('billing');

      container.register(AuthUserRepository, AuthUserRepository, {
        lifetime: ServiceLifetime.Singleton,
      });
      container.register(BillingUserRepository, BillingUserRepository, {
        lifetime: ServiceLifetime.Singleton,
      });

      const auth = container.resolve(AuthUserRepository);
      const billing = container.resolve(BillingUserRepository);

      expect(auth).toBeInstanceOf(AuthUserRepository);
      expect(billing).toBeInstanceOf(BillingUserRepository);
      expect(auth).not.toBe(billing);
      expect(auth.marker).toBe('auth');
      expect(billing.marker).toBe('billing');
      // Singleton caches are isolated per token reference
      expect(container.resolve(AuthUserRepository)).toBe(auth);
      expect(container.resolve(BillingUserRepository)).toBe(billing);
    });

    it('isRegistered distinguishes same-named classes by reference', () => {
      const RegisteredRepo = makeUserRepositoryClass('registered');
      const UnregisteredRepo = makeUserRepositoryClass('unregistered');

      container.register(RegisteredRepo, RegisteredRepo);

      expect(container.isRegistered(RegisteredRepo)).toBe(true);
      expect(container.isRegistered(UnregisteredRepo)).toBe(false);
    });

    it('resolving an unregistered same-named class throws ContainerServiceNotFoundError (no .name fallback)', () => {
      const RegisteredRepo = makeUserRepositoryClass('registered');
      const UnregisteredRepo = makeUserRepositoryClass('unregistered');

      container.register(RegisteredRepo, RegisteredRepo);

      const [err] = safeRun(() => container.resolve(UnregisteredRepo));

      expect(err).toBeInstanceOf(ContainerServiceNotFoundError);
    });

    it("Symbol('X') !== Symbol('X') — same-description symbols are isolated tokens", () => {
      const tokenA = Symbol('X');
      const tokenB = Symbol('X');

      const instanceA = { source: 'A' };
      const instanceB = { source: 'B' };

      container.registerInstance(tokenA, instanceA);
      const [secondRegErr] = safeRun(() => container.registerInstance(tokenB, instanceB));

      expect(secondRegErr).toBeUndefined();
      expect(container.resolve(tokenA)).toBe(instanceA);
      expect(container.resolve(tokenB)).toBe(instanceB);

      // A third same-description symbol is NOT registered
      const [err] = safeRun(() => container.resolve(Symbol('X')));
      expect(err).toBeInstanceOf(ContainerServiceNotFoundError);
    });

    it('Symbol.for() yields a shared token across lookups (documented cross-module pattern)', () => {
      const instance = { shared: true };
      container.registerInstance(Symbol.for('vf030.shared'), instance);

      expect(container.resolve(Symbol.for('vf030.shared'))).toBe(instance);
    });

    it('string tokens keep VALUE identity', () => {
      class TestService {}
      container.register('StringToken', TestService, { lifetime: ServiceLifetime.Singleton });

      // A structurally equal but freshly-created string still matches
      const key = ['String', 'Token'].join('');
      expect(container.resolve(key)).toBe(container.resolve('StringToken'));
    });

    it('scoped lifetime behavior is unchanged with class-reference tokens', () => {
      class ScopedService {
        public id = Math.random();
      }

      container.register(ScopedService, ScopedService, { lifetime: ServiceLifetime.Scoped });

      const scope = container.createScope('scope-1');
      const parentInstance = container.resolve(ScopedService);
      const scopeInstance1 = scope.resolve(ScopedService);
      const scopeInstance2 = scope.resolve(ScopedService);

      // Same instance within a resolution context, cached per container
      expect(parentInstance).toBe(container.resolve(ScopedService));
      expect(scopeInstance1).toBe(scopeInstance2);
    });

    it('singleton lifetime behavior is unchanged with symbol tokens', () => {
      const token = Symbol('singleton-service');

      class SingletonService {
        public id = Math.random();
      }

      container.register(token, SingletonService, { lifetime: ServiceLifetime.Singleton });

      expect(container.resolve(token)).toBe(container.resolve(token));
    });
  });
});
