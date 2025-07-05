import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { IDomainEvent, IEventBus } from '@vytches-ddd/contracts';
import type { IUnitOfWork } from '@vytches-ddd/core';
import { safeRun } from '@vytches-ddd/utils';
import {
  AsyncDomainService,
  IBaseDomainService,
  EventAwareDomainService,
  UnitOfWorkAwareDomainService,
} from './base-domain-service';

class DomainService extends IBaseDomainService {
  constructor(serviceId: string) {
    super(serviceId);
  }
}

class AsyncService extends AsyncDomainService {
  constructor(serviceId: string) {
    super(serviceId);
  }
}

// Mock implementations for testing
class MockEventBus implements IEventBus {
  public publishedEvents: IDomainEvent[] = [];

  async publish(event: IDomainEvent): Promise<void> {
    this.publishedEvents.push(event);
  }

  async publishMany(events: IDomainEvent[]): Promise<void> {
    this.publishedEvents.push(...events);
  }

  registerHandler = vi.fn();
  subscribe = vi.fn();
  unsubscribe = vi.fn();
}

class MockUnitOfWork implements IUnitOfWork {
  private eventBus: IEventBus;
  private repositories: Map<string, any> = new Map();
  private transactionActive = false;

  constructor(eventBus?: IEventBus) {
    this.eventBus = eventBus || new MockEventBus();
  }

  async begin(): Promise<void> {
    this.transactionActive = true;
  }

  async commit(): Promise<void> {
    if (!this.transactionActive) {
      throw new Error('No active transaction');
    }
    this.transactionActive = false;
  }

  async rollback(): Promise<void> {
    if (!this.transactionActive) {
      throw new Error('No active transaction');
    }
    this.transactionActive = false;
  }

  getRepository<T>(name: string): T {
    const repo = this.repositories.get(name);
    if (!repo) {
      throw new Error(`Repository '${name}' not found`);
    }
    return repo as T;
  }

  registerRepository<T>(name: string, repository: T): void {
    this.repositories.set(name, repository);
  }

  getEventBus(): IEventBus {
    return this.eventBus;
  }

  isTransactionActive(): boolean {
    return this.transactionActive;
  }
}

// Mock domain event
interface TestEvent extends IDomainEvent {
  readonly eventType: string;
  readonly data: string;
}

// Sample repository for testing
class MockRepository {
  getData(): string {
    return 'repository-data';
  }
}

describe('IBaseDomainService', () => {
  it('should initialize with serviceId', () => {
    // Arrange & Act
    const service = new DomainService('test-service');

    // Assert
    expect(service.serviceId).toBe('test-service');
  });
});

describe('EventAwareDomainService', () => {
  class TestEventAwareService extends EventAwareDomainService {
    constructor(serviceId: string) {
      super(serviceId);
    }

    publishTestEvent(eventType: string, data: string): void {
      const event: TestEvent = {
        eventType,
        data,
      };

      this.publishEvent(event);
    }
  }

  it('should set event bus', () => {
    // Arrange
    const service = new TestEventAwareService('event-service');
    const eventBus = new MockEventBus();

    // Act
    service.setEventBus(eventBus);

    // Assert
    expect((service as any).eventBus).toBe(eventBus);
  });

  it('should publish events via event bus', () => {
    // Arrange
    const service = new TestEventAwareService('event-service');
    const eventBus = new MockEventBus();
    service.setEventBus(eventBus);

    // Act
    service.publishTestEvent('TestEvent', 'test-data');

    // Assert
    expect(eventBus.publishedEvents).toHaveLength(1);
    expect(eventBus?.publishedEvents?.[0]?.eventType).toBe('TestEvent');
    expect((eventBus.publishedEvents[0] as TestEvent).data).toBe('test-data');
  });

  it('should throw error when publishing without event bus', async () => {
    // Arrange
    const service = new TestEventAwareService('event-service');

    // Act
    const [error] = await safeRun(() => service.publishTestEvent('TestEvent', 'test-data'));

    // Assert
    expect(error).toBeInstanceOf(Error);
    expect(error?.message).toContain('Event bus not set');
  });
});

