import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { safeRun } from '@vytches/ddd-utils';
import {
  ServiceLifetime,
  SimpleContainer,
  ServiceNotFoundError,
  CircularDependencyError,
  ServiceAlreadyRegisteredError,
  ContainerDisposedError,
} from '../../src';

describe('SimpleContainer', () => {
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
    it('should throw ServiceNotFoundError for unregistered service', () => {
      const [serviceNotFoundError] = safeRun(() => {
        container.resolve('UnregisteredService');
      });
      expect(serviceNotFoundError).toBeInstanceOf(ServiceNotFoundError);
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
});
