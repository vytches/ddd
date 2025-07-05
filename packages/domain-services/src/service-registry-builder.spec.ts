import { describe, it, expect, vi } from 'vitest';
import type { IUnitOfWork } from '@vytches-ddd/core';

import type { IEventBus } from '@vytches-ddd/contracts';
import { ServiceRegistryBuilder } from './service-registry-builder';
import { DefaultDomainServiceRegistry } from './domain-service-registry';
import { ServiceBuilder } from './service-builder';
import type { IDomainService, IEventBusAware, IUnitOfWorkAware } from './domain-service.interface';

// Mock implementations for testing
class MockEventBus implements IEventBus {
  publishMany = vi.fn();
  publish = vi.fn();
  subscribe = vi.fn();
  unsubscribe = vi.fn();
  registerHandler = vi.fn();
}

class MockUnitOfWork implements IUnitOfWork {
  begin = vi.fn().mockResolvedValue(undefined);
  commit = vi.fn().mockResolvedValue(undefined);
  rollback = vi.fn().mockResolvedValue(undefined);
  getRepository = vi.fn();
  registerRepository = vi.fn();
  getEventBus = vi.fn().mockReturnValue(new MockEventBus());
}

class SimpleService implements IDomainService {
  constructor(public readonly serviceId: string) {}
}

class EventAwareService implements IDomainService, IEventBusAware {
  public readonly serviceId: string;
  private eventBus?: IEventBus;

  constructor(serviceId: string) {
    this.serviceId = serviceId;
  }

  setEventBus(eventBus: IEventBus): void {
    this.eventBus = eventBus;
  }

  getEventBus(): IEventBus | undefined {
    return this.eventBus;
  }
}

class UnitOfWorkAwareService implements IDomainService, IUnitOfWorkAware {
  public readonly serviceId: string;
  private unitOfWork?: IUnitOfWork | undefined;

  constructor(serviceId: string) {
    this.serviceId = serviceId;
  }

  setUnitOfWork(unitOfWork: IUnitOfWork): void {
    this.unitOfWork = unitOfWork;
  }

  clearUnitOfWork(): void {
    this.unitOfWork = undefined;
  }

  getUnitOfWork(): IUnitOfWork | undefined {
    return this.unitOfWork;
  }
}

