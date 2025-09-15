import { safeRun } from '@vytches/ddd-utils';
import { beforeEach, describe, expect, it } from 'vitest';
import { ContainerBuilder, ServiceLifetime, SimpleContainer } from '../../src';

describe('ContainerBuilder', () => {
  // Mock container helper for testing
  const createMockContainer = () => new SimpleContainer();
  let builder: ContainerBuilder;

  beforeEach(() => {
    builder = new ContainerBuilder();
  });

  describe('fluent API', () => {
    it('should support fluent registration', () => {
      class ServiceA {}
      class ServiceB {}
      class ServiceC {}

      const container = builder
        .register('ServiceA', ServiceA)
        .register('ServiceB', ServiceB, { lifetime: ServiceLifetime.Singleton })
        .registerInstance('ServiceC', new ServiceC())
        .build();

      expect(container.isRegistered('ServiceA')).toBe(true);
      expect(container.isRegistered('ServiceB')).toBe(true);
      expect(container.isRegistered('ServiceC')).toBe(true);
    });

    it('should support factory registration', () => {
      class TestService {
        constructor(public value: string) {}
      }

      const container = builder
        .registerFactory('TestService', () => new TestService('factory'))
        .build();

      const instance = container.resolve<TestService>('TestService');

      expect(instance.value).toBe('factory');
    });

    it('should support instance registration', () => {
      class TestService {
        public id = Math.random();
      }

      const originalInstance = new TestService();

      const container = builder.registerInstance('TestService', originalInstance).build();

      const resolvedInstance = container.resolve<TestService>('TestService');

      expect(resolvedInstance).toBe(originalInstance);
    });

    it('should support mixed registration types', () => {
      class ServiceA {}
      class ServiceB {
        constructor(public value: string) {}
      }
      class ServiceC {}

      const serviceC = new ServiceC();

      const container = builder
        .register('ServiceA', ServiceA)
        .registerFactory('ServiceB', () => new ServiceB('factory'))
        .registerInstance('ServiceC', serviceC)
        .build();

      const instanceA = container.resolve<ServiceA>('ServiceA');
      const instanceB = container.resolve<ServiceB>('ServiceB');
      const instanceC = container.resolve<ServiceC>('ServiceC');

      expect(instanceA).toBeInstanceOf(ServiceA);
      expect(instanceB).toBeInstanceOf(ServiceB);
      expect(instanceB.value).toBe('factory');
      expect(instanceC).toBe(serviceC);
    });

    it('should support registration with options', () => {
      class TestService {
        public id = Math.random();
      }

      const container = builder
        .register('TestService', TestService, {
          lifetime: ServiceLifetime.Singleton,
          tags: ['test', 'service'],
          context: 'TestContext',
        })
        .build();

      const instance1 = container.resolve<TestService>('TestService');
      const instance2 = container.resolve<TestService>('TestService');

      expect(instance1).toBe(instance2); // Singleton behavior

      const services = container.getServicesByTag('test');
      expect(services).toHaveLength(1);
      expect(services[0]?.context).toBe('TestContext');
    });
  });

  describe('build', () => {
    it('should return a functional container', () => {
      class TestService {}

      const container = builder.register('TestService', TestService).build();

      expect(container).toBeDefined();
      expect(typeof container.resolve).toBe('function');
      expect(typeof container.register).toBe('function');
      expect(typeof container.isRegistered).toBe('function');
    });

    it('should build container with all registered services', () => {
      class ServiceA {}
      class ServiceB {}
      class ServiceC {}

      const container = builder
        .register('ServiceA', ServiceA)
        .register('ServiceB', ServiceB)
        .register('ServiceC', ServiceC)
        .build();

      const services = container.getServices();

      expect(services).toHaveLength(3);
      expect(services.some(s => s.token === 'ServiceA')).toBe(true);
      expect(services.some(s => s.token === 'ServiceB')).toBe(true);
      expect(services.some(s => s.token === 'ServiceC')).toBe(true);
    });
  });

  describe('method chaining', () => {
    it('should return builder instance for method chaining', () => {
      class TestService {}

      const result = builder.register('TestService', TestService);

      expect(result).toBe(builder);
    });

    it('should support long method chains', () => {
      class ServiceA {}
      class ServiceB {}
      class ServiceC {}
      class ServiceD {}

      const [chainError] = safeRun(() => {
        builder
          .register('ServiceA', ServiceA)
          .register('ServiceB', ServiceB, { lifetime: ServiceLifetime.Singleton })
          .registerFactory('ServiceC', () => new ServiceC())
          .registerInstance('ServiceD', new ServiceD())
          .build();
      });
      expect(chainError).toBeUndefined();
    });
  });
});
