import { describe, it, expect, beforeEach, vi } from 'vitest';
import { safeRun } from '@vytches/ddd-utils';
import { BaseEventBus } from '../src/base-event-bus';
import { AggregatedEventHandlerError } from '../src/aggregated-event-handler-error';
import type { IDomainEvent, IEventHandler } from '@vytches/ddd-contracts';

// Test event and handler
class TestEvent implements IDomainEvent {
  eventName = 'TestEvent';
  aggregateId = 'test-id';
  aggregateType = 'Test';
  eventVersion = 1;
  occurredOn = new Date();

  constructor(public value: string) {}
}

class TestEventHandler implements IEventHandler<TestEvent> {
  async handle(_event: TestEvent): Promise<void> {
    // Test implementation
  }
}

// Concrete implementation for testing
class TestEventBus extends BaseEventBus<IDomainEvent> {}

describe('BaseEventBus', () => {
  let eventBus: TestEventBus;

  beforeEach(() => {
    eventBus = new TestEventBus();
  });

  describe('registration and publishing', () => {
    it('should register a class-based handler and publish without error', async () => {
      const handler = new TestEventHandler();
      eventBus.registerHandler('TestEvent', handler);

      const [publishError] = await safeRun(async () => await eventBus.publish(new TestEvent('t')));
      expect(publishError).toBeUndefined();
    });

    it('should subscribe a function handler and invoke it on publish', async () => {
      const handler = vi.fn();
      eventBus.subscribe('TestEvent', handler);

      const event = new TestEvent('t');
      await eventBus.publish(event);

      expect(handler).toHaveBeenCalledWith(event);
    });

    it('should expose registered handlers via getHandlers/getRegisteredEventTypes', () => {
      const handler = vi.fn();
      eventBus.subscribe('TestEvent', handler);

      expect(eventBus.getRegisteredEventTypes()).toEqual(['TestEvent']);
      expect(eventBus.getHandlers('TestEvent')?.size).toBe(1);
    });

    it('should clear all handlers via clearHandlers', async () => {
      const handler = vi.fn();
      eventBus.subscribe('TestEvent', handler);
      eventBus.clearHandlers();

      await eventBus.publish(new TestEvent('t'));

      expect(handler).not.toHaveBeenCalled();
      expect(eventBus.getRegisteredEventTypes()).toEqual([]);
      expect(eventBus.getHandlers('TestEvent')).toBeUndefined();
    });
  });

  describe('error semantics (run-all fan-out, UX-C2)', () => {
    it('runs all handlers when a middle sync handler throws, then throws AggregatedEventHandlerError', async () => {
      const first = vi.fn();
      const failing = vi.fn(() => {
        throw new Error('middle handler failed');
      });
      const third = vi.fn();

      eventBus.subscribe('TestEvent', first);
      eventBus.subscribe('TestEvent', failing);
      eventBus.subscribe('TestEvent', third);

      const [publishError] = await safeRun(() => eventBus.publish(new TestEvent('t')));

      expect(first).toHaveBeenCalled();
      expect(failing).toHaveBeenCalled();
      expect(third).toHaveBeenCalled();
      expect(publishError).toBeInstanceOf(AggregatedEventHandlerError);
      const aggregated = publishError as AggregatedEventHandlerError;
      expect(aggregated.eventName).toBe('TestEvent');
      expect(aggregated.errors).toHaveLength(1);
      expect(aggregated.errors[0]?.message).toBe('middle handler failed');
    });

    it('collects multiple failures (sync throw + async rejection) into one aggregated error', async () => {
      const survivor = vi.fn();
      eventBus.subscribe('TestEvent', () => {
        throw new Error('sync failure');
      });
      eventBus.subscribe('TestEvent', async () => {
        throw new Error('async failure');
      });
      eventBus.subscribe('TestEvent', survivor);

      const [publishError] = await safeRun(() => eventBus.publish(new TestEvent('t')));

      expect(survivor).toHaveBeenCalled();
      expect(publishError).toBeInstanceOf(AggregatedEventHandlerError);
      const messages = (publishError as AggregatedEventHandlerError).errors.map(e => e.message);
      expect(messages).toContain('sync failure');
      expect(messages).toContain('async failure');
      expect(messages).toHaveLength(2);
    });

    it('routes failures to onError when configured and resolves publish', async () => {
      const onError = vi.fn();
      const busWithHook = new TestEventBus({ onError });
      const survivor = vi.fn();

      busWithHook.subscribe('TestEvent', () => {
        throw new Error('routed failure');
      });
      busWithHook.subscribe('TestEvent', survivor);

      const [publishError] = await safeRun(() => busWithHook.publish(new TestEvent('t')));

      expect(publishError).toBeUndefined();
      expect(survivor).toHaveBeenCalled();
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(expect.any(Error), 'TestEvent');
    });
  });

  describe('handler cap (MAX_HANDLERS_PER_EVENT)', () => {
    it('enforces the default cap of 100 handlers per event', () => {
      for (let i = 0; i < 100; i++) {
        eventBus.subscribe('TestEvent', () => Promise.resolve());
      }

      expect(() => eventBus.subscribe('TestEvent', () => Promise.resolve())).toThrow(
        'Maximum handlers (100) exceeded for event "TestEvent"'
      );
    });

    it('respects a subclass override of MAX_HANDLERS_PER_EVENT', () => {
      class SmallBus extends BaseEventBus<IDomainEvent> {
        static override readonly MAX_HANDLERS_PER_EVENT = 2;
      }
      const smallBus = new SmallBus();

      smallBus.subscribe('TestEvent', () => Promise.resolve());
      smallBus.registerHandler('TestEvent', new TestEventHandler());

      expect(() => smallBus.subscribe('TestEvent', () => Promise.resolve())).toThrow(
        'Maximum handlers (2) exceeded for event "TestEvent"'
      );
    });
  });

  describe('publishMany (UX-C10)', () => {
    it('publishes all events in parallel by default', async () => {
      const handler = vi.fn();
      eventBus.subscribe('TestEvent', handler);

      await eventBus.publishMany([new TestEvent('a'), new TestEvent('b'), new TestEvent('c')]);

      expect(handler).toHaveBeenCalledTimes(3);
    });

    it('preserves strict array order with { sequential: true }', async () => {
      const order: string[] = [];
      eventBus.subscribe('TestEvent', async event => {
        const value = (event as TestEvent).value;
        if (value === 'first') {
          // Delay the first event's handler; parallel dispatch would let
          // the second event's handler finish before it.
          await new Promise(resolve => setTimeout(resolve, 20));
        }
        order.push(value);
      });

      await eventBus.publishMany([new TestEvent('first'), new TestEvent('second')], {
        sequential: true,
      });

      expect(order).toEqual(['first', 'second']);
    });
  });
});
