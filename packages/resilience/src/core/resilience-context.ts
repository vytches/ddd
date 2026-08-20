/* eslint-disable @typescript-eslint/no-explicit-any */

import { LibUtils } from '@vytches/ddd-utils';

export interface ResilienceContext {
  readonly signal: AbortSignal;
  readonly correlationId: string;
  readonly startTime: Date;
  readonly attempt: number;
  readonly metadata: ReadonlyMap<string, unknown>;

  fork(timeout?: number): ResilienceContext;
  withMetadata(key: string, value: unknown): ResilienceContext;
  withTimeout(timeoutMs: number): ResilienceContext;

  /**
   * @deprecated Since 0.31.0 — a no-op on {@link DefaultResilienceContext},
   * kept only so existing `context.dispose?.()` calls keep compiling.
   *
   * VB-004 introduced this because `fork()`/`withAttempt()` wired their own
   * `setTimeout` and their own `addEventListener('abort', …, { once: true })`
   * on the parent signal — and `{ once: true }` only removes the listener if
   * the parent actually aborts, so every happy-path settle left one behind.
   * VF-027 replaced that machinery with `AbortSignal.any()` /
   * `AbortSignal.timeout()`, which the platform cleans up on its own: the
   * timer is unref'd and self-clearing, and the composite signal's
   * subscription to its sources dies with the composite. There is nothing
   * left to release.
   *
   * Calling it remains harmless. New code should not.
   */
  dispose?(): void;
}

export class DefaultResilienceContext implements ResilienceContext {
  private abortController: AbortController;
  private _metadata: Map<string, unknown>;

  /**
   * Set on contexts produced by {@link fork} / {@link withAttempt}, where the
   * signal is a composite built by `AbortSignal.any()` rather than the one
   * owned by {@link abortController}. Undefined elsewhere, so a directly
   * constructed context keeps exposing its controller's signal and stays
   * abortable through that controller.
   */
  private _derivedSignal: AbortSignal | undefined = undefined;

  constructor(
    public readonly correlationId: string = LibUtils.getUUID(),
    public readonly startTime: Date = new Date(),
    public readonly attempt = 1,
    metadata: Map<string, unknown> = new Map(),
    abortController?: AbortController
  ) {
    this.abortController = abortController ?? new AbortController();
    this._metadata = new Map(metadata);
  }

  get signal(): AbortSignal {
    return this._derivedSignal ?? this.abortController.signal;
  }

  get metadata(): ReadonlyMap<string, unknown> {
    return this._metadata;
  }

  fork(timeout?: number): ResilienceContext {
    // Native composition (VF-027). AbortSignal.timeout() is backed by an
    // already-unref'd, self-clearing timer, and AbortSignal.any() owns its
    // subscription to the sources — so neither the timer nor the parent
    // listener outlives the child, with no dispose() call required. The
    // hand-rolled setTimeout + {once:true} listener pair this replaces leaked
    // on every happy-path settle (VB-004 D-4, SA-M12, UX-C6).
    const sources: AbortSignal[] =
      timeout !== undefined && timeout > 0
        ? [this.signal, AbortSignal.timeout(timeout)]
        : [this.signal];

    const child = new DefaultResilienceContext(
      this.correlationId,
      this.startTime,
      this.attempt,
      this._metadata,
      new AbortController()
    );

    child._derivedSignal = AbortSignal.any(sources);

    return child;
  }

  /**
   * @deprecated Since 0.31.0 — no-op. See {@link ResilienceContext.dispose}.
   *
   * Retained so the `context.dispose?.()` calls VB-004 added across
   * `circuit-breaker.ts`, `resilience-strategy.ts` and elsewhere keep
   * compiling and keep meaning "I am done with this context". They simply have
   * nothing to release now that `AbortSignal.any()` / `AbortSignal.timeout()`
   * handle cleanup.
   */
  dispose(): void {
    // Intentionally empty — see the deprecation note above.
  }

  withMetadata(key: string, value: unknown): ResilienceContext {
    const newMetadata = new Map(this._metadata);
    newMetadata.set(key, value);

    return new DefaultResilienceContext(
      this.correlationId,
      this.startTime,
      this.attempt,
      newMetadata,
      this.abortController
    );
  }

  withTimeout(timeoutMs: number): ResilienceContext {
    return this.fork(timeoutMs);
  }

  static create(
    options: {
      correlationId?: string;
      metadata?: Record<string, unknown>;
      timeout?: number;
    } = {}
  ): ResilienceContext {
    const metadata = new Map(Object.entries(options.metadata ?? {}));
    const context = new DefaultResilienceContext(options.correlationId, undefined, 1, metadata);

    return options.timeout ? context.withTimeout(options.timeout) : context;
  }

  static withAttempt(context: ResilienceContext, attempt: number): ResilienceContext {
    // Same native composition as fork(). SA-M12: RetryPolicy.execute() builds
    // one of these per attempt against a context that may be reused across
    // many execute() calls; under the old manual pairing each attempt added a
    // parent listener that only a real abort would remove, so listeners grew
    // without bound. AbortSignal.any() makes that structurally impossible —
    // no per-attempt dispose() needed.
    const child = new DefaultResilienceContext(
      context.correlationId,
      context.startTime,
      attempt,
      new Map(context.metadata),
      new AbortController()
    );

    child._derivedSignal = AbortSignal.any([context.signal]);

    return child;
  }
}

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

export class OperationCancelledError extends Error {
  constructor(message = 'Operation was cancelled') {
    super(message);
    this.name = 'OperationCancelledError';
  }
}
