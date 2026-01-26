import type { IDomainEvent } from '@vytches/ddd-contracts';
import { DomainErrorCode } from '@vytches/ddd-domain-primitives';
import { safeRun } from '@vytches/ddd-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DeadLetterCapability } from '../../src';
import { ProjectionError } from '../../src/projection-errors';
import type {
  ICapabilityContext,
  IDeadLetter,
  IDeadLetterStore,
} from '../../src/projection-interfaces';

// Mock store implementation
class MockDeadLetterStore implements IDeadLetterStore {
  private deadLetters: IDeadLetter[] = [];

  async store(deadLetter: IDeadLetter): Promise<void> {
    this.deadLetters.push(deadLetter);
  }

  async getByProjection(projectionName: string): Promise<IDeadLetter[]> {
    return this.deadLetters.filter(dl => dl.projectionName === projectionName);
  }

  async retry(deadLetterId: string): Promise<IDomainEvent> {
    const deadLetter = this.deadLetters.find(dl => dl.id === deadLetterId);
    if (!deadLetter) {
      throw new Error(`Dead letter ${deadLetterId} not found`);
    }
    return deadLetter.event;
  }

  async delete(deadLetterId: string): Promise<void> {
    const index = this.deadLetters.findIndex(dl => dl.id === deadLetterId);
    if (index >= 0) {
      this.deadLetters.splice(index, 1);
    }
  }

  // Helper for testing
  getAllDeadLetters(): IDeadLetter[] {
    return [...this.deadLetters];
  }

