/**
 * Performance benchmarks for @vytches/ddd hot paths.
 *
 * Run with: `pnpm bench`
 *
 * Five core operations covered (per VP-NEW-001 plan):
 *   1. AggregateRoot.apply() — single event application
 *   2. AggregateRoot replay (batch of N events)
 *   3. BaseValueObject.equals() — deep equality on object value
 *   4. EntityId.create() — UUID generation hot path
 *   5. UUID validation
 *
 * Results are non-deterministic; use them as baselines, not assertions.
 * To compare across versions: run on the same hardware before + after,
 * compare ops/sec.
 */

import { bench, describe } from 'vitest';

import { AggregateRoot } from '@vytches/ddd-aggregates';
import { DomainEvent } from '@vytches/ddd-events';
import { EntityId, BaseValueObject } from '@vytches/ddd-value-objects';
import { LibUtils } from '@vytches/ddd-utils';

// === Bench fixtures ===========================================================

interface OrderItemAddedPayload {
  readonly sku: string;
  readonly quantity: number;
}

class OrderItemAdded extends DomainEvent<OrderItemAddedPayload> {
  constructor(payload: OrderItemAddedPayload) {
    super(payload);
  }
}

class BenchOrder extends AggregateRoot<string> {
  public itemCount = 0;

  constructor() {
    super({ id: EntityId.create(), version: 0 });
    this.registerEventHandler<OrderItemAddedPayload>('OrderItemAdded', () => {
      this.itemCount++;
    });
  }

  add(sku: string, qty: number): void {
    this.apply(new OrderItemAdded({ sku, quantity: qty }));
  }
}

interface MoneyProps {
  readonly amount: number;
  readonly currency: string;
}

class Money extends BaseValueObject<MoneyProps> {
  constructor(amount: number, currency: string) {
    super({ amount, currency });
  }
}

// === Benchmarks ==============================================================

describe('AggregateRoot.apply()', () => {
  bench('single event application', () => {
    const order = new BenchOrder();
    order.add('SKU-1', 1);
  });

  bench('replay batch of 100 events', () => {
    const order = new BenchOrder();
    for (let i = 0; i < 100; i++) {
      order.add(`SKU-${i}`, 1);
    }
  });
});

describe('BaseValueObject.equals()', () => {
  const a = new Money(100, 'USD');
  const b = new Money(100, 'USD');
  const c = new Money(100, 'EUR');

  bench('equal objects (same values)', () => {
    a.equals(b);
  });

  bench('not equal (different currency)', () => {
    a.equals(c);
  });
});

describe('EntityId hot paths', () => {
  bench('EntityId.create() — UUID generation', () => {
    EntityId.create();
  });

  bench('EntityId.fromUUID() — validation', () => {
    EntityId.fromUUID('550e8400-e29b-41d4-a716-446655440000');
  });

  bench('LibUtils.isValidUUID() — predicate', () => {
    LibUtils.isValidUUID('550e8400-e29b-41d4-a716-446655440000');
  });
});

describe('LibUtils.deepEqual() — value comparison', () => {
  const a = { id: 1, name: 'a', tags: ['x', 'y'], meta: { n: 5 } };
  const b = { id: 1, name: 'a', tags: ['x', 'y'], meta: { n: 5 } };

  bench('shallow equal nested object', () => {
    LibUtils.deepEqual(a, b);
  });
});
