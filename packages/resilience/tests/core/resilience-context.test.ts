import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DefaultResilienceContext } from '../../src/core/resilience-context';

/**
 * VF-027 replaced VB-004's hand-rolled disposal with native
 * `AbortSignal.any()` / `AbortSignal.timeout()`.
 *
 * VB-004's tests asserted that `dispose()` *released* two resources: a
 * `setTimeout` and an `{ once: true }` abort listener on the parent signal.
 * Both are gone, so those assertions cannot hold — AC4 anticipated this and
 * allows updating them to the new mechanism's observable semantics.
 *
 * The guarantee under test has therefore inverted, and is stronger: nothing is
 * registered that would need releasing in the first place, so forgetting to
 * call `dispose()` can no longer leak anything. That is what these tests pin.
 */
describe('DefaultResilienceContext', () => {
  describe('native AbortSignal composition (VF-027)', () => {
    describe('no user-space timer is registered by fork()', () => {
      beforeEach(() => {
        vi.useFakeTimers();
      });

      afterEach(() => {
        vi.useRealTimers();
      });

      it('registers no fake-timer for a fork timeout', () => {
        const baseline = vi.getTimerCount();

        const parent = DefaultResilienceContext.create();
        parent.fork(5000);

        // Was baseline + 1 before VF-027. AbortSignal.timeout() is backed by an
        // internal, already-unref'd timer the platform clears itself — it never
        // reaches the global setTimeout that fake timers intercept, so there is
        // no timer for a forgotten dispose() to strand.
        expect(vi.getTimerCount()).toBe(baseline);
      });

      it('leaves no timer behind when the context is dropped without dispose()', () => {
        const baseline = vi.getTimerCount();

        const parent = DefaultResilienceContext.create();
        for (let i = 0; i < 25; i++) parent.fork(5000);

        expect(vi.getTimerCount()).toBe(baseline);
      });
    });

    describe('parent-signal listeners do not accumulate', () => {
      it('fork() adds no user-space listener to the parent signal', () => {
        const parent = DefaultResilienceContext.create();
        const addSpy = vi.spyOn(parent.signal, 'addEventListener');

        parent.fork(5000);

        // AbortSignal.any() subscribes internally, not through the public
        // addEventListener the old implementation used.
        expect(addSpy).not.toHaveBeenCalled();
      });

      it('withAttempt() adds no user-space listener, across many attempts (SA-M12)', () => {
        // The leak this replaces: RetryPolicy.execute() derives one attempt
        // context per attempt from a context that may be reused across many
        // execute() calls. Each derivation used to register a {once:true}
        // listener that only a real abort would remove.
        const parent = DefaultResilienceContext.create();
        const addSpy = vi.spyOn(parent.signal, 'addEventListener');

        for (let attempt = 1; attempt <= 50; attempt++) {
          DefaultResilienceContext.withAttempt(parent, attempt);
        }

        expect(addSpy).not.toHaveBeenCalled();
      });
    });

    describe('behaviour preserved from the manual implementation', () => {
      it('propagates a parent abort to the forked child', async () => {
        const controller = new AbortController();
        const parent = new DefaultResilienceContext(undefined, undefined, 1, undefined, controller);
        const forked = parent.fork();

        expect(forked.signal.aborted).toBe(false);
        controller.abort(new Error('parent aborted'));
        await Promise.resolve();

        expect(forked.signal.aborted).toBe(true);
      });

      it('starts already-aborted when the parent aborted before the fork', () => {
        const controller = new AbortController();
        const parent = new DefaultResilienceContext(undefined, undefined, 1, undefined, controller);
        controller.abort(new Error('parent aborted'));

        expect(parent.fork(5000).signal.aborted).toBe(true);
      });

      it('aborts the child on timeout, leaving the parent untouched', async () => {
        vi.useRealTimers();
        const parent = DefaultResilienceContext.create();
        const forked = parent.fork(10);

        await new Promise(resolve => setTimeout(resolve, 40));

        expect(forked.signal.aborted).toBe(true);
        expect(parent.signal.aborted).toBe(false);
        // Native timeouts abort with a DOMException whose name is
        // 'TimeoutError' rather than this package's TimeoutError class. Code
        // branching on `reason.name` is unaffected; code using `instanceof
        // TimeoutError` on a fork reason is not — recorded as D3 in the task.
        expect((forked.signal.reason as Error).name).toBe('TimeoutError');
      });

      it('carries correlationId, startTime and metadata into the child', () => {
        const parent = DefaultResilienceContext.create({
          correlationId: 'corr-1',
          metadata: { tenant: 'acme' },
        });

        const forked = parent.fork(5000);

        expect(forked.correlationId).toBe('corr-1');
        expect(forked.startTime).toEqual(parent.startTime);
        expect(forked.metadata.get('tenant')).toBe('acme');
      });

      it('withAttempt() carries the attempt number and metadata', () => {
        const parent = DefaultResilienceContext.create({ metadata: { tenant: 'acme' } });

        const child = DefaultResilienceContext.withAttempt(parent, 3);

        expect(child.attempt).toBe(3);
        expect(child.metadata.get('tenant')).toBe('acme');
      });
    });

    describe('dispose() compatibility (AC3)', () => {
      it('is a harmless no-op, so existing dispose?.() call sites keep working', () => {
        const parent = DefaultResilienceContext.create();
        const forked = parent.fork(5000);

        expect(() => {
          forked.dispose?.();
          forked.dispose?.();
        }).not.toThrow();

        // Still functional afterwards — dispose() releases nothing and
        // therefore breaks nothing.
        expect(forked.signal.aborted).toBe(false);
      });
    });
  });
});
