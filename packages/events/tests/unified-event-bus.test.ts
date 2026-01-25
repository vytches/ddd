import { describe, it, expect, beforeEach, vi } from 'vitest';
import { safeRun } from '@vytches/ddd-utils';
import { DomainEvent, UnifiedEventBus } from '../src';
import type { IIntegrationEvent } from '../src/integration/integration-event-interfaces';

// Test events
class TestDomainEvent extends DomainEvent {
  constructor(data: any, contextId?: string) {
    super(data, contextId ? { contextId } : undefined);
  }
}

class TestIntegrationEvent implements IIntegrationEvent {
  readonly eventName = 'TestIntegrationEvent';
  readonly metadata = {
    eventId: 'test-id',
    timestamp: new Date(),
    version: '1.0',
  };

  constructor(readonly payload: any) {}
}

describe('UnifiedEventBus', () => {
  let eventBus: UnifiedEventBus;

  beforeEach(() => {
    eventBus = new UnifiedEventBus({
      enableLogging: false,
    });
  });

  describe('Basic Event Publishing', () => {
    it('should publish and handle domain events', async () => {
      const handler = vi.fn();
      const testEvent = new TestDomainEvent({ id: 'test-1' });

      eventBus.subscribe(TestDomainEvent, handler);
      await eventBus.publish(testEvent);

      expect(handler).toHaveBeenCalledWith(testEvent);
    });

    it('should publish and handle integration events', async () => {
      const handler = vi.fn();
      const testEvent = new TestIntegrationEvent({ id: 'test-1' });

      eventBus.subscribe('TestIntegrationEvent', handler);
      await eventBus.publish(testEvent);

      expect(handler).toHaveBeenCalledWith(testEvent);
    });

    it('should handle multiple handlers for the same event', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const testEvent = new TestDomainEvent({ id: 'test-1' });

      eventBus.subscribe(TestDomainEvent, handler1);
      eventBus.subscribe(TestDomainEvent, handler2);
      await eventBus.publish(testEvent);

      expect(handler1).toHaveBeenCalledWith(testEvent);
      expect(handler2).toHaveBeenCalledWith(testEvent);
    });
  });

  describe('Context-Aware Subscriptions', () => {
    it('should filter events by single context', async () => {
      const orderHandler = vi.fn();
      const userHandler = vi.fn();

      // Subscribe to specific contexts
      eventBus.subscribe(TestDomainEvent, 'order-context', orderHandler);
      eventBus.subscribe(TestDomainEvent, 'user-context', userHandler);

      // Publish events with different contexts
      await eventBus.publish(new TestDomainEvent({ id: 'order-1' }, 'order-context'));
      await eventBus.publish(new TestDomainEvent({ id: 'user-1' }, 'user-context'));

      expect(orderHandler).toHaveBeenCalledTimes(1);
      expect(userHandler).toHaveBeenCalledTimes(1);
      expect(orderHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: { id: 'order-1' },
        })
      );
      expect(userHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: { id: 'user-1' },
        })
      );
    });

    it('should filter events by multiple contexts', async () => {
      const multiContextHandler = vi.fn();

      // Subscribe to multiple contexts
      eventBus.subscribe(
        TestDomainEvent,
        ['order-context', 'inventory-context'],
        multiContextHandler
      );

      // Publish events with different contexts
      await eventBus.publish(new TestDomainEvent({ id: 'order-1' }, 'order-context'));
      await eventBus.publish(new TestDomainEvent({ id: 'inventory-1' }, 'inventory-context'));
      await eventBus.publish(new TestDomainEvent({ id: 'user-1' }, 'user-context'));

      expect(multiContextHandler).toHaveBeenCalledTimes(2);
      expect(multiContextHandler).not.toHaveBeenCalledWith(
        expect.objectContaining({
          payload: { id: 'user-1' },
        })
      );
    });

    it('should handle events from all contexts when no filter is specified', async () => {
      const allContextsHandler = vi.fn();

      // Subscribe without context filter
      eventBus.subscribe(TestDomainEvent, allContextsHandler);

      // Publish events with different contexts
      await eventBus.publish(new TestDomainEvent({ id: 'order-1' }, 'order-context'));
      await eventBus.publish(new TestDomainEvent({ id: 'user-1' }, 'user-context'));
      await eventBus.publish(new TestDomainEvent({ id: 'no-context' }));

      expect(allContextsHandler).toHaveBeenCalledTimes(3);
    });

    it('should use subscribeToContext method', async () => {
      const contextHandler = vi.fn();

      eventBus.subscribeToContext('specific-context', TestDomainEvent, contextHandler);

      await eventBus.publish(new TestDomainEvent({ id: 'test-1' }, 'specific-context'));
      await eventBus.publish(new TestDomainEvent({ id: 'test-2' }, 'other-context'));

      expect(contextHandler).toHaveBeenCalledTimes(1);
      expect(contextHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: { id: 'test-1' },
        })
      );
    });
  });

  describe('Class-based Handlers', () => {
    it('should register class-based handlers', async () => {
      const handler = {
        handle: vi.fn(),
      };

      eventBus.registerHandler(TestDomainEvent, handler);
      await eventBus.publish(new TestDomainEvent({ id: 'test-1' }));

      expect(handler.handle).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: { id: 'test-1' },
        })
      );
    });
  });

  describe('Unsubscribing', () => {
    it('should unsubscribe function handlers', async () => {
      const handler = vi.fn();
      const testEvent = new TestDomainEvent({ id: 'test-1' });

      eventBus.subscribe(TestDomainEvent, handler);
      await eventBus.publish(testEvent);
      expect(handler).toHaveBeenCalledTimes(1);

      eventBus.unsubscribe(TestDomainEvent, handler);
      await eventBus.publish(testEvent);
      expect(handler).toHaveBeenCalledTimes(1); // Still 1, not called again
    });

    it('should unsubscribe class-based handlers', async () => {
      const handler = {
        handle: vi.fn(),
      };
      const testEvent = new TestDomainEvent({ id: 'test-1' });

      eventBus.registerHandler(TestDomainEvent, handler);
      await eventBus.publish(testEvent);
      expect(handler.handle).toHaveBeenCalledTimes(1);

      eventBus.unsubscribe(TestDomainEvent, handler);
      await eventBus.publish(testEvent);
      expect(handler.handle).toHaveBeenCalledTimes(1); // Still 1, not called again
    });
  });

  describe('Multiple Events Publishing', () => {
    it('should publish multiple events', async () => {
      const handler = vi.fn();
      const events = [
        new TestDomainEvent({ id: 'test-1' }),
        new TestDomainEvent({ id: 'test-2' }),
        new TestDomainEvent({ id: 'test-3' }),
      ];

      eventBus.subscribe(TestDomainEvent, handler);
      await eventBus.publishMany(events);

      expect(handler).toHaveBeenCalledTimes(3);
    });
  });

  describe('Error Handling', () => {
    it('should handle errors in event handlers', async () => {
      const workingHandler = vi.fn();
      const onError = vi.fn();

      const eventBus = new UnifiedEventBus({
        enableLogging: false,
        onError,
      });

      eventBus.subscribe(TestDomainEvent, () => {
        throw new Error('Handler error');
      });
      eventBus.subscribe(TestDomainEvent, workingHandler);

      const testEvent = new TestDomainEvent({ id: 'test-1' });

      const [publishError] = await safeRun(() => eventBus.publish(testEvent));
      expect(publishError?.message).toBe('Handler error');
      expect(onError).toHaveBeenCalledWith(expect.any(Error), 'TestDomainEvent');
      expect(workingHandler).toHaveBeenCalled(); // Should still be called
    });

    it('should continue processing other handlers when one fails', async () => {
      const handler1 = vi.fn(() => {
        throw new Error('Handler 1 failed');
      });
      const handler2 = vi.fn();
      const onError = vi.fn();

      const eventBus = new UnifiedEventBus({
        enableLogging: false,
        onError,
      });

      eventBus.subscribe(TestDomainEvent, handler1);
      eventBus.subscribe(TestDomainEvent, handler2);

      const testEvent = new TestDomainEvent({ id: 'test-1' });

      const [publishError] = await safeRun(() => eventBus.publish(testEvent));
      expect(publishError).toBeInstanceOf(Error);
      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
      expect(onError).toHaveBeenCalled();
    });
  });

  describe('Middleware Support', () => {
    it('should execute middleware pipeline', async () => {
      const middleware1 = vi.fn(next => async (event: any) => {
        event.middlewareOrder = ['middleware1'];
        await next(event);
      });

      const middleware2 = vi.fn(next => async (event: any) => {
        event.middlewareOrder.push('middleware2');
        await next(event);
      });

      const handler = vi.fn();

      const eventBus = new UnifiedEventBus({
        enableLogging: false,
        middlewares: [middleware1, middleware2],
      });

      eventBus.subscribe(TestDomainEvent, handler);

      const testEvent = new TestDomainEvent({ id: 'test-1' });
      await eventBus.publish(testEvent);

      expect(middleware1).toHaveBeenCalled();
      expect(middleware2).toHaveBeenCalled();
      expect(handler).toHaveBeenCalled();
      expect((testEvent as any).middlewareOrder).toEqual(['middleware1', 'middleware2']);
    });
  });

  describe('No Handlers Scenario', () => {
    it('should handle publishing when no handlers are registered', async () => {
      const testEvent = new TestDomainEvent({ id: 'test-1' });

      // Should not throw error
      await expect(eventBus.publish(testEvent)).resolves.toBeUndefined();
    });

    it('should handle publishing when no handlers match context', async () => {
      const handler = vi.fn();
      eventBus.subscribe(TestDomainEvent, 'specific-context', handler);

      const testEvent = new TestDomainEvent({ id: 'test-1' }, 'different-context');
      await eventBus.publish(testEvent);

      expect(handler).not.toHaveBeenCalled();
    });
  });
});
