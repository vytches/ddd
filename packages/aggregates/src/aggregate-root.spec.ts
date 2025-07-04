import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { safeRun } from '@vytches-ddd/utils';
import type { IExtendedDomainEvent, IDomainEvent } from '@vytches-ddd/contracts';

import { AggregateRoot } from './aggregate-root';
import { AggregateBuilder, AggregateTestBuilder } from './aggregate-root.builder';
import { EntityId } from '@vytches-ddd/value-objects';
import { AggregateError } from './aggregate-errors';
import type { IAggregateSnapshot } from './aggregate-interfaces';
import type { IEventUpcaster } from '@vytches-ddd/contracts';
import { SnapshotCapability, VersioningCapability, AuditCapability } from './capabilities';
import {
  asSnapshotAggregate,
  asVersioningAggregate,
  getAggregateCapabilities,
  createSnapshotIfCapable,
} from './aggregate-utilities';

// Test implementation of entity
class TestAggregate extends AggregateRoot<string> {
  private _name = '';
  private _items: string[] = [];

  constructor({ id, version }: { id: EntityId<string>; version?: number | undefined }) {
    super({ id, version: version ?? 0 });

    // Register event handlers
    this.registerEventHandler('NameChanged', (payload, _metadata) =>
      this.onNameChanged(payload as { name: string })
    );
    this.registerEventHandler('ItemAdded', (payload, _metadata) =>
      this.onItemAdded(payload as { item: string })
    );
    this.registerEventHandler('ItemRemoved', (payload, _metadata) =>
      this.onItemRemoved(payload as { item: string })
    );
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
    this._items = this._items.filter(i => i !== payload.item);
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
  upcast(payload: { name: string }, _metadata: any): { name: string; timestamp: Date } {
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

    it('should correctly handle aggregate with custom initial version', () => {
      // Arrange
      const initialVersion = 5;
      const aggregateWithVersion = new TestAggregate({
        id: aggregateId,
        version: initialVersion,
      });

      // Act & Assert
      expect(aggregateWithVersion.getVersion()).toBe(initialVersion);
      expect(aggregateWithVersion.getInitialVersion()).toBe(initialVersion);
      expect(aggregateWithVersion.hasChanges()).toBe(false);
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
      expect(event?.eventType).toBe('NameChanged');
      expect(event?.payload).toEqual({ name: testName });
      expect(event?.metadata?.aggregateId).toBe(aggregateId.getValue());
      expect(event?.metadata?.aggregateType).toBe('TestAggregate');
      expect(event?.metadata?.aggregateVersion).toBe(1);
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
      expect(events?.[0]?.eventType).toBe('NameChanged');
      expect(events?.[1]?.eventType).toBe('ItemAdded');
      expect(events?.[2]?.eventType).toBe('ItemAdded');
      expect(events?.[3]?.eventType).toBe('ItemRemoved');
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

      const [nonexistentItemError] = safeRun(() => aggregate.removeItem('Nonexistent'));
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
      aggregate['apply'](event, undefined, { additionalInfo: 'test' });

      // Assert
      expect(aggregate.name).toBe(directName);
      expect(aggregate.items).toContain(directItem);
      expect(aggregate.getDomainEvents()).toHaveLength(2);

      // Check if second event has correct metadata
      const secondEvent = aggregate.getDomainEvents()[1];
      expect(secondEvent?.metadata?.additionalInfo).toBe('test');
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

  describe('Capability Management', () => {
    it('should not have any capabilities by default', () => {
      // Arrange - already done in beforeEach

      // Act & Assert
      expect(aggregate.hasCapability('snapshot')).toBe(false);
      expect(aggregate.hasCapability('versioning')).toBe(false);
      expect(aggregate.hasCapability('audit')).toBe(false);
      expect(aggregate.hasCapability('eventSourcing')).toBe(false);
      expect(getAggregateCapabilities(aggregate)).toHaveLength(0);
    });

    it('should allow adding and removing capabilities', () => {
      // Arrange
      const snapshotCap = new SnapshotCapability<TestAggregateState>();
      const auditCap = new AuditCapability();

      // Act - Add capabilities
      aggregate.addCapability('snapshot', snapshotCap);
      aggregate.addCapability('audit', auditCap);

      // Assert
      expect(aggregate.hasCapability('snapshot')).toBe(true);
      expect(aggregate.hasCapability('audit')).toBe(true);
      expect(aggregate.getCapability('snapshot')).toBe(snapshotCap);
      expect(aggregate.getCapability('audit')).toBe(auditCap);
      expect(getAggregateCapabilities(aggregate)).toContain('snapshot');
      expect(getAggregateCapabilities(aggregate)).toContain('audit');

      // Act - Remove capability
      aggregate.removeCapability('snapshot');

      // Assert
      expect(aggregate.hasCapability('snapshot')).toBe(false);
      expect(aggregate.hasCapability('audit')).toBe(true);
      expect(aggregate.getCapability('snapshot')).toBeUndefined();
    });

    it('should throw exception when trying to create snapshot without capability', () => {
      // Arrange - already done in beforeEach

      // Act
      const snapshot = createSnapshotIfCapable(aggregate, () => aggregate.serializeState());

      // Assert
      expect(snapshot).toBeNull();
    });

    it('should correctly create and restore snapshots with capability', () => {
      // Arrange
      const testName = 'Snapshot Test';
      const item1 = 'Snapshot Item 1';
      const item2 = 'Snapshot Item 2';

      const snapshotCap = new SnapshotCapability<TestAggregateState>();
      aggregate.addCapability('snapshot', snapshotCap);
      aggregate.changeName(testName);
      aggregate.addItem(item1);
      aggregate.addItem(item2);

      // Act - Create snapshot using capability
      const snapshotAggregate = asSnapshotAggregate(aggregate);
      const snapshot = snapshotAggregate
        .getCapability('snapshot')
        .createSnapshot(() => aggregate.serializeState());

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
      const newSnapshotCap = new SnapshotCapability<TestAggregateState>();
      newAggregate.addCapability('snapshot', newSnapshotCap);

      // Act - Restore from snapshot
      const newSnapshotAggregate = asSnapshotAggregate(newAggregate);
      newSnapshotAggregate
        .getCapability('snapshot')
        .restoreFromSnapshot(snapshot, state => newAggregate.deserializeState(state));

      // Assert - Check state after restoration
      expect(newAggregate.name).toBe(testName);
      expect(newAggregate.items).toEqual([item1, item2]);
      expect(newAggregate.getVersion()).toBe(3);
      expect(newAggregate.getInitialVersion()).toBe(3);
      expect(newAggregate.hasChanges()).toBe(false);
    });

    it('should throw exception when trying to restore snapshot with incorrect ID', () => {
      // Arrange
      const snapshotCap = new SnapshotCapability<TestAggregateState>();
      aggregate.addCapability('snapshot', snapshotCap);

      const wrongIdSnapshot: IAggregateSnapshot<TestAggregateState> = {
        id: 'wrong-id',
        version: 1,
        aggregateType: 'TestAggregate',
        state: { name: 'Test', items: [] },
        timestamp: new Date(),
      };

      // Act
      const [error] = safeRun(() => {
        const snapshotAggregate = asSnapshotAggregate(aggregate);
        snapshotAggregate
          .getCapability('snapshot')
          .restoreFromSnapshot(wrongIdSnapshot, state => aggregate.deserializeState(state));
      });

      // Assert
      expect(error).not.toBeNull();
      expect(error?.message).toMatch(/ID mismatch/);
    });

    it('should throw exception when trying to restore snapshot with incorrect type', () => {
      // Arrange
      const snapshotCap = new SnapshotCapability<TestAggregateState>();
      aggregate.addCapability('snapshot', snapshotCap);

      const wrongTypeSnapshot: IAggregateSnapshot<TestAggregateState> = {
        id: aggregateId.getValue(),
        version: 1,
        aggregateType: 'WrongAggregateType',
        state: { name: 'Test', items: [] },
        timestamp: new Date(),
      };

      // Act
      const [error] = safeRun(() => {
        const snapshotAggregate = asSnapshotAggregate(aggregate);
        snapshotAggregate
          .getCapability('snapshot')
          .restoreFromSnapshot(wrongTypeSnapshot, state => aggregate.deserializeState(state));
      });

      // Assert
      expect(error).not.toBeNull();
      expect(error?.message).toMatch(/Aggregate type mismatch/);
    });

    it('should throw exception when trying to restore invalid snapshot', () => {
      // Arrange
      const snapshotCap = new SnapshotCapability<TestAggregateState>();
      aggregate.addCapability('snapshot', snapshotCap);

      // Snapshot without state
      const invalidSnapshot = {
        id: aggregateId.getValue(),
        version: 1,
        aggregateType: 'TestAggregate',
        timestamp: new Date(),
      } as IAggregateSnapshot<TestAggregateState>;

      // Act
      const [error] = safeRun(() => {
        const snapshotAggregate = asSnapshotAggregate(aggregate);
        snapshotAggregate
          .getCapability('snapshot')
          .restoreFromSnapshot(invalidSnapshot, state => aggregate.deserializeState(state));
      });

      // Assert
      expect(error).not.toBeNull();
      expect(error?.message).toMatch(/Invalid snapshot/);
    });
  });

  describe('Versioning Capability', () => {
    it('should not have versioning capability by default', () => {
      // Arrange - already done in beforeEach

      // Act & Assert
      expect(aggregate.hasCapability('versioning')).toBe(false);
    });

    it('should allow adding versioning capability', () => {
      // Arrange
      const versioningCap = new VersioningCapability();

      // Act
      aggregate.addCapability('versioning', versioningCap);

      // Assert
      expect(aggregate.hasCapability('versioning')).toBe(true);
      expect(aggregate.getCapability('versioning')).toBe(versioningCap);
    });

    it('should work without versioning capability', () => {
      // Arrange
      const testName = 'Non-versioned Test';

      // Act
      aggregate.changeName(testName);

      // Assert
      expect(aggregate.name).toBe(testName);
      expect(aggregate.hasChanges()).toBe(true);
      expect(aggregate.getVersion()).toBe(1);
    });

    it('should correctly register upcasters with versioning capability', () => {
      // Arrange
      const versioningCap = new VersioningCapability();
      aggregate.addCapability('versioning', versioningCap);
      const upcaster = new NameChangedUpcaster();

      // Act
      const versioningAggregate = asVersioningAggregate(aggregate);
      const result = versioningAggregate
        .getCapability('versioning')
        .registerUpcaster('NameChanged', 1, upcaster);

      // Assert
      expect(result).toBe(versioningCap);

      // Act & Assert - Trying to register again for the same version should throw exception
      const [error] = safeRun(() =>
        versioningAggregate.getCapability('versioning').registerUpcaster('NameChanged', 1, upcaster)
      );
      expect(error).not.toBeNull();
      expect(error?.message).toMatch(/Upcaster for event NameChanged version 1 already exists/);
    });
  });

  describe('Aggregate Builder Tests', () => {
    it('should create aggregate with basic configuration', () => {
      // Arrange & Act
      const builtAggregate = AggregateBuilder.create({ id: aggregateId }).build();

      // Assert
      expect(builtAggregate.getId()).toBe(aggregateId);
      expect(builtAggregate.getVersion()).toBe(0);
      expect(builtAggregate.hasChanges()).toBe(false);
    });

    it('should create aggregate with all capabilities using builder', () => {
      // Arrange & Act
      const builtAggregate = AggregateBuilder.create({ id: aggregateId })
        .withSnapshots()
        .withVersioning()
        .withAudit()
        .withEventSourcing()
        .build();

      // Assert
      expect(builtAggregate.hasCapability('snapshot')).toBe(true);
      expect(builtAggregate.hasCapability('versioning')).toBe(true);
      expect(builtAggregate.hasCapability('audit')).toBe(true);
      expect(builtAggregate.hasCapability('eventSourcing')).toBe(true);
      expect(getAggregateCapabilities(builtAggregate)).toHaveLength(4);
    });

    it('should create test aggregate with all capabilities', () => {
      // Arrange & Act
      const testAggregate = AggregateTestBuilder.forTesting(aggregateId)
        .withAllCapabilities()
        .build();

      // Assert
      expect(testAggregate.hasCapability('snapshot')).toBe(true);
      expect(testAggregate.hasCapability('versioning')).toBe(true);
      expect(testAggregate.hasCapability('audit')).toBe(true);
      expect(testAggregate.hasCapability('eventSourcing')).toBe(true);
    });

    it('should create test aggregate with testing capabilities only', () => {
      // Arrange & Act
      const testAggregate = AggregateTestBuilder.forTesting(aggregateId)
        .withTestingCapabilities()
        .build();

      // Assert
      expect(testAggregate.hasCapability('audit')).toBe(true);
      expect(testAggregate.hasCapability('snapshot')).toBe(false);
      expect(testAggregate.hasCapability('versioning')).toBe(false);
      expect(testAggregate.hasCapability('eventSourcing')).toBe(false);
    });

    it('should allow custom capability registration', () => {
      // Arrange
      const customCapability = new AuditCapability();

      // Act
      const builtAggregate = AggregateBuilder.create({ id: aggregateId })
        .withCustomCapability('customAudit', customCapability)
        .build();

      // Assert
      expect(builtAggregate.hasCapability('customAudit')).toBe(true);
      expect(builtAggregate.getCapability('customAudit')).toBe(customCapability);
    });
  });

  describe('Aggregate Utilities Tests', () => {
    it('should correctly identify aggregate capabilities', () => {
      // Arrange
      const snapshotCap = new SnapshotCapability<TestAggregateState>();
      const auditCap = new AuditCapability();

      aggregate.addCapability('snapshot', snapshotCap);
      aggregate.addCapability('audit', auditCap);

      // Act
      const capabilities = getAggregateCapabilities(aggregate);

      // Assert
      expect(capabilities).toContain('snapshot');
      expect(capabilities).toContain('audit');
      expect(capabilities).toHaveLength(2);
    });

    it('should create snapshot when capability exists', () => {
      // Arrange
      const snapshotCap = new SnapshotCapability<TestAggregateState>();
      aggregate.addCapability('snapshot', snapshotCap);
      aggregate.changeName('Test Name');

      // Act
      const snapshot = createSnapshotIfCapable(aggregate, () => aggregate.serializeState());

      // Assert
      expect(snapshot).not.toBeNull();
      expect(snapshot?.id).toBe(aggregateId.getValue());
      expect(snapshot?.state.name).toBe('Test Name');
    });

    it('should return null when snapshot capability does not exist', () => {
      // Arrange
      aggregate.changeName('Test Name');

      // Act
      const snapshot = createSnapshotIfCapable(aggregate, () => aggregate.serializeState());

      // Assert
      expect(snapshot).toBeNull();
    });

    it('should throw error when casting to capability that does not exist', () => {
      // Arrange - aggregate without snapshot capability

      // Act & Assert
      const [error] = safeRun(() => asSnapshotAggregate(aggregate));
      expect(error).toBeInstanceOf(AggregateError);
      expect(error?.message).toMatch(/Feature.*not enabled/);
    });

    it('should successfully cast when capability exists', () => {
      // Arrange
      const snapshotCap = new SnapshotCapability<TestAggregateState>();
      aggregate.addCapability('snapshot', snapshotCap);

      // Act
      const snapshotAggregate = asSnapshotAggregate(aggregate);

      // Assert
      expect(snapshotAggregate).toBeDefined();
      expect(snapshotAggregate.getCapability('snapshot')).toBe(snapshotCap);
    });
  });

  describe('Complex scenarios', () => {
    it('should work correctly with multiple capabilities enabled', () => {
      // Arrange
      const snapshotCap = new SnapshotCapability<TestAggregateState>();
      const versioningCap = new VersioningCapability();
      const auditCap = new AuditCapability();

      aggregate.addCapability('snapshot', snapshotCap);
      aggregate.addCapability('versioning', versioningCap);
      aggregate.addCapability('audit', auditCap);

      // Act - Apply events
      aggregate.changeName('Complex Test');
      aggregate.addItem('Item 1');
      aggregate.addItem('Item 2');

      // Act - Create snapshot
      const snapshotAggregate = asSnapshotAggregate(aggregate);
      const snapshot = snapshotAggregate
        .getCapability('snapshot')
        .createSnapshot(() => aggregate.serializeState());

      // Arrange - Create new aggregate
      const newAggregate = new TestAggregate({ id: aggregateId });
      newAggregate.addCapability('snapshot', new SnapshotCapability<TestAggregateState>());
      newAggregate.addCapability('versioning', new VersioningCapability());
      newAggregate.addCapability('audit', new AuditCapability());

      // Act - Restore from snapshot
      const newSnapshotAggregate = asSnapshotAggregate(newAggregate);
      newSnapshotAggregate
        .getCapability('snapshot')
        .restoreFromSnapshot(snapshot, state => newAggregate.deserializeState(state));

      // Assert - Verify state
      expect(newAggregate.name).toBe('Complex Test');
      expect(newAggregate.items).toEqual(['Item 1', 'Item 2']);
      expect(newAggregate.getVersion()).toBe(3);

      // Act - Add new events
      newAggregate.changeName('Updated Name');
      newAggregate.addItem('Item 3');

      // Assert - Verify final state
      expect(newAggregate.name).toBe('Updated Name');
      expect(newAggregate.items).toEqual(['Item 1', 'Item 2', 'Item 3']);
      expect(newAggregate.getVersion()).toBe(5);
    });

    it('should correctly load data from history and create snapshot', () => {
      // Arrange
      const snapshotCap = new SnapshotCapability<TestAggregateState>();
      aggregate.addCapability('snapshot', snapshotCap);

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
      const snapshotAggregate = asSnapshotAggregate(aggregate);
      const snapshot = snapshotAggregate
        .getCapability('snapshot')
        .createSnapshot(() => aggregate.serializeState());

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
});
