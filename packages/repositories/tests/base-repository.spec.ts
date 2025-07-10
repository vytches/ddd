import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { safeRun } from '@vytches-ddd/testing';

import type { IRepositoryAggregate } from '../src';
import { IBaseRepository } from '../src';
import { EntityId } from '@vytches-ddd/contracts';
import type {
  IDomainEvent,
  IAggregateWithEvents,
  IExtendedDomainEvent,
} from '@vytches-ddd/contracts';
import { IEventPersistenceHandler, IEnhancedEventDispatcher } from '@vytches-ddd/contracts';

// Mock dla IEnhancedEventDispatcher
class MockEnhancedEventDispatcher extends IEnhancedEventDispatcher {
  public dispatchedEvents: IDomainEvent[] = [];
  public dispatchedAggregates: IAggregateWithEvents[] = [];
  public shouldFail = false;

  async dispatchEventsForAggregate(aggregate: IAggregateWithEvents): Promise<void> {
    if (this.shouldFail) {
      throw new Error('Dispatch events failed');
    }
    this.dispatchedAggregates.push(aggregate);
    aggregate.getDomainEvents().forEach(event => this.dispatchedEvents.push(event));

    aggregate.commit();
  }

  async dispatchEvent(event: IDomainEvent): Promise<void> {
    if (this.shouldFail) {
      throw new Error('Dispatch event failed');
    }
    this.dispatchedEvents.push(event);
  }

  async dispatchEvents(...events: IDomainEvent[]): Promise<void> {
    if (this.shouldFail) {
      throw new Error('Dispatch events failed');
    }
    events.forEach(event => this.dispatchedEvents.push(event));
  }

  use(middleware: any): this {
    // Mock implementation
    return this;
  }

  registerProcessor(processor: any): this {
    // Mock implementation
    return this;
  }

  reset(): void {
    this.dispatchedEvents = [];
    this.dispatchedAggregates = [];
    this.shouldFail = false;
  }
}

// Mock dla IEventPersistenceHandler
class MockEventPersistenceHandler extends IEventPersistenceHandler {
  public handledEvents: IDomainEvent[] = [];
  public versions = new Map<any, number>();
  public shouldFail = false;

  async handleEvent(event: IDomainEvent): Promise<number> {
    if (this.shouldFail) {
      throw new Error('Handle event failed');
    }
    this.handledEvents.push(event);
    // Zakładamy że event ma metadata z aggregateId
    const aggregateId = (event as any).metadata?.aggregateId || 'default';
    const currentVersion = this.versions.get(aggregateId) || 0;
    const newVersion = currentVersion + 1;
    this.versions.set(aggregateId, newVersion);
    return newVersion;
  }

  async getCurrentVersion(aggregateId: any): Promise<number | undefined> {
    return this.versions.get(aggregateId) ?? undefined;
  }

  reset(): void {
    this.handledEvents = [];
    this.versions.clear();
    this.shouldFail = false;
  }
}

// Mock implementacji IRepositoryAggregate
class TestAggregate implements IRepositoryAggregate {
  private _id: EntityId;
  private _version: number;
  private _events: IExtendedDomainEvent[] = [];
  private _name = '';
  private _items: string[] = [];

  constructor({ id, version }: { id: EntityId; version?: number }) {
    this._id = id;
    this._version = version ?? 0;
  }

  getId(): EntityId {
    return this._id;
  }

  getInitialVersion(): number {
    return this._version;
  }

  getDomainEvents(): ReadonlyArray<IExtendedDomainEvent> {
    return [...this._events];
  }

  commit(): void {
    this._events = [];
  }

  hasChanges(): boolean {
    return this._events.length > 0;
  }

  // Metody do manipulacji stanem
  get name(): string {
    return this._name;
  }

  get items(): string[] {
    return [...this._items];
  }

  changeName(name: string): void {
    this.addEvent('NameChanged', { name });
  }

  addItem(item: string): void {
    this.addEvent('ItemAdded', { item });
  }

  // Metoda do dodawania testowych zdarzeń - dla backward compatibility
  addTestEvent(eventType: string, payload: any): void {
    this.addEvent(eventType, payload);
  }

  private addEvent(eventType: string, payload: any): void {
    const event: IExtendedDomainEvent = {
      eventType,
      payload,
      metadata: {
        aggregateId: this._id.getValue(),
        aggregateType: 'TestAggregate',
        aggregateVersion: this._version + this._events.length + 1,
        timestamp: new Date(),
        correlationId: `corr-${Date.now()}`,
      },
    };
    this._events.push(event);
  }
}

// Konkretna implementacja BaseRepository do testów
class TestRepository extends IBaseRepository {
  override async findById(id: unknown): Promise<unknown | null> {
    return null;
  }

