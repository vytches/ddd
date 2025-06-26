import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { safeRun } from '@vytches-ddd/utils';
import type {
  IExtendedDomainEvent,
  IDomainEvent
} from '@vytches-ddd/contracts';

import { AggregateRoot } from './aggregate-root';
import { EntityId } from '../value-objects';
import { AggregateError } from './aggregate-errors';
import type { IAggregateSnapshot } from './aggregate-interfaces';
import type { IEventUpcaster } from '@vytches-ddd/contracts';

// Test implementation of entity
class TestAggregate extends AggregateRoot<string> {
  private _name = '';
  private _items: string[] = [];

  constructor({ id, version }: { id: EntityId<string>; version?: number | undefined }) {
    super({ id, version });
  }

  // Getters for testing internal state
  get name(): string {
    return this._name;
  }

  get items(): string[] {
    return [...this._items];
  }

  // Methods for modifying the aggregate
  changeName(newName: string): void {
    if (!newName || newName.trim() === '') {
      throw new Error('Name cannot be empty');
    }

    this.apply('NameChanged', { name: newName });
  }

  addItem(item: string): void {
    if (!item || item.trim() === '') {
      throw new Error('Item cannot be empty');
    }

    if (this._items.includes(item)) {
      throw new Error('Item already exists');
    }

    this.apply('ItemAdded', { item });
  }

  removeItem(item: string): void {
    if (!this._items.includes(item)) {
      throw new Error('Item does not exist');
    }

    this.apply('ItemRemoved', { item });
  }

  // Event handlers
  protected onNameChanged(payload: { name: string }): void {
    this._name = payload.name;
  }

  protected onItemAdded(payload: { item: string }): void {
    this._items.push(payload.item);
  }

  protected onItemRemoved(payload: { item: string }): void {
    this._items = this._items.filter((i) => i !== payload.item);
  }

  // Implementation for snapshots
  serializeState(): TestAggregateState {
    return {
      name: this._name,
      items: [...this._items],
    };
  }

  deserializeState(state: TestAggregateState): void {
    this._name = state.name;
    this._items = [...state.items];
  }

  // Implementation for versioning
  protected onNameChanged_v1(payload: { name: string }): void {
    this._name = payload.name;
  }

  protected onNameChanged_v2(payload: {
    name: string;
    timestamp?: Date;
  }): void {
    this._name = payload.name;
    // In version 2 we ignore timestamp, but we could handle it
  }
}

// State structure for snapshot
interface TestAggregateState {
  name: string;
  items: string[];
}

// Upcaster for testing versioning
class NameChangedUpcaster
  implements IEventUpcaster<{ name: string }, { name: string; timestamp: Date }>
{
  upcast(
    payload: { name: string },
    metadata: any,
  ): { name: string; timestamp: Date } {
    return {
      name: payload.name,
      timestamp: new Date(),
    };
  }
}

