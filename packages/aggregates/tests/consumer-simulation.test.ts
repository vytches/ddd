import { describe, it, expect } from 'vitest';
import { safeRun } from '@vytches/ddd-utils';
import { EntityId, type IDomainEvent } from '@vytches/ddd-contracts';

import { AggregateRoot } from '../src/core/aggregate-root';
import type { IAggregateConstructorParams } from '../src/aggregate-interfaces';

/**
 * VF-023 (D-6, AC8 proxy): consumer-simulation test suite.
 *
 * juz-ide-api (the largest known consumer, 237+ aggregates) cannot be
 * exercised directly from this repo. These tests are a proxy — they
 * reconstruct realistic patterns a large event-sourced consumer is likely
 * to hit under the VF-023 invariants (deep-frozen domain events, the
 * maxEvents throw-and-retry guard). Kept small and representative, not
 * exhaustive — see CHANGELOG.md's "Consumer Impact Checklist" for the
 * grep-based self-audit consumers should run instead of per-aggregate test
 * duplication.
 */

interface ItemAddedPayload {
  sku: string;
  quantity: number;
  meta: { source: string };
}

class Cart extends AggregateRoot<string> {
  private _items: ReadonlyArray<{ sku: string; quantity: number }> = [];

  constructor(params: IAggregateConstructorParams<string>) {
    super(params);
    this.registerEventHandler<ItemAddedPayload>('ItemAdded', payload => {
      this._items = [...this._items, { sku: payload!.sku, quantity: payload!.quantity }];
    });
  }

  get items(): ReadonlyArray<{ sku: string; quantity: number }> {
    return this._items;
  }

  addItem(sku: string, quantity: number, source: string): void {
    this.apply('ItemAdded', { sku, quantity, meta: { source } });
  }

  loadFrom(events: IDomainEvent[]): void {
    this.loadFromHistory(events);
  }
}

const newCart = (overrides: Partial<IAggregateConstructorParams<string>> = {}) =>
  new Cart({ id: EntityId.create(), version: 0, ...overrides });

describe('Consumer simulation — aggregates (VF-023 D-6)', () => {
  describe('mutating a domain event payload returned from getDomainEvents() (deep freeze, AC11)', () => {
    it("a consumer projector/handler that mutates the event payload in place now throws instead of silently corrupting the aggregate's recorded history", () => {
      const cart = newCart();
      cart.addItem('SKU-1', 2, 'checkout-widget');

      const events = cart.getDomainEvents();
      const event = events[0]!;

      // Common pre-VF-023 consumer bug: an event projector "enriches" the
      // payload object it was handed instead of copying it first.
      const [error] = safeRun(() => {
        (event.payload as ItemAddedPayload).quantity = 999;
      });
      expect(error).toBeInstanceOf(TypeError);
      expect((cart.getDomainEvents()[0]!.payload as ItemAddedPayload).quantity).toBe(2);

      // Nested payload objects are frozen too.
      const [nestedError] = safeRun(() => {
        (event.payload as ItemAddedPayload).meta.source = 'tampered';
      });
      expect(nestedError).toBeInstanceOf(TypeError);
      expect((cart.getDomainEvents()[0]!.payload as ItemAddedPayload).meta.source).toBe(
        'checkout-widget'
      );
    });
  });

  describe('throw-and-retry apply() pattern under maxEvents (AC4, F-C6 fix)', () => {
    // Simulates a command handler that retries a batch operation after
    // catching a maxEvents guard error — a realistic pattern for a large
    // consumer batching multiple domain events per command before an
    // explicit `commit()`/flush boundary.
    it('a caught apply() failure does not desync version from the event log on the very next successful apply()', () => {
      const cart = newCart({ maxEvents: 2 });
      cart.addItem('SKU-1', 1, 'batch-import');
      cart.addItem('SKU-2', 1, 'batch-import');

      const versionBeforeRetry = cart.getVersion();

      const [error] = safeRun(() => cart.addItem('SKU-3', 1, 'batch-import'));
      expect(error).toBeDefined();

      // Consumer's retry strategy: flush/commit, then retry the same logical
      // operation on the same aggregate instance.
      cart.commit();
      cart.addItem('SKU-3', 1, 'batch-import');

      expect(cart.getVersion()).toBe(versionBeforeRetry + 1);
      expect(cart.items).toHaveLength(3);
    });
  });

  describe('reconstitution via loadFromHistory with an event stream built externally (event-store consumer pattern)', () => {
    it('replays events without accumulating new uncommitted events, matching a typical repository.findById() implementation', () => {
      const id = EntityId.create();
      const original = new Cart({ id, version: 0 });
      original.addItem('SKU-1', 3, 'seed');
      original.addItem('SKU-2', 1, 'seed');
      const history = [...original.getDomainEvents()];

      const reconstituted = new Cart({ id, version: 0 });
      reconstituted.loadFrom(history);

      expect(reconstituted.items).toEqual(original.items);
      expect(reconstituted.getDomainEvents()).toHaveLength(0);
      expect(reconstituted.getVersion()).toBe(history.length);
    });
  });
});
