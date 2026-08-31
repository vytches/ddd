import { describe, expect, it, vi } from 'vitest';
import { Result } from '@vytches/ddd-contracts';
import { CompensationStack, runCompensated } from '../../src';
import type { CompensationFailure } from '../../src';

/**
 * VF-040 — `CompensationStack` / `runCompensated` (try-confirm-cancel
 * primitive, D-07..D-16).
 *
 * LT1: imports the package's own public barrel via '../../src'
 * (`packages/resilience/src/index.ts` — the exact file
 * '@vytches/ddd-resilience' resolves to), matching the established
 * convention in this directory (bulkhead.test.ts, retry.test.ts,
 * circuit-breaker.half-open-race.test.ts). `Result` comes from
 * '@vytches/ddd-contracts' since it is a separate package the flows under
 * test are built on, not an internal path of this package.
 *
 * No mocking of this package's own internals (N4) — every test drives
 * `CompensationStack`/`runCompensated` through their real public methods;
 * `vi.fn()` is used only to observe call order/count on caller-supplied
 * acquire/compensate functions, never to stub out anything inside this
 * package.
 */

/**
 * Drains the microtask queue several times over. Two chained `async`
 * functions (the internal `runUnwind` loop calling into a caller-supplied
 * `async` compensate) need more than one microtask hop to fully settle a
 * single resolved deferred before the next loop iteration's synchronous
 * work runs. Awaiting `Promise.resolve()` a generous, fixed number of times
 * is still fully deterministic (no timers, no real delay) — once a chain
 * to the next pending deferred is reached, further ticks are no-ops, so
 * over-flushing cannot mask a bug the way under-flushing could hide one.
 */
async function flushMicrotasks(times = 10): Promise<void> {
  for (let i = 0; i < times; i++) {
    await Promise.resolve();
  }
}

/** A deferred promise, resolved/rejected from outside its executor — used
 * to make the two-concurrent-unwind and max-concurrency tests deterministic
 * without a bare racy `setTimeout`. */
function createDeferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
} {
  let resolveFn: (value: T) => void = () => undefined;
  let rejectFn: (error: unknown) => void = () => undefined;
  const promise = new Promise<T>((res, rej) => {
    resolveFn = res;
    rejectFn = rej;
  });
  return { promise, resolve: resolveFn, reject: rejectFn };
}

