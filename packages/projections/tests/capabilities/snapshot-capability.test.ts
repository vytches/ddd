import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { IDomainEvent } from '@vytches/ddd-contracts';
import { safeRun } from '@vytches/ddd-utils';
import { SnapshotProjectionCapability } from '../../src';
import type {
  ICapabilityContext,
  IProjectionSnapshotStore,
  IProjectionSnapshot,
} from '../../src/projection-interfaces';

// Mock store implementation
class MockSnapshotStore implements IProjectionSnapshotStore {
  private snapshots = new Map<string, IProjectionSnapshot<any>[]>();

  async save<TState>(
    projectionName: string,
    snapshot: Omit<IProjectionSnapshot<TState>, 'projectionName'>
  ): Promise<void> {
    if (!this.snapshots.has(projectionName)) {
      this.snapshots.set(projectionName, []);
    }

    const snapshots = this.snapshots.get(projectionName)!;
    snapshots.push({
      projectionName,
      ...snapshot,
    });
  }

  async load<TState>(projectionName: string): Promise<IProjectionSnapshot<TState> | null> {
    const snapshots = this.snapshots.get(projectionName);
    return snapshots && snapshots.length > 0 ? snapshots[0]! : null;
  }

  async loadLatest<TState>(projectionName: string): Promise<IProjectionSnapshot<TState> | null> {
    const snapshots = this.snapshots.get(projectionName);
    return snapshots && snapshots.length > 0 ? snapshots[snapshots.length - 1]! : null;
  }

  async delete(projectionName: string): Promise<void> {
    this.snapshots.delete(projectionName);
  }

  async deleteOlderThan(projectionName: string, date: Date): Promise<number> {
    const snapshots = this.snapshots.get(projectionName);
    if (!snapshots) return 0;

    const initialCount = snapshots.length;
    const filtered = snapshots.filter(s => s.timestamp > date);
    this.snapshots.set(projectionName, filtered);

    return initialCount - filtered.length;
  }

  // Helper for testing
  getSnapshots(projectionName: string): IProjectionSnapshot<any>[] {
    return this.snapshots.get(projectionName) || [];
  }

  getAllSnapshots(): Map<string, IProjectionSnapshot<any>[]> {
    return this.snapshots;
  }

  clear(): void {
    this.snapshots.clear();
  }
}

// Mock context implementation
class MockContext implements ICapabilityContext<any> {
  constructor(private projectionName: string) {}

  getProjectionName(): string {
    return this.projectionName;
  }

  getStore(): any {
    return null;
  }

  async executeHooks(_hookName: string, ..._args: any[]): Promise<void> {
    // Mock hook execution
  }
}

