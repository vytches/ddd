import { describe, it, expect, vi } from 'vitest';
import { safeRun } from '@vytches/ddd-utils';
import { EntityId, type IDomainEvent, type IEventUpcaster } from '@vytches/ddd-contracts';

import { AggregateRoot } from '../../src/core/aggregate-root';
import { VersioningCapability } from '../../src/capabilities/versioning-capability';
import type {
  IAggregateConstructorParams,
  IAggregateEventHandler,
} from '../../src/aggregate-interfaces';

class Order extends AggregateRoot<string> {
  constructor(params: IAggregateConstructorParams<string>) {
    super(params);
    this.registerEventHandler('Created', () => undefined);
  }
}

const newVersioned = (): { order: Order; versioning: VersioningCapability } => {
  const order = new Order({ id: EntityId.create(), version: 0 });
  const versioning = new VersioningCapability();
  order.addCapability(versioning);
  return { order, versioning };
};

const upcasterFor = <TFrom, TTo>(fn: (p: TFrom) => TTo): IEventUpcaster<TFrom, TTo> => ({
  upcast: fn,
});

describe('VersioningCapability — registerUpcaster', () => {
  it('registers a single upcaster', () => {
    const { versioning } = newVersioned();
    versioning.registerUpcaster('OrderCreated', 1, upcasterFor((p: unknown) => p));
    expect(versioning.hasUpcaster('OrderCreated', 1)).toBe(true);
  });

  it('registers multiple versions for the same event type', () => {
    const { versioning } = newVersioned();
    versioning.registerUpcaster('OrderCreated', 1, upcasterFor((p: unknown) => p));
    versioning.registerUpcaster('OrderCreated', 2, upcasterFor((p: unknown) => p));
    expect(versioning.hasUpcaster('OrderCreated', 1)).toBe(true);
    expect(versioning.hasUpcaster('OrderCreated', 2)).toBe(true);
  });

  it('registers upcasters for different event types', () => {
    const { versioning } = newVersioned();
    versioning.registerUpcaster('A', 1, upcasterFor((p: unknown) => p));
    versioning.registerUpcaster('B', 1, upcasterFor((p: unknown) => p));
    expect(versioning.getRegisteredEventTypes().sort()).toEqual(['A', 'B']);
  });

  it('overwrites an existing upcaster for same (eventType, version)', () => {
    const { versioning } = newVersioned();
    const first = upcasterFor((p: unknown) => p);
    const second = upcasterFor(() => 'replaced');
    versioning.registerUpcaster('A', 1, first);
    versioning.registerUpcaster('A', 1, second);
    expect(versioning.getUpcastersForType('A')?.get(1)).toBe(second);
  });
});

describe('VersioningCapability — hasUpcaster / getUpcastersForType', () => {
  it('hasUpcaster returns false for unregistered event type', () => {
    const { versioning } = newVersioned();
    expect(versioning.hasUpcaster('Unknown', 1)).toBe(false);
  });

  it('hasUpcaster returns false for unregistered version', () => {
    const { versioning } = newVersioned();
    versioning.registerUpcaster('A', 1, upcasterFor((p: unknown) => p));
    expect(versioning.hasUpcaster('A', 2)).toBe(false);
  });

  it('getUpcastersForType returns the version map for a known event type', () => {
    const { versioning } = newVersioned();
    versioning.registerUpcaster('A', 1, upcasterFor((p: unknown) => p));
    versioning.registerUpcaster('A', 2, upcasterFor((p: unknown) => p));
    const map = versioning.getUpcastersForType('A');
    expect(map?.size).toBe(2);
    expect(map?.has(1)).toBe(true);
    expect(map?.has(2)).toBe(true);
  });

  it('getUpcastersForType returns undefined for unknown event type', () => {
    const { versioning } = newVersioned();
    expect(versioning.getUpcastersForType('Unknown')).toBeUndefined();
  });
});

