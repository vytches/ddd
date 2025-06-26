import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { safeRun } from '@vytches-ddd/utils';

import { IBaseRepository } from './base-repository';
import { AggregateRoot, EntityId } from '..';
import type { IDomainEvent } from '@vytches-ddd/contracts';

// Mock dla IEventDispatcher
class MockEventDispatcher implements IEventDispatcher {
  public dispatchedEvents: IDomainEvent[] = [];
  public dispatchedAggregates: AggregateRoot<any>[] = [];
  public shouldFail = false;

  async dispatchEventsForAggregate(
    aggregate: AggregateRoot<any>,
  ): Promise<void> {
    if (this.shouldFail) {
      throw new Error('Dispatch events failed');
    }
    this.dispatchedAggregates.push(aggregate);
    aggregate
      .getDomainEvents()
      .forEach((event) => this.dispatchedEvents.push(event));

    aggregate.commit();
  }

  async dispatchEvents(...events: IDomainEvent<any>[]): Promise<void> {
    if (this.shouldFail) {
      throw new Error('Dispatch events failed');
    }
    events.forEach((event) => this.dispatchedEvents.push(event));
  }

  reset(): void {
    this.dispatchedEvents = [];
    this.dispatchedAggregates = [];
    this.shouldFail = false;
  }
}

// Mock dla AggregateRoot
class TestAggregate extends AggregateRoot<string> {
  private _name = '';
  private _items: string[] = [];
  // private getDomainEvents(): IDomainEvent[] = [];

  constructor({ id, version }: { id: EntityId<string>; version?: number }) {
    super({ id, version });
  }

  // Metody do manipulacji stanem
  get name(): string {
    return this._name;
  }

  get items(): string[] {
    return [...this._items];
  }

  // Metoda do dodawania testowych zdarzeń
  addTestEvent(eventType: string, payload: any): void {
    this['_domainEvents'].push({
      eventType,
      payload,
    });

    // Symulujemy zwiększenie wersji
    (this as any)._version++;
  }
}

// Konkretna implementacja BaseRepository do testów
class TestRepository extends IBaseRepository {
  private versions: Map<string, number> = new Map();
  public handlerCalls: { eventType: string; payload: any }[] = [];

  constructor(eventDispatcher: IEventDispatcher) {
    super(eventDispatcher);
  }

  async getCurrentVersion(id: EntityId<string>): Promise<number> {
    return this.versions.get(id.getValue()) ?? 0;
  }

  setVersion(id: EntityId<string>, version: number): void {
    this.versions.set(id.getValue(), version);
  }

  // Przykładowe handlery dla różnych zdarzeń
  async handleNameChanged(payload: { name: string }): Promise<void> {
    this.handlerCalls.push({ eventType: 'NameChanged', payload });
  }

  async handleItemAdded(payload: { item: string }): Promise<void> {
    this.handlerCalls.push({ eventType: 'ItemAdded', payload });
  }

  // Metoda pomocnicza do resetowania stanu
  reset(): void {
    this.versions.clear();
    this.handlerCalls = [];
  }
}