describe('CompensationStack', () => {
  it('happy path: every step acquires cleanly -> unwind() never had to run, zero compensation calls', async () => {
    const compensateA = vi.fn().mockResolvedValue(undefined);
    const compensateB = vi.fn().mockResolvedValue(undefined);
    const stack = CompensationStack.create();

    const a = await stack.acquire('step-a', () => Promise.resolve('a-resource'), compensateA);
    const b = await stack.acquire('step-b', () => Promise.resolve('b-resource'), compensateB);

    expect(a).toBe('a-resource');
    expect(b).toBe('b-resource');
    expect(compensateA).not.toHaveBeenCalled();
    expect(compensateB).not.toHaveBeenCalled();
  });

  it('failure mid-sequence: only the steps already acquired are compensated, most-recently-acquired first (LIFO) — asserted on order, not just count', async () => {
    const order: string[] = [];
    const stack = CompensationStack.create();

    await stack.acquire(
      'reserve-inventory',
      () => Promise.resolve('inv-1'),
      () => {
        order.push('reserve-inventory');
        return Promise.resolve();
      }
    );
    await stack.acquire(
      'reserve-ledger-hold',
      () => Promise.resolve('hold-1'),
      () => {
        order.push('reserve-ledger-hold');
        return Promise.resolve();
      }
    );
    // A third step's acquire() itself fails, so nothing is ever registered
    // for it — there is nothing to undo for a step that never succeeded.
    await expect(
      stack.acquire(
        'charge-payment',
        () => Promise.reject(new Error('payment gateway unreachable')),
        () => {
          order.push('charge-payment');
          return Promise.resolve();
        }
      )
    ).rejects.toThrow('payment gateway unreachable');

    const failures = await stack.unwind();

    expect(failures).toEqual([]);
    expect(order).toEqual(['reserve-ledger-hold', 'reserve-inventory']);
  });

  it('a compensation that itself throws does not stop the loop — the rest still run and the failure lands on compensationFailures', async () => {
    const order: string[] = [];
    const stack = CompensationStack.create();

    await stack.acquire(
      'outer',
      () => Promise.resolve('outer-resource'),
      () => {
        order.push('outer');
        return Promise.resolve();
      }
    );
    await stack.acquire(
      'middle-throws',
      () => Promise.resolve('middle-resource'),
      () => {
        order.push('middle-throws');
        return Promise.reject(new Error('release endpoint returned 500'));
      }
    );
    await stack.acquire(
      'inner',
      () => Promise.resolve('inner-resource'),
      () => {
        order.push('inner');
        return Promise.resolve();
      }
    );

    const failures = await stack.unwind();

    // All three still ran, in LIFO order, despite the middle one rejecting.
    expect(order).toEqual(['inner', 'middle-throws', 'outer']);
    expect(failures).toHaveLength(1);
    const failure: CompensationFailure | undefined = failures[0];
    expect(failure?.label).toBe('middle-throws');
    expect(failure?.error).toBeInstanceOf(Error);
    expect(failure?.error.message).toBe('release endpoint returned 500');
  });

  it('double invocation of unwind() — each compensate function is called EXACTLY ONCE, never twice', async () => {
    const compensateA = vi.fn().mockResolvedValue(undefined);
    const compensateB = vi.fn().mockResolvedValue(undefined);
    const stack = CompensationStack.create();

    await stack.acquire('a', () => Promise.resolve('a-resource'), compensateA);
    await stack.acquire('b', () => Promise.resolve('b-resource'), compensateB);

    const firstFailures = await stack.unwind();
    const secondFailures = await stack.unwind();

    expect(compensateA).toHaveBeenCalledTimes(1);
    expect(compensateB).toHaveBeenCalledTimes(1);
    expect(secondFailures).toBe(firstFailures);
  });

  it('two concurrent await on the same stack (Promise.all of two unwind() calls) run compensations once and both resolve to the same result — falsifies a boolean-flag implementation', async () => {
    const deferred = createDeferred<void>();
    const compensate = vi.fn(() => deferred.promise);
    const stack = CompensationStack.create();

    await stack.acquire('slow-release', () => Promise.resolve('resource'), compensate);

    // Neither call is awaited individually first — both start racing against
    // the same in-flight unwind before it has had any chance to settle. A
    // boolean-flag guard (`if (!this.unwound) { this.unwound = true; ... }`)
    // would let both callers observe the flag as false at the same
    // synchronous instant and each start its own run; latching the promise
    // itself is the only thing that prevents that.
    const both = Promise.all([stack.unwind(), stack.unwind()]);

    // Both calls to unwind() have already run synchronously up to the
    // pending compensate() call by this point — the second call reused the
    // first's latched promise instead of starting its own run.
    await flushMicrotasks();
    expect(compensate).toHaveBeenCalledTimes(1);

    deferred.resolve(undefined);
    const [resultA, resultB] = await both;

    expect(compensate).toHaveBeenCalledTimes(1);
    expect(resultA).toBe(resultB);
    expect(resultA).toEqual([]);
  });

  it('the stack stays armed after a successful flow — an explicit unwind() called later (e.g. from a post-rollback hook) still runs the compensations', async () => {
    const compensate = vi.fn().mockResolvedValue(undefined);
    const stack = CompensationStack.create();

    await stack.acquire('reserve-inventory', () => Promise.resolve('inv-1'), compensate);

    // The flow "succeeds" here in the sense that nothing calls unwind() yet
    // — the stack is left armed, exactly as documented. Some time later, a
    // caller-owned hook (outside this primitive entirely) decides to roll
    // back and calls unwind() itself.
    expect(compensate).not.toHaveBeenCalled();

    const failures = await stack.unwind();

    expect(compensate).toHaveBeenCalledTimes(1);
    expect(failures).toEqual([]);
  });

  it('at most one compensation runs at a time — the loop never overlaps two compensate() calls (no Promise.all in the implementation)', async () => {
    let concurrent = 0;
    let maxConcurrent = 0;
    const deferredA = createDeferred<void>();
    const deferredB = createDeferred<void>();
    const deferredC = createDeferred<void>();
    const deferredsByLabel = new Map([
      ['a', deferredA],
      ['b', deferredB],
      ['c', deferredC],
    ]);
    const started: string[] = [];

    const makeCompensate = (label: string) => async () => {
      concurrent += 1;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      started.push(label);
      await deferredsByLabel.get(label)?.promise;
      concurrent -= 1;
    };

    const stack = CompensationStack.create();
    await stack.acquire('a', () => Promise.resolve('a'), makeCompensate('a'));
    await stack.acquire('b', () => Promise.resolve('b'), makeCompensate('b'));
    await stack.acquire('c', () => Promise.resolve('c'), makeCompensate('c'));

    const unwindResult = stack.unwind();

    // LIFO: 'c' is compensated first. If the loop used Promise.all instead
    // of a sequential for...of, all three compensate() calls would have
    // started (and 'concurrent' would read 3) before any deferred resolves.
    await flushMicrotasks();
    expect(started).toEqual(['c']);
    expect(concurrent).toBe(1);

    deferredC.resolve(undefined);
    await flushMicrotasks();
    expect(started).toEqual(['c', 'b']);
    expect(concurrent).toBe(1);

    deferredB.resolve(undefined);
    await flushMicrotasks();
    expect(started).toEqual(['c', 'b', 'a']);
    expect(concurrent).toBe(1);

    deferredA.resolve(undefined);
    await unwindResult;

    expect(maxConcurrent).toBe(1);
    expect(started).toEqual(['c', 'b', 'a']);
  });
});