describe('VersioningCapability — clearUpcastersForType / getTotalUpcasterCount', () => {
  it('clearUpcastersForType removes all upcasters for that event type only', () => {
    const { versioning } = newVersioned();
    versioning.registerUpcaster('A', 1, upcasterFor((p: unknown) => p));
    versioning.registerUpcaster('A', 2, upcasterFor((p: unknown) => p));
    versioning.registerUpcaster('B', 1, upcasterFor((p: unknown) => p));
    versioning.clearUpcastersForType('A');
    expect(versioning.hasUpcaster('A', 1)).toBe(false);
    expect(versioning.hasUpcaster('A', 2)).toBe(false);
    expect(versioning.hasUpcaster('B', 1)).toBe(true);
  });

  it('getTotalUpcasterCount sums upcasters across event types', () => {
    const { versioning } = newVersioned();
    expect(versioning.getTotalUpcasterCount()).toBe(0);
    versioning.registerUpcaster('A', 1, upcasterFor((p: unknown) => p));
    versioning.registerUpcaster('A', 2, upcasterFor((p: unknown) => p));
    versioning.registerUpcaster('B', 1, upcasterFor((p: unknown) => p));
    expect(versioning.getTotalUpcasterCount()).toBe(3);
  });
});

describe('VersioningCapability — handleVersionedEvent', () => {
  const buildEvent = (
    name: string,
    payload: unknown,
    metadata: Record<string, unknown> = {}
  ): IDomainEvent =>
    ({
      eventName: name,
      payload,
      metadata,
    }) as unknown as IDomainEvent;

  const buildHandlers = (
    handler: IAggregateEventHandler
  ): Map<string, IAggregateEventHandler> => {
    const map = new Map<string, IAggregateEventHandler>();
    map.set('Evt', handler);
    return map;
  };

  it('runs handler with the original payload when version is current', () => {
    const { versioning } = newVersioned();
    const handler = vi.fn();
    versioning.handleVersionedEvent(buildEvent('Evt', { v: 1 }), buildHandlers(handler));
    expect(handler).toHaveBeenCalledWith({ v: 1 }, expect.any(Object));
  });

  it('upcasts payload through registered upcasters when targetVersion > eventVersion', () => {
    const { versioning } = newVersioned();
    versioning.registerUpcaster('Evt', 1, upcasterFor((p: { v: number }) => ({ v: p.v + 10 })));
    const handler = vi.fn();
    versioning.handleVersionedEvent(
      buildEvent('Evt', { v: 1 }, { version: 1, targetVersion: 2 }),
      buildHandlers(handler)
    );
    expect(handler).toHaveBeenCalledWith({ v: 11 }, expect.objectContaining({ version: 2 }));
  });

  it('chains multiple upcasters in sequence (v1 → v2 → v3)', () => {
    const { versioning } = newVersioned();
    versioning.registerUpcaster('Evt', 1, upcasterFor((p: { v: number }) => ({ v: p.v + 1 })));
    versioning.registerUpcaster('Evt', 2, upcasterFor((p: { v: number }) => ({ v: p.v * 10 })));
    const handler = vi.fn();
    versioning.handleVersionedEvent(
      buildEvent('Evt', { v: 1 }, { version: 1, targetVersion: 3 }),
      buildHandlers(handler)
    );
    // v1 -> v2: {v:2}; v2 -> v3: {v:20}
    expect(handler).toHaveBeenCalledWith({ v: 20 }, expect.objectContaining({ version: 3 }));
  });

  it('skips missing upcasters in the chain (warns instead of throwing)', () => {
    const { versioning } = newVersioned();
    // Only register v2 -> v3, leave v1 -> v2 missing
    versioning.registerUpcaster('Evt', 2, upcasterFor((p: { v: number }) => ({ v: p.v + 100 })));
    const handler = vi.fn();
    versioning.handleVersionedEvent(
      buildEvent('Evt', { v: 1 }, { version: 1, targetVersion: 3 }),
      buildHandlers(handler)
    );
    expect(handler).toHaveBeenCalled();
  });

  it('does nothing if there is no handler for the event name', () => {
    const { versioning } = newVersioned();
    const [error] = safeRun(() =>
      versioning.handleVersionedEvent(buildEvent('Evt', {}), new Map())
    );
    expect(error).toBeUndefined();
  });

  it('treats event without metadata.version as version 1', () => {
    const { versioning } = newVersioned();
    const handler = vi.fn();
    versioning.handleVersionedEvent(buildEvent('Evt', { x: 1 }), buildHandlers(handler));
    expect(handler).toHaveBeenCalled();
  });
});

describe('VersioningCapability — type metadata', () => {
  it('exposes type "versioning" on instance and capabilityType on class', () => {
    expect(new VersioningCapability().type).toBe('versioning');
    expect(VersioningCapability.capabilityType).toBe('versioning');
  });
});
