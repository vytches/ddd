import { describe, it, expect } from 'vitest';
import { safeRun } from '@vytches/ddd-utils';
import { EntityId, type IDomainEvent } from '@vytches/ddd-contracts';

import { AggregateRoot } from '../src/core/aggregate-root';
import { AggregateBuilder } from '../src/core/aggregate-root.builder';
import { SnapshotCapability } from '../src/capabilities/snapshot-capability';
import { AuditCapability } from '../src/capabilities/audit-capability';
import { VersioningCapability } from '../src/capabilities/versioning-capability';
import type { IAggregateConstructorParams } from '../src/aggregate-interfaces';

interface OrderCreatedPayload {
  customerId: string;
  amount: number;
}

interface OrderItemAddedPayload {
  sku: string;
  quantity: number;
}

/**
 * Test fixture aggregate. Fields are `private` (mutated only inside event
 * handlers via `apply()`) and exposed via read-only getters — matches the
 * canonical aggregate pattern enforced by ddd-lint rule `ddd-001`.
 */
class Order extends AggregateRoot<string> {
  private _customerId = '';
  private _amount = 0;
  private _items: ReadonlyArray<{ sku: string; quantity: number }> = [];

  constructor(params: IAggregateConstructorParams<string>) {
    super(params);
    this.registerEventHandler<OrderCreatedPayload>('OrderCreated', payload => {
      this._customerId = payload!.customerId;
      this._amount = payload!.amount;
    });
    this.registerEventHandler<OrderItemAddedPayload>('OrderItemAdded', payload => {
      this._items = [...this._items, { sku: payload!.sku, quantity: payload!.quantity }];
    });
  }

  get customerId(): string {
    return this._customerId;
  }
  get amount(): number {
    return this._amount;
  }
  get items(): ReadonlyArray<{ sku: string; quantity: number }> {
    return this._items;
  }

  // expose protected methods for testing
  applyEvent(name: string, payload: unknown, metadata?: Record<string, unknown>): void {
    this.apply(name, payload, metadata);
  }

  loadFrom(events: IDomainEvent[]): void {
    this.loadFromHistory(events);
  }
}

const newOrder = (overrides: Partial<IAggregateConstructorParams<string>> = {}) =>
  new Order({
    id: EntityId.create(),
    version: 0,
    ...overrides,
  });