describe('runCompensated', () => {
  it('happy path: fn resolves to Result.ok -> the stack is never unwound, zero compensation calls', async () => {
    const compensate = vi.fn().mockResolvedValue(undefined);
    const stack = CompensationStack.create();

    const outcome = await runCompensated(stack, async s => {
      await s.acquire('reserve-inventory', () => Promise.resolve('inv-1'), compensate);
      return Result.ok<string, Error>('order-placed');
    });

    expect(outcome.isSuccess).toBe(true);
    expect(outcome.value).toBe('order-placed');
    expect(compensate).not.toHaveBeenCalled();
  });

  it('failure mid-sequence: fn resolves to Result.fail -> compensations run LIFO for the steps already acquired, and the original cause is unconditionally readable (D-11)', async () => {
    const order: string[] = [];
    const stack = CompensationStack.create();
    class OrderError extends Error {
      constructor(public readonly code: string) {
        super(code);
      }
    }
    const originalCause = new OrderError('PAYMENT_DECLINED');

    const outcome = await runCompensated(stack, async s => {
      await s.acquire(
        'reserve-inventory',
        () => Promise.resolve('inv-1'),
        () => {
          order.push('reserve-inventory');
          return Promise.resolve();
        }
      );
      await s.acquire(
        'reserve-ledger-hold',
        () => Promise.resolve('hold-1'),
        () => {
          order.push('reserve-ledger-hold');
          return Promise.resolve();
        }
      );
      // The payment step fails without ever registering a compensation of
      // its own — there is nothing to undo for a step that never succeeded.
      return Result.fail<string, OrderError>(originalCause);
    });

    expect(outcome.isFailure).toBe(true);
    expect(order).toEqual(['reserve-ledger-hold', 'reserve-inventory']);
    // Cause is unconditionally readable — no branch needed on the shape.
    expect(outcome.error.cause).toBe(originalCause);
    expect(outcome.error.compensationFailures).toEqual([]);
  });

  it('a failed compensation never shadows the original failure (D-11): cause stays the real error whether cleanup succeeded or failed', async () => {
    class OrderError extends Error {
      constructor(public readonly code: string) {
        super(code);
      }
    }
    const originalCause = new OrderError('PAYMENT_DECLINED');
    const stack = CompensationStack.create();

    const outcome = await runCompensated(stack, async s => {
      await s.acquire(
        'reserve-inventory',
        () => Promise.resolve('inv-1'),
        () => Promise.reject(new Error('inventory release endpoint down'))
      );
      return Result.fail<string, OrderError>(originalCause);
    });

    expect(outcome.isFailure).toBe(true);
    // Same access path as the clean-unwind test above — no conditional on
    // whether compensation itself succeeded.
    expect(outcome.error.cause).toBe(originalCause);
    expect(outcome.error.cause.code).toBe('PAYMENT_DECLINED');
    expect(outcome.error.compensationFailures).toHaveLength(1);
    expect(outcome.error.compensationFailures[0]?.label).toBe('reserve-inventory');
    expect(outcome.error.compensationFailures[0]?.error.message).toBe(
      'inventory release endpoint down'
    );
  });

  it('fn throws after acquiring two resources -> both compensations run, in LIFO order, before the throw propagates', async () => {
    // Deferred compensations (rather than plain `Promise.resolve()`) make
    // "before" verifiable rather than merely plausible: if `runCompensated`
    // ever regressed to firing `stack.unwind()` without awaiting it, the
    // rejection below would settle while these deferreds are still pending
    // and `settled` would already be `true` at the first checkpoint — a
    // clean, deterministic failure instead of a flake that only shows up
    // when the fire-and-forget unwind happens to lose the race.
    const order: string[] = [];
    const stack = CompensationStack.create();
    const thrown = new Error('unexpected infrastructure failure');
    const deferredInventory = createDeferred<void>();
    const deferredLedger = createDeferred<void>();

    let caught: unknown;
    let settled = false;
    const settledPromise = runCompensated(stack, async s => {
      await s.acquire(
        'reserve-inventory',
        () => Promise.resolve('inv-1'),
        () => {
          order.push('reserve-inventory');
          return deferredInventory.promise;
        }
      );
      await s.acquire(
        'reserve-ledger-hold',
        () => Promise.resolve('hold-1'),
        () => {
          order.push('reserve-ledger-hold');
          return deferredLedger.promise;
        }
      );
      throw thrown;
    })
      .catch(error => {
        caught = error;
      })
      .finally(() => {
        settled = true;
      });

    // fn has already thrown by now, but unwind() is blocked on the first
    // (most-recently-acquired) compensation — the throw must not have
    // propagated yet.
    await flushMicrotasks();
    expect(order).toEqual(['reserve-ledger-hold']);
    expect(settled).toBe(false);

    deferredLedger.resolve(undefined);
    await flushMicrotasks();
    expect(order).toEqual(['reserve-ledger-hold', 'reserve-inventory']);
    expect(settled).toBe(false);

    deferredInventory.resolve(undefined);
    await settledPromise;

    expect(settled).toBe(true);
    expect(caught).toBe(thrown);
    expect(order).toEqual(['reserve-ledger-hold', 'reserve-inventory']);
  });

  it('a thrown error propagates with reference identity preserved -- not wrapped, not replaced', async () => {
    const stack = CompensationStack.create();
    class InfrastructureError extends Error {
      constructor(public readonly code: string) {
        super(code);
      }
    }
    const thrown = new InfrastructureError('CONNECTION_RESET');

    let caught: unknown;
    try {
      await runCompensated(stack, async () => {
        throw thrown;
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBe(thrown);
  });

  it('fn throws AND a compensation also throws -> the original error still propagates (not the compensation error), and a subsequent stack.unwind() from the catch block returns the compensation failures without re-running any compensation', async () => {
    const stack = CompensationStack.create();
    const originalError = new Error('order placement crashed');
    const compensateInventory = vi.fn(() =>
      Promise.reject(new Error('inventory release endpoint down'))
    );
    const compensateLedger = vi.fn().mockResolvedValue(undefined);

    let caught: unknown;
    try {
      await runCompensated(stack, async s => {
        await s.acquire('reserve-inventory', () => Promise.resolve('inv-1'), compensateInventory);
        await s.acquire('reserve-ledger-hold', () => Promise.resolve('hold-1'), compensateLedger);
        throw originalError;
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBe(originalError);
    expect(compensateInventory).toHaveBeenCalledTimes(1);
    expect(compensateLedger).toHaveBeenCalledTimes(1);

    // The caller recovers compensation failures via the documented latch:
    // calling unwind() again returns the same settled result, without
    // re-running any compensation.
    const failures = await stack.unwind();

    expect(failures).toHaveLength(1);
    expect(failures[0]?.label).toBe('reserve-inventory');
    expect(failures[0]?.error.message).toBe('inventory release endpoint down');
    expect(compensateInventory).toHaveBeenCalledTimes(1);
    expect(compensateLedger).toHaveBeenCalledTimes(1);
  });
});
