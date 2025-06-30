import { describe, it, expect, vi, beforeEach } from 'vitest';

import { safeRun } from '@vytches-ddd/utils';
import type { IEventBus } from '@vytches-ddd/contracts';
import type { IUnitOfWork } from '@vytches-ddd/core';
import { DefaultDomainServiceRegistry } from './domain-service-registry';
import { ServiceBuilder } from './service-builder';
import type {
  IAsyncDomainService,
  IDomainService,
  IEventBusAware,
  IUnitOfWorkAware,
} from './domain-service.interface';
import type { IDomainServiceRegistry } from './domain-service-registry.interface';

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
  constructor(
    public readonly serviceId: string,
    public readonly dependencies: any[] = [],
  ) {}
}

class EventAwareService implements IDomainService, IEventBusAware {
  public readonly serviceId: string;
  private eventBus?: IEventBus;

  constructor(
    serviceId: string,
    public readonly dependencies: any[] = [],
  ) {
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

  constructor(
    serviceId: string,
    public readonly dependencies: any[] = [],
  ) {
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

  constructor(
    serviceId: string,
    public readonly dependencies: any[] = [],
  ) {
    this.serviceId = serviceId;
  }

  async initialize(): Promise<void> {
    this.initialized = true;
  }

  async dispose(): Promise<void> {
    this.initialized = false;
  }
}

describe('ServiceBuilder', () => {
  let registry: IDomainServiceRegistry;
  let eventBus: MockEventBus;
  let unitOfWork: MockUnitOfWork;

  beforeEach(() => {
    registry = new DefaultDomainServiceRegistry();
    eventBus = new MockEventBus();
    unitOfWork = new MockUnitOfWork();
  });

  describe('build and buildSync', () => {
    it('should build a service with the factory function', async () => {
      // Arrange
      const builder = new ServiceBuilder<SimpleService>(
        registry,
        'test-service',
        () => new SimpleService('test-service'),
      );

      // Act
      const service = await builder.build();

      // Assert
      expect(service).toBeInstanceOf(SimpleService);
      expect(service.serviceId).toBe('test-service');
    });

    it('should build a service synchronously', () => {
      // Arrange
      const builder = new ServiceBuilder<SimpleService>(
        registry,
        'test-service',
        () => new SimpleService('test-service'),
      );

      // Act
      const service = builder.buildSync();

      // Assert
      expect(service).toBeInstanceOf(SimpleService);
      expect(service.serviceId).toBe('test-service');
    });

    it('should inject dependencies from registry', async () => {
      // Arrange
      const dependencyId = 'dependency-service';
      const dependency = new SimpleService(dependencyId);
      registry.register(dependency, dependencyId);

      const builder = new ServiceBuilder<SimpleService, [IDomainService]>(
        registry,
        'test-service',
        (dep) => new SimpleService('test-service', [dep]),
      ).dependsOn(dependencyId);

      // Act
      const service = await builder.build();

      // Assert
      expect(service.dependencies).toHaveLength(1);
      expect(service.dependencies[0]).toBe(dependency);
    });
  });

  describe('dependsOn', () => {
    it('should throw error if dependency not found', async () => {
      // Arrange
      const builder = new ServiceBuilder<SimpleService>(
        registry,
        'test-service',
        () => new SimpleService('test-service'),
      );

      // Act
      const [error] = await safeRun(() => builder.dependsOn('non-existent'));

      // Assert
      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toContain('not found in registry');
    });

    it('should create a new builder with updated dependency types', async () => {
      // Arrange
      const dependencyId = 'dependency-service';
      const dependency = new SimpleService(dependencyId);
      registry.register(dependency, dependencyId);

      const originalBuilder = new ServiceBuilder<SimpleService>(
        registry,
        'test-service',
        () => new SimpleService('test-service'),
      );

      // Act
      const newBuilder = originalBuilder.dependsOn(dependencyId);
      const service = await newBuilder.build();

      // Assert
      expect(newBuilder).not.toBe(originalBuilder);
      expect(service).toBeInstanceOf(SimpleService);
    });
  });

  describe('withDependency', () => {
    it('should add a direct dependency instance', async () => {
      // Arrange
      const dependency = new SimpleService('direct-dependency');
      const builder = new ServiceBuilder<SimpleService, [IDomainService]>(
        registry,
        'test-service',
        (dep) => new SimpleService('test-service', [dep]),
      ).withDependency(dependency);

      // Act
      const service = await builder.build();

      // Assert
      expect(service.dependencies).toHaveLength(1);
      expect(service.dependencies[0]).toBe(dependency);
    });

    it('should create a new builder with updated dependency types', async () => {
      // Arrange
      const dependency = new SimpleService('direct-dependency');
      const originalBuilder = new ServiceBuilder<SimpleService>(
        registry,
        'test-service',
        () => new SimpleService('test-service'),
      );

      // Act
      const newBuilder = originalBuilder.withDependency(dependency);
      const service = await newBuilder.build();

      // Assert
      expect(newBuilder).not.toBe(originalBuilder);
      expect(service).toBeInstanceOf(SimpleService);
    });
  });

  describe('withEventBus', () => {
    it('should configure event-aware service with event bus', async () => {
      // Arrange
      const builder = new ServiceBuilder<EventAwareService>(
        registry,
        'event-service',
        () => new EventAwareService('event-service'),
      ).withEventBus(eventBus);

      // Act
      const service = await builder.build();

      // Assert
      expect(service.getEventBus()).toBe(eventBus);
    });

    it('should not affect non-event-aware services', async () => {
      // Arrange
      const builder = new ServiceBuilder<SimpleService>(
        registry,
        'simple-service',
        () => new SimpleService('simple-service'),
      ).withEventBus(eventBus);

      // Act
      const service = await builder.build();

      // Assert
      expect(service).toBeInstanceOf(SimpleService);
      // No error should be thrown
    });
  });

  describe('withUnitOfWork', () => {
    it('should configure unit-of-work-aware service with unit of work', async () => {
      // Arrange
      const builder = new ServiceBuilder<UnitOfWorkAwareService>(
        registry,
        'uow-service',
        () => new UnitOfWorkAwareService('uow-service'),
      ).withUnitOfWork(unitOfWork);

      // Act
      const service = await builder.build();

      // Assert
      expect(service.getUnitOfWork()).toBe(unitOfWork);
    });

    it('should not affect non-unit-of-work-aware services', async () => {
      // Arrange
      const builder = new ServiceBuilder<SimpleService>(
        registry,
        'simple-service',
        () => new SimpleService('simple-service'),
      ).withUnitOfWork(unitOfWork);

      // Act
      const service = await builder.build();

      // Assert
      expect(service).toBeInstanceOf(SimpleService);
      // No error should be thrown
    });
  });

  describe('withAsyncInitialization', () => {
    it('should initialize async service', async () => {
      // Arrange
      const builder = new ServiceBuilder<AsyncService>(
        registry,
        'async-service',
        () => new AsyncService('async-service'),
      ).withAsyncInitialization();

      // Act
      const service = await builder.build();

      // Assert
      expect(service.initialized).toBe(true);
    });

    it('should not affect non-async services', async () => {
      // Arrange
      const builder = new ServiceBuilder<SimpleService>(
        registry,
        'simple-service',
        () => new SimpleService('simple-service'),
      ).withAsyncInitialization();

      // Act
      const service = await builder.build();

      // Assert
      expect(service).toBeInstanceOf(SimpleService);
      // No error should be thrown
    });
  });

  describe('buildAndRegister', () => {
    it('should build service and register it in registry', async () => {
      // Arrange
      const serviceId = 'registered-service';
      const builder = new ServiceBuilder<SimpleService>(
        registry,
        serviceId,
        () => new SimpleService(serviceId),
      );

      // Act
      const service = await builder.buildAndRegister();

      // Assert
      expect(registry.has(serviceId)).toBe(true);
      expect(registry.get(serviceId)).toBe(service);
    });

    it('should register service with dependencies', async () => {
      // Arrange
      const dependencyId = 'dependency-service';
      const dependency = new SimpleService(dependencyId);
      registry.register(dependency, dependencyId);

      const serviceId = 'registered-service';
      const builder = new ServiceBuilder<SimpleService, [IDomainService]>(
        registry,
        serviceId,
        (dep) => new SimpleService(serviceId, [dep]),
      ).dependsOn(dependencyId);

      // Act
      const service = await builder.buildAndRegister();

      // Assert
      expect(registry.has(serviceId)).toBe(true);
      expect(service.dependencies[0]).toBe(dependency);
    });
  });
});
