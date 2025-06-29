import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { IDomainEvent, IExtendedDomainEvent } from '@vytches-ddd/contracts';
import { ProjectionProcessor } from './projection-processor';
import { ProjectionEngineRegistry } from './projection-registry';
import type { IProjectionCapability, IProjectionEngine } from './projection-interfaces';

// Mock implementation of IProjectionEngine
class MockProjectionEngine implements IProjectionEngine<any> {
  constructor(
    private name: string,
    private eventTypes: string[] = [],
    private shouldThrow = false
  ) {}

  getProjectionName(): string {
    return this.name;
  }

  async processEvent(event: IExtendedDomainEvent): Promise<void> {
    if (this.shouldThrow) {
      throw new Error(`Processing failed for ${event.eventType}`);
    }
    // Mock successful processing
  }

  async getState(): Promise<any> {
    return {};
  }

  async reset(): Promise<void> {
    // Mock reset
  }

  addCapability(capability: IProjectionCapability<any>): this {
    // Mock add capability
    return this;
  }

  async rebuild(events: AsyncIterable<IExtendedDomainEvent>): Promise<void> {
    // Mock rebuild
    for await (const event of events) {
      await this.processEvent(event);
    }
  }

  isInterestedIn(event: IExtendedDomainEvent): boolean {
    return this.eventTypes.includes(event.eventType);
  }
}

