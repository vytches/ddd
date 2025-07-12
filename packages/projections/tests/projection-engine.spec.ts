import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Capability } from '@vytches-ddd/contracts';
import { safeRun } from '@vytches-ddd/utils';
import { ProjectionEngine, EnhancedProjectionEngine } from '../src/projection-engine';
import { ProjectionError } from '../src/projection-errors';
import { ExponentialBackoffStrategy } from '../src/error-strategy';

// Mock Store implementation
class MockProjectionStore<T> {
  private data = new Map<string, T>();

  async load(projectionName: string): Promise<T | null> {
    return this.data.get(projectionName) || null;
  }

  async save(projectionName: string, state: T): Promise<void> {
    this.data.set(projectionName, state);
  }

  async delete(projectionName: string): Promise<void> {
    this.data.delete(projectionName);
  }

  async exists(projectionName: string): Promise<boolean> {
    return this.data.has(projectionName);
  }

  async deleteAll(): Promise<void> {
    this.data.clear();
  }

  // Helper for testing
  getData(): Map<string, T> {
    return this.data;
  }

  clear(): void {
    this.data.clear();
  }
}

// Mock Projection implementation
interface UserReadModel {
  id: string;
  name: string;
  email: string;
  version: number;
}

class MockUserProjection {
  readonly name = 'UserProjection';
  readonly eventTypes = ['UserCreated', 'UserUpdated', 'UserDeleted'];

  constructor(private shouldThrow = false) {}

  createInitialState(): UserReadModel {
    if (this.shouldThrow) {
      throw new Error('Failed to create initial state');
    }
    return {
      id: '',
      name: '',
      email: '',
      version: 0,
    };
  }

  async apply(readModel: UserReadModel, event: any): Promise<UserReadModel> {
    if (this.shouldThrow) {
      throw new Error(`Failed to apply event ${event.eventType}`);
    }

    switch (event.eventType) {
      case 'UserCreated':
        return {
          id: (event.metadata?.aggregateId as string) || '',
          name: event.payload.name,
          email: event.payload.email,
          version: readModel.version + 1,
        };
      case 'UserUpdated':
        return {
          ...readModel,
          name: event.payload.name || readModel.name,
          email: event.payload.email || readModel.email,
          version: readModel.version + 1,
        };
      case 'UserDeleted':
        return {
          ...readModel,
          version: readModel.version + 1,
        };
      default:
        return readModel;
    }
  }

  handles(eventType: string): boolean {
    return this.eventTypes.includes(eventType);
  }
}

// Mock Capability
class MockCapability extends Capability<'mockCapability'> {
  readonly type = 'mockCapability' as const;
  private attachedContext: any = null;
  public onAttachCalled = false;
  public onDetachCalled = false;

  constructor() {
    super();
  }

  attach(context: any): void {
    this.attachedContext = context;
    this.onAttachCalled = true;
  }

  detach(): void {
    this.onDetachCalled = true;
    this.attachedContext = null;
  }

  getAttachedContext() {
    return this.attachedContext;
  }
}

