import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { IEventBus } from '@vytches-ddd/contracts';
import type { IUnitOfWork } from '@vytches-ddd/core';
import { DefaultDomainServiceRegistry } from './domain-service-registry';
import { DomainServiceContainer } from './domain-service-container';
import { safeRun } from '@vytches-ddd/utils';
import type {
  IAsyncDomainService,
  IDomainService,
  IEventBusAware,
  IUnitOfWorkAware,
} from './domain-service.interface';
import type { IDomainServiceRegistry } from './domain-service-registry.interface';

// Mock implementations for testing
class MockEventBus implements IEventBus {
  publish = vi.fn();
  publishMany = vi.fn();
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

class AsyncService implements IDomainService, IAsyncDomainService {
  public readonly serviceId: string;
  public initialized = false;

  constructor(serviceId: string) {
    this.serviceId = serviceId;
  }

  async initialize(): Promise<void> {
    this.initialized = true;
  }

  async dispose(): Promise<void> {
    this.initialized = false;
  }
}

describe('DomainServiceContainer', () => {
  let registry: IDomainServiceRegistry;
  let eventBus: IEventBus;
  let unitOfWorkProvider: () => IUnitOfWork;

  beforeEach(() => {
    registry = new DefaultDomainServiceRegistry();
    eventBus = new MockEventBus();
    unitOfWorkProvider = () => new MockUnitOfWork();
  });

  describe('constructor', () => {
    it('should create container with default registry', () => {
      // Act
      const container = new DomainServiceContainer();

      // Assert
      expect(container.getRegistry()).toBeInstanceOf(DefaultDomainServiceRegistry);
    });

    it('should use provided registry', () => {
      // Act
      const container = new DomainServiceContainer(registry);

      // Assert
      expect(container.getRegistry()).toBe(registry);
    });
  });

  describe('registerFactory', () => {
    it('should register service factory', () => {
      // Arrange
      const container = new DomainServiceContainer(registry);
      const serviceId = 'test-service';
      const factory = () => new SimpleService(serviceId);

      // Act
      container.registerFactory(serviceId, factory);
      container.initializeServices();

      // Assert
      expect(registry.has(serviceId)).toBe(true);
      expect(registry.get(serviceId)).toBeInstanceOf(SimpleService);
    });

    it('should register service with dependencies', () => {
      // Arrange
      const container = new DomainServiceContainer(registry);
      const dependencyId = 'dependency-service';
      const serviceId = 'dependent-service';

      // First, register the dependency
      container.registerFactory(dependencyId, () => new SimpleService(dependencyId));

      // Then, register a service that depends on it
      container.registerFactory(serviceId, () => new SimpleService(serviceId), [dependencyId]);

      // Act
      container.initializeServices();

      // Assert
      expect(registry.has(dependencyId)).toBe(true);
      expect(registry.has(serviceId)).toBe(true);
    });
  });

  describe('setEventBus', () => {
    it('should set event bus for the container', () => {
      // Arrange
      const container = new DomainServiceContainer(registry);

      // Act
      const result = container.setEventBus(eventBus);

      // Assert
      expect(result).toBe(container); // Should return this for chaining
    });

    it('should configure event-aware services with the event bus', () => {
      // Arrange
      const container = new DomainServiceContainer(registry);
      container.setEventBus(eventBus);
      const serviceId = 'event-aware-service';
      container.registerFactory(serviceId, () => new EventAwareService(serviceId));

      // Act
      container.initializeServices();

      // Assert
      const service = registry.get<EventAwareService>(serviceId);
      expect(service?.getEventBus()).toBe(eventBus);
    });
  });

  describe('setUnitOfWorkProvider', () => {
    it('should set unit of work provider for the container', () => {
      // Arrange
      const container = new DomainServiceContainer(registry);

      // Act
      const result = container.setUnitOfWorkProvider(unitOfWorkProvider);

      // Assert
      expect(result).toBe(container); // Should return this for chaining
    });

    it('should configure unit-of-work-aware services with a unit of work', () => {
      // Arrange
      const container = new DomainServiceContainer(registry);
      container.setUnitOfWorkProvider(unitOfWorkProvider);
      const serviceId = 'uow-aware-service';
      container.registerFactory(serviceId, () => new UnitOfWorkAwareService(serviceId));

      // Act
      container.initializeServices();

      // Assert
      const service = registry.get<UnitOfWorkAwareService>(serviceId);
      expect(service?.getUnitOfWork()).toBeInstanceOf(MockUnitOfWork);
    });
  });

  describe('initializeServices', () => {
    it('should initialize services respecting dependencies', () => {
      // Arrange
      const container = new DomainServiceContainer(registry);

      // Define a chain of dependencies: service1 <- service2 <- service3
      container.registerFactory('service1', () => new SimpleService('service1'));
      container.registerFactory('service2', () => new SimpleService('service2'), ['service1']);
      container.registerFactory('service3', () => new SimpleService('service3'), ['service2']);

      // Act
      container.initializeServices();

      // Assert
      expect(registry.has('service1')).toBe(true);
      expect(registry.has('service2')).toBe(true);
      expect(registry.has('service3')).toBe(true);
    });

    it('should detect circular dependencies', async () => {
      // Arrange
      const container = new DomainServiceContainer(registry);

      // Define circular dependencies: serviceA <- serviceB <- serviceC <- serviceA
      container.registerFactory('serviceA', () => new SimpleService('serviceA'), ['serviceC']);
      container.registerFactory('serviceB', () => new SimpleService('serviceB'), ['serviceA']);
      container.registerFactory('serviceC', () => new SimpleService('serviceC'), ['serviceB']);

      // Act
      const [error] = await safeRun(() => container.initializeServices());

      // Assert
      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toContain('Circular dependency');
    });

    it('should initialize async services', async () => {
      // Arrange
      const container = new DomainServiceContainer(registry);
      const serviceId = 'async-service';
      container.registerFactory(serviceId, () => new AsyncService(serviceId));

      // Act
      container.initializeServices();
      // Allow any pending promises to resolve
      await new Promise(resolve => setTimeout(resolve, 0));

      // Assert
      const service = registry.get<AsyncService>(serviceId);
      expect(service?.initialized).toBe(true);
    });
  });

  describe('getService', () => {
    it('should retrieve registered service by ID', () => {
      // Arrange
      const container = new DomainServiceContainer(registry);
      const serviceId = 'test-service';
      const service = new SimpleService(serviceId);
      registry.register(service, serviceId);

      // Act
      const result = container.getService<SimpleService>(serviceId);

      // Assert
      expect(result).toBe(service);
    });

    it('should return undefined for non-existent service', () => {
      // Arrange
      const container = new DomainServiceContainer(registry);

      // Act
      const result = container.getService('non-existent');

      // Assert
      expect(result).toBeUndefined();
    });
  });

  describe('getRegistry', () => {
    it('should return the registry being used by the container', () => {
      // Arrange
      const container = new DomainServiceContainer(registry);

      // Act
      const result = container.getRegistry();

      // Assert
      expect(result).toBe(registry);
    });
  });
});
