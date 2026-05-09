import { describe, it, expect, vi } from 'vitest';
import type { ISpecification } from '@vytches/ddd-contracts';

import { CompositeSpecification, MemoizedSpecification } from '../../src/specifications';

interface Order {
  id: string;
  total: number;
}

class HighValueOrder extends CompositeSpecification<Order> {
  // counter to verify caching
  evalCount = 0;
  isSatisfiedBy(o: Order): boolean {
    this.evalCount++;
    return o.total > 1000;
  }
}

describe('MemoizedSpecification — VP-002', () => {
  describe('basic memoization', () => {
    it('evaluates inner spec once per candidate, caches result', () => {
      const inner = new HighValueOrder();
      const memo = new MemoizedSpecification(inner);
      const order: Order = { id: 'o-1', total: 5000 };

      expect(memo.isSatisfiedBy(order)).toBe(true);
      expect(memo.isSatisfiedBy(order)).toBe(true);
      expect(memo.isSatisfiedBy(order)).toBe(true);

      expect(inner.evalCount).toBe(1);
    });

    it('evaluates fresh per distinct candidate', () => {
      const inner = new HighValueOrder();
      const memo = new MemoizedSpecification(inner);

      memo.isSatisfiedBy({ id: 'a', total: 100 });
      memo.isSatisfiedBy({ id: 'b', total: 2000 });
      memo.isSatisfiedBy({ id: 'c', total: 500 });

      expect(inner.evalCount).toBe(3);
    });

    it('returns identical cached result on repeat hits', () => {
      const memo = new MemoizedSpecification(new HighValueOrder());
      const order: Order = { id: 'o-1', total: 5000 };

      const first = memo.isSatisfiedBy(order);
      const second = memo.isSatisfiedBy(order);
      expect(first).toBe(second);
    });
  });

  describe('cache lifecycle', () => {
    it('invalidate(candidate) forces fresh evaluation', () => {
      const inner = new HighValueOrder();
      const memo = new MemoizedSpecification(inner);
      const order: Order = { id: 'o-1', total: 5000 };

      memo.isSatisfiedBy(order);
      memo.isSatisfiedBy(order);
      memo.invalidate(order);
      memo.isSatisfiedBy(order);

      expect(inner.evalCount).toBe(2);
    });

    it('invalidate is no-op for uncached candidates', () => {
      const inner = new HighValueOrder();
      const memo = new MemoizedSpecification(inner);
      const order: Order = { id: 'o-1', total: 5000 };

      // Should not throw
      memo.invalidate(order);
      memo.isSatisfiedBy(order);
      expect(inner.evalCount).toBe(1);
    });
  });

  describe('composition with and/or/not', () => {
    it('composes with another spec — outer composition not cached', () => {
      const expensive = new HighValueOrder();
      const memo = new MemoizedSpecification(expensive);

      class ActiveOrder extends CompositeSpecification<Order> {
        isSatisfiedBy(o: Order): boolean {
          return o.id.startsWith('a');
        }
      }

      const both = memo.and(new ActiveOrder());
      const order: Order = { id: 'a-1', total: 5000 };

      // Two evaluations of the composite — but the memoized spec inside
      // only evaluates once per candidate.
      both.isSatisfiedBy(order);
      both.isSatisfiedBy(order);

      expect(expensive.evalCount).toBe(1);
    });

    it('not() works on memoized spec — inverts cached result', () => {
      const memo = new MemoizedSpecification(new HighValueOrder());
      const order: Order = { id: 'o-1', total: 100 };

      expect(memo.isSatisfiedBy(order)).toBe(false);
      expect(memo.not().isSatisfiedBy(order)).toBe(true);
    });
  });

  describe('explainFailure forwarding', () => {
    it('forwards to inner.explainFailure when present', () => {
      class ExplainingSpec implements ISpecification<Order> {
        isSatisfiedBy(_o: Order): boolean {
          return false;
        }
        and(_other: ISpecification<Order>): ISpecification<Order> {
          throw new Error();
        }
        or(_other: ISpecification<Order>): ISpecification<Order> {
          throw new Error();
        }
        not(): ISpecification<Order> {
          throw new Error();
        }
        explainFailure(o: Order): string | null {
          return `Order ${o.id} did not match`;
        }
      }

      const memo = new MemoizedSpecification(new ExplainingSpec());
      expect(memo.explainFailure({ id: 'o-1', total: 0 })).toBe('Order o-1 did not match');
    });

    it('returns null when inner does not implement explainFailure', () => {
      const memo = new MemoizedSpecification(new HighValueOrder());
      expect(memo.explainFailure({ id: 'o-1', total: 100 })).toBeNull();
    });
  });

  describe('primitive candidates (defensive bypass)', () => {
    it('bypasses cache for primitive candidates (still evaluates correctly)', () => {
      class StringSpec implements ISpecification<string> {
        evalCount = 0;
        isSatisfiedBy(s: string): boolean {
          this.evalCount++;
          return s.length > 3;
        }
        and(_o: ISpecification<string>): ISpecification<string> {
          throw new Error();
        }
        or(_o: ISpecification<string>): ISpecification<string> {
          throw new Error();
        }
        not(): ISpecification<string> {
          throw new Error();
        }
      }

      const inner = new StringSpec();
      // Cast string as object to satisfy the type system; runtime fallback
      // path engages because `typeof 'foo' !== 'object'`.
      const memo = new MemoizedSpecification<object>(inner as unknown as ISpecification<object>);
      memo.isSatisfiedBy('hello' as unknown as object);
      memo.isSatisfiedBy('hello' as unknown as object);
      memo.isSatisfiedBy('hello' as unknown as object);

      // No caching — every call evaluates.
      expect(inner.evalCount).toBe(3);
    });
  });

  describe('isolation between memoized instances', () => {
    it('two memoized wrappers around the same inner spec have separate caches', () => {
      const inner = new HighValueOrder();
      const memoA = new MemoizedSpecification(inner);
      const memoB = new MemoizedSpecification(inner);
      const order: Order = { id: 'o-1', total: 5000 };

      memoA.isSatisfiedBy(order);
      memoA.isSatisfiedBy(order);
      memoB.isSatisfiedBy(order);
      memoB.isSatisfiedBy(order);

      // Inner evaluates once per memoized wrapper (2 cache misses), not 4.
      expect(inner.evalCount).toBe(2);
    });
  });
});