describe('UnitOfWorkAwareDomainService', () => {
  class TestUnitOfWorkService extends UnitOfWorkAwareDomainService {
    constructor(serviceId: string) {
      super(serviceId);
    }

    getTestRepository(): MockRepository {
      return this.getRepository<MockRepository>('test-repo');
    }

    async executeTestTransaction(shouldSucceed: boolean): Promise<string> {
      return this.executeInTransaction(async () => {
        if (!shouldSucceed) {
          throw new Error('Transaction failed');
        }
        return 'transaction-result';
      });
    }
  }

  let service: TestUnitOfWorkService;
  let unitOfWork: MockUnitOfWork;
  let eventBus: MockEventBus;

  beforeEach(() => {
    service = new TestUnitOfWorkService('uow-service');
    eventBus = new MockEventBus();
    unitOfWork = new MockUnitOfWork(eventBus);
    const repository = new MockRepository();
    unitOfWork.registerRepository('test-repo', repository);
  });

  it('should set unit of work', () => {
    // Act
    service.setUnitOfWork(unitOfWork);

    // Assert
    expect((service as any).unitOfWork).toBe(unitOfWork);
  });

  it('should set event bus from unit of work', () => {
    // Act
    service.setUnitOfWork(unitOfWork);

    // Assert
    expect((service as any).eventBus).toBe(eventBus);
  });

  it('should clear unit of work', () => {
    // Arrange
    service.setUnitOfWork(unitOfWork);

    // Act
    service.clearUnitOfWork();

    // Assert
    expect((service as any).unitOfWork).toBeUndefined();
  });

  it('should get repository from unit of work', () => {
    // Arrange
    service.setUnitOfWork(unitOfWork);

    // Act
    const repository = service.getTestRepository();

    // Assert
    expect(repository).toBeInstanceOf(MockRepository);
    expect(repository.getData()).toBe('repository-data');
  });

  it('should throw error when getting repository without unit of work', async () => {
    // Act
    const [error] = await safeRun(() => service.getTestRepository());

    // Assert
    expect(error).toBeInstanceOf(Error);
    expect(error?.message).toContain('Unit of Work not set');
  });

  it('should execute successful transaction', async () => {
    // Arrange
    service.setUnitOfWork(unitOfWork);

    // Act
    const result = await service.executeTestTransaction(true);

    // Assert
    expect(result).toBe('transaction-result');
    expect(unitOfWork.isTransactionActive()).toBe(false); // Transaction committed
  });

  it('should rollback failed transaction', async () => {
    // Arrange
    service.setUnitOfWork(unitOfWork);

    // Act
    const [error] = await safeRun(() => service.executeTestTransaction(false));

    // Assert
    expect(error).toBeInstanceOf(Error);
    expect(error?.message).toBe('Transaction failed');
    expect(unitOfWork.isTransactionActive()).toBe(false); // Transaction rolled back
  });

  it('should throw error when executing transaction without unit of work', async () => {
    // Act
    const [error] = await safeRun(() => service.executeTestTransaction(true));

    // Assert
    expect(error).toBeInstanceOf(Error);
    expect(error?.message).toContain('Unit of Work not set');
  });
});

describe('AsyncDomainService', () => {
  class TestAsyncService extends AsyncDomainService {
    public initializeCalled = false;
    public disposeCalled = false;

    constructor(serviceId: string) {
      super(serviceId);
    }

    override async initialize(): Promise<void> {
      this.initializeCalled = true;
      await super.initialize();
    }

    override async dispose(): Promise<void> {
      this.disposeCalled = true;
      await super.dispose();
    }
  }

  it('should initialize', async () => {
    // Arrange
    const service = new TestAsyncService('async-service');

    // Act
    await service.initialize();

    // Assert
    expect(service.initializeCalled).toBe(true);
  });

  it('should dispose', async () => {
    // Arrange
    const service = new TestAsyncService('async-service');

    // Act
    await service.dispose();

    // Assert
    expect(service.disposeCalled).toBe(true);
  });

  it('should have default implementations for lifecycle methods', async () => {
    // Arrange
    const service = new AsyncService('minimal-async-service');

    // Act & Assert - should not throw
    await expect(service.initialize()).resolves.toBeUndefined();
    await expect(service.dispose()).resolves.toBeUndefined();
  });
});
