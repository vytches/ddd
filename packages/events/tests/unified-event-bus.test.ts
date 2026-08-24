import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { safeRun } from '@vytches/ddd-utils';
import { internalLogger } from '@vytches/ddd-contracts/internal';
import { AggregatedEventHandlerError, DomainEvent, UnifiedEventBus } from '../src';
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

    it('should use subscribe with a context filter', async () => {
      const contextHandler = vi.fn();

      eventBus.subscribe(TestDomainEvent, 'specific-context', contextHandler);

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

    it('should remove exactly the requested class handler when two share an event (UX-C8)', async () => {
      class HandlerA {
        handle(_event: TestDomainEvent): void {
          // intentional no-op
        }
      }
      class HandlerB {
        handle(_event: TestDomainEvent): void {
          // intentional no-op
        }
      }
      const handlerA = new HandlerA();
      const handlerB = new HandlerB();
      const spyA = vi.spyOn(handlerA, 'handle');
      const spyB = vi.spyOn(handlerB, 'handle');

      eventBus.registerHandler(TestDomainEvent, handlerA);
      eventBus.registerHandler(TestDomainEvent, handlerB);

      eventBus.unsubscribe(TestDomainEvent, handlerB);
      await eventBus.publish(new TestDomainEvent({ id: 'test-1' }));

      expect(spyA).toHaveBeenCalledTimes(1); // A still fires
      expect(spyB).not.toHaveBeenCalled(); // B is gone
    });

    it('should clean up empty registry keys after the last unsubscribe', () => {
      const handler = vi.fn();
      eventBus.subscribe(TestDomainEvent, handler);
      eventBus.unsubscribe(TestDomainEvent, handler);

      expect(eventBus.getRegisteredEventTypes()).toEqual([]);
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

    it('should preserve strict array order with { sequential: true } (UX-C10)', async () => {
      const order: string[] = [];
      eventBus.subscribe(TestDomainEvent, async event => {
        const id = (event.payload as { id: string }).id;
        if (id === 'first') {
          // Delay the first event's handler; parallel dispatch would let
          // the second event's handler finish before it.
          await new Promise(resolve => setTimeout(resolve, 20));
        }
        order.push(id);
      });

      await eventBus.publishMany(
        [new TestDomainEvent({ id: 'first' }), new TestDomainEvent({ id: 'second' })],
        { sequential: true }
      );

      expect(order).toEqual(['first', 'second']);
    });
  });

  describe('Error Handling', () => {
    it('should route handler errors to onError and resolve publish (onError owns errors)', async () => {
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
      expect(publishError).toBeUndefined(); // onError configured => publish resolves
      expect(onError).toHaveBeenCalledTimes(1);
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
      expect(publishError).toBeUndefined();
      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
      expect(onError).toHaveBeenCalledWith(expect.any(Error), 'TestDomainEvent');
    });

    it('should run all handlers and throw AggregatedEventHandlerError by default (no onError)', async () => {
      const first = vi.fn(() => {
        throw new Error('first failed');
      });
      const middle = vi.fn();
      const last = vi.fn(() => {
        throw new Error('last failed');
      });

      eventBus.subscribe(TestDomainEvent, first);
      eventBus.subscribe(TestDomainEvent, middle);
      eventBus.subscribe(TestDomainEvent, last);

      const [publishError] = await safeRun(() =>
        eventBus.publish(new TestDomainEvent({ id: 'test-1' }))
      );

      expect(first).toHaveBeenCalled();
      expect(middle).toHaveBeenCalled();
      expect(last).toHaveBeenCalled();
      expect(publishError).toBeInstanceOf(AggregatedEventHandlerError);
      const aggregated = publishError as AggregatedEventHandlerError;
      expect(aggregated.eventName).toBe('TestDomainEvent');
      expect(aggregated.errors.map(e => e.message)).toEqual(
        expect.arrayContaining(['first failed', 'last failed'])
      );
      expect(aggregated.errors).toHaveLength(2);
    });
  });

  describe('Registry Integrity (UX-C1)', () => {
    it('getHandlers/getRegisteredEventTypes reflect the active handler registry', () => {
      const handler = vi.fn();
      eventBus.subscribe(TestDomainEvent, handler);
      eventBus.subscribe('TestIntegrationEvent', () => undefined);

      expect(eventBus.getRegisteredEventTypes().sort()).toEqual([
        'TestDomainEvent',
        'TestIntegrationEvent',
      ]);
      const handlers = eventBus.getHandlers(TestDomainEvent);
      expect(handlers).toBeDefined();
      expect(handlers!.size).toBe(1);
      expect(handlers!.has(handler)).toBe(true);
    });

    it('getHandlers returns undefined for unknown event types', () => {
      expect(eventBus.getHandlers('NopeEvent')).toBeUndefined();
    });

    it('clearHandlers empties the active registry so publish fires nothing', async () => {
      const handler = vi.fn();
      const classHandler = { handle: vi.fn() };
      eventBus.subscribe(TestDomainEvent, handler);
      eventBus.registerHandler(TestDomainEvent, classHandler);

      eventBus.clearHandlers();
      await eventBus.publish(new TestDomainEvent({ id: 'test-1' }));

      expect(handler).not.toHaveBeenCalled();
      expect(classHandler.handle).not.toHaveBeenCalled();
      expect(eventBus.getRegisteredEventTypes()).toEqual([]);
      expect(eventBus.getHandlers(TestDomainEvent)).toBeUndefined();
    });
  });

  describe('Handler Cap (UX-C9)', () => {
    it('enforces MAX_HANDLERS_PER_EVENT across every registration path', () => {
      for (let i = 0; i < 99; i++) {
        eventBus.subscribe(TestDomainEvent, () => undefined);
      }
      // 100th handler via a different path still counts against the cap
      eventBus.registerHandler(TestDomainEvent, { handle: vi.fn() });

      expect(() => eventBus.subscribe(TestDomainEvent, 'ctx', () => undefined)).toThrow(
        'Maximum handlers (100) exceeded for event "TestDomainEvent"'
      );
    });

    it('respects a subclass override of MAX_HANDLERS_PER_EVENT', () => {
      class CappedBus extends UnifiedEventBus {
        static override readonly MAX_HANDLERS_PER_EVENT = 2;
      }
      const cappedBus = new CappedBus();

      cappedBus.subscribe(TestDomainEvent, () => undefined);
      cappedBus.subscribe(TestDomainEvent, () => undefined);

      expect(() => cappedBus.subscribe(TestDomainEvent, () => undefined)).toThrow(
        'Maximum handlers (2) exceeded for event "TestDomainEvent"'
      );
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

  describe('Duplicate Handler Registration Warning (VF-025 AC1 / D3)', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('still invokes the same handler reference twice per dispatch when registered twice with the same contexts (no behavior regression)', async () => {
      const warnSpy = vi.spyOn(internalLogger, 'warn').mockImplementation(() => undefined);
      const handler = vi.fn();

      eventBus.subscribe(TestDomainEvent, 'shared-context', handler);
      eventBus.subscribe(TestDomainEvent, 'shared-context', handler);

      await eventBus.publish(new TestDomainEvent({ id: 'test-1' }, 'shared-context'));

      expect(handler).toHaveBeenCalledTimes(2);

      const duplicateWarnings = warnSpy.mock.calls.filter(([message]) =>
        String(message).includes('duplicate handler registration detected')
      );
      expect(duplicateWarnings).toHaveLength(1);
      expect(duplicateWarnings[0]?.[1]).toMatchObject({
        eventName: 'TestDomainEvent',
      });
    });

    it('does not warn when two different handlers are registered for the same event', async () => {
      const warnSpy = vi.spyOn(internalLogger, 'warn').mockImplementation(() => undefined);
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      eventBus.subscribe(TestDomainEvent, handler1);
      eventBus.subscribe(TestDomainEvent, handler2);

      const duplicateWarnings = warnSpy.mock.calls.filter(([message]) =>
        String(message).includes('duplicate handler registration detected')
      );
      expect(duplicateWarnings).toHaveLength(0);
    });

    it('does not warn when the same handler reference is registered with different contexts', async () => {
      const warnSpy = vi.spyOn(internalLogger, 'warn').mockImplementation(() => undefined);
      const handler = vi.fn();

      eventBus.subscribe(TestDomainEvent, 'context-a', handler);
      eventBus.subscribe(TestDomainEvent, 'context-b', handler);

      const duplicateWarnings = warnSpy.mock.calls.filter(([message]) =>
        String(message).includes('duplicate handler registration detected')
      );
      expect(duplicateWarnings).toHaveLength(0);
    });
  });

  describe('autoRegisterHandlers Diagnostics (VF-025 SA-M5)', () => {
    const globalRecord = globalThis as Record<string, unknown>;
    let originalVytchesDDD: unknown;

    beforeEach(() => {
      originalVytchesDDD = globalRecord.VytchesDDD;
    });

    afterEach(() => {
      if (originalVytchesDDD === undefined) {
        delete globalRecord.VytchesDDD;
      } else {
        globalRecord.VytchesDDD = originalVytchesDDD;
      }
      vi.restoreAllMocks();
    });

    it('completes construction and logs a warning when globalThis.VytchesDDD.discoverHandlers() throws', () => {
      const warnSpy = vi.spyOn(internalLogger, 'warn').mockImplementation(() => undefined);
      globalRecord.VytchesDDD = {
        discoverHandlers: () => {
          throw new Error('discovery boom');
        },
      };

      let bus: UnifiedEventBus | undefined;
      expect(() => {
        bus = new UnifiedEventBus({ enableLogging: false });
      }).not.toThrow();

      expect(bus).toBeInstanceOf(UnifiedEventBus);
      expect(warnSpy).toHaveBeenCalledWith(
        'UnifiedEventBus: auto-registration of discovered handlers failed',
        expect.objectContaining({ errorMessage: expect.stringContaining('discovery boom') })
      );
    });
  });
});