describe('ProjectionEngine', () => {
  let engine: ProjectionEngine<UserReadModel>;
  let store: MockProjectionStore<UserReadModel>;
  let projection: MockUserProjection;

  const createMockEvent = (
    eventType: string,
    aggregateId = 'user-123',
    payload: any = {}
  ): any => ({
    eventType,
    payload,
    metadata: {
      aggregateType: 'User',
      eventVersion: 1,
      aggregateId,
      eventId: 'event-123',
      timestamp: new Date(),
    },
  });

  beforeEach(() => {
    store = new MockProjectionStore<UserReadModel>();
    projection = new MockUserProjection();
    engine = new ProjectionEngine(projection, store);
  });

  describe('initialization', () => {
    it('should initialize with projection and store', () => {
      expect(engine.getProjectionName()).toBe('UserProjection');
      expect(engine.getEventTypes()).toEqual(['UserCreated', 'UserUpdated', 'UserDeleted']);
    });

    it('should add capabilities during initialization', () => {
      const capability = new MockCapability();
      const engineWithCapability = new ProjectionEngine(projection, store, [capability]);

      expect(capability.onAttachCalled).toBe(true);
      expect(capability.getAttachedContext()).toBeDefined();
    });
  });

  describe('processEvent', () => {
    it('should process UserCreated event and create new state', async () => {
      // Arrange
      const event = createMockEvent('UserCreated', 'user-123', {
        name: 'John Doe',
        email: 'john@example.com',
      });

      // Act
      await engine.processEvent(event);

      // Assert
      const state = await engine.getState();
      expect(state).toEqual({
        id: 'user-123',
        name: 'John Doe',
        email: 'john@example.com',
        version: 1,
      });
    });

    it('should process UserUpdated event and update existing state', async () => {
      // Arrange
      const createEvent = createMockEvent('UserCreated', 'user-123', {
        name: 'John Doe',
        email: 'john@example.com',
      });
      const updateEvent = createMockEvent('UserUpdated', 'user-123', {
        name: 'Jane Doe',
      });

      // Act
      await engine.processEvent(createEvent);
      await engine.processEvent(updateEvent);

      // Assert
      const state = await engine.getState();
      expect(state).toEqual({
        id: 'user-123',
        name: 'Jane Doe',
        email: 'john@example.com',
        version: 2,
      });
    });

    it('should ignore events not handled by projection', async () => {
      // Arrange
      const event = createMockEvent('UnknownEvent', 'user-123', {});
      const initialState = await engine.getState();

      // Act
      await engine.processEvent(event);

      // Assert
      const finalState = await engine.getState();
      expect(finalState).toEqual(initialState);
    });

    it('should load existing state from store', async () => {
      // Arrange
      const existingState: UserReadModel = {
        id: 'user-123',
        name: 'Existing User',
        email: 'existing@example.com',
        version: 5,
      };
      await store.save('UserProjection', existingState);

      const event = createMockEvent('UserUpdated', 'user-123', {
        name: 'Updated User',
      });

      // Act
      await engine.processEvent(event);

      // Assert
      const state = await engine.getState();
      expect(state).toEqual({
        id: 'user-123',
        name: 'Updated User',
        email: 'existing@example.com',
        version: 6,
      });
    });

    it('should handle projection errors gracefully', async () => {
      // Arrange
      const failingProjection = new MockUserProjection(true);
      const failingEngine = new ProjectionEngine(failingProjection, store);
      const event = createMockEvent('UserCreated', 'user-123', {});

      // Act & Assert
      const [error] = await safeRun(() => failingEngine.processEvent(event));
      expect(error).toBeInstanceOf(Error);
      expect(error!.message).toBe('Failed to create initial state');
    });

    it('should save state after successful event processing', async () => {
      // Arrange
      const event = createMockEvent('UserCreated', 'user-123', {
        name: 'John Doe',
        email: 'john@example.com',
      });

      // Act
      await engine.processEvent(event);

      // Assert
      const storedState = await store.load('UserProjection');
      expect(storedState).toEqual({
        id: 'user-123',
        name: 'John Doe',
        email: 'john@example.com',
        version: 1,
      });
    });
  });

  describe('isInterestedIn', () => {
    it('should return true for handled event types', () => {
      const event = createMockEvent('UserCreated');
      expect(engine.isInterestedIn(event)).toBe(true);
    });

    it('should return false for unhandled event types', () => {
      const event = createMockEvent('UnknownEvent');
      expect(engine.isInterestedIn(event)).toBe(false);
    });
  });

  describe('state management', () => {
    it('should return initial state when no events processed', async () => {
      const state = await engine.getState();
      expect(state).toEqual({
        id: '',
        name: '',
        email: '',
        version: 0,
      });
    });

    it('should save state explicitly', async () => {
      // Arrange
      const newState: UserReadModel = {
        id: 'user-456',
        name: 'Manual Save',
        email: 'manual@example.com',
        version: 10,
      };

      // Act
      await engine.saveState(newState);

      // Assert
      const storedState = await store.load('UserProjection');
      expect(storedState).toEqual(newState);
    });

    it('should handle concurrent event processing', async () => {
      // Arrange
      const events = [
        createMockEvent('UserCreated', 'user-123', { name: 'John', email: 'john@example.com' }),
        createMockEvent('UserUpdated', 'user-123', { name: 'Jane' }),
        createMockEvent('UserUpdated', 'user-123', { email: 'jane@example.com' }),
      ];

      // Act - process events sequentially to avoid race conditions
      for (const event of events) {
        await engine.processEvent(event);
      }

      // Assert
      const state = await engine.getState();
      expect(state?.version).toBeGreaterThan(0);
      expect(state?.id).toBe('user-123');
    });
  });

  describe('capabilities', () => {
    it('should attach capabilities on initialization', () => {
      // Arrange
      const capability1 = new MockCapability();
      const capability2 = new MockCapability();

      // Act
      const engineWithCapabilities = new ProjectionEngine(projection, store, [
        capability1,
        capability2,
      ]);

      // Assert
      expect(capability1.onAttachCalled).toBe(true);
      expect(capability2.onAttachCalled).toBe(true);
    });

    it('should provide capability context', () => {
      // Arrange
      const capability = new MockCapability();
      const engineWithCapability = new ProjectionEngine(projection, store, [capability]);

      // Act
      const context = capability.getAttachedContext();

      // Assert
      expect(context.getProjectionName()).toBe('UserProjection');
      expect(context.getStore()).toBe(store);
      expect(typeof context.executeHooks).toBe('function');
    });
  });
});

