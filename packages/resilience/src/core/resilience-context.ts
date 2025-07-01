/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Context for resilience operations - inspired by Go's context package
 */
export interface ResilienceContext {
  readonly signal: AbortSignal;
  readonly correlationId: string;
  readonly startTime: Date;
  readonly attempt: number;
  readonly metadata: ReadonlyMap<string, unknown>;

  fork(timeout?: number): ResilienceContext;
  withMetadata(key: string, value: unknown): ResilienceContext;
  withTimeout(timeoutMs: number): ResilienceContext;
}

export class DefaultResilienceContext implements ResilienceContext {
  private abortController: AbortController;
  private _metadata: Map<string, unknown>;

  constructor(
    public readonly correlationId: string = crypto.randomUUID(),
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

    // Forward abort from parent
    if (this.signal.aborted) {
      newController.abort(this.signal.reason);
    } else {
      this.signal.addEventListener('abort', () => {
        newController.abort(this.signal.reason);
      });
    }

    // Set timeout if specified
    if (timeout !== undefined && timeout > 0) {
      setTimeout(() => {
        if (!newController.signal.aborted) {
          newController.abort(new TimeoutError(`Operation timed out after ${timeout}ms`));
        }
      }, timeout);
    }

    return new DefaultResilienceContext(
      this.correlationId,
      this.startTime,
      this.attempt,
      this._metadata,
      newController
    );
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

  static create(options: {
    correlationId?: string;
    metadata?: Record<string, unknown>;
    timeout?: number;
  } = {}): ResilienceContext {
    const metadata = new Map(Object.entries(options.metadata ?? {}));
    const context = new DefaultResilienceContext(
      options.correlationId,
      undefined,
      1,
      metadata
    );

    return options.timeout ? context.withTimeout(options.timeout) : context;
  }

  static withAttempt(context: ResilienceContext, attempt: number): ResilienceContext {
    return new DefaultResilienceContext(
      context.correlationId,
      context.startTime,
      attempt,
      new Map(context.metadata),
      // Create new controller to avoid sharing abort state between attempts
      new AbortController()
    );
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
