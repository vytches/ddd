/**
 * Tests for VP-007 Phase 4: ContextAwareEventDispatcher and OnModuleDestroy.
 *
 * Coverage:
 * - ContextAwareEventDispatcher routes IntegrationEvent → global bus
 * - ContextAwareEventDispatcher routes DomainEvent → LOCAL_EVENT_BUS
 * - Graceful handling when buses are absent
 * - dispatchEventsForAggregate commits aggregate on success, rethrows on failure
 * - FeatureHandlerRegistrar.onModuleDestroy() calls dispose() on buses that support it
 * - EnhancedQueryBus.dispose() clears the setInterval and caches
 */
import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IDomainEvent, IAggregateWithEvents } from '@vytches/ddd-contracts';

import { ContextAwareEventDispatcher } from '../../src/dispatchers/context-aware-event-dispatcher';
import { FeatureHandlerRegistrar } from '../../src/feature/feature-handler-registrar';

vi.mock('@vytches/ddd-logging', () => ({
  Logger: {
    forContext: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }),
  },
}));

// ─── Shared event stubs ───────────────────────────────────────────────────────

class StubIntegrationEvent {
  readonly eventName = 'StubIntegrationEvent';
  readonly payload = {};
}

class StubDomainEvent {
  readonly eventName = 'StubDomainEvent';
  readonly payload = {};
}

// ─── ContextAwareEventDispatcher ─────────────────────────────────────────────

