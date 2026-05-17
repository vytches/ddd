import { describe, it, expect } from 'vitest';
import { safeRun } from '@vytches/ddd-utils';
import { EntityId } from '@vytches/ddd-contracts';

import { AggregateRoot } from '../../src/core/aggregate-root';
import { SnapshotCapability } from '../../src/capabilities/snapshot-capability';
import { AggregateError } from '../../src/aggregate-errors';
import type { IAggregateConstructorParams } from '../../src/aggregate-interfaces';

interface OrderState {
  amount: number;
  customerId: string;
}

class Order extends AggregateRoot<string> {
  amount = 0;
  customerId = '';

  constructor(params: IAggregateConstructorParams<string>) {
    super(params);
    this.registerEventHandler<{ amount: number; customerId: string }>('Created', payload => {
      this.amount = payload!.amount;
      this.customerId = payload!.customerId;
    });
  }

  applyEvent(name: string, payload: unknown, metadata?: Record<string, unknown>): void {
    this.apply(name, payload, metadata);
  }
}

const newSnap = (id: EntityId<string> = EntityId.create()) => {
  const order = new Order({ id, version: 0 });
  const snap = new SnapshotCapability<OrderState>();
  order.addCapability(snap);
  return { order, snap, id };
};

describe('SnapshotCapability — createSnapshot', () => {
  it('captures aggregateId, aggregateType, version, state, timestamp', () => {
    const { order, snap } = newSnap();
    order.applyEvent('Created', { amount: 100, customerId: 'c-1' });
    const snapshot = snap.createSnapshot(() => ({
      amount: order.amount,
      customerId: order.customerId,
    }));
    expect(snapshot.aggregateType).toBe('Order');
    expect(snapshot.version).toBe(1);
    expect(snapshot.state).toEqual({ amount: 100, customerId: 'c-1' });
    expect(snapshot.timestamp).toBeInstanceOf(Date);
    expect(snapshot.aggregateId).toBeDefined();
  });

  it('embeds lastEventId when at least one domain event has been applied', () => {
    const { order, snap } = newSnap();
    order.applyEvent('Created', { amount: 1, customerId: 'c-1' });
    const snapshot = snap.createSnapshot(() => ({
      amount: order.amount,
      customerId: order.customerId,
    }));
    expect(snapshot.lastEventId).toBeDefined();
  });

  it('omits lastEventId when no events have been applied', () => {
    const { snap } = newSnap();
    const snapshot = snap.createSnapshot(() => ({ amount: 0, customerId: '' }));
    expect(snapshot.lastEventId).toBeUndefined();
  });

  it('uses metadataCreator when provided', () => {
    const { snap } = newSnap();
    const snapshot = snap.createSnapshot(
      () => ({ amount: 0, customerId: '' }),
      () => ({ author: 'tester' }) as never
    );
    expect(snapshot.metadata).toEqual({ author: 'tester' });
  });

  it('omits metadata when metadataCreator is not provided', () => {
    const { snap } = newSnap();
    const snapshot = snap.createSnapshot(() => ({ amount: 0, customerId: '' }));
    expect(snapshot.metadata).toBeUndefined();
  });
});

