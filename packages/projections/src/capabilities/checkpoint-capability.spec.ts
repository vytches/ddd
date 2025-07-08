/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { IExtendedDomainEvent } from '@vytches-ddd/contracts';
import { CheckpointCapability } from './checkpoint-capability';
import type {
  ICapabilityContext,
  IProjectionCheckpointStore,
  IProjectionCheckpoint,
} from '../projection-interfaces';

// Mock store implementation
class MockCheckpointStore implements IProjectionCheckpointStore {
  private checkpoints = new Map<string, IProjectionCheckpoint<any>>();

  async save<TState>(
    projectionName: string,
    checkpoint: Omit<IProjectionCheckpoint<TState>, 'projectionName'>
  ): Promise<void> {
    this.checkpoints.set(projectionName, {
      projectionName,
      ...checkpoint,
    });
  }

  async load<TState>(projectionName: string): Promise<IProjectionCheckpoint<TState> | null> {
    return this.checkpoints.get(projectionName) || null;
  }

  async delete(projectionName: string): Promise<void> {
    this.checkpoints.delete(projectionName);
  }

  // Helper for testing
  getCheckpoints(): Map<string, IProjectionCheckpoint<any>> {
    return this.checkpoints;
  }

  clear(): void {
    this.checkpoints.clear();
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

  async executeHooks(hookName: string, ...args: any[]): Promise<void> {
    // Mock hook execution
  }
}

describe('CheckpointCapability', () => {
  let capability: CheckpointCapability<any>;
  let store: MockCheckpointStore;
  let context: MockContext;

  const createMockEvent = (position = 100): IExtendedDomainEvent => ({
    eventType: 'TestEvent',
    payload: { data: 'test' },
    metadata: {
      aggregateId: 'test-123',
      eventVersion: 1,
      aggregateType: 'TestAggregate',
      eventId: 'event-123',
      timestamp: new Date(),
      position,
    },
  });

  beforeEach(() => {
    store = new MockCheckpointStore();
    context = new MockContext('TestProjection');
    capability = new CheckpointCapability(store, 3); // Checkpoint every 3 events
    capability.attach(context);
  });

  describe('initialization', () => {
    it('should initialize with correct name and interval', () => {
      expect(capability.type).toBe('checkpoint');
    });

    it('should throw error for invalid interval', () => {
      expect(() => new CheckpointCapability(store, 0)).toThrow(
        'checkpoint capability: interval must be positive'
      );
      expect(() => new CheckpointCapability(store, -1)).toThrow(
        'checkpoint capability: interval must be positive'
      );
    });

    it('should use default interval when not specified', () => {
      const defaultCapability = new CheckpointCapability(store);
      expect(defaultCapability.type).toBe('checkpoint');
    });
  });

  describe('checkpoint creation', () => {
    it('should create checkpoint after specified interval', async () => {
      // Arrange
      const state = { id: 'test', version: 1 };
      const event = createMockEvent(100);

      // Act - process 3 events to reach interval
      await capability.onAfterApply(state, event);
      await capability.onAfterApply(state, event);
      await capability.onAfterApply(state, event);

      // Assert
      const checkpoint = await store.load('TestProjection');
      expect(checkpoint).toBeDefined();
      expect(checkpoint!.state).toEqual(state);
      expect(checkpoint!.position).toBe(100);
      expect(checkpoint!.eventCount).toBe(3);
      expect(checkpoint!.timestamp).toBeInstanceOf(Date);
    });

    it('should not create checkpoint before interval is reached', async () => {
      // Arrange
      const state = { id: 'test', version: 1 };
      const event = createMockEvent(50);

      // Act - process only 2 events (interval is 3)
      await capability.onAfterApply(state, event);
      await capability.onAfterApply(state, event);

      // Assert
      const checkpoint = await store.load('TestProjection');
      expect(checkpoint).toBeNull();
    });

    it('should reset counter after creating checkpoint', async () => {
      // Arrange
      const state = { id: 'test', version: 1 };
      const event = createMockEvent(100);

      // Act - create first checkpoint
      await capability.onAfterApply(state, event);
      await capability.onAfterApply(state, event);
      await capability.onAfterApply(state, event);

      // Process 2 more events (should not create another checkpoint yet)
      const newState = { id: 'test', version: 2 };
      await capability.onAfterApply(newState, createMockEvent(101));
      await capability.onAfterApply(newState, createMockEvent(102));

      // Assert - should still have the first checkpoint
      const checkpoint = await store.load('TestProjection');
      expect(checkpoint!.eventCount).toBe(3);
      expect(checkpoint!.position).toBe(100);
    });

    it('should handle events without position metadata', async () => {
      // Arrange
      const state = { id: 'test', version: 1 };
      const eventWithoutPosition: IExtendedDomainEvent = {
        eventType: 'TestEvent',
        payload: { data: 'test' },
        metadata: {
          eventVersion: 1,
          aggregateType: 'TestAggregate',
          aggregateId: 'test-123',
          eventId: 'event-123',
          timestamp: new Date(),
        },
      };

      // Act
      for (let i = 0; i < 3; i++) {
        await capability.onAfterApply(state, eventWithoutPosition);
      }

      // Assert
      const checkpoint = await store.load('TestProjection');
      expect(checkpoint!.position).toBe(0); // Default position
    });
  });

  describe('checkpoint loading', () => {
    it('should load existing checkpoint', async () => {
      // Arrange
      const expectedState = { id: 'test', version: 5 };
      const expectedPosition = 250;

      await store.save('TestProjection', {
        state: expectedState,
        position: expectedPosition,
        timestamp: new Date(),
        eventCount: 15,
      });

      // Act
      const result = await capability.loadCheckpoint();

      // Assert
      expect(result).toBeDefined();
      expect(result!.state).toEqual(expectedState);
      expect(result!.position).toBe(expectedPosition);
    });

    it('should return null when no checkpoint exists', async () => {
      // Act
      const result = await capability.loadCheckpoint();

      // Assert
      expect(result).toBeNull();
    });

    it('should throw error when not attached to context', async () => {
      // Arrange
      const unattachedCapability = new CheckpointCapability(store);

      // Act & Assert
      await expect(unattachedCapability.loadCheckpoint()).rejects.toThrow();
    });
  });

  describe('error handling', () => {
    it('should handle store errors gracefully during save', async () => {
      // Arrange
      const failingStore = new MockCheckpointStore();
      vi.spyOn(failingStore, 'save').mockRejectedValue(new Error('Store error'));

      const failingCapability = new CheckpointCapability(failingStore, 1);
      failingCapability.attach(context);

      const state = { id: 'test', version: 1 };
      const event = createMockEvent(100);

      // Act & Assert
      await expect(failingCapability.onAfterApply(state, event)).rejects.toThrow('Store error');
    });

    it('should handle store errors gracefully during load', async () => {
      // Arrange
      const failingStore = new MockCheckpointStore();
      vi.spyOn(failingStore, 'load').mockRejectedValue(new Error('Load error'));

      const failingCapability = new CheckpointCapability(failingStore);
      failingCapability.attach(context);

      // Act & Assert
      await expect(failingCapability.loadCheckpoint()).rejects.toThrow('Load error');
    });

    it('should throw error when handling interval without attachment', async () => {
      // Arrange
      const unattachedCapability = new CheckpointCapability(store, 1);
      const state = { id: 'test', version: 1 };
      const event = createMockEvent(100);

      // Act & Assert
      await expect(unattachedCapability.onAfterApply(state, event)).rejects.toThrow();
    });
  });

  describe('lifecycle', () => {
    it('should attach and detach properly', () => {
      // Arrange
      const newCapability = new CheckpointCapability(store);

      // Act
      newCapability.attach(context);

      // Assert - should not throw when attached
      expect(() => newCapability.loadCheckpoint()).not.toThrow();

      // Act
      newCapability.detach();

      // Assert - should throw when detached
      expect(() => newCapability.loadCheckpoint()).rejects.toThrow();
    });
  });

  describe('integration scenarios', () => {
    it('should handle rapid event processing', async () => {
      // Arrange
      const state = { id: 'test', version: 1 };
      const events = Array.from({ length: 10 }, (_, i) => createMockEvent(i + 1));

      // Act
      for (const event of events) {
        await capability.onAfterApply(state, event);
      }

      // Assert - should have created 3 checkpoints (at positions 3, 6, 9)
      const checkpoint = await store.load('TestProjection');
      expect(checkpoint).toBeDefined();
      expect(checkpoint!.position).toBe(9); // Last checkpoint position
    });

    it('should handle concurrent checkpoint operations', async () => {
      // Arrange
      const capability1 = new CheckpointCapability(store, 1);
      const capability2 = new CheckpointCapability(store, 1);
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
      const checkpoint1 = await store.load('Projection1');
      const checkpoint2 = await store.load('Projection2');

      expect(checkpoint1).toBeDefined();
      expect(checkpoint2).toBeDefined();
      expect(checkpoint1!.projectionName).toBe('Projection1');
      expect(checkpoint2!.projectionName).toBe('Projection2');
    });

    it('should handle complex state objects', async () => {
      // Arrange
      const complexState = {
        id: 'complex-test',
        nested: {
          data: ['item1', 'item2'],
          metadata: { version: 1, tags: ['tag1', 'tag2'] },
        },
        timestamps: {
          created: new Date('2023-01-01'),
          updated: new Date('2023-01-02'),
        },
      };
      const event = createMockEvent(500);

      // Act
      for (let i = 0; i < 3; i++) {
        await capability.onAfterApply(complexState, event);
      }

      // Assert
      const checkpoint = await store.load('TestProjection');
      expect(checkpoint!.state).toEqual(complexState);
      expect((checkpoint as any)!.state?.nested.data).toEqual(['item1', 'item2']);
    });
  });
});