describe('SnapshotProjectionCapability', () => {
  let capability: SnapshotProjectionCapability<any>;
  let store: MockSnapshotStore;
  let context: MockContext;

  const createMockEvent = (position = 100): IDomainEvent => ({
    eventName: 'TestEvent',
    payload: { data: 'test' },
    metadata: {
      eventId: 'event-123',
      timestamp: new Date(),
      aggregateId: 'test-123',
      aggregateType: 'TestAggregate',
      eventVersion: 1,
      position,
    },
  });

  beforeEach(() => {
    store = new MockSnapshotStore();
    context = new MockContext('TestProjection');
    capability = new SnapshotProjectionCapability(store, 3); // Snapshot every 3 events
    capability.attach(context);
  });

  describe('initialization', () => {
    it('should initialize with correct name and interval', () => {
      expect(capability.type).toBe('snapshot');
    });

    it('should throw error for invalid interval', () => {
      const [zeroError] = safeRun(() => new SnapshotProjectionCapability(store, 0));
      expect(zeroError?.message).toBe('snapshot capability: interval must be positive');

      const [negativeError] = safeRun(() => new SnapshotProjectionCapability(store, -1));
      expect(negativeError?.message).toBe('snapshot capability: interval must be positive');
    });

    it('should use default interval when not specified', () => {
      const defaultCapability = new SnapshotProjectionCapability(store);
      expect(defaultCapability.type).toBe('snapshot');
    });
  });

  describe('snapshot creation', () => {
    it('should create snapshot after specified interval', async () => {
      // Arrange
      const state = { id: 'test', version: 1, data: 'test-data' };
      const event = createMockEvent(100);

      // Act - process 3 events to reach interval
      await capability.onAfterApply(state, event);
      await capability.onAfterApply(state, event);
      await capability.onAfterApply(state, event);

      // Assert
      const snapshot = await store.loadLatest('TestProjection');
      expect(snapshot).toBeDefined();
      expect(snapshot!.state).toEqual(state);
      expect(snapshot!.position).toBe(100);
      expect(snapshot!.version).toBe(1);
      expect(snapshot!.timestamp).toBeInstanceOf(Date);
      expect(snapshot!.metadata?.eventCount).toBe(3);
    });

    it('should not create snapshot before interval is reached', async () => {
      // Arrange
      const state = { id: 'test', version: 1 };
      const event = createMockEvent(50);

      // Act - process only 2 events (interval is 3)
      await capability.onAfterApply(state, event);
      await capability.onAfterApply(state, event);

      // Assert
      const snapshot = await store.loadLatest('TestProjection');
      expect(snapshot).toBeNull();
    });

    it('should increment version with each snapshot', async () => {
      // Arrange
      const state = { id: 'test', version: 1 };
      const event = createMockEvent(100);

      // Act - create multiple snapshots
      for (let i = 0; i < 6; i++) {
        await capability.onAfterApply(state, event);
      }

      // Assert
      const snapshots = store.getSnapshots('TestProjection');
      expect(snapshots).toHaveLength(2); // Two snapshots created
      expect(snapshots[0]!.version).toBe(1);
      expect(snapshots[1]!.version).toBe(2);
    });

    it('should reset counter after creating snapshot', async () => {
      // Arrange
      const state = { id: 'test', version: 1 };
      const event = createMockEvent(100);

      // Act - create first snapshot
      await capability.onAfterApply(state, event);
      await capability.onAfterApply(state, event);
      await capability.onAfterApply(state, event);

      // Process 2 more events (should not create another snapshot yet)
      const newState = { id: 'test', version: 2 };
      await capability.onAfterApply(newState, createMockEvent(101));
      await capability.onAfterApply(newState, createMockEvent(102));

      // Assert - should still have only one snapshot
      const snapshots = store.getSnapshots('TestProjection');
      expect(snapshots).toHaveLength(1);
      expect(snapshots[0]!.version).toBe(1);
    });

    it('should handle events without position metadata', async () => {
      // Arrange
      const state = { id: 'test', version: 1 };
      const eventWithoutPosition: IDomainEvent = {
        eventName: 'TestEvent',
        payload: { data: 'test' },
        metadata: {
          eventId: 'event-123',
          timestamp: new Date(),
          aggregateId: 'test-123',
          aggregateType: 'TestAggregate',
          eventVersion: 1,
        },
      };

      // Act
      for (let i = 0; i < 3; i++) {
        await capability.onAfterApply(state, eventWithoutPosition);
      }

      // Assert
      const snapshot = await store.loadLatest('TestProjection');
      expect(snapshot!.position).toBe(0); // Default position
    });
  });

  describe('snapshot loading', () => {
    it('should load latest snapshot', async () => {
      // Arrange
      const state1 = { id: 'test', version: 1 };
      const state2 = { id: 'test', version: 2 };

      // Create multiple snapshots
      await store.save('TestProjection', {
        state: state1,
        position: 100,
        timestamp: new Date('2023-01-01'),
        version: 1,
      });

      await store.save('TestProjection', {
        state: state2,
        position: 200,
        timestamp: new Date('2023-01-02'),
        version: 2,
      });

      // Act
      const result = await capability.loadLatestSnapshot();

      // Assert
      expect(result).toBeDefined();
      expect(result!.state).toEqual(state2);
      expect(result!.position).toBe(200);
    });

    it('should return null when no snapshot exists', async () => {
      // Act
      const result = await capability.loadLatestSnapshot();

      // Assert
      expect(result).toBeNull();
    });

    it('should update internal version when loading snapshot', async () => {
      // Arrange
      await store.save('TestProjection', {
        state: { id: 'test', version: 5 },
        position: 500,
        timestamp: new Date(),
        version: 10,
      });

      // Act
      const result = await capability.loadLatestSnapshot();

      // Assert
      expect(result!.state.version).toBe(5);

      // Create new snapshot - version should continue from loaded version
      const state = { id: 'test', version: 6 };
      const event = createMockEvent(600);

      for (let i = 0; i < 3; i++) {
        await capability.onAfterApply(state, event);
      }

      const newSnapshot = await store.loadLatest('TestProjection');
      expect(newSnapshot!.version).toBe(11); // 10 + 1
    });

    it('should throw error when not attached to context', async () => {
      // Arrange
      const unattachedCapability = new SnapshotProjectionCapability(store);

      // Act & Assert
      const [error] = await safeRun(() => unattachedCapability.loadLatestSnapshot());
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('error handling', () => {
    it('should handle store errors gracefully during save', async () => {
      // Arrange
      const failingStore = new MockSnapshotStore();
      vi.spyOn(failingStore, 'save').mockRejectedValue(new Error('Store error'));

      const failingCapability = new SnapshotProjectionCapability(failingStore, 1);
      failingCapability.attach(context);

      const state = { id: 'test', version: 1 };
      const event = createMockEvent(100);

      // Act & Assert
      const [error] = await safeRun(() => failingCapability.onAfterApply(state, event));
      expect(error).toBeInstanceOf(Error);
      expect(error!.message).toBe('Store error');
    });

    it('should handle store errors gracefully during load', async () => {
      // Arrange
      const failingStore = new MockSnapshotStore();
      vi.spyOn(failingStore, 'loadLatest').mockRejectedValue(new Error('Load error'));

      const failingCapability = new SnapshotProjectionCapability(failingStore);
      failingCapability.attach(context);

      // Act & Assert
      const [error] = await safeRun(() => failingCapability.loadLatestSnapshot());
      expect(error).toBeInstanceOf(Error);
      expect(error!.message).toBe('Load error');
    });

    it('should throw error when handling interval without attachment', async () => {
      // Arrange
      const unattachedCapability = new SnapshotProjectionCapability(store, 1);
      const state = { id: 'test', version: 1 };
      const event = createMockEvent(100);

      // Act & Assert
      const [error] = await safeRun(() => unattachedCapability.onAfterApply(state, event));
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('lifecycle', () => {
    it('should attach and detach properly', async () => {
      // Arrange
      const newCapability = new SnapshotProjectionCapability(store);

      // Act
      newCapability.attach(context);

      // Assert - should not throw when attached
      const [attachError] = await safeRun(() => newCapability.loadLatestSnapshot());
      expect(attachError).toBeUndefined();

      // Act
      newCapability.detach();

      // Assert - should throw when detached
      const [detachError] = await safeRun(() => newCapability.loadLatestSnapshot());
      expect(detachError).toBeInstanceOf(Error);
    });
  });

  describe('integration scenarios', () => {
    it('should handle rapid snapshot creation', async () => {
      // Arrange
      const states = Array.from({ length: 10 }, (_, i) => ({
        id: 'test',
        version: i + 1,
        data: `data-${i}`,
      }));
      const events = Array.from({ length: 10 }, (_, i) => createMockEvent(i + 1));

      // Act
      for (let i = 0; i < 10; i++) {
        await capability.onAfterApply(states[i]!, events[i]!);
      }

      // Assert - should have created 3 snapshots (at events 3, 6, 9)
      const snapshots = store.getSnapshots('TestProjection');
      expect(snapshots).toHaveLength(3);
      expect(snapshots[0]!.version).toBe(1);
      expect(snapshots[1]!.version).toBe(2);
      expect(snapshots[2]!.version).toBe(3);
    });

    it('should handle concurrent snapshot operations for different projections', async () => {
      // Arrange
      const capability1 = new SnapshotProjectionCapability(store, 1);
      const capability2 = new SnapshotProjectionCapability(store, 1);
      const context1 = new MockContext('Projection1');
      const context2 = new MockContext('Projection2');

      capability1.attach(context1);
      capability2.attach(context2);

      const state = { id: 'test', version: 1 };
      const event = createMockEvent(100);

      // Act
      await Promise.all([
        capability1.onAfterApply(state, event),
        capability2.onAfterApply(state, event),
      ]);

      // Assert
      const snapshot1 = await store.loadLatest('Projection1');
      const snapshot2 = await store.loadLatest('Projection2');

      expect(snapshot1).toBeDefined();
      expect(snapshot2).toBeDefined();
      expect(snapshot1!.projectionName).toBe('Projection1');
      expect(snapshot2!.projectionName).toBe('Projection2');
    });

    it('should handle complex state objects with nested data', async () => {
      // Arrange
      const complexState = {
        id: 'complex-test',
        userData: {
          profile: {
            name: 'John Doe',
            email: 'john@example.com',
            preferences: {
              theme: 'dark',
              notifications: ['email', 'push'],
            },
          },
          activity: {
            lastLogin: new Date('2023-01-01'),
            sessionCount: 15,
            features: new Set(['feature1', 'feature2']),
          },
        },
        metadata: {
          version: 1,
          tags: ['user', 'active'],
          timestamps: {
            created: new Date('2022-12-01'),
            updated: new Date('2023-01-01'),
          },
        },
      };
      const event = createMockEvent(500);

      // Act
      for (let i = 0; i < 3; i++) {
        await capability.onAfterApply(complexState, event);
      }

      // Assert
      const snapshot = await store.loadLatest('TestProjection');
      expect(snapshot!.state).toEqual(complexState);
      expect((snapshot!.state as any).userData.profile.name).toBe('John Doe');
      expect((snapshot!.state as any).metadata.tags).toEqual(['user', 'active']);
    });

    it('should maintain snapshot history', async () => {
      // Arrange
      const states = [
        { id: 'test', version: 1, status: 'active' },
        { id: 'test', version: 2, status: 'inactive' },
        { id: 'test', version: 3, status: 'archived' },
      ];
      const event = createMockEvent(100);

      // Act - create snapshots at different intervals
      for (let stateIndex = 0; stateIndex < states.length; stateIndex++) {
        for (let i = 0; i < 3; i++) {
          await capability.onAfterApply(states[stateIndex], event);
        }
      }

      // Assert
      const snapshots = store.getSnapshots('TestProjection');
      expect(snapshots).toHaveLength(3);

      expect((snapshots[0]!.state as any).status).toBe('active');
      expect((snapshots[1]!.state as any).status).toBe('inactive');
      expect((snapshots[2]!.state as any).status).toBe('archived');

      expect(snapshots[0]!.version).toBe(1);
      expect(snapshots[1]!.version).toBe(2);
      expect(snapshots[2]!.version).toBe(3);
    });

    it('should handle snapshot loading edge cases', async () => {
      // Arrange - create snapshot without version
      await store.save('TestProjection', {
        state: { id: 'test', version: 1 },
        position: 100,
        timestamp: new Date(),
        // version is optional and not provided
      });

      // Act
      const result = await capability.loadLatestSnapshot();

      // Assert - should handle missing version gracefully
      expect(result).toBeDefined();
      expect(result!.state.version).toBe(1);

      // Create new snapshot - should use default version of 0 + 1
      const state = { id: 'test', version: 2 };
      const event = createMockEvent(200);

      for (let i = 0; i < 3; i++) {
        await capability.onAfterApply(state, event);
      }

      const newSnapshot = await store.loadLatest('TestProjection');
      expect(newSnapshot!.version).toBe(1); // 0 (default from missing version) + 1
    });
  });
});