describe('ContextAwareEventDispatcher', () => {
  let globalBus: { publish: ReturnType<typeof vi.fn> };
  let localBus: { publish: ReturnType<typeof vi.fn> };
  let dispatcher: ContextAwareEventDispatcher;

  beforeEach(async () => {
    // Stub IntegrationEvent instanceof check via the real class from @vytches/ddd-events
    globalBus = { publish: vi.fn().mockResolvedValue(undefined) };
    localBus = { publish: vi.fn().mockResolvedValue(undefined) };
  });

  describe('event routing', () => {
    it('routes IntegrationEvent to the global bus', async () => {
      const { IntegrationEvent } = await import('@vytches/ddd-events');

      class OrderShippedIntegrationEvent extends IntegrationEvent {
        constructor() {
          super({ payload: {} } as never);
        }
      }

      dispatcher = new ContextAwareEventDispatcher(globalBus as never, localBus as never);

      await dispatcher.dispatchEvent(new OrderShippedIntegrationEvent() as never);

      expect(globalBus.publish).toHaveBeenCalledTimes(1);
      expect(localBus.publish).not.toHaveBeenCalled();
    });

    it('routes plain domain events to the local bus', async () => {
      dispatcher = new ContextAwareEventDispatcher(globalBus as never, localBus as never);

      const domainEvent: IDomainEvent = { eventName: 'OrderPlaced', payload: {} };
      await dispatcher.dispatchEvent(domainEvent);

      expect(localBus.publish).toHaveBeenCalledTimes(1);
      expect(globalBus.publish).not.toHaveBeenCalled();
    });

    it('routes DomainEvent subclass instances to the local bus', async () => {
      const { DomainEvent } = await import('@vytches/ddd-events');

      class OrderPlacedEvent extends DomainEvent {
        readonly eventName = 'OrderPlacedEvent';
      }

      dispatcher = new ContextAwareEventDispatcher(globalBus as never, localBus as never);

      await dispatcher.dispatchEvent(new OrderPlacedEvent({} as never) as never);

      expect(localBus.publish).toHaveBeenCalledTimes(1);
      expect(globalBus.publish).not.toHaveBeenCalled();
    });

    it('dispatches multiple events individually with correct routing', async () => {
      const { IntegrationEvent, DomainEvent } = await import('@vytches/ddd-events');

      class ShippedIntegration extends IntegrationEvent {
        constructor() {
          super({ payload: {} } as never);
        }
      }
      class PlacedDomain extends DomainEvent {
        readonly eventName = 'Placed';
      }

      dispatcher = new ContextAwareEventDispatcher(globalBus as never, localBus as never);

      await dispatcher.dispatchEvents(
        new PlacedDomain({} as never) as never,
        new ShippedIntegration() as never,
        new PlacedDomain({} as never) as never
      );

      expect(localBus.publish).toHaveBeenCalledTimes(2);
      expect(globalBus.publish).toHaveBeenCalledTimes(1);
    });
  });

  describe('missing bus handling', () => {
    it('silently drops IntegrationEvent when global bus is not provided', async () => {
      const { IntegrationEvent } = await import('@vytches/ddd-events');

      class TestIntegration extends IntegrationEvent {
        constructor() {
          super({ payload: {} } as never);
        }
      }

      dispatcher = new ContextAwareEventDispatcher(undefined, localBus as never);

      await expect(dispatcher.dispatchEvent(new TestIntegration() as never)).resolves.not.toThrow();
      expect(localBus.publish).not.toHaveBeenCalled();
    });

    it('silently drops DomainEvent when local bus is not provided', async () => {
      dispatcher = new ContextAwareEventDispatcher(globalBus as never, undefined);

      const domainEvent: IDomainEvent = { eventName: 'Test', payload: {} };
      await expect(dispatcher.dispatchEvent(domainEvent)).resolves.not.toThrow();
      expect(globalBus.publish).not.toHaveBeenCalled();
    });

    it('works with both buses absent', async () => {
      dispatcher = new ContextAwareEventDispatcher(undefined, undefined);

      const domainEvent: IDomainEvent = { eventName: 'Test', payload: {} };
      await expect(dispatcher.dispatchEvent(domainEvent)).resolves.not.toThrow();
    });
  });

  describe('dispatchEventsForAggregate', () => {
    it('commits the aggregate after successful dispatch', async () => {
      dispatcher = new ContextAwareEventDispatcher(globalBus as never, localBus as never);

      const commitSpy = vi.fn();
      const domainEvent: IDomainEvent = { eventName: 'Placed', payload: {} };
      const aggregate: IAggregateWithEvents = {
        getDomainEvents: vi.fn().mockReturnValue([domainEvent]),
        commit: commitSpy,
      };

      await dispatcher.dispatchEventsForAggregate(aggregate);

      expect(localBus.publish).toHaveBeenCalledWith(domainEvent);
      expect(commitSpy).toHaveBeenCalledOnce();
    });

    it('does not commit and rethrows when dispatch fails', async () => {
      const failingBus = { publish: vi.fn().mockRejectedValue(new Error('bus down')) };
      dispatcher = new ContextAwareEventDispatcher(failingBus as never, failingBus as never);

      const commitSpy = vi.fn();
      const domainEvent: IDomainEvent = { eventName: 'Placed', payload: {} };
      const aggregate: IAggregateWithEvents = {
        getDomainEvents: vi.fn().mockReturnValue([domainEvent]),
        commit: commitSpy,
      };

      await expect(dispatcher.dispatchEventsForAggregate(aggregate)).rejects.toThrow('bus down');
      expect(commitSpy).not.toHaveBeenCalled();
    });

    it('does nothing and does not commit when aggregate has no events', async () => {
      dispatcher = new ContextAwareEventDispatcher(globalBus as never, localBus as never);

      const commitSpy = vi.fn();
      const aggregate: IAggregateWithEvents = {
        getDomainEvents: vi.fn().mockReturnValue([]),
        commit: commitSpy,
      };

      await dispatcher.dispatchEventsForAggregate(aggregate);

      expect(commitSpy).not.toHaveBeenCalled();
      expect(localBus.publish).not.toHaveBeenCalled();
      expect(globalBus.publish).not.toHaveBeenCalled();
    });
  });
});

// ─── FeatureHandlerRegistrar.onModuleDestroy ──────────────────────────────────