describe('IBaseRepository', () => {
  let eventDispatcher: MockEventDispatcher;
  let repository: TestRepository;
  let aggregate: TestAggregate;
  let aggregateId: EntityId<string>;

  beforeEach(() => {
    // Inicjalizacja przed każdym testem
    eventDispatcher = new MockEventDispatcher();
    repository = new TestRepository(eventDispatcher);
    aggregateId = EntityId.fromUUID('123e4567-e89b-12d3-a456-426614174000');
    aggregate = new TestAggregate({ id: aggregateId });

    // Reset stanów mocków
    vi.clearAllMocks();
    eventDispatcher.reset();
    repository.reset();
  });

  afterEach(() => {
    // Czyszczenie po testach
    vi.resetAllMocks();
  });

  describe('save method', () => {
    const eventNameChanged = 'NameChanged';
    it('should successfully save aggregate with valid version', async () => {
      // Arrange
      aggregate.addTestEvent(eventNameChanged, { name: 'Test' });
      repository.setVersion(aggregateId, 0);
      // repository['handleNameChanged'] = vi.fn();

      // Act
      await repository.save(aggregate);

      // Assert
      expect(repository.handlerCalls).toHaveLength(1);
      expect(repository.handlerCalls[0]).toEqual({
        eventType: eventNameChanged,
        payload: { name: 'Test' },
      });
      expect(await eventDispatcher.dispatchedAggregates).toContain(aggregate);
    });

    it('should fail when version mismatch occurs', async () => {
      // Arrange
      aggregate.addTestEvent(eventNameChanged, { name: 'Test' });
      repository.setVersion(aggregateId, 5); // Current version is 5, but aggregate expects 0

      // Act
      const [error] = await safeRun(() => repository.save(aggregate));

      // Assert
      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toContain('Version mismatch');
      expect(repository.handlerCalls).toHaveLength(0);
      expect(eventDispatcher.dispatchedAggregates).toHaveLength(0);
    });

    it('should fail when handler is missing for event type', async () => {
      // Arrange
      aggregate.addTestEvent('UnknownEvent', { data: 'test' });
      repository.setVersion(aggregateId, 0);

      // Act
      const [error] = await safeRun(() => repository.save(aggregate));

      // Assert
      expect(error).not.toBeNull();
      expect(error?.message).toContain('Missing handler handleUnknownEvent');
      expect(repository.handlerCalls).toHaveLength(0);
      expect(eventDispatcher.dispatchedAggregates).toHaveLength(0);
    });

    it('should process multiple events from an aggregate', async () => {
      // Arrange
      aggregate.addTestEvent(eventNameChanged, { name: 'Test' });
      aggregate.addTestEvent('ItemAdded', { item: 'Item 1' });
      repository.setVersion(aggregateId, 0);

      // Act
      await repository.save(aggregate);

      // Assert
      expect(repository.handlerCalls).toHaveLength(2);
      expect(repository.handlerCalls[0].eventType).toBe(eventNameChanged);
      expect(repository.handlerCalls[1].eventType).toBe('ItemAdded');
      expect(eventDispatcher.dispatchedAggregates).toHaveLength(1);
      expect(eventDispatcher.dispatchedEvents).toHaveLength(2);
    });

    it('should not process any events if first event fails validation', async () => {
      // Arrange
      aggregate.addTestEvent('UnknownEvent', { data: 'test' });
      aggregate.addTestEvent(eventNameChanged, { name: 'Test' });
      repository.setVersion(aggregateId, 0);

      // Act
      const [error] = await safeRun(() => repository.save(aggregate));

      // Assert
      expect(error).not.toBeNull();
      expect(repository.handlerCalls).toHaveLength(0);
      expect(eventDispatcher.dispatchedAggregates).toHaveLength(0);
    });

    it('should handle case when aggregate has no events', async () => {
      // Arrange - No events in aggregate
      repository.setVersion(aggregateId, 0);
      const curVersion = (repository.getCurrentVersion = vi.fn());

      // Act
      await repository.save(aggregate);

      // Assert
      expect(repository.handlerCalls).toHaveLength(0);
      expect(curVersion).toBeCalledTimes(0);
    });

    it('should handle failure in event dispatcher', async () => {
      // Arrange
      aggregate.addTestEvent(eventNameChanged, { name: 'Test' });
      repository.setVersion(aggregateId, 0);
      eventDispatcher.shouldFail = true;

      // Act
      const [error] = await safeRun(() => repository.save(aggregate));

      // Assert
      expect(error).not.toBeNull();
      expect(error?.message).toBe('Dispatch events failed');
      expect(repository.handlerCalls).toHaveLength(1); // Handler still called
    });

    it('should handle first-time save with no previous version', async () => {
      // Arrange - No version set for this ID (simulate new aggregate)
      aggregate.addTestEvent(eventNameChanged, { name: 'Test' });

      // Act
      await repository.save(aggregate);

      // Assert
      expect(repository.handlerCalls).toHaveLength(1);
      expect(eventDispatcher.dispatchedAggregates).toHaveLength(1);
    });

    it('should handle handlers throwing errors', async () => {
      // Arrange
      aggregate.addTestEvent(eventNameChanged, { name: 'Test' });
      repository.setVersion(aggregateId, 0);

      // Mock handler to throw error
      const handleSpy = vi
        .spyOn(repository as any, 'handleNameChanged')
        .mockImplementation(() => {
          throw new Error('Handler error');
        });

      // Act
      const [error] = await safeRun(() => repository.save(aggregate));

      // Assert
      expect(error).not.toBeNull();
      expect(error?.message).toBe('Handler error');
      expect(handleSpy).toHaveBeenCalledTimes(1);
      expect(eventDispatcher.dispatchedAggregates).toHaveLength(0);
    });

    it('should execute all event handlers before dispatching events', async () => {
      // Arrange
      const handlerSpy = vi.spyOn(repository as any, 'handleNameChanged');
      const dispatchSpy = vi.spyOn(
        eventDispatcher,
        'dispatchEventsForAggregate',
      );

      aggregate.addTestEvent(eventNameChanged, { name: 'Test' });
      repository.setVersion(aggregateId, 0);

      // Act
      await repository.save(aggregate);

      // Assert
      expect(handlerSpy).toHaveBeenCalledTimes(1);
      expect(dispatchSpy).toHaveBeenCalledTimes(1);

      // Check execution order
      // dispatchEventsForAggregate should be called after handler
      const handlerCallOrder = handlerSpy.mock.invocationCallOrder[0];
      const dispatchCallOrder = dispatchSpy.mock.invocationCallOrder[0];
      expect(handlerCallOrder).toBeLessThan(dispatchCallOrder);
    });
  });

  describe('getCurrentVersion implementation', () => {
    it('should return version from storage', async () => {
      // Arrange
      repository.setVersion(aggregateId, 5);

      // Act
      const version = await repository.getCurrentVersion(aggregateId);

      // Assert
      expect(version).toBe(5);
    });

    it('should return 0 for non-existent aggregate', async () => {
      // Arrange
      const nonExistentId = EntityId.fromUUID(
        '00000000-0000-0000-0000-000000000000',
      );

      // Act
      const version = await repository.getCurrentVersion(nonExistentId);

      // Assert
      expect(version).toBe(0);
    });
  });

  describe('Edge cases', () => {
    it('should verify event versions are processed in order', async () => {
      // Arrange
      const orderOfExecution: string[] = [];

      // Override handlers to track execution order
      vi.spyOn(repository as any, 'handleNameChanged').mockImplementation(
        async () => {
          orderOfExecution.push('NameChanged');
        },
      );

      vi.spyOn(repository as any, 'handleItemAdded').mockImplementation(
        async () => {
          orderOfExecution.push('ItemAdded');
        },
      );

      repository.setVersion(aggregateId, 0);
      aggregate.addTestEvent('NameChanged', { name: 'Test' });
      aggregate.addTestEvent('ItemAdded', { item: 'Item 1' });

      // Act
      await repository.save(aggregate);

      // Assert
      expect(orderOfExecution).toEqual(['NameChanged', 'ItemAdded']);
      expect(aggregate.getVersion()).toBe(2); // Version should be incremented
    });

    it('should fail entire transaction if any event handler fails', async () => {
      // Arrange
      // First handler succeeds
      vi.spyOn(repository as any, 'handleNameChanged').mockImplementation(
        async () => {
          // Success
        },
      );

      // Second handler fails
      vi.spyOn(repository as any, 'handleItemAdded').mockImplementation(
        async () => {
          throw new Error('Second handler failed');
        },
      );

      repository.setVersion(aggregateId, 0);
      aggregate.addTestEvent('NameChanged', { name: 'Test' });
      aggregate.addTestEvent('ItemAdded', { item: 'Item 1' });

      // Act
      const [error] = await safeRun(() => repository.save(aggregate));
      // Assert
      expect(error?.message).toBe(`Second handler failed`);
      expect(repository.handlerCalls).toHaveLength(0); // No handlers recorded due to spy
      expect(eventDispatcher.dispatchedAggregates).toHaveLength(0); // Event dispatch didn't happen
    });
  });
});
