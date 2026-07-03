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
   * Releases resources held by this context: the fork timeout (if any) and
   * the abort listener registered on the parent signal. Optional for
   * backward compatibility -- existing implementers of this interface are
   * unaffected. Consumers that fork/derive a context (e.g. via `fork()` or
   * `withTimeout()`) should call `context.dispose?.()` once the operation
   * using that context has settled (success or failure) to avoid leaking
   * timers and event listeners.
   */
  dispose?(): void;
}

export class DefaultResilienceContext implements ResilienceContext {
  private abortController: AbortController;
  private _metadata: Map<string, unknown>;
  private _disposeTimerId: ReturnType<typeof setTimeout> | undefined = undefined;
  private _disposeAbortCleanup: (() => void) | undefined = undefined;

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
    return this.abortController.signal;
  }

  get metadata(): ReadonlyMap<string, unknown> {
    return this._metadata;
  }

  fork(timeout?: number): ResilienceContext {
    const newController = new AbortController();
    let parentAbortCleanup: (() => void) | undefined;

    // Forward abort from parent
    if (this.signal.aborted) {
      newController.abort(this.signal.reason);
    } else {
      const onParentAbort = (): void => {
        newController.abort(this.signal.reason);
      };
      this.signal.addEventListener('abort', onParentAbort, { once: true });
      // {once: true} only auto-removes the listener when the parent aborts;
      // on the happy path (context settles without the parent ever
      // aborting) the listener would otherwise remain registered on the
      // parent signal for the parent's lifetime. dispose() removes it.
      parentAbortCleanup = () => {
        this.signal.removeEventListener('abort', onParentAbort);
      };
    }

    // Set timeout if specified
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    if (timeout !== undefined && timeout > 0) {
      timeoutId = setTimeout(() => {
        if (!newController.signal.aborted) {
          newController.abort(new TimeoutError(`Operation timed out after ${timeout}ms`));
        }
      }, timeout);
    }

    const child = new DefaultResilienceContext(
      this.correlationId,
      this.startTime,
      this.attempt,
      this._metadata,
      newController
    );

    child._disposeTimerId = timeoutId;
    child._disposeAbortCleanup = parentAbortCleanup;

    return child;
  }

  /**
   * Clears the fork timeout (if this context was created with one) and
   * removes the abort listener registered on the parent signal during
   * fork()/withAttempt(). Safe to call multiple times; a no-op once
   * already disposed or when this context holds neither resource (e.g.
   * a context created directly via the constructor or `static create()`).
   */
  dispose(): void {
    if (this._disposeTimerId !== undefined) {
      clearTimeout(this._disposeTimerId);
      this._disposeTimerId = undefined;
    }

    if (this._disposeAbortCleanup !== undefined) {
      this._disposeAbortCleanup();
      this._disposeAbortCleanup = undefined;
    }
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
    const newController = new AbortController();
    let parentAbortCleanup: (() => void) | undefined;

    // Propagate abort from parent context to child attempt
    if (context.signal.aborted) {
      newController.abort(context.signal.reason);
    } else {
      const onParentAbort = (): void => {
        newController.abort(context.signal.reason);
      };
      context.signal.addEventListener('abort', onParentAbort, { once: true });
      // Same {once: true} happy-path leak as fork() -- see dispose().
      parentAbortCleanup = () => {
        context.signal.removeEventListener('abort', onParentAbort);
      };
    }

    const child = new DefaultResilienceContext(
      context.correlationId,
      context.startTime,
      attempt,
      new Map(context.metadata),
      newController
    );

    child._disposeAbortCleanup = parentAbortCleanup;

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