describe('FeatureHandlerRegistrar.onModuleDestroy()', () => {
  const anchorToken = Symbol('test:feature:destroy');

  function makeRegistrar(commandBus: unknown, queryBus: unknown, eventBus: unknown) {
    return new FeatureHandlerRegistrar(
      commandBus as never,
      queryBus as never,
      eventBus as never,
      anchorToken,
      { get: vi.fn() } as never,
      new Map() as never,
      undefined
    );
  }

  it('calls dispose() on commandBus when it has a dispose method', () => {
    const disposeSpy = vi.fn();
    const bus = { register: vi.fn(), execute: vi.fn(), dispose: disposeSpy };

    const registrar = makeRegistrar(bus, { execute: vi.fn() }, { publish: vi.fn() });
    registrar.onModuleDestroy();

    expect(disposeSpy).toHaveBeenCalledOnce();
  });

  it('calls dispose() on queryBus when it has a dispose method', () => {
    const disposeSpy = vi.fn();
    const bus = { register: vi.fn(), execute: vi.fn(), dispose: disposeSpy };

    const registrar = makeRegistrar({ execute: vi.fn() }, bus, { publish: vi.fn() });
    registrar.onModuleDestroy();

    expect(disposeSpy).toHaveBeenCalledOnce();
  });

  it('calls dispose() on localEventBus when it has a dispose method', () => {
    const disposeSpy = vi.fn();
    const bus = { publish: vi.fn(), dispose: disposeSpy };

    const registrar = makeRegistrar({ execute: vi.fn() }, { execute: vi.fn() }, bus);
    registrar.onModuleDestroy();

    expect(disposeSpy).toHaveBeenCalledOnce();
  });

  it('does not throw when buses have no dispose method', () => {
    const registrar = makeRegistrar(
      { register: vi.fn(), execute: vi.fn() },
      { register: vi.fn(), execute: vi.fn() },
      { publish: vi.fn() }
    );

    expect(() => registrar.onModuleDestroy()).not.toThrow();
  });

  it('disposes all three buses when all have dispose methods', () => {
    const commandDispose = vi.fn();
    const queryDispose = vi.fn();
    const eventDispose = vi.fn();

    const registrar = makeRegistrar(
      { execute: vi.fn(), dispose: commandDispose },
      { execute: vi.fn(), dispose: queryDispose },
      { publish: vi.fn(), dispose: eventDispose }
    );

    registrar.onModuleDestroy();

    expect(commandDispose).toHaveBeenCalledOnce();
    expect(queryDispose).toHaveBeenCalledOnce();
    expect(eventDispose).toHaveBeenCalledOnce();
  });
});

// ─── EnhancedQueryBus.dispose() ──────────────────────────────────────────────

describe('EnhancedQueryBus.dispose()', () => {
  it('clears the cache cleanup interval and caches', async () => {
    vi.useFakeTimers();

    const { EnhancedQueryBus } = await import('@vytches/ddd-cqrs');
    const container = {
      get: vi.fn(),
      getAll: vi.fn().mockReturnValue([]),
      register: vi.fn(),
      has: vi.fn().mockReturnValue(false),
    };
    const bus = new EnhancedQueryBus(container as never, { enableMetrics: false });

    expect(() => bus.dispose()).not.toThrow();

    // Advance timers — the cleanup interval should not fire after dispose
    const cleanSpy = vi.spyOn(bus as never, 'cleanHandlerCache' as never);
    vi.advanceTimersByTime(120000); // 2 minutes — should fire twice if interval is running

    expect(cleanSpy).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('is idempotent — calling dispose() twice does not throw', async () => {
    const { EnhancedQueryBus } = await import('@vytches/ddd-cqrs');
    const container = {
      get: vi.fn(),
      getAll: vi.fn().mockReturnValue([]),
      register: vi.fn(),
      has: vi.fn().mockReturnValue(false),
    };
    const bus = new EnhancedQueryBus(container as never, { enableMetrics: false });

    expect(() => {
      bus.dispose();
      bus.dispose();
    }).not.toThrow();
  });
});
