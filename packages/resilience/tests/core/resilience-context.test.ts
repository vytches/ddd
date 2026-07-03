import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DefaultResilienceContext } from '../../src/core/resilience-context';

describe('DefaultResilienceContext', () => {
  describe('dispose()', () => {
    // VB-004: fork() (and withAttempt()) leak two resources when a forked
    // context is never explicitly disposed: (1) the setTimeout backing the
    // fork's own timeout-abort, and (2) the abort listener registered on
    // the PARENT signal -- {once: true} only auto-removes that listener
    // when the parent aborts, never on the happy-path settle. dispose()
    // must release both.

    describe('fork timer clearance (D-5: vi.getTimerCount() idiom)', () => {
      beforeEach(() => {
        vi.useFakeTimers();
      });

      afterEach(() => {
        vi.useRealTimers();
      });

      it('clears the fork timeout on dispose after a successful operation', async () => {
        const baseline = vi.getTimerCount();

        const parent = DefaultResilienceContext.create();
        const forked = parent.fork(5000);

        expect(vi.getTimerCount()).toBe(baseline + 1);

        forked.dispose?.();

        expect(vi.getTimerCount()).toBe(baseline);
      });

      it('clears the fork timeout on dispose after an early-exit/throw path', async () => {
        const baseline = vi.getTimerCount();

        const parent = DefaultResilienceContext.create();
        const forked = parent.fork(5000);

        expect(vi.getTimerCount()).toBe(baseline + 1);

        let caught: unknown;
        try {
          throw new Error('operation failed');
        } catch (error) {
          caught = error;
        } finally {
          forked.dispose?.();
        }

        expect(caught).toBeInstanceOf(Error);
        expect(vi.getTimerCount()).toBe(baseline);
      });

      it('is a no-op when called multiple times', () => {
        const baseline = vi.getTimerCount();

        const parent = DefaultResilienceContext.create();
        const forked = parent.fork(5000);

        forked.dispose?.();
        forked.dispose?.();
        forked.dispose?.();

        expect(vi.getTimerCount()).toBe(baseline);
      });

      it('is a no-op for a context forked without a timeout', () => {
        const baseline = vi.getTimerCount();

        const parent = DefaultResilienceContext.create();
        const forked = parent.fork();

        expect(vi.getTimerCount()).toBe(baseline);

        expect(() => forked.dispose?.()).not.toThrow();
        expect(vi.getTimerCount()).toBe(baseline);
      });
    });

    describe('parent-signal abort listener removal (separate from timer clearance)', () => {
      // getTimerCount() cannot observe an EventTarget listener leak -- this
      // needs its own assertion mechanism (spying on removeEventListener).

      it('removes the abort listener registered on the parent signal when disposed', () => {
        const parent = DefaultResilienceContext.create() as DefaultResilienceContext;
        const removeSpy = vi.spyOn(parent.signal, 'removeEventListener');

        const forked = parent.fork(5000);

        expect(removeSpy).not.toHaveBeenCalled();

        forked.dispose?.();

        expect(removeSpy).toHaveBeenCalledTimes(1);
        expect(removeSpy).toHaveBeenCalledWith('abort', expect.any(Function));
      });

      it('removes the abort listener registered by withAttempt() on the parent signal', () => {
        const parent = DefaultResilienceContext.create() as DefaultResilienceContext;
        const removeSpy = vi.spyOn(parent.signal, 'removeEventListener');

        const child = DefaultResilienceContext.withAttempt(parent, 2);

        expect(removeSpy).not.toHaveBeenCalled();

        child.dispose?.();

        expect(removeSpy).toHaveBeenCalledTimes(1);
        expect(removeSpy).toHaveBeenCalledWith('abort', expect.any(Function));
      });

      it('does not throw and does not attempt listener removal when the parent was already aborted at fork time', () => {
        const parentController = new AbortController();
        const parent = new DefaultResilienceContext(
          undefined,
          undefined,
          1,
          undefined,
          parentController
        );
        parentController.abort(new Error('parent aborted'));

        const removeSpy = vi.spyOn(parent.signal, 'removeEventListener');

        const forked = parent.fork(5000);

        expect(() => forked.dispose?.()).not.toThrow();
        expect(removeSpy).not.toHaveBeenCalled();
      });

      it('is safe to call dispose multiple times without double-removing listeners', () => {
        const parent = DefaultResilienceContext.create() as DefaultResilienceContext;
        const removeSpy = vi.spyOn(parent.signal, 'removeEventListener');

        const forked = parent.fork(5000);

        forked.dispose?.();
        forked.dispose?.();

        expect(removeSpy).toHaveBeenCalledTimes(1);
      });
    });
  });
});