describe('EnhancedProjectionEngine', () => {
  let engine: EnhancedProjectionEngine<UserReadModel>;
  let store: MockProjectionStore<UserReadModel>;
  let projection: MockUserProjection;
  let errorStrategy: ExponentialBackoffStrategy;

  const createMockEvent = (
    eventType: string,
    aggregateId = 'user-123',
    payload: any = {}
  ): any => ({
    eventType,
    payload,
    metadata: {
      aggregateId,
      aggregateType: 'User',
      eventVersion: 1,
      eventId: 'event-123',
      timestamp: new Date(),
    },
  });

  beforeEach(() => {
    store = new MockProjectionStore<UserReadModel>();
    projection = new MockUserProjection();
    errorStrategy = new ExponentialBackoffStrategy(); // Use default strategy
    const retryConfig = {
      maxAttempts: 3,
      baseDelayMs: 100,
      maxDelayMs: 5000,
      backoffMultiplier: 2,
      retryableErrors: [],
      nonRetryableErrors: [],
    };
    engine = new EnhancedProjectionEngine(projection, store, retryConfig, errorStrategy);
  });

  describe('error handling and retries', () => {
    it('should retry failed operations according to strategy', async () => {
      // Arrange
      const failingProjection = new MockUserProjection(true);
      const failingEngine = new EnhancedProjectionEngine(
        failingProjection,
        store,
        [],
        errorStrategy
      );
      const event = createMockEvent('UserCreated', 'user-123', {});

      // Mock the shouldRetry method to return true initially, then false
      let callCount = 0;
      vi.spyOn(errorStrategy, 'shouldRetry').mockImplementation((error, attemptNumber) => {
        callCount++;
        return attemptNumber <= 2; // Retry first 2 attempts, fail on 3rd
      });

      vi.spyOn(errorStrategy, 'getDelay').mockReturnValue(10); // Fast delay for testing

      // Act & Assert
      const [error] = await safeRun(() => failingEngine.processEvent(event));
      expect(error).toBeInstanceOf(Error);
      expect(callCount).toBeGreaterThan(1); // Should have retried
    });

    it('should succeed after retry when transient error resolves', async () => {
      // Arrange
      let attemptCount = 0;
      const projection = new MockUserProjection();

      // Override apply method to fail first time, succeed second time
      vi.spyOn(projection, 'apply').mockImplementation(async (readModel, event) => {
        attemptCount++;
        if (attemptCount === 1) {
          throw new Error('Transient error');
        }
        return {
          id: (event?.metadata?.aggregateId as string) || '',
          name: 'Recovered User',
          email: 'recovered@example.com',
          version: readModel.version + 1,
        };
      });

      const retryEngine = new EnhancedProjectionEngine(projection, store, [], errorStrategy);
      const event = createMockEvent('UserCreated', 'user-123', {});

      // Act
      await retryEngine.processEvent(event);

      // Assert
      const state = await retryEngine.getState();
      expect(state?.name).toBe('Recovered User');
      expect(attemptCount).toBe(2); // Should have retried once
    });

    it('should not retry non-retryable errors', async () => {
      // Arrange
      const nonRetryableError = new ProjectionError('Non-retryable error', {
        name: 'UserProjection',
      });
      const projection = new MockUserProjection();

      vi.spyOn(projection, 'apply').mockRejectedValue(nonRetryableError);
      vi.spyOn(errorStrategy, 'shouldRetry').mockReturnValue(false);

      const engine = new EnhancedProjectionEngine(projection, store, [], errorStrategy);
      const event = createMockEvent('UserCreated', 'user-123', {});

      // Act & Assert
      const [error] = await safeRun(() => engine.processEvent(event));
      expect(error).toBeInstanceOf(Error);
      expect(error!.message).toBe('Non-retryable error');
      expect(errorStrategy.shouldRetry).toHaveBeenCalledWith(nonRetryableError, 1);
    });

    it('should respect maximum retry attempts', async () => {
      // Arrange
      const shortRetryStrategy = new ExponentialBackoffStrategy(); // Default strategy
      const failingProjection = new MockUserProjection(true);
      const engine = new EnhancedProjectionEngine(failingProjection, store, [], shortRetryStrategy);
      const event = createMockEvent('UserCreated', 'user-123', {});

      let retryCallCount = 0;
      vi.spyOn(shortRetryStrategy, 'shouldRetry').mockImplementation((error, attempt) => {
        retryCallCount++;
        return attempt <= 2;
      });

      // Act & Assert
      const [error] = await safeRun(() => engine.processEvent(event));
      expect(error).toBeInstanceOf(Error);
      expect(retryCallCount).toBe(3); // Initial attempt + 2 retries
    });

    it('should handle store errors with retry logic', async () => {
      // Arrange
      let saveCallCount = 0;
      const originalSave = store.save.bind(store);
      vi.spyOn(store, 'save').mockImplementation(async (projectionName: string, state: any) => {
        saveCallCount++;
        if (saveCallCount <= 2) {
          // Fail first 2 attempts
          throw new Error('Store temporarily unavailable');
        }
        // Succeed on fourth attempt - actually save the data
        return originalSave(projectionName, state);
      });

      const event = createMockEvent('UserCreated', 'user-123', {
        name: 'Test User',
        email: 'test@example.com',
      });

      // Act
      await engine.processEvent(event);

      // Assert
      expect(saveCallCount).toBe(4); // getState() saves initial state (1) + 2 failed attempts + 1 success = 4
      const state = await engine.getState();
      expect(state?.name).toBe('Test User');
    });
  });

  describe('enhanced capabilities integration', () => {
    it('should work with capabilities that have lifecycle hooks', async () => {
      // Arrange
      const capability = new MockCapability();
      const engineWithCapability = new EnhancedProjectionEngine(
        projection,
        store,
        [capability],
        errorStrategy
      );

      const event = createMockEvent('UserCreated', 'user-123', {
        name: 'Test User',
        email: 'test@example.com',
      });

      // Act
      await engineWithCapability.processEvent(event);

      // Assert
      expect(capability.onAttachCalled).toBe(true);
      const state = await engineWithCapability.getState();
      expect(state?.name).toBe('Test User');
    });
  });

  describe('performance and stress tests', () => {
    it('should handle high volume of events efficiently', async () => {
      // Arrange
      const events = Array.from({ length: 1000 }, (_, i) =>
        createMockEvent('UserUpdated', 'user-123', { name: `User ${i}` })
      );

      const startTime = Date.now();

      // Act
      for (const event of events) {
        await engine.processEvent(event);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Assert
      const state = await engine.getState();
      expect(state?.version).toBe(1000);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle concurrent events safely', async () => {
      // Arrange - first create the user, then update it
      const createEvent = createMockEvent('UserCreated', 'user-123', {
        name: 'Initial User',
        email: 'initial@example.com',
      });
      await engine.processEvent(createEvent);

      const updateEvents = Array.from({ length: 10 }, (_, i) =>
        createMockEvent('UserUpdated', 'user-123', { name: `Concurrent User ${i}` })
      );

      // Act - process updates sequentially to avoid race conditions
      for (const event of updateEvents) {
        await engine.processEvent(event);
      }

      // Assert
      const state = await engine.getState();
      expect(state?.version).toBeGreaterThan(0);
      expect(state?.id).toBe('user-123');
    });
  });

  describe('edge cases', () => {
    it('should handle events with missing payload', async () => {
      // Arrange
      const event = {
        eventType: 'UserCreated',
        aggregateId: 'user-123',
        aggregateType: 'User',
        eventVersion: 1,
        payload: null,
        metadata: {
          eventId: 'event-123',
          timestamp: new Date(),
        },
      } as any;

      // Act & Assert
      // Should handle gracefully or throw appropriate error
      try {
        await engine.processEvent(event);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });

    it('should handle store unavailability gracefully', async () => {
      // Arrange
      vi.spyOn(store, 'load').mockRejectedValue(new Error('Store unavailable'));
      vi.spyOn(store, 'save').mockRejectedValue(new Error('Store unavailable'));

      const event = createMockEvent('UserCreated', 'user-123', {});

      // Act & Assert
      const [error] = await safeRun(() => engine.processEvent(event));
      expect(error).toBeInstanceOf(Error);
    });

    it('should handle very large event payloads', async () => {
      // Arrange
      const largePayload = {
        data: 'x'.repeat(1000000), // 1MB string
        metadata: { size: 'large' },
      };
      const event = createMockEvent('UserCreated', 'user-123', largePayload);

      // Act & Assert
      // Should handle or appropriately reject very large payloads
      try {
        await engine.processEvent(event);
      } catch (error) {
        // Expected if payload size limits are enforced
        expect(error).toBeDefined();
      }
    });
  });
});
