import { describe, it, expect, vi } from 'vitest';
import { safeRun } from '@vytches/ddd-utils';
import { EntityId, type IDomainEvent, type IEventStore } from '@vytches/ddd-contracts';

import { AggregateRoot } from '../../src/core/aggregate-root';
import { EventSourcingCapability } from '../../src/capabilities/event-sourcing-capability';
import { AggregateError } from '../../src/aggregate-errors';
import type { IAggregateConstructorParams } from '../../src/aggregate-interfaces';

class Order extends AggregateRoot<string> {
  appliedPayloads: unknown[] = [];

  constructor(params: IAggregateConstructorParams<string>) {
    super(params);
    this.registerEventHandler<{ amount: number }>('Created', payload => {
      this.appliedPayloads.push(payload);
    });
  }

  applyEvent(name: string, payload: unknown, metadata?: Record<string, unknown>): void {
    this.apply(name, payload, metadata);
  }
}

class FakeEventStore implements IEventStore {
  saveEvents = vi.fn(async (_id: unknown, _events: IDomainEvent[], _v: number): Promise<void> => {
    return undefined;
  });
  getEvents = vi.fn(async (_id: unknown): Promise<IDomainEvent[]> => []);
  getEventsAfterVersion = vi.fn(
    async (_id: unknown, _v: number): Promise<IDomainEvent[]> => []
  );
}

const newES = (): {
  order: Order;
  es: EventSourcingCapability;
  store: FakeEventStore;
} => {
  const order = new Order({ id: EntityId.create(), version: 0 });
  const es = new EventSourcingCapability();
  order.addCapability(es);
  const store = new FakeEventStore();
  return { order, es, store };
};

describe('EventSourcingCapability — setEventStore / getEventStore / hasEventStore', () => {
  it('returns null and false before any store is configured', () => {
    const { es } = newES();
    expect(es.getEventStore()).toBeNull();
    expect(es.hasEventStore()).toBe(false);
  });

  it('sets and exposes the configured store', () => {
    const { es, store } = newES();
    es.setEventStore(store);
    expect(es.getEventStore()).toBe(store);
    expect(es.hasEventStore()).toBe(true);
  });
});

describe('EventSourcingCapability — getStreamName', () => {
  it('returns "<AggregateType>-<id>" composed from constructor.name + id', () => {
    const { order, es } = newES();
    const name = es.getStreamName();
    expect(name.startsWith('Order-')).toBe(true);
    expect(name).toContain(order.getId().toString());
  });
});

describe('EventSourcingCapability — saveToEventStore', () => {
  it('throws AggregateError when store is not configured', async () => {
    const { es } = newES();
    const [error] = await safeRun(async () => es.saveToEventStore());
    expect(error).toBeInstanceOf(AggregateError);
  });

  it('calls store.saveEvents with id, events copy, and initialVersion', async () => {
    const { order, es, store } = newES();
    order.applyEvent('Created', { amount: 99 });
    es.setEventStore(store);
    await es.saveToEventStore();
    expect(store.saveEvents).toHaveBeenCalledTimes(1);
    const [idArg, eventsArg, versionArg] = store.saveEvents.mock.calls[0]!;
    expect(idArg).toBe(order.getId().toString());
    expect(Array.isArray(eventsArg)).toBe(true);
    expect((eventsArg as IDomainEvent[]).length).toBe(1);
    expect(typeof versionArg).toBe('number');
  });

  it('returns without calling store.saveEvents when there are no uncommitted events', async () => {
    const { es, store } = newES();
    es.setEventStore(store);
    await es.saveToEventStore();
    expect(store.saveEvents).not.toHaveBeenCalled();
  });
});

describe('EventSourcingCapability — loadFromEventStore', () => {
  it('throws AggregateError when store is not configured', async () => {
    const { es } = newES();
    const [error] = await safeRun(async () => es.loadFromEventStore('agg-1'));
    expect(error).toBeInstanceOf(AggregateError);
  });

  it('returns early when store has no events for the aggregate id', async () => {
    const { order, es, store } = newES();
    es.setEventStore(store);
    store.getEvents.mockResolvedValueOnce([]);
    await es.loadFromEventStore('agg-1');
    expect(order.appliedPayloads).toHaveLength(0);
  });

  it('replays events through aggregate.loadFromHistory when store returns events', async () => {
    const { order, es, store } = newES();
    es.setEventStore(store);
    const event: IDomainEvent = {
      eventName: 'Created',
      payload: { amount: 50 },
      metadata: {},
    } as unknown as IDomainEvent;
    store.getEvents.mockResolvedValueOnce([event]);
    await es.loadFromEventStore(order.getId().toString());
    expect(order.appliedPayloads).toEqual([{ amount: 50 }]);
  });
});

describe('EventSourcingCapability — loadFromVersion', () => {
  it('throws AggregateError when store is not configured', async () => {
    const { es } = newES();
    const [error] = await safeRun(async () => es.loadFromVersion('agg-1', 3));
    expect(error).toBeInstanceOf(AggregateError);
  });

  it('calls store.getEventsAfterVersion with id and fromVersion', async () => {
    const { es, store } = newES();
    es.setEventStore(store);
    await es.loadFromVersion('agg-1', 5);
    expect(store.getEventsAfterVersion).toHaveBeenCalledWith('agg-1', 5);
  });

  it('does not call loadFromHistory when no events are returned', async () => {
    const { order, es, store } = newES();
    es.setEventStore(store);
    store.getEventsAfterVersion.mockResolvedValueOnce([]);
    await es.loadFromVersion('agg-1', 0);
    expect(order.appliedPayloads).toHaveLength(0);
  });

  it('replays returned events when present', async () => {
    const { order, es, store } = newES();
    es.setEventStore(store);
    const event: IDomainEvent = {
      eventName: 'Created',
      payload: { amount: 7 },
      metadata: {},
    } as unknown as IDomainEvent;
    store.getEventsAfterVersion.mockResolvedValueOnce([event]);
    await es.loadFromVersion('agg-1', 0);
    expect(order.appliedPayloads).toEqual([{ amount: 7 }]);
  });
});

describe('EventSourcingCapability — type metadata', () => {
  it('exposes type "eventSourcing" on instance and capabilityType on class', () => {
    expect(new EventSourcingCapability().type).toBe('eventSourcing');
    expect(EventSourcingCapability.capabilityType).toBe('eventSourcing');
  });
});
