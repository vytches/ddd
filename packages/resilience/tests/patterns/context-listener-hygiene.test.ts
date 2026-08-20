/**
 * VF-027 AC6/AC7 — a context reused across many calls must not accumulate
 * abort listeners.
 *
 * Both leaks came from the same `{ once: true }` misconception: that flag
 * removes the listener when the signal *fires*, so on the happy path — where
 * nothing ever aborts — every call left one behind. A `contextProvider` handing
 * the same context to a hot code path therefore grew listeners without bound.
 *
 * These assert on the caller-supplied parent context, which is what a consumer
 * actually reuses.
 */
import { describe, it, expect, vi } from 'vitest';
import { DefaultResilienceContext } from '../../src/core/resilience-context';
import { RetryPolicy } from '../../src/patterns/retry';
import { Bulkhead } from '../../src/patterns/bulkhead';

const retryConfig = {
  maxAttempts: 3,
  baseDelay: 1,
  maxDelay: 2,
  backoffMultiplier: 1,
  jitter: false,
};

describe('AC6 — RetryPolicy attempt contexts (SA-M12)', () => {
  it('adds no listener to a reused parent context across many execute() calls', async () => {
    const policy = new RetryPolicy(retryConfig);
    const context = DefaultResilienceContext.create();
    const addSpy = vi.spyOn(context.signal, 'addEventListener');

    for (let i = 0; i < 20; i++) {
      await policy.execute(() => Promise.resolve('ok'), context);
    }

    expect(addSpy).not.toHaveBeenCalled();
  });

  it('stays clean when every attempt fails, i.e. maxAttempts contexts per call', async () => {
    const policy = new RetryPolicy(retryConfig);
    const context = DefaultResilienceContext.create();
    const addSpy = vi.spyOn(context.signal, 'addEventListener');

    for (let i = 0; i < 10; i++) {
      await expect(
        policy.execute(() => Promise.reject(new Error('boom')), context)
      ).rejects.toThrow('boom');
    }

    // 10 calls × 3 attempts = 30 derived contexts, none of which subscribes.
    expect(addSpy).not.toHaveBeenCalled();
  });
});

describe('AC7 — Bulkhead queue path (UX-C6)', () => {
  it("removes each queued task's abort listener once the task leaves the queue", async () => {
    // maxConcurrency 1 forces everything after the first call onto the queue —
    // the path that registered the listener.
    const bulkhead = new Bulkhead({ maxConcurrency: 1, queueCapacity: 50, name: 'test' });
    const context = DefaultResilienceContext.create();

    const addSpy = vi.spyOn(context.signal, 'addEventListener');
    const removeSpy = vi.spyOn(context.signal, 'removeEventListener');

    await Promise.all(
      Array.from({ length: 20 }, () => bulkhead.execute(() => Promise.resolve('ok'), context))
    );

    // Every listener that went on came back off. Before VF-027 removeSpy stayed
    // at zero and the count grew with every queued call.
    expect(removeSpy.mock.calls.length).toBe(addSpy.mock.calls.length);
    expect(addSpy.mock.calls.length).toBeGreaterThan(0);
  });

  it('still aborts a queued task when the context aborts', async () => {
    const bulkhead = new Bulkhead({ maxConcurrency: 1, queueCapacity: 10, name: 'test' });
    const controller = new AbortController();
    const context = new DefaultResilienceContext(undefined, undefined, 1, undefined, controller);

    let releaseFirst: (() => void) | undefined;
    const blocker = bulkhead.execute(
      () => new Promise<string>(resolve => (releaseFirst = () => resolve('first'))),
      context
    );

    const queued = bulkhead.execute(() => Promise.resolve('second'), context);
    controller.abort(new Error('cancelled'));

    await expect(queued).rejects.toThrow('cancelled');

    releaseFirst?.();
    await blocker;
  });
});