describe('ServiceRegistryBuilder', () => {
  describe('constructor', () => {
    it('should create new builder with default registry', () => {
      // Act
      const builder = new ServiceRegistryBuilder();

      // Assert
      expect(builder.build()).toBeInstanceOf(DefaultDomainServiceRegistry);
    });

    it('should use provided registry', () => {
      // Arrange
      const registry = new DefaultDomainServiceRegistry();

      // Act
      const builder = new ServiceRegistryBuilder(registry);

      // Assert
      expect(builder.build()).toBe(registry);
    });
  });

  describe('withEventBus', () => {
    it('should set event bus for the builder', () => {
      // Arrange
      const builder = new ServiceRegistryBuilder();
      const eventBus = new MockEventBus();

      // Act
      const result = builder.withEventBus(eventBus);

      // Assert
      expect(result).toBe(builder); // Should return this for chaining
    });

    it('should configure services created by builder with event bus', async () => {
      // Arrange
      const builder = new ServiceRegistryBuilder();
      const eventBus = new MockEventBus();
      builder.withEventBus(eventBus);

      // Act
      const serviceBuilder = builder.service(
        'event-service',
        () => new EventAwareService('event-service')
      );
      const service = await serviceBuilder.build();

      // Assert
      expect((service as EventAwareService).getEventBus()).toBe(eventBus);
    });
  });

  describe('withUnitOfWork', () => {
    it('should set unit of work for the builder', () => {
      // Arrange
      const builder = new ServiceRegistryBuilder();
      const unitOfWork = new MockUnitOfWork();

      // Act
      const result = builder.withUnitOfWork(unitOfWork);

      // Assert
      expect(result).toBe(builder); // Should return this for chaining
    });

    it('should configure services created by builder with unit of work', async () => {
      // Arrange
      const builder = new ServiceRegistryBuilder();
      const unitOfWork = new MockUnitOfWork();
      builder.withUnitOfWork(unitOfWork);

      // Act
      const serviceBuilder = builder.service(
        'uow-service',
        () => new UnitOfWorkAwareService('uow-service')
      );
      const service = await serviceBuilder.build();

      // Assert
      expect((service as UnitOfWorkAwareService).getUnitOfWork()).toBe(unitOfWork);
    });
  });

  describe('service', () => {
    it('should create a service builder for the service', () => {
      // Arrange
      const builder = new ServiceRegistryBuilder();

      // Act
      const serviceBuilder = builder.service(
        'test-service',
        () => new SimpleService('test-service')
      );

      // Assert
      expect(serviceBuilder).toBeInstanceOf(ServiceBuilder);
    });

    it('should create service builder with configuration from registry builder', () => {
      // Arrange
      const builder = new ServiceRegistryBuilder();
      const eventBus = new MockEventBus();
      const unitOfWork = new MockUnitOfWork();

      builder.withEventBus(eventBus);
      builder.withUnitOfWork(unitOfWork);

      // Create spies on the ServiceBuilder prototype methods
      const withEventBusSpy = vi.spyOn(ServiceBuilder.prototype, 'withEventBus');
      const withUnitOfWorkSpy = vi.spyOn(ServiceBuilder.prototype, 'withUnitOfWork');

      // Act
      builder.service('test-service', () => new SimpleService('test-service'));

      // Assert
      expect(withEventBusSpy).toHaveBeenCalledWith(eventBus);
      expect(withUnitOfWorkSpy).toHaveBeenCalledWith(unitOfWork);

      // Clean up
      withEventBusSpy.mockRestore();
      withUnitOfWorkSpy.mockRestore();
    });
  });

  describe('register', () => {
    it('should register a service directly in the registry', () => {
      // Arrange
      const builder = new ServiceRegistryBuilder();
      const service = new SimpleService('direct-service');

      // Act
      builder.register(service);
      const registry = builder.build();

      // Assert
      expect(registry.has('direct-service')).toBe(true);
      expect(registry.get('direct-service')).toBe(service);
    });

    it('should register a service with custom ID', () => {
      // Arrange
      const builder = new ServiceRegistryBuilder();
      const service = new SimpleService('original-id');

      // Act
      builder.register(service, 'custom-id');
      const registry = builder.build();

      // Assert
      expect(registry.has('custom-id')).toBe(true);
      expect(registry.get('custom-id')).toBe(service);
      expect(registry.has('original-id')).toBe(false);
    });

    it('should return the builder for chaining', () => {
      // Arrange
      const builder = new ServiceRegistryBuilder();
      const service1 = new SimpleService('service-1');
      const service2 = new SimpleService('service-2');

      // Act
      const result = builder.register(service1).register(service2);

      // Assert
      expect(result).toBe(builder);
      expect(builder.build().has('service-1')).toBe(true);
      expect(builder.build().has('service-2')).toBe(true);
    });
  });

  describe('build', () => {
    it('should return the configured registry', () => {
      // Arrange
      const registry = new DefaultDomainServiceRegistry();
      const builder = new ServiceRegistryBuilder(registry);
      const service = new SimpleService('test-service');

      // Act
      builder.register(service);
      const result = builder.build();

      // Assert
      expect(result).toBe(registry);
      expect(result.has('test-service')).toBe(true);
    });

    it('should return a registry with all registered services', () => {
      // Arrange
      const builder = new ServiceRegistryBuilder();
      const service1 = new SimpleService('service-1');
      const service2 = new SimpleService('service-2');

      // Act
      builder.register(service1);
      builder.register(service2);
      const registry = builder.build();

      // Assert
      expect(registry.has('service-1')).toBe(true);
      expect(registry.has('service-2')).toBe(true);
    });
  });
});