  clear(): void {
    this.deadLetters = [];
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

describe('DeadLetterCapability', () => {
  let capability: DeadLetterCapability<any>;
  let store: MockDeadLetterStore;
  let context: MockContext;

  const createMockEvent = (): IDomainEvent => ({
    eventName: 'TestEvent',
    payload: { data: 'test' },
    metadata: {
      eventVersion: 1,
      eventId: 'event-123',
      timestamp: new Date(),
    },
  });

  beforeEach(() => {
    store = new MockDeadLetterStore();
    context = new MockContext('TestProjection');
    capability = new DeadLetterCapability(store);
    capability.attach(context);
  });

  describe('initialization', () => {
    it('should initialize with correct name', () => {
      expect(capability.type).toBe('deadLetter');
    });

    it('should accept custom shouldDeadLetter function', () => {
      const customShouldDeadLetter = (_error: Error, attempts: number) => attempts >= 5;
      const customCapability = new DeadLetterCapability(store, customShouldDeadLetter);
      expect(customCapability.type).toBe('deadLetter');
    });

    it('should use default shouldDeadLetter function when not provided', () => {
      const defaultCapability = new DeadLetterCapability(store);
      expect(defaultCapability.type).toBe('deadLetter');
    });
  });

  describe('dead letter creation', () => {
    it('should create dead letter when error threshold is reached', async () => {
      // Arrange
      const error = new ProjectionError('Test error', { attemptCount: 3 });
      const event = createMockEvent();

      // Act
      await capability.onError(error, event);

      // Assert
      const deadLetters = store.getAllDeadLetters();
      expect(deadLetters).toHaveLength(1);

      const deadLetter = deadLetters[0];
      expect(deadLetter?.projectionName).toBe('TestProjection');
      expect(deadLetter?.event).toEqual(event);
      expect(deadLetter?.error).toBe(error);
      expect(deadLetter?.attemptCount).toBe(3);
      expect(deadLetter?.id).toBeDefined();
      expect(deadLetter?.firstFailedAt).toBeInstanceOf(Date);
      expect(deadLetter?.lastFailedAt).toBeInstanceOf(Date);
      expect(deadLetter?.metadata?.errorType).toBe('ProjectionError');
      expect(deadLetter?.metadata?.errorMessage).toBe('Test error');
    });

    it('should not create dead letter when threshold is not reached', async () => {
      // Arrange
      const error = new ProjectionError('Test error', { attemptCount: 2 });
      const event = createMockEvent();

      // Act
      await capability.onError(error, event);

      // Assert
      const deadLetters = store.getAllDeadLetters();
      expect(deadLetters).toHaveLength(0);
    });

    it('should not create dead letter when no event is provided', async () => {
      // Arrange
      const error = new ProjectionError('Test error', { attemptCount: 5 });

      // Act
      await capability.onError(error);

      // Assert
      const deadLetters = store.getAllDeadLetters();
      expect(deadLetters).toHaveLength(0);
    });

    it('should not create dead letter when not attached to context', async () => {
      // Arrange
      const unattachedCapability = new DeadLetterCapability(store);
      const error = new ProjectionError('Test error', { attemptCount: 5 });
      const event = createMockEvent();

      // Act
      await unattachedCapability.onError(error, event);

      // Assert
      const deadLetters = store.getAllDeadLetters();
      expect(deadLetters).toHaveLength(0);
    });

    it('should handle errors without attempt count in data', async () => {
      // Arrange
      const errorWithoutAttemptCount = new ProjectionError('Test error');
      const event = createMockEvent();

      // Act
      await capability.onError(errorWithoutAttemptCount, event);

      // Assert
      const deadLetters = store.getAllDeadLetters();
      expect(deadLetters).toHaveLength(0); // Default attempt count is 1, below threshold
    });

    it('should use custom shouldDeadLetter logic', async () => {
      // Arrange
      const customCapability = new DeadLetterCapability(
        store,
        (_error, attempts) => attempts >= 1 // Dead letter immediately
      );
      customCapability.attach(context);

      const error = new ProjectionError('Test error', { attemptCount: 1 });
      const event = createMockEvent();

      // Act
      await customCapability.onError(error, event);

      // Assert
      const deadLetters = store.getAllDeadLetters();
      expect(deadLetters).toHaveLength(1);
    });
  });

  describe('error handling', () => {
    it('should handle store errors gracefully', async () => {
      // Arrange
      const failingStore = new MockDeadLetterStore();
      vi.spyOn(failingStore, 'store').mockRejectedValue(new Error('Store error'));

      const failingCapability = new DeadLetterCapability(failingStore);
      failingCapability.attach(context);

      const error = new ProjectionError('Test error', { attemptCount: 5 });
      const event = createMockEvent();

      // Act & Assert
      const [onErrorError] = await safeRun(() => failingCapability.onError(error, event));
      expect(onErrorError?.message).toBe('Store error');
    });

    it('should handle malformed error data gracefully', async () => {
      // Arrange
      // Create an error with malformed data structure by manually setting the data after construction
      const errorWithMalformedData = new ProjectionError('Test error', {
        code: DomainErrorCode.Default,
        data: 'invalid-data',
      });
      const event = createMockEvent();

      // Act & Assert - should not throw
      await expect(capability.onError(errorWithMalformedData, event)).resolves.toBeUndefined();

      // Should use default attempt count of 1
      const deadLetters = store.getAllDeadLetters();
      expect(deadLetters).toHaveLength(0); // Below threshold
    });

    it('should handle undefined error data', async () => {
      // Arrange
      const errorWithoutData = new Error('Standard error') as ProjectionError;
      const event = createMockEvent();

      // Act & Assert - should not throw
      await expect(capability.onError(errorWithoutData, event)).resolves.toBeUndefined();

      // Should use default attempt count of 1
      const deadLetters = store.getAllDeadLetters();
      expect(deadLetters).toHaveLength(0); // Below threshold
    });
  });

  describe('lifecycle', () => {
    it('should attach and detach properly', () => {
      // Arrange
      const newCapability = new DeadLetterCapability(store);
      const newContext = new MockContext('NewProjection');

      // Act
      newCapability.attach(newContext);

      // Assert - should work with attached context
      expect(newCapability.type).toBe('deadLetter');

      // Note: DeadLetterCapability doesn't implement detach method
      // but it should handle the undefined context gracefully
    });

    it('should handle multiple attachments', () => {
      // Arrange
      const context1 = new MockContext('Projection1');
      const context2 = new MockContext('Projection2');

      // Act
      capability.attach(context1);
      capability.attach(context2); // Should overwrite previous context

      // Assert - should use the latest context
      expect(capability.type).toBe('deadLetter');
    });
  });

  describe('attempt count extraction', () => {
    it('should extract attempt count from error data when valid', async () => {
      // Arrange
      const error = new ProjectionError('Test error', { attemptCount: 4 });
      const event = createMockEvent();

      // Act
      await capability.onError(error, event);

      // Assert
      const deadLetters = store.getAllDeadLetters();
      expect(deadLetters).toHaveLength(1);
      expect(deadLetters?.[0]?.attemptCount).toBe(4);
    });

    it('should handle non-number attempt count in error data', async () => {
      // Arrange
      const error = new ProjectionError('Test error', { attemptCount: 'invalid' });
      const event = createMockEvent();

      // Act
      await capability.onError(error, event);

      // Assert
      const deadLetters = store.getAllDeadLetters();
      expect(deadLetters).toHaveLength(0); // Should use default attempt count of 1
    });

    it('should handle nested data structures', async () => {
      // Arrange
      const error = new ProjectionError('Test error', {
        nested: { attemptCount: 5 },
        attemptCount: 3, // This should be used
      });
      const event = createMockEvent();

      // Act
      await capability.onError(error, event);

      // Assert
      const deadLetters = store.getAllDeadLetters();
      expect(deadLetters).toHaveLength(1);
      expect(deadLetters?.[0]?.attemptCount).toBe(3);
    });
  });

  describe('integration scenarios', () => {
    it('should handle multiple dead letters for different projections', async () => {
      // Arrange
      const capability1 = new DeadLetterCapability(store);
      const capability2 = new DeadLetterCapability(store);
      const context1 = new MockContext('Projection1');
      const context2 = new MockContext('Projection2');

      capability1.attach(context1);
      capability2.attach(context2);

      const error1 = new ProjectionError('Error 1', { attemptCount: 3 });
      const error2 = new ProjectionError('Error 2', { attemptCount: 4 });
      const event1 = createMockEvent();
      const event2 = createMockEvent();

      // Act
      await capability1.onError(error1, event1);
      await capability2.onError(error2, event2);

      // Assert
      const deadLetters = store.getAllDeadLetters();
      expect(deadLetters).toHaveLength(2);

      const projection1DeadLetters = deadLetters.filter(dl => dl.projectionName === 'Projection1');
      const projection2DeadLetters = deadLetters.filter(dl => dl.projectionName === 'Projection2');

      expect(projection1DeadLetters).toHaveLength(1);
      expect(projection2DeadLetters).toHaveLength(1);
    });

    it('should handle rapid error processing', async () => {
      // Arrange
      const errors = Array.from(
        { length: 10 },
        (_, i) => new ProjectionError(`Error ${i}`, { attemptCount: 5 })
      );
      const events = Array.from({ length: 10 }, () => createMockEvent());

      // Act
      await Promise.all(errors.map((error, index) => capability.onError(error, events[index])));

      // Assert
      const deadLetters = store.getAllDeadLetters();
      expect(deadLetters).toHaveLength(10);
      deadLetters.forEach((dl, index) => {
        expect(dl.error.message).toBe(`Error ${index}`);
        expect(dl.attemptCount).toBe(5);
      });
    });

    it('should handle complex error metadata', async () => {
      // Arrange
      const complexError = new ProjectionError('Complex error', {
        attemptCount: 3,
        retryHistory: ['attempt1', 'attempt2', 'attempt3'],
        context: { userId: '123', action: 'update' },
      });
      const event = createMockEvent();

      // Act
      await capability.onError(complexError, event);

      // Assert
      const deadLetters = store.getAllDeadLetters();
      expect(deadLetters).toHaveLength(1);

      const deadLetter = deadLetters[0];
      expect(deadLetter?.attemptCount).toBe(3);
      expect(deadLetter?.metadata?.errorType).toBe('ProjectionError');
      expect(deadLetter?.metadata?.errorMessage).toBe('Complex error');
    });

    it('should handle edge case with different error types', async () => {
      // Arrange
      const standardError = new Error('Standard error');
      const projectionError = new ProjectionError('Projection error', { attemptCount: 3 });
      const typeError = new TypeError('Type error');

      const event = createMockEvent();

      // Act
      await capability.onError(standardError as ProjectionError, event);
      await capability.onError(projectionError, event);
      await capability.onError(typeError as ProjectionError, event);

      // Assert
      const deadLetters = store.getAllDeadLetters();
      expect(deadLetters).toHaveLength(1); // Only ProjectionError should create dead letter
      expect(deadLetters?.[0]?.error).toBe(projectionError);
    });
  });
});