  // Metoda pomocnicza do resetowania stanu
  reset(): void {
    // Reset persistence handler versions
    if (this.eventPersistenceHandler instanceof MockEventPersistenceHandler) {
      this.eventPersistenceHandler.reset();
    }
  }
}

describe('IBaseRepository', () => {
  let eventDispatcher: MockEnhancedEventDispatcher;
  let persistenceHandler: MockEventPersistenceHandler;
  let repository: TestRepository;
  let aggregate: TestAggregate;
  let aggregateId: EntityId;

  beforeEach(() => {
    // Inicjalizacja przed każdym testem
    eventDispatcher = new MockEnhancedEventDispatcher();
    persistenceHandler = new MockEventPersistenceHandler();
    repository = new TestRepository(eventDispatcher, persistenceHandler);
    aggregateId = EntityId.fromUUID('123e4567-e89b-12d3-a456-426614174000');
    aggregate = new TestAggregate({ id: aggregateId });

    // Reset stanów mocków
    vi.clearAllMocks();
    eventDispatcher.reset();
    persistenceHandler.reset();
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
      persistenceHandler.versions.set(aggregateId.getValue(), 0);

      // Act
      await repository.save(aggregate);

      // Assert
      expect(persistenceHandler.handledEvents).toHaveLength(1);
      expect(persistenceHandler?.handledEvents?.[0]?.eventType).toBe(eventNameChanged);
      expect(eventDispatcher.dispatchedAggregates).toContain(aggregate);
    });

    it('should fail when version mismatch occurs', async () => {
      // Arrange
      aggregate.addTestEvent(eventNameChanged, { name: 'Test' });
      // Set the version using the aggregate's ID (same as what repository will pass)
      persistenceHandler.versions.set(aggregate.getId(), 5); // Current version is 5, but aggregate expects 0

      // Act
      const [error] = await safeRun(() => repository.save(aggregate));

      // Assert
      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toContain('Version mismatch');
      expect(persistenceHandler.handledEvents).toHaveLength(0);
      expect(eventDispatcher.dispatchedAggregates).toHaveLength(0);
    });

    it('should handle persistence failure', async () => {
      // Arrange
      aggregate.addTestEvent(eventNameChanged, { name: 'Test' });
      persistenceHandler.versions.set(aggregateId.getValue(), 0);
      persistenceHandler.shouldFail = true;

      // Act
      const [error] = await safeRun(() => repository.save(aggregate));

      // Assert
      expect(error).not.toBeNull();
      expect(error?.message).toBe('Handle event failed');
      expect(persistenceHandler.handledEvents).toHaveLength(0);
      expect(eventDispatcher.dispatchedAggregates).toHaveLength(0);
    });

    it('should process multiple events from an aggregate', async () => {
      // Arrange
      aggregate.addTestEvent(eventNameChanged, { name: 'Test' });
      aggregate.addTestEvent('ItemAdded', { item: 'Item 1' });
      persistenceHandler.versions.set(aggregateId.getValue(), 0);

      // Act
      await repository.save(aggregate);

      // Assert
      expect(persistenceHandler.handledEvents).toHaveLength(2);
      expect(persistenceHandler?.handledEvents?.[0]?.eventType).toBe(eventNameChanged);
      expect(persistenceHandler?.handledEvents?.[1]?.eventType).toBe('ItemAdded');
      expect(eventDispatcher.dispatchedAggregates).toHaveLength(1);
      expect(eventDispatcher.dispatchedEvents).toHaveLength(2);
    });

    it('should not dispatch events if persistence fails', async () => {
      // Arrange
      aggregate.addTestEvent(eventNameChanged, { name: 'Test' });
      aggregate.addTestEvent('ItemAdded', { item: 'Item 1' });
      persistenceHandler.versions.set(aggregateId.getValue(), 0);
      persistenceHandler.shouldFail = true;

      // Act
      const [error] = await safeRun(() => repository.save(aggregate));

      // Assert
      expect(error).not.toBeNull();
      expect(persistenceHandler.handledEvents).toHaveLength(0);
      expect(eventDispatcher.dispatchedAggregates).toHaveLength(0);
    });

    it('should handle case when aggregate has no events', async () => {
      // Arrange - No events in aggregate
      persistenceHandler.versions.set(aggregateId.getValue(), 0);
      const getCurrentVersionSpy = vi.spyOn(persistenceHandler, 'getCurrentVersion');

      // Act
      await repository.save(aggregate);

      // Assert
      expect(persistenceHandler.handledEvents).toHaveLength(0);
      expect(getCurrentVersionSpy).not.toHaveBeenCalled();
      expect(eventDispatcher.dispatchedAggregates).toHaveLength(0);
    });

    it('should handle failure in event dispatcher', async () => {
      // Arrange
      aggregate.addTestEvent(eventNameChanged, { name: 'Test' });
      persistenceHandler.versions.set(aggregateId.getValue(), 0);
      eventDispatcher.shouldFail = true;

      // Act
      const [error] = await safeRun(() => repository.save(aggregate));

      // Assert
      expect(error).not.toBeNull();
      expect(error?.message).toBe('Dispatch events failed');
      expect(persistenceHandler.handledEvents).toHaveLength(1); // Event still persisted
    });

    it('should handle first-time save with no previous version', async () => {
      // Arrange - No version set for this ID (simulate new aggregate)
      aggregate.addTestEvent(eventNameChanged, { name: 'Test' });

      // Act
      await repository.save(aggregate);

      // Assert
      expect(persistenceHandler.handledEvents).toHaveLength(1);
      expect(eventDispatcher.dispatchedAggregates).toHaveLength(1);
    });

    it('should handle persistence handler throwing errors', async () => {
      // Arrange
      aggregate.addTestEvent(eventNameChanged, { name: 'Test' });
      persistenceHandler.versions.set(aggregateId.getValue(), 0);

      // Mock persistence handler to throw error
      const handleEventSpy = vi.spyOn(persistenceHandler, 'handleEvent').mockImplementation(() => {
        throw new Error('Persistence error');
      });

      // Act
      const [error] = await safeRun(() => repository.save(aggregate));

      // Assert
      expect(error).not.toBeNull();
      expect(error?.message).toBe('Persistence error');
      expect(handleEventSpy).toHaveBeenCalledTimes(1);
      expect(eventDispatcher.dispatchedAggregates).toHaveLength(0);
    });

    it('should persist all events before dispatching events', async () => {
      // Arrange
      const persistSpy = vi.spyOn(persistenceHandler, 'handleEvent');
      const dispatchSpy = vi.spyOn(eventDispatcher, 'dispatchEventsForAggregate');

      aggregate.addTestEvent(eventNameChanged, { name: 'Test' });
      persistenceHandler.versions.set(aggregateId.getValue(), 0);

      // Act
      await repository.save(aggregate);

      // Assert
      expect(persistSpy).toHaveBeenCalledTimes(1);
      expect(dispatchSpy).toHaveBeenCalledTimes(1);

      // Check execution order
      // dispatchEventsForAggregate should be called after persistence
      const persistCallOrder = persistSpy.mock.invocationCallOrder[0];
      const dispatchCallOrder = dispatchSpy.mock.invocationCallOrder[0];
      expect(persistCallOrder).toBeLessThan(dispatchCallOrder as number);
    });
  });

  describe('version management', () => {
    it('should get current version from persistence handler', async () => {
      // Arrange
      persistenceHandler.versions.set(aggregateId.getValue(), 5);

      // Act
      const version = await persistenceHandler.getCurrentVersion(aggregateId.getValue());

      // Assert
      expect(version).toBe(5);
    });

    it('should return undefined for non-existent aggregate', async () => {
      // Arrange
      const nonExistentId = 'non-existent';

      // Act
      const version = await persistenceHandler.getCurrentVersion(nonExistentId);

      // Assert
      expect(version).toBeUndefined();
    });
  });

  describe('Edge cases', () => {
    it('should verify events are persisted in order', async () => {
      // Arrange
      persistenceHandler.versions.set(aggregateId.getValue(), 0);
      aggregate.addTestEvent('NameChanged', { name: 'Test' });
      aggregate.addTestEvent('ItemAdded', { item: 'Item 1' });

      // Act
      await repository.save(aggregate);

      // Assert
      expect(persistenceHandler.handledEvents).toHaveLength(2);
      expect(persistenceHandler?.handledEvents?.[0]?.eventType).toBe('NameChanged');
      expect(persistenceHandler?.handledEvents?.[1]?.eventType).toBe('ItemAdded');
      expect(persistenceHandler.versions.get(aggregateId.getValue())).toBe(2);
    });

    it('should fail entire transaction if persistence fails for any event', async () => {
      // Arrange
      let callCount = 0;
      vi.spyOn(persistenceHandler, 'handleEvent').mockImplementation(async () => {
        callCount++;
        if (callCount === 2) {
          throw new Error('Second event persistence failed');
        }
        return 1;
      });

      persistenceHandler.versions.set(aggregateId.getValue(), 0);
      aggregate.addTestEvent('NameChanged', { name: 'Test' });
      aggregate.addTestEvent('ItemAdded', { item: 'Item 1' });

      // Act
      const [error] = await safeRun(() => repository.save(aggregate));

      // Assert
      expect(error?.message).toBe('Second event persistence failed');
      expect(eventDispatcher.dispatchedAggregates).toHaveLength(0);
    });
  });
});
