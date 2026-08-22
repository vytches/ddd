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

// === CachedPolicy.generateCacheKey() — VP-012c / R1 =========================
//
// @vytches/ddd-policies' `PolicyCachingBehavior.generateCacheKey()` (default,
// no `keyGenerator` override) used to call its private `hashString()`
// (SHA-256 via `globalThis.crypto.subtle`, sliced to a 128-bit hex prefix)
// TWICE per cache key — once for the context, once for the serialised
// entity. R1 merges this into a SINGLE `hashString()` call over a combined,
// length-prefixed buffer (`${contextRaw.length}:${contextRaw}${entityKey}`)
// to close a narrower collision surface (colliding `contextHash` alone used
// to be sufficient for a cross-user cache-key collision on the same entity;
// see docs/security/threat-models/TM-VP-012c.md). `hashString()` itself is
// unchanged — still SHA-256, still a 128-bit prefix — so this suite measures
// only the digest-call-count reduction (2 → 1), not a hashing-algorithm
// change (that swap, e.g. to FNV-1a, is an explicit NON-GOAL — see the
// `hashString()` doc comment in cached-policy.ts).
//
// `generateCacheKey()`/`hashString()` are private on `PolicyCachingBehavior`,
// so BEFORE/AFTER are reproduced here as standalone functions using the same
// `globalThis.crypto.subtle.digest('SHA-256', ...)` primitive and the same
// slice(0, 32) truncation — this measures the shape of the change (call
// count) without depending on package-internal access.
//
// The benchmark also isolates `JSON.stringify(request.entity)` as its own
// baseline: R1 is a merge from 2 digests to 1, which only matters if that
// saved digest call is not already dwarfed by entity serialisation cost —
// the dominant cost on any non-trivial entity. If JSON.stringify() alone
// costs far more than one whole hashString() call, the merge's real-world
// win is bounded by (at most) one digest's worth of time, not "half the
// hashing work".
describe('CachedPolicy.generateCacheKey() — R1 hash-merge (VP-012c)', () => {
  async function hashString(str: string): Promise<string> {
    const encoded = new TextEncoder().encode(str);
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', encoded);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, 32);
  }

  // Representative policy request shape: a userId/tenantId/environment
  // context plus a moderately sized entity (comparable to a real
  // aggregate/DTO passed through a cached policy), not a trivial `{value}`.
  const contextRaw = 'user-0123456789abcdef\x00tenant-0123456789abcdef\x00production';
  const entity = {
    id: 'order-0123456789abcdef',
    status: 'CONFIRMED',
    items: Array.from({ length: 10 }, (_, i) => ({
      sku: `SKU-${i}`,
      quantity: i + 1,
      unitPrice: 19.99 + i,
    })),
    customer: { id: 'cust-0123456789abcdef', tier: 'GOLD', region: 'EU' },
    metadata: { source: 'web', campaign: 'summer-sale', notes: 'expedited shipping requested' },
  };

  bench('baseline: JSON.stringify(request.entity) alone', () => {
    JSON.stringify(entity);
  });

  bench('BEFORE (2 hashString calls: contextHash + entityHash)', async () => {
    const entityKey = JSON.stringify(entity);
    await hashString(contextRaw);
    await hashString(entityKey);
  });

  bench('AFTER (1 hashString call over length-prefixed combined buffer)', async () => {
    const entityKey = JSON.stringify(entity);
    const combined = `${contextRaw.length}:${contextRaw}${entityKey}`;
    await hashString(combined);
  });
});