describe('SnapshotCapability — restoreFromSnapshot', () => {
  it('calls deserializer with snapshot.state', () => {
    const sharedId = EntityId.create();
    const a = newSnap(sharedId);
    a.order.applyEvent('Created', { amount: 50, customerId: 'c-x' });
    const snapshot = a.snap.createSnapshot(() => ({
      amount: a.order.amount,
      customerId: a.order.customerId,
    }));

    const b = newSnap(sharedId);
    let received: OrderState | null = null;
    b.snap.restoreFromSnapshot(snapshot, state => {
      received = state;
    });
    expect(received).toEqual({ amount: 50, customerId: 'c-x' });
  });

  it('invokes metadataRestorer when snapshot has metadata', () => {
    const sharedId = EntityId.create();
    const a = newSnap(sharedId);
    a.order.applyEvent('Created', { amount: 5, customerId: 'c-1' });
    const snapshot = a.snap.createSnapshot(
      () => ({ amount: a.order.amount, customerId: a.order.customerId }),
      () => ({ author: 'tester' }) as never
    );

    const b = newSnap(sharedId);
    let receivedMeta: unknown = null;
    b.snap.restoreFromSnapshot(
      snapshot,
      () => undefined,
      meta => {
        receivedMeta = meta;
      }
    );
    expect(receivedMeta).toEqual({ author: 'tester' });
  });

  it('skips metadataRestorer when no metadata is present', () => {
    const sharedId = EntityId.create();
    const a = newSnap(sharedId);
    const snapshot = a.snap.createSnapshot(() => ({ amount: 0, customerId: '' }));

    const b = newSnap(sharedId);
    let called = false;
    b.snap.restoreFromSnapshot(
      snapshot,
      () => undefined,
      () => {
        called = true;
      }
    );
    expect(called).toBe(false);
  });

  it('throws AggregateError when snapshot is null/undefined', () => {
    const { snap } = newSnap();
    const [error] = safeRun(() =>
      snap.restoreFromSnapshot(null as never, () => undefined)
    );
    expect(error).toBeInstanceOf(AggregateError);
  });

  it('throws AggregateError when snapshot has no state', () => {
    const { snap } = newSnap();
    const [error] = safeRun(() =>
      snap.restoreFromSnapshot(
        {
          aggregateId: 'x',
          aggregateType: 'Order',
          version: 1,
          state: undefined,
          timestamp: new Date(),
        } as never,
        () => undefined
      )
    );
    expect(error).toBeInstanceOf(AggregateError);
  });

  it('throws idMismatch when snapshot.aggregateId does not match aggregate id', () => {
    const a = newSnap();
    a.order.applyEvent('Created', { amount: 1, customerId: 'c-1' });
    const snapshot = a.snap.createSnapshot(() => ({
      amount: a.order.amount,
      customerId: a.order.customerId,
    }));

    const b = newSnap(); // different id
    const [error] = safeRun(() => b.snap.restoreFromSnapshot(snapshot, () => undefined));
    expect(error).toBeInstanceOf(AggregateError);
    expect((error as AggregateError).message).toContain('ID mismatch');
  });

  it('throws typeMismatch when snapshot.aggregateType does not match constructor.name', () => {
    const sharedId = EntityId.create();
    const a = newSnap(sharedId);
    a.order.applyEvent('Created', { amount: 1, customerId: 'c-1' });
    const snapshot = a.snap.createSnapshot(() => ({
      amount: a.order.amount,
      customerId: a.order.customerId,
    }));
    const tampered = { ...snapshot, aggregateType: 'OtherType' };

    const b = newSnap(sharedId);
    const [error] = safeRun(() => b.snap.restoreFromSnapshot(tampered, () => undefined));
    expect(error).toBeInstanceOf(AggregateError);
    expect((error as AggregateError).message).toContain('mismatch');
  });
});

describe('SnapshotCapability — saveSnapshot / saveTemporaryState / getPreviousState', () => {
  it('saveSnapshot stores a snapshot retrievable by getPreviousState (one-shot)', () => {
    const { order, snap } = newSnap();
    order.applyEvent('Created', { amount: 1, customerId: 'c' });
    snap.saveSnapshot(() => ({ amount: order.amount, customerId: order.customerId }));

    const previous = snap.getPreviousState();
    expect(previous).not.toBeNull();
    expect(previous?.state).toEqual({ amount: 1, customerId: 'c' });

    // getPreviousState clears the slot — second call returns null
    expect(snap.getPreviousState()).toBeNull();
  });

  it('saveTemporaryState wraps a state value in a snapshot (without serializer)', () => {
    const { snap } = newSnap();
    snap.saveTemporaryState!({ amount: 7, customerId: 'c-7' });
    const previous = snap.getPreviousState();
    expect(previous?.state).toEqual({ amount: 7, customerId: 'c-7' });
  });

  it('getLastSnapshotTimestamp returns null before any save and the timestamp after', () => {
    const { snap } = newSnap();
    expect(snap.getLastSnapshotTimestamp!()).toBeNull();
    snap.saveTemporaryState!({ amount: 1, customerId: 'c' });
    expect(snap.getLastSnapshotTimestamp!()).toBeInstanceOf(Date);
  });
});

describe('SnapshotCapability — type metadata', () => {
  it('exposes type "snapshot" on instance and capabilityType on class', () => {
    expect(new SnapshotCapability().type).toBe('snapshot');
    expect(SnapshotCapability.capabilityType).toBe('snapshot');
  });
});