describe('ProjectionProcessor', () => {
  let processor: ProjectionProcessor;
  let registry: ProjectionEngineRegistry;
  let mockEngine1: MockProjectionEngine;
  let mockEngine2: MockProjectionEngine;
  let mockFailingEngine: MockProjectionEngine;

  const createMockEvent = (eventType: string, aggregateId = 'test-id'): IDomainEvent => ({
    eventType,
    payload: { data: 'test', aggregateId, aggregateType: 'TestAggregate', eventVersion: 1 },
  });

  const createExtendedMockEvent = (
    eventType: string,
    aggregateId = 'test-id'
  ): IExtendedDomainEvent => ({
    ...createMockEvent(eventType, aggregateId),
    metadata: {
      eventId: 'event-123',
      timestamp: new Date(),
    },
  });

  beforeEach(() => {
    registry = new ProjectionEngineRegistry();
    processor = new ProjectionProcessor(registry);

    mockEngine1 = new MockProjectionEngine('UserProjection', ['UserCreated', 'UserUpdated']);
    mockEngine2 = new MockProjectionEngine('OrderProjection', ['OrderPlaced', 'OrderShipped']);
    mockFailingEngine = new MockProjectionEngine('FailingProjection', ['UserCreated'], true);
  });

  describe('canProcess', () => {
    it('should return true when engines are interested in the event', () => {
      // Arrange
      registry.register(mockEngine1);
      const event = createMockEvent('UserCreated');

      // Act
      const result = processor.canProcess(event);

      // Assert
      expect(result).toBe(true);
    });

    it('should return false when no engines are interested in the event', () => {
      // Arrange
      registry.register(mockEngine1);
      const event = createMockEvent('UnknownEvent');

      // Act
      const result = processor.canProcess(event);

      // Assert
      expect(result).toBe(false);
    });

    it('should return false when no engines are registered', () => {
      // Arrange
      const event = createMockEvent('UserCreated');

      // Act
      const result = processor.canProcess(event);

      // Assert
      expect(result).toBe(false);
    });

    it('should handle events without metadata', () => {
      // Arrange
      registry.register(mockEngine1);
      const event = createMockEvent('UserCreated');

      // Act
      const result = processor.canProcess(event);

      // Assert
      expect(result).toBe(true);
    });

    it('should handle events with metadata', () => {
      // Arrange
      registry.register(mockEngine1);
      const event = createExtendedMockEvent('UserCreated');

      // Act
      const result = processor.canProcess(event);

      // Assert
      expect(result).toBe(true);
    });
  });

  describe('process', () => {
    it('should process event with single interested engine', async () => {
      // Arrange
      const processEventSpy = vi.spyOn(mockEngine1, 'processEvent');
      registry.register(mockEngine1);
      const event = createExtendedMockEvent('UserCreated');

      // Act
      await processor.process(event);
      console.log('Event processed===>>', processor);

      // Assert
      expect(processEventSpy).toHaveBeenCalledTimes(1);
      expect(processEventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'UserCreated',
          metadata: expect.objectContaining({
            eventId: expect.any(String),
            timestamp: expect.any(Date),
          }),
        })
      );
    });

    it('should process event with multiple interested engines', async () => {
      // Arrange
      const _processEventSpy1 = vi.spyOn(mockEngine1, 'processEvent');
      const _processEventSpy2 = vi.spyOn(mockEngine2, 'processEvent');

      // Create engines that both handle the same event
      const multiEngine1 = new MockProjectionEngine('Multi1', ['SharedEvent']);
      const multiEngine2 = new MockProjectionEngine('Multi2', ['SharedEvent']);
      const spy1 = vi.spyOn(multiEngine1, 'processEvent');
      const spy2 = vi.spyOn(multiEngine2, 'processEvent');

      registry.register(multiEngine1);
      registry.register(multiEngine2);

      const event = createMockEvent('SharedEvent');

      // Act
      await processor.process(event);

      // Assert
      expect(spy1).toHaveBeenCalledTimes(1);
      expect(spy2).toHaveBeenCalledTimes(1);
    });

    it('should not process event when no engines are interested', async () => {
      // Arrange
      const processEventSpy = vi.spyOn(mockEngine1, 'processEvent');
      registry.register(mockEngine1);
      const event = createMockEvent('UnknownEvent');

      // Act
      await processor.process(event);

      // Assert
      expect(processEventSpy).not.toHaveBeenCalled();
    });

    it('should handle processing errors gracefully', async () => {
      // Arrange
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => ({}) as any);
      registry.register(mockFailingEngine);
      const event = createMockEvent('UserCreated');

      // Act & Assert - should not throw
      await expect(processor.process(event)).resolves.toBeUndefined();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Error processing event UserCreated in projection FailingProjection'
        ),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should process all engines even if some fail', async () => {
      // Arrange
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => ({}) as any);
      const successSpy = vi.spyOn(mockEngine1, 'processEvent');

      // Both engines handle UserCreated, but one fails
      const failingEngine = new MockProjectionEngine('FailingEngine', ['UserCreated'], true);

      registry.register(mockEngine1);
      registry.register(failingEngine);

      const event = createMockEvent('UserCreated');

      // Act
      await processor.process(event);

      // Assert
      expect(successSpy).toHaveBeenCalledTimes(1); // Successful engine should still process
      expect(consoleSpy).toHaveBeenCalledTimes(1); // Error should be logged

      consoleSpy.mockRestore();
    });

    it('should add metadata to events that do not have it', async () => {
      // Arrange
      const processEventSpy = vi.spyOn(mockEngine1, 'processEvent');
      registry.register(mockEngine1);
      const event = createMockEvent('UserCreated');

      // Act
      await processor.process(event);

      // Assert
      expect(processEventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'UserCreated',
          metadata: expect.objectContaining({
            eventId: expect.any(String),
            timestamp: expect.any(Date),
          }),
        })
      );
    });

    it('should preserve existing metadata in events', async () => {
      // Arrange
      const processEventSpy = vi.spyOn(mockEngine1, 'processEvent');
      registry.register(mockEngine1);
      const originalTimestamp = new Date('2023-01-01');
      const event = {
        ...createMockEvent('UserCreated'),
        metadata: {
          eventId: 'original-id',
          timestamp: originalTimestamp,
        },
      } as IExtendedDomainEvent;

      // Act
      await processor.process(event);

      // Assert
      expect(processEventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'UserCreated',
          metadata: {
            eventId: 'original-id',
            timestamp: originalTimestamp,
          },
        })
      );
    });

    it('should handle concurrent processing', async () => {
      // Arrange
      const processEventSpy1 = vi.spyOn(mockEngine1, 'processEvent');
      const processEventSpy2 = vi.spyOn(mockEngine2, 'processEvent');

      registry.register(mockEngine1);
      registry.register(mockEngine2);

      const event1 = createMockEvent('UserCreated');
      const event2 = createMockEvent('OrderPlaced');

      // Act
      await Promise.all([processor.process(event1), processor.process(event2)]);

      // Assert
      expect(processEventSpy1).toHaveBeenCalledTimes(1);
      expect(processEventSpy2).toHaveBeenCalledTimes(1);
    });

    it('should handle events with complex payloads', async () => {
      // Arrange
      const processEventSpy = vi.spyOn(mockEngine1, 'processEvent');
      registry.register(mockEngine1);

      const complexEvent: IDomainEvent = {
        eventType: 'UserCreated',
        payload: {
          userData: {
            name: 'John Doe',
            email: 'john@example.com',
            preferences: {
              theme: 'dark',
              notifications: true,
            },
          },
          metadata: {
            aggregateId: 'user-123',
            aggregateType: 'User',
            eventVersion: 1,
            source: 'web-app',
            ipAddress: '192.168.1.1',
          },
        },
      };

      // Act
      await processor.process(complexEvent);

      // Assert
      expect(processEventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: complexEvent.payload,
        })
      );
    });
  });

  describe('edge cases', () => {
    it('should handle undefined event gracefully', async () => {
      // This would typically be caught by TypeScript, but testing runtime behavior
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => ({}) as any);

      try {
        await processor.process(undefined as any);
      } catch (error) {
        // Expected to throw due to undefined access
        expect(error).toBeDefined();
      }

      consoleSpy.mockRestore();
    });

    it('should handle events with missing required properties', async () => {
      // Arrange
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => ({}) as any);
      registry.register(mockEngine1);

      const malformedEvent = {
        eventType: 'UserCreated',
        aggregateType: 'User',
        eventVersion: 1,
        payload: {},
        // Missing other required properties intentionally
      } as IDomainEvent;

      // Act & Assert
      try {
        await processor.process(malformedEvent);
      } catch (error) {
        expect(error).toBeDefined();
      }

      consoleSpy.mockRestore();
    });

    it('should handle engines that return promises vs synchronous results', async () => {
      // Arrange
      const asyncEngine = new MockProjectionEngine('AsyncEngine', ['AsyncEvent']);
      const syncEngine = new MockProjectionEngine('SyncEngine', ['AsyncEvent']);

      // Override processEvent to simulate different return types
      vi.spyOn(asyncEngine, 'processEvent').mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      vi.spyOn(syncEngine, 'processEvent').mockImplementation(() => {
        return Promise.resolve();
      });

      registry.register(asyncEngine);
      registry.register(syncEngine);

      const event = createMockEvent('AsyncEvent');

      // Act & Assert - should not throw
      await expect(processor.process(event)).resolves.toBeUndefined();
    });

    it('should handle very large number of engines', async () => {
      // Arrange
      const engines: MockProjectionEngine[] = [];
      const spies: any[] = [];

      // Register 100 engines that all handle the same event
      for (let i = 0; i < 100; i++) {
        const engine = new MockProjectionEngine(`Engine${i}`, ['MassEvent']);
        const spy = vi.spyOn(engine, 'processEvent');
        engines.push(engine);
        spies.push(spy);
        registry.register(engine);
      }

      const event = createMockEvent('MassEvent');

      // Act
      const start = Date.now();
      await processor.process(event);
      const duration = Date.now() - start;

      // Assert
      spies.forEach(spy => {
        expect(spy).toHaveBeenCalledTimes(1);
      });

      // Should complete in reasonable time (less than 1 second for 100 engines)
      expect(duration).toBeLessThan(1000);
    });
  });
});