describe('AggregateRoot', () => {
  let aggregateId: EntityId<string>;
  let aggregate: TestAggregate;

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();

    // Prepare aggregate for tests
    aggregateId = EntityId.fromUUID('123e4567-e89b-12d3-a456-426614174000');
    aggregate = new TestAggregate({ id: aggregateId });
  });

  afterEach(() => {
    // Clean up after tests
    vi.resetAllMocks();
  });

  describe('Basic functionality', () => {
    it('should correctly initialize aggregate with identifier', () => {
      // Arrange - already done in beforeEach

      // Act - initialization was performed in beforeEach

      // Assert
      expect(aggregate.getId()).toBe(aggregateId);
      expect(aggregate.getVersion()).toBe(0);
      expect(aggregate.getInitialVersion()).toBe(0);
      expect(aggregate.hasChanges()).toBe(false);
      expect(aggregate.getDomainEvents()).toHaveLength(0);
    });

    it('should correctly initialize aggregate with identifier and version', () => {
      // Arrange
      const initialVersion = 5;

      // Act
      const aggregateWithVersion = new TestAggregate({
        id: aggregateId,
        version: initialVersion,
      });

      // Assert
      expect(aggregateWithVersion.getId()).toBe(aggregateId);
      expect(aggregateWithVersion.getVersion()).toBe(initialVersion);
      expect(aggregateWithVersion.getInitialVersion()).toBe(initialVersion);
      expect(aggregateWithVersion.hasChanges()).toBe(false);
    });

    it('should correctly check version', () => {
      // Arrange
      const initialVersion = 5;
      const aggregateWithVersion = new TestAggregate({
        id: aggregateId,
        version: initialVersion,
      });

      // Act & Assert - Checking correct version shouldn't throw an error
      const correctVersion = aggregateWithVersion.checkVersion(5);
      expect(correctVersion).toBeUndefined();

      // Act & Assert - Checking incorrect version should throw an error
      const [errorForLowerVersion] = safeRun(() =>
        aggregateWithVersion.checkVersion(3),
      );

      expect(errorForLowerVersion).toBeInstanceOf(AggregateError);
      expect(errorForLowerVersion?.message).toMatch(/Version conflict/);
    });
  });

  describe('Applying events', () => {
    it('should correctly apply events and update state', () => {
      // Arrange
      const testName = 'Test Name';

      // Act
      aggregate.changeName(testName);

      // Assert
      expect(aggregate.name).toBe(testName);
      expect(aggregate.hasChanges()).toBe(true);
      expect(aggregate.getVersion()).toBe(1);
      expect(aggregate.getDomainEvents()).toHaveLength(1);

      const event = aggregate.getDomainEvents()[0];
      expect(event.eventType).toBe('NameChanged');
      expect(event.payload).toEqual({ name: testName });
      expect(event.metadata.aggregateId).toBe(aggregateId.getValue());
      expect(event.metadata.aggregateType).toBe('TestAggregate');
      expect(event.metadata.aggregateVersion).toBe(1);
    });

    it('should correctly commit changes', () => {
      // Arrange
      aggregate.changeName('Test Name');
      aggregate.addItem('Item 1');

      // Act
      aggregate.commit();

      // Assert
      expect(aggregate.hasChanges()).toBe(false);
      expect(aggregate.getDomainEvents()).toHaveLength(0);
      expect(aggregate.getVersion()).toBe(2);
      expect(aggregate.getInitialVersion()).toBe(2);
    });

    it('should allow applying multiple events', () => {
      // Arrange
      const testName = 'Test Name';
      const item1 = 'Item 1';
      const item2 = 'Item 2';

      // Act
      aggregate.changeName(testName);
      aggregate.addItem(item1);
      aggregate.addItem(item2);
      aggregate.removeItem(item1);

      // Assert
      expect(aggregate.name).toBe(testName);
      expect(aggregate.items).toEqual([item2]);
      expect(aggregate.hasChanges()).toBe(true);
      expect(aggregate.getVersion()).toBe(4);
      expect(aggregate.getDomainEvents()).toHaveLength(4);

      // Check if events are in correct order
      const events = aggregate.getDomainEvents();
      expect(events[0].eventType).toBe('NameChanged');
      expect(events[1].eventType).toBe('ItemAdded');
      expect(events[2].eventType).toBe('ItemAdded');
      expect(events[3].eventType).toBe('ItemRemoved');
    });

    it('should throw exception when applying invalid arguments', () => {
      // Arrange - already done in beforeEach

      // Act & Assert
      const [emptyNameError] = safeRun(() => aggregate.changeName(''));
      expect(emptyNameError).not.toBeNull();
      expect(emptyNameError?.message).toBe('Name cannot be empty');

      const [emptyItemError] = safeRun(() => aggregate.addItem(''));
      expect(emptyItemError).not.toBeNull();
      expect(emptyItemError?.message).toBe('Item cannot be empty');

      const [nonexistentItemError] = safeRun(() =>
        aggregate.removeItem('Nonexistent'),
      );
      expect(nonexistentItemError).not.toBeNull();
      expect(nonexistentItemError?.message).toBe('Item does not exist');

      // Aggregate state should not have changed
      expect(aggregate.name).toBe('');
      expect(aggregate.items).toEqual([]);
      expect(aggregate.hasChanges()).toBe(false);
      expect(aggregate.getVersion()).toBe(0);
    });

    it('should throw exception when trying to add a duplicate', () => {
      // Arrange
      const itemName = 'Item 1';
      aggregate.addItem(itemName);

      // Act
      const [error] = safeRun(() => aggregate.addItem(itemName));

      // Assert
      expect(error).not.toBeNull();
      expect(error?.message).toBe('Item already exists');

      // State should contain only one item
      expect(aggregate.items).toEqual([itemName]);
      expect(aggregate.getVersion()).toBe(1);
    });

    it('should correctly handle both signatures of apply method', () => {
      // Arrange
      const directName = 'Test Direct';
      const directItem = 'Direct Item';

      // Act
      // First variant: (eventType, payload, metadata)
      aggregate.changeName(directName);

      // Second variant: (domainEvent, metadata) - simulating direct call
      const event: IDomainEvent = {
        eventType: 'ItemAdded',
        payload: { item: directItem },
      };

      // Direct call of protected method using a hack - only for testing purposes
      (aggregate as any).apply(event, { additionalInfo: 'test' });

      // Assert
      expect(aggregate.name).toBe(directName);
      expect(aggregate.items).toContain(directItem);
      expect(aggregate.getDomainEvents()).toHaveLength(2);

      // Check if second event has correct metadata
      const secondEvent = aggregate.getDomainEvents()[1];
      expect(secondEvent.metadata.additionalInfo).toBe('test');
    });
  });

  describe('Loading from history', () => {
    it('should correctly reconstruct state from event history', () => {
      // Arrange
      const historyName = 'Historical Name';
      const historyItem1 = 'Historical Item 1';
      const historyItem2 = 'Historical Item 2';

      // Prepare example events from history
      const historyEvents: IExtendedDomainEvent[] = [
        {
          eventType: 'NameChanged',
          payload: { name: historyName },
          metadata: {
            aggregateId: aggregateId.getValue(),
            aggregateType: 'TestAggregate',
            aggregateVersion: 1,
          },
        },
        {
          eventType: 'ItemAdded',
          payload: { item: historyItem1 },
          metadata: {
            aggregateId: aggregateId.getValue(),
            aggregateType: 'TestAggregate',
            aggregateVersion: 2,
          },
        },
        {
          eventType: 'ItemAdded',
          payload: { item: historyItem2 },
          metadata: {
            aggregateId: aggregateId.getValue(),
            aggregateType: 'TestAggregate',
            aggregateVersion: 3,
          },
        },
      ];

      // Act
      // Direct call of protected method
      (aggregate as any).loadFromHistory(historyEvents);

      // Assert
      expect(aggregate.name).toBe(historyName);
      expect(aggregate.items).toEqual([historyItem1, historyItem2]);
      expect(aggregate.getVersion()).toBe(3);
      expect(aggregate.getInitialVersion()).toBe(3);
      expect(aggregate.hasChanges()).toBe(false);
      expect(aggregate.getDomainEvents()).toHaveLength(0);
    });

    it('should ignore events without handlers', () => {
      // Arrange
      const validName = 'Valid Name';
      const validItem = 'Valid Item';

      // Event with unknown type should not affect state
      const historyEvents: IExtendedDomainEvent[] = [
        {
          eventType: 'NameChanged',
          payload: { name: validName },
          metadata: {},
        },
        {
          eventType: 'UnknownEventType',
          payload: { someData: 'should be ignored' },
          metadata: {},
        },
        {
          eventType: 'ItemAdded',
          payload: { item: validItem },
          metadata: {},
        },
      ];

      // Act
      (aggregate as any).loadFromHistory(historyEvents);

      // Assert
      expect(aggregate.name).toBe(validName);
      expect(aggregate.items).toEqual([validItem]);
      expect(aggregate.getVersion()).toBe(3); // Still counts all events, even unknown ones
    });
  });

  describe('Snapshotting', () => {
    it('should not have snapshots enabled by default', () => {
      // Arrange - already done in beforeEach

      // Act & Assert
      expect(aggregate.isSnapshotEnabled()).toBe(false);
    });

    it('should allow enabling snapshot support', () => {
      // Arrange - already done in beforeEach

      // Act
      aggregate.enableSnapshots();

      // Assert
      expect(aggregate.isSnapshotEnabled()).toBe(true);
    });

    it('should throw exception when trying to create snapshot without enabled feature', () => {
      // Arrange - already done in beforeEach

      // Act
      const [error] = safeRun(() => aggregate.createSnapshot());

      // Assert
      expect(error).not.toBeNull();
      expect(error?.message).toMatch(/Feature 'snapshots' is not enabled/);
    });

    it('should throw exception when trying to restore snapshot without enabled feature', () => {
      // Arrange
      const mockSnapshot = {} as IAggregateSnapshot<TestAggregateState>;

      // Act
      const [error] = safeRun(() =>
        aggregate.restoreFromSnapshot(mockSnapshot),
      );

      // Assert
      expect(error).not.toBeNull();
      expect(error?.message).toMatch(/Feature 'snapshots' is not enabled/);
    });

    it('should correctly create and restore snapshots', () => {
      // Arrange
      const testName = 'Snapshot Test';
      const item1 = 'Snapshot Item 1';
      const item2 = 'Snapshot Item 2';

      aggregate.enableSnapshots();
      aggregate.changeName(testName);
      aggregate.addItem(item1);
      aggregate.addItem(item2);

      // Act - Create snapshot
      const snapshot = aggregate.createSnapshot();

      // Assert - Verify snapshot
      expect(snapshot.id).toBe(aggregateId.getValue());
      expect(snapshot.version).toBe(3);
      expect(snapshot.aggregateType).toBe('TestAggregate');
      expect(snapshot.state).toEqual({
        name: testName,
        items: [item1, item2],
      });
      expect(snapshot.timestamp).toBeInstanceOf(Date);

      // Arrange - Create new aggregate and restore from snapshot
      const newAggregate = new TestAggregate({ id: aggregateId });
      newAggregate.enableSnapshots();

      // Act - Restore from snapshot
      newAggregate.restoreFromSnapshot(snapshot);

      // Assert - Check state after restoration
      expect(newAggregate.name).toBe(testName);
      expect(newAggregate.items).toEqual([item1, item2]);
      expect(newAggregate.getVersion()).toBe(3);
      expect(newAggregate.getInitialVersion()).toBe(3);
      expect(newAggregate.hasChanges()).toBe(false);
    });

    it('should throw exception when trying to restore snapshot with incorrect ID', () => {
      // Arrange
      aggregate.enableSnapshots();

      const wrongIdSnapshot: IAggregateSnapshot<TestAggregateState> = {
        id: 'wrong-id',
        version: 1,
        aggregateType: 'TestAggregate',
        state: { name: 'Test', items: [] },
        timestamp: new Date(),
      };

      // Act
      const [error] = safeRun(() =>
        aggregate.restoreFromSnapshot(wrongIdSnapshot),
      );

      // Assert
      expect(error).not.toBeNull();
      expect(error?.message).toMatch(/ID mismatch/);
    });

    it('should throw exception when trying to restore snapshot with incorrect type', () => {
      // Arrange
      aggregate.enableSnapshots();

      const wrongTypeSnapshot: IAggregateSnapshot<TestAggregateState> = {
        id: aggregateId.getValue(),
        version: 1,
        aggregateType: 'WrongAggregateType',
        state: { name: 'Test', items: [] },
        timestamp: new Date(),
      };

      // Act
      const [error] = safeRun(() =>
        aggregate.restoreFromSnapshot(wrongTypeSnapshot),
      );

      // Assert
      expect(error).not.toBeNull();
      expect(error?.message).toMatch(/Aggregate type mismatch/);
    });

    it('should throw exception when trying to restore invalid snapshot', () => {
      // Arrange
      aggregate.enableSnapshots();

      // Snapshot without state
      const invalidSnapshot = {
        id: aggregateId.getValue(),
        version: 1,
        aggregateType: 'TestAggregate',
        timestamp: new Date(),
      } as IAggregateSnapshot<TestAggregateState>;

      // Act
      const [error] = safeRun(() =>
        aggregate.restoreFromSnapshot(invalidSnapshot),
      );

      // Assert
      expect(error).not.toBeNull();
      expect(error?.message).toMatch(/Invalid snapshot/);
    });
  });

  describe('Versioning', () => {
    it('should not have versioning enabled by default', () => {
      // Arrange - already done in beforeEach

      // Act & Assert
      expect(aggregate.isVersioningEnabled()).toBe(false);
    });

    it('should allow enabling versioning support', () => {
      // Arrange - already done in beforeEach

      // Act
      aggregate.enableVersioning();

      // Assert
      expect(aggregate.isVersioningEnabled()).toBe(true);
    });

    it('should throw exception when trying to register upcaster without enabled feature', () => {
      // Arrange
      const upcaster = new NameChangedUpcaster();

      // Act
      const [error] = safeRun(() =>
        aggregate.registerUpcaster('NameChanged', 1, upcaster),
      );

      // Assert
      expect(error).not.toBeNull();
      expect(error?.message).toMatch(/Feature 'versioning' is not enabled/);
    });

    it('should throw exception when trying to apply event with version without enabled feature', () => {
      // Arrange
      const event: IDomainEvent = {
        eventType: 'NameChanged',
        payload: { name: 'Versioned Test' },
      };

      // Act
      const [error] = safeRun(() => aggregate.applyWithVersion(event, 1));

      // Assert
      expect(error).not.toBeNull();
      expect(error?.message).toMatch(/Feature 'versioning' is not enabled/);
    });

    it('should correctly register upcasters', () => {
      // Arrange
      aggregate.enableVersioning();
      const upcaster = new NameChangedUpcaster();

      // Act
      // Registration should return this for chaining
      const result = aggregate.registerUpcaster('NameChanged', 1, upcaster);

      // Assert
      expect(result).toBe(aggregate);

      // Act & Assert - Trying to register again for the same version should throw exception
      const [error] = safeRun(() =>
        aggregate.registerUpcaster('NameChanged', 1, upcaster),
      );
      expect(error).not.toBeNull();
      expect(error?.message).toMatch(
        /Upcaster for event NameChanged version 1 already exists/,
      );
    });

    it('should handle specific handlers for different event versions', () => {
      // Arrange
      aggregate.enableVersioning();

      const event: IDomainEvent = {
        eventType: 'NameChanged',
        payload: { name: 'Versioned Name' },
      };

      // Act - Apply V1
      aggregate.applyWithVersion(event, 1);

      // Assert
      expect(aggregate.name).toBe('Versioned Name');

      // Act - Apply V2
      aggregate.applyWithVersion(event, 2, { additionalData: 'test' });

      // Assert
      expect(aggregate.name).toBe('Versioned Name'); // Name doesn't change, but a different handler is used

      // Check metadata
      const events = aggregate.getDomainEvents();
      expect(events[0].metadata.eventVersion).toBe(1);
      expect(events[1].metadata.eventVersion).toBe(2);
      expect(events[1].metadata.additionalData).toBe('test');
    });

    it('should use upcasting for events from history', () => {
      // Arrange
      aggregate.enableVersioning();

      // Register upcaster v1 -> v2
      const upcaster = new NameChangedUpcaster();
      aggregate.registerUpcaster('NameChanged', 1, upcaster);

      // v1 event from history
      const historyEvent: IExtendedDomainEvent = {
        eventType: 'NameChanged',
        payload: { name: 'Original Name' },
        metadata: {
          eventVersion: 1,
        },
      };

      // Create spy for upcast method to verify its call
      const upcastSpy = vi.spyOn(upcaster, 'upcast');

      // Act
      // Direct call of protected method
      (aggregate as any)._handleVersionedEvent(historyEvent);

      // Assert
      // Check if upcast was called
      expect(upcastSpy).toHaveBeenCalledWith(
        { name: 'Original Name' }, // payload
        expect.objectContaining({ eventVersion: 1 }), // metadata
      );
    });

    it('should throw exception when missing appropriate upcaster', () => {
      // Arrange
      aggregate.enableVersioning();

      // Only register upcaster from v2 to v3
      const upcaster = new NameChangedUpcaster();
      aggregate.registerUpcaster('NameChanged', 2, upcaster);

      // v1 event - no upcaster from v1 to v2
      const historyEvent: IExtendedDomainEvent = {
        eventType: 'NameChanged',
        payload: { name: 'Missing Upcaster Test' },
        metadata: {
          eventVersion: 1,
        },
      };

      // Act & Assert
      // Direct call to _upcastEvent should throw exception
      const [error] = safeRun(() =>
        (aggregate as any)._upcastEvent(historyEvent),
      );
      expect(error).not.toBeNull();
      expect(error?.message).toMatch(
        /Missing upcaster for event NameChanged from version 1 to 2/,
      );
    });

    it('should correctly use upcasting chain for multiple versions', () => {
      // Arrange
      aggregate.enableVersioning();

      // Upcasters for multiple versions
      const upcasterV1toV2 = {
        upcast: (payload: any) => ({ ...payload, additionalV2: true }),
      } as IEventUpcaster;

      const upcasterV2toV3 = {
        upcast: (payload: any) => ({ ...payload, additionalV3: true }),
      } as IEventUpcaster;

      // Register upcasters
      aggregate.registerUpcaster('TestEvent', 1, upcasterV1toV2);
      aggregate.registerUpcaster('TestEvent', 2, upcasterV2toV3);

      // Original v1 event
      const originalEvent: IExtendedDomainEvent = {
        eventType: 'TestEvent',
        payload: { original: true },
        metadata: {
          eventVersion: 1,
        },
      };

      // Act
      // Upcast should go through entire path v1 -> v2 -> v3
      const result = (aggregate as any)._upcastEvent(originalEvent);

      // Assert
      expect(result.payload).toEqual({
        original: true,
        additionalV2: true,
        additionalV3: true,
      });

      expect(result.metadata.eventVersion).toBe(3);
    });
  });

  describe('Complex scenarios', () => {
    it('should work correctly with snapshots and versioning enabled', () => {
      // Arrange
      // Configure aggregate with both features
      aggregate.enableSnapshots();
      aggregate.enableVersioning();

      // Register upcaster
      const upcaster = new NameChangedUpcaster();
      aggregate.registerUpcaster('NameChanged', 1, upcaster);

      // Apply events with different versions
      aggregate.applyWithVersion(
        { eventType: 'NameChanged', payload: { name: 'Version 1' } },
        1,
      );
      aggregate.applyWithVersion(
        { eventType: 'ItemAdded', payload: { item: 'Item 1' } },
        1,
      );
      aggregate.applyWithVersion(
        { eventType: 'ItemAdded', payload: { item: 'Item 2' } },
        1,
      );

      // Act - Create snapshot
      const snapshot = aggregate.createSnapshot();

      // Arrange - Create new aggregate
      const newAggregate = new TestAggregate({ id: aggregateId });
      newAggregate.enableSnapshots();
      newAggregate.enableVersioning();
      newAggregate.registerUpcaster('NameChanged', 1, upcaster);

      // Act - Restore from snapshot
      newAggregate.restoreFromSnapshot(snapshot);

      // Assert - Verify state
      expect(newAggregate.name).toBe('Version 1');
      expect(newAggregate.items).toEqual(['Item 1', 'Item 2']);
      expect(newAggregate.getVersion()).toBe(3);

      // Act - Add new events
      newAggregate.applyWithVersion(
        { eventType: 'NameChanged', payload: { name: 'Version 2' } },
        2,
      );
      newAggregate.applyWithVersion(
        { eventType: 'ItemAdded', payload: { item: 'Item 3' } },
        1,
      );

      // Assert - Verify final state
      expect(newAggregate.name).toBe('Version 2');
      expect(newAggregate.items).toEqual(['Item 1', 'Item 2', 'Item 3']);
      expect(newAggregate.getVersion()).toBe(5);
    });

    it('should correctly load data from history and create snapshot', () => {
      // Arrange
      // Enable features
      aggregate.enableSnapshots();

      // Prepare event history
      const historyEvents: IExtendedDomainEvent[] = [
        {
          eventType: 'NameChanged',
          payload: { name: 'Name from history' },
          metadata: { aggregateVersion: 1 },
        },
        {
          eventType: 'ItemAdded',
          payload: { item: 'Item from history 1' },
          metadata: { aggregateVersion: 2 },
        },
        {
          eventType: 'ItemAdded',
          payload: { item: 'Item from history 2' },
          metadata: { aggregateVersion: 3 },
        },
        {
          eventType: 'ItemRemoved',
          payload: { item: 'Item from history 1' },
          metadata: { aggregateVersion: 4 },
        },
      ];

      // Act - Load from history
      (aggregate as any).loadFromHistory(historyEvents);

      // Assert - Verify state
      expect(aggregate.name).toBe('Name from history');
      expect(aggregate.items).toEqual(['Item from history 2']);
      expect(aggregate.getVersion()).toBe(4);

      // Act - Create snapshot
      const snapshot = aggregate.createSnapshot();

      // Assert - Verify snapshot
      expect(snapshot.version).toBe(4);
      expect(snapshot.state.name).toBe('Name from history');
      expect(snapshot.state.items).toEqual(['Item from history 2']);

      // Act - Add new events
      aggregate.changeName('New name');
      aggregate.addItem('New item');

      // Assert - Verify final state
      expect(aggregate.name).toBe('New name');
      expect(aggregate.items).toEqual(['Item from history 2', 'New item']);
      expect(aggregate.getVersion()).toBe(6);
    });
  });

  describe('Test coverage analysis', () => {
    it('should test all error paths in the apply method', () => {
      // Arrange
      // Create an invalid event type (not a string or object with eventType)
      const invalidEvent = { notAnEventType: true } as any;

      // Act & Assert
      const [error] = safeRun(() => (aggregate as any).apply(invalidEvent));
      expect(error).not.toBeNull();
      expect(error?.message).toMatch(/Invalid arguments for apply method/);
    });

    it('should test missing methods for snapshot capabilities', () => {
      // Arrange
      // Create a class that doesn't implement required methods
      class IncompleteAggregate extends AggregateRoot<string, any> {
        constructor(id: EntityId<string>) {
          super({ id });
          this.enableSnapshots();
        }

        // No serializeState or deserializeState methods
      }

      const incompleteAggregate = new IncompleteAggregate(
        EntityId.fromUUID('123e4567-e89b-12d3-a456-426614174000'),
      );

      // Act & Assert - Create snapshot should fail
      const [createError] = safeRun(() => incompleteAggregate.createSnapshot());
      expect(createError?.message).toMatch(
        /Method 'serializeState' must be implemented/,
      );

      // Act & Assert - Restore snapshot should fail
      const mockSnapshot = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        version: 1,
        aggregateType: 'IncompleteAggregate',
        state: {},
        timestamp: new Date(),
      } as IAggregateSnapshot<any>;

      const [restoreError] = safeRun(() =>
        incompleteAggregate.restoreFromSnapshot(mockSnapshot),
      );
      expect(restoreError?.message).toMatch(
        /Method 'deserializeState' must be implemented/,
      );
    });

    it('should test snapshot metadata handling', () => {
      // Arrange
      // Create an aggregate with metadata handling
      class MetadataAggregate extends AggregateRoot<
        string,
        any,
        { metaValue: string }
      > {
        private _metaValue = '';

        constructor(id: EntityId<string>) {
          super({ id });
          this.enableSnapshots();
        }

        get metaValue(): string {
          return this._metaValue;
        }

        serializeState(): any {
          return { data: 'state' };
        }

        deserializeState(state: any): void {
          // Just for implementation
        }

        protected createSnapshotMetadata(): { metaValue: string } {
          return { metaValue: this._metaValue };
        }

        protected restoreSnapshotMetadata(metadata: {
          metaValue: string;
        }): void {
          this._metaValue = metadata.metaValue;
        }

        setMetaValue(value: string): void {
          this._metaValue = value;
        }
      }

      const metaAggregate = new MetadataAggregate(
        EntityId.fromUUID('123e4567-e89b-12d3-a456-426614174000'),
      );
      metaAggregate.setMetaValue('test-meta');

      // Act
      const snapshot = metaAggregate.createSnapshot();

      // Assert
      expect(snapshot.metadata).toBeDefined();
      expect(snapshot.metadata?.metaValue).toBe('test-meta');

      // Act - Create new aggregate and restore
      const newMetaAggregate = new MetadataAggregate(
        EntityId.fromUUID('123e4567-e89b-12d3-a456-426614174000'),
      );
      newMetaAggregate.restoreFromSnapshot(snapshot);

      // Assert
      expect(newMetaAggregate.metaValue).toBe('test-meta');
    });
  });
});