describe('AggregateRoot — full lifecycle', () => {
  describe('apply() invariants', () => {
    it('records the event in domain events list', () => {
      const order = newOrder();
      order.applyEvent('OrderCreated', { customerId: 'c-1', amount: 100 });

      const events = order.getDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]!.eventName).toBe('OrderCreated');
      expect(events[0]!.payload).toEqual({ customerId: 'c-1', amount: 100 });
    });

    it('increments version monotonically', () => {
      const order = newOrder();
      expect(order.getVersion()).toBe(0);

      order.applyEvent('OrderCreated', { customerId: 'c-1', amount: 100 });
      expect(order.getVersion()).toBe(1);

      order.applyEvent('OrderItemAdded', { sku: 'A', quantity: 2 });
      expect(order.getVersion()).toBe(2);

      order.applyEvent('OrderItemAdded', { sku: 'B', quantity: 1 });
      expect(order.getVersion()).toBe(3);
    });

    it('runs the registered handler to mutate state', () => {
      const order = newOrder();
      order.applyEvent('OrderCreated', { customerId: 'c-42', amount: 999 });

      expect(order.customerId).toBe('c-42');
      expect(order.amount).toBe(999);
    });

    it('enriches metadata with aggregateId, aggregateType, aggregateVersion', () => {
      const order = newOrder();
      order.applyEvent('OrderCreated', { customerId: 'c-1', amount: 100 });

      const event = order.getDomainEvents()[0]!;
      expect(event.metadata?.aggregateId).toBe(order.getId().toString());
      expect(event.metadata?.aggregateType).toBe('Order');
      expect(event.metadata?.aggregateVersion).toBe(1);
      expect(event.metadata?.timestamp).toBeInstanceOf(Date);
    });

    it('preserves user-supplied metadata when applying events', () => {
      const order = newOrder();
      order.applyEvent(
        'OrderCreated',
        { customerId: 'c-1', amount: 100 },
        { correlationId: 'req-42', userId: 'u-7' }
      );

      const event = order.getDomainEvents()[0]!;
      expect(event.metadata?.correlationId).toBe('req-42');
      expect(event.metadata?.userId).toBe('u-7');
    });

    it('hasChanges() returns true after apply, false after commit', () => {
      const order = newOrder();
      expect(order.hasChanges()).toBe(false);

      order.applyEvent('OrderCreated', { customerId: 'c-1', amount: 100 });
      expect(order.hasChanges()).toBe(true);

      order.commit();
      expect(order.hasChanges()).toBe(false);
    });
  });

  describe('commit()', () => {
    it('clears uncommitted events', () => {
      const order = newOrder();
      order.applyEvent('OrderCreated', { customerId: 'c-1', amount: 100 });
      order.applyEvent('OrderItemAdded', { sku: 'A', quantity: 1 });

      expect(order.getDomainEvents()).toHaveLength(2);
      order.commit();
      expect(order.getDomainEvents()).toHaveLength(0);
    });

    it('preserves the current version after commit', () => {
      const order = newOrder();
      order.applyEvent('OrderCreated', { customerId: 'c-1', amount: 100 });
      order.applyEvent('OrderItemAdded', { sku: 'A', quantity: 1 });

      const versionBefore = order.getVersion();
      order.commit();
      expect(order.getVersion()).toBe(versionBefore);
    });

    it('updates initialVersion to current version (optimistic locking)', () => {
      const order = newOrder();
      order.applyEvent('OrderCreated', { customerId: 'c-1', amount: 100 });
      order.commit();

      expect(order.getInitialVersion()).toBe(order.getVersion());
    });
  });

  describe('loadFromHistory() — reconstitution', () => {
    it('replays events to restore state', () => {
      const order = newOrder();
      order.applyEvent('OrderCreated', { customerId: 'c-1', amount: 100 });
      order.applyEvent('OrderItemAdded', { sku: 'A', quantity: 2 });
      order.applyEvent('OrderItemAdded', { sku: 'B', quantity: 1 });

      const history = order.getDomainEvents().slice();
      const restored = newOrder({ id: order.getId() });
      restored.loadFrom(history as IDomainEvent[]);

      expect(restored.customerId).toBe('c-1');
      expect(restored.amount).toBe(100);
      expect(restored.items).toHaveLength(2);
      expect(restored.getVersion()).toBe(3);
    });

    it('does NOT record replayed events as new uncommitted events', () => {
      const order = newOrder();
      order.applyEvent('OrderCreated', { customerId: 'c-1', amount: 100 });
      const history = order.getDomainEvents().slice() as IDomainEvent[];

      const restored = newOrder({ id: order.getId() });
      restored.loadFrom(history);

      expect(restored.hasChanges()).toBe(false);
      expect(restored.getDomainEvents()).toHaveLength(0);
    });

    it('discards prior uncommitted events on replay (consistency rule)', () => {
      const order = newOrder();
      order.applyEvent('OrderCreated', { customerId: 'c-1', amount: 100 });
      // events not yet committed
      const oldHistory: IDomainEvent[] = [];

      order.loadFrom(oldHistory);
      expect(order.getDomainEvents()).toHaveLength(0);
    });
  });

  describe('maxEvents advisory limit (REL-007)', () => {
    it('throws when uncommitted events exceed limit', () => {
      const order = newOrder({ maxEvents: 3 });
      order.applyEvent('OrderItemAdded', { sku: 'A', quantity: 1 });
      order.applyEvent('OrderItemAdded', { sku: 'B', quantity: 1 });
      order.applyEvent('OrderItemAdded', { sku: 'C', quantity: 1 });

      const [error] = safeRun(() => order.applyEvent('OrderItemAdded', { sku: 'D', quantity: 1 }));
      expect(error).toBeDefined();
      expect(error?.message).toMatch(/maxEvents/);
    });

    // VF-023 (D-7, AC4, regression test for F-C6): the maxEvents guard must
    // run BEFORE any state mutation. Combined into ONE test per D-7 — a
    // naive fix could satisfy "event list does not grow" while still
    // leaving `_version` desynced (bumped on the throwing call), which
    // would then compound into version+2 on the very next successful
    // apply(). Both halves of the invariant must hold together.
    it('preserves invariants — failed apply mutates nothing, and immediate valid retry produces version+1 (not version+2)', () => {
      const order = newOrder({ maxEvents: 1 });
      order.applyEvent('OrderItemAdded', { sku: 'A', quantity: 1 });

      const versionBefore = order.getVersion();
      const eventsBefore = order.getDomainEvents();
      const domainEventsSnapshot = [...eventsBefore];

      // The second apply throws because maxEvents=1 is reached.
      const [error] = safeRun(() => order.applyEvent('OrderItemAdded', { sku: 'B', quantity: 1 }));
      expect(error).toBeDefined();

      // Nothing about the aggregate's state changed as a result of the
      // thrown guard: version, event count, and event content are all
      // identical to before the failed call.
      expect(order.getVersion()).toBe(versionBefore);
      expect(order.getDomainEvents()).toHaveLength(1);
      expect(order.getDomainEvents()).toEqual(domainEventsSnapshot);

      // An immediate valid retry on the SAME instance (commit() clears the
      // uncommitted-event count so the maxEvents guard no longer blocks)
      // must produce version+1 relative to versionBefore — NOT version+2,
      // which would indicate the failed call had already bumped `_version`
      // before throwing (the exact F-C6 regression this test guards
      // against).
      order.commit();
      order.applyEvent('OrderItemAdded', { sku: 'C', quantity: 1 });
      expect(order.getVersion()).toBe(versionBefore + 1);
    });

    it('undefined maxEvents = no limit (backward compatible)', () => {
      const order = newOrder();
      for (let i = 0; i < 100; i++) {
        order.applyEvent('OrderItemAdded', { sku: `SKU-${i}`, quantity: 1 });
      }
      expect(order.getDomainEvents()).toHaveLength(100);
    });
  });

  describe('capability composition', () => {
    it('AuditCapability captures every applied event', () => {
      const order = AggregateBuilder.create({ id: EntityId.create() }).withAudit().build(Order);

      order.applyEvent('OrderCreated', { customerId: 'c-1', amount: 100 });
      order.applyEvent('OrderItemAdded', { sku: 'A', quantity: 2 });

      const audit = order.getCapability(AuditCapability)!;
      const log = audit.getAuditLog();
      expect(log).toHaveLength(2);
      expect(log[0]!.eventName).toBe('OrderCreated');
      expect(log[1]!.eventName).toBe('OrderItemAdded');
      expect(log[0]!.aggregateType).toBe('Order');
    });

    it('SnapshotCapability creates snapshots with current version', () => {
      const order = AggregateBuilder.create({ id: EntityId.create() }).withSnapshots().build(Order);

      order.applyEvent('OrderCreated', { customerId: 'c-1', amount: 100 });
      order.applyEvent('OrderItemAdded', { sku: 'A', quantity: 2 });

      interface OrderSnapshotState {
        customerId: string;
        amount: number;
        items: Array<{ sku: string; quantity: number }>;
      }
      const cap = order.getCapability(SnapshotCapability) as unknown as {
        createSnapshot: (s: () => OrderSnapshotState) => {
          version: number;
          aggregateType: string;
          aggregateId: string;
          state: OrderSnapshotState;
        };
      };
      const snap = cap.createSnapshot(() => ({
        customerId: order.customerId,
        amount: order.amount,
        items: [...order.items],
      }));

      expect(snap.version).toBe(2);
      expect(snap.aggregateType).toBe('Order');
      expect(snap.aggregateId).toBe(order.getId().toString());
      expect(snap.state.amount).toBe(100);
      expect(snap.state.items).toHaveLength(1);
    });

    it('multiple capabilities coexist on one aggregate', () => {
      const order = AggregateBuilder.create({ id: EntityId.create() })
        .withAudit()
        .withSnapshots()
        .withVersioning()
        .build(Order);

      expect(order.hasCapability(AuditCapability)).toBe(true);
      expect(order.hasCapability(SnapshotCapability)).toBe(true);
      expect(order.hasCapability(VersioningCapability)).toBe(true);
    });

    it('audit + snapshot together — audit captures, snapshot serializes', () => {
      const order = AggregateBuilder.create({ id: EntityId.create() })
        .withAudit()
        .withSnapshots()
        .build(Order);

      order.applyEvent('OrderCreated', { customerId: 'c-1', amount: 100 });

      const auditLog = order.getCapability(AuditCapability)!.getAuditLog();
      const snap = order
        .getCapability(SnapshotCapability)!
        .createSnapshot(() => ({ amount: order.amount }));

      expect(auditLog).toHaveLength(1);
      expect(snap.version).toBe(1);
    });
  });

  describe('event class identity preservation (Object.create pattern)', () => {
    class OrderCreatedEvent implements IDomainEvent<OrderCreatedPayload> {
      readonly eventName = 'OrderCreated';
      constructor(public payload: OrderCreatedPayload) {}
      describe(): string {
        return `OrderCreated for ${this.payload.customerId}`;
      }
    }

    it('preserves prototype chain so instanceof + class methods still work', () => {
      const order = newOrder();
      const orig = new OrderCreatedEvent({ customerId: 'c-1', amount: 100 });
      order.applyEvent(orig.eventName, orig.payload);

      const stored = order.getDomainEvents()[0]!;
      // Note: apply(string, payload) creates a plain event, not the class instance.
      // This test documents the boundary: pass class instances to apply(event)
      // overload to preserve identity; passing (string, payload) creates plain.
      expect(stored.eventName).toBe('OrderCreated');
      expect(stored.payload).toEqual(orig.payload);
    });
  });

  describe('internal state gating (VF-023 D-2, AC5, CRITICAL F-H4)', () => {
    // Only the happy path (SnapshotCapability calling with the real
    // INTERNAL_STATE_TOKEN) was previously covered. This asserts the actual
    // enforcement: a forged/wrong token must be rejected, otherwise the
    // gate is decorative rather than a real barrier against bypassing
    // apply()/loadFromHistory() to corrupt the version/event-log invariant.
    it('throws TypeError when called with a forged/wrong token', () => {
      const order = newOrder();

      const [error] = safeRun(() =>
        (
          order as unknown as { _internal_setState: (token: unknown, state: unknown) => void }
        )._internal_setState('wrong-token', {
          version: 999,
          initialVersion: 0,
          domainEvents: [],
        })
      );

      expect(error).toBeInstanceOf(TypeError);
      expect(error?.message).toMatch(/invalid or missing internal state token/);

      // The forged call must not have mutated anything.
      expect(order.getVersion()).toBe(0);
    });
  });

  describe('equals() — identity-based equality (VF-023 AC10)', () => {
    it('two aggregates with the same id are equal, regardless of state/version differences', () => {
      const id = EntityId.create();
      const a = new Order({ id, version: 0 });
      const b = new Order({ id, version: 0 });
      b.applyEvent('OrderCreated', { customerId: 'c-1', amount: 100 });

      expect(a.equals(b)).toBe(true);
      expect(b.equals(a)).toBe(true);
    });

    it('two aggregates with different ids are not equal', () => {
      const a = newOrder();
      const b = newOrder();

      expect(a.equals(b)).toBe(false);
    });

    it('an aggregate is equal to itself', () => {
      const a = newOrder();
      expect(a.equals(a)).toBe(true);
    });

    it('returns false for null/undefined', () => {
      const a = newOrder();
      expect(a.equals(null)).toBe(false);
      expect(a.equals(undefined)).toBe(false);
    });
  });

  describe('versioning rules', () => {
    it('initialVersion is 0 for fresh aggregate', () => {
      const order = newOrder();
      expect(order.getInitialVersion()).toBe(0);
    });

    it('initialVersion is set from constructor params', () => {
      const order = newOrder({ version: 5 });
      expect(order.getVersion()).toBe(5);
      expect(order.getInitialVersion()).toBe(5);
    });

    it('apply() increments version above the initial', () => {
      const order = newOrder({ version: 5 });
      order.applyEvent('OrderItemAdded', { sku: 'X', quantity: 1 });

      expect(order.getVersion()).toBe(6);
      expect(order.getInitialVersion()).toBe(5);
    });
  });
});
