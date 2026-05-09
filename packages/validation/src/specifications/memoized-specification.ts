import type { ISpecification } from '@vytches/ddd-contracts';

import { CompositeSpecification } from './composite-specification';

/**
 * Specification wrapper that memoizes `isSatisfiedBy` results per candidate.
 *
 * VP-002 (2026-05-09): cuts repeated evaluation cost when the same
 * specification is checked multiple times against the same candidate
 * during a single query — common in pipelines like "filter list by spec,
 * then enrich with another spec, then sort by a third predicate that
 * also calls the first spec." Without memoization, each `isSatisfiedBy`
 * call walks the full predicate tree even when the answer is already
 * known.
 *
 * **Memoization storage**: `WeakMap<object, boolean>` for object
 * candidates — automatic GC when the candidate is unreachable. Primitive
 * candidates (strings, numbers) bypass the cache entirely (WeakMap keys
 * must be objects); for those the wrapper degrades to a pass-through.
 *
 * **When NOT to use this**: specs whose result depends on mutable
 * external state (timestamps, counters, randomness, fetched data). The
 * cache assumes "same candidate object → same answer." If your spec is
 * pure (depends only on candidate fields), you're safe.
 *
 * **Lifecycle contract — NOT a singleton-safe Specification.** Per Evans
 * (Blue Book, ch. 9), a canonical `Specification` is a *stateless predicate*:
 * shareable, serializable, safe to cache as a singleton. `MemoizedSpecification`
 * is intentionally stateful — its `WeakMap` cache makes results dependent
 * on call history. Treat it as a *per-query* helper, not as something to
 * stash in a module-level constant or DI singleton with a long lifetime.
 * Construct fresh, use within a request, let it be collected.
 *
 * Composes correctly with `and`/`or`/`not` because it extends
 * `CompositeSpecification` — but those operators wrap the *current*
 * memoized result with new instances, so the composition itself isn't
 * memoized. To memoize the whole tree, wrap the outer composite.
 *
 * @example Pure-function specification
 * ```typescript
 * import { MemoizedSpecification, CompositeSpecification } from '@vytches/ddd-validation';
 *
 * class HighValueOrder extends CompositeSpecification<Order> {
 *   isSatisfiedBy(o: Order) { return o.total > 1000; }
 * }
 *
 * const spec = new MemoizedSpecification(new HighValueOrder());
 * spec.isSatisfiedBy(order);  // computes
 * spec.isSatisfiedBy(order);  // cached, no recomputation
 * spec.isSatisfiedBy(otherOrder);  // computes (different candidate)
 *
 * // After `order` is unreachable, its cache entry is GC'd automatically.
 * ```
 *
 * @example Composing memoized + raw specs
 * ```typescript
 * const expensive = new MemoizedSpecification(new ComplexCustomerCheck());
 * const cheap = new IsActiveOrder();
 *
 * // The composed spec re-runs `expensive` once per candidate (cache hit
 * // on second call), and `cheap` directly each time.
 * const both = expensive.and(cheap);
 * ```
 *
 * @public
 * @stable
 * @since 0.25.0
 */
export class MemoizedSpecification<T extends object> extends CompositeSpecification<T> {
  private readonly cache = new WeakMap<T, boolean>();

  constructor(private readonly inner: ISpecification<T>) {
    super();
  }

  isSatisfiedBy(candidate: T): boolean {
    // Defensive guard: WeakMap requires object keys. If a caller passes a
    // primitive through `unknown`-cast, fall back to direct evaluation.
    if (candidate === null || (typeof candidate !== 'object' && typeof candidate !== 'function')) {
      return this.inner.isSatisfiedBy(candidate);
    }

    const cached = this.cache.get(candidate);
    if (cached !== undefined) return cached;

    const result = this.inner.isSatisfiedBy(candidate);
    this.cache.set(candidate, result);
    return result;
  }

  /**
   * Manually evict a candidate from the cache. Use when you know the
   * candidate's relevant fields have changed and you want fresh evaluation
   * without discarding cache entries for other candidates.
   */
  invalidate(candidate: T): void {
    this.cache.delete(candidate);
  }

  /**
   * Forwarded to the inner spec, if it implements optional `explainFailure`.
   * Skips the cache because failure explanations are typically only computed
   * on-demand.
   */
  explainFailure(candidate: T): string | null {
    type WithExplain = ISpecification<T> & {
      explainFailure?(c: T): string | null;
    };
    const inner = this.inner as WithExplain;
    return inner.explainFailure ? (inner.explainFailure(candidate) ?? null) : null;
  }
}
