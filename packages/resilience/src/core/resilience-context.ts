/* eslint-disable @typescript-eslint/no-explicit-any */

import { LibUtils } from '@vytches/ddd-utils';

/**
 * @llm-summary Contract for resilience context functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * ResilienceContext interface implementing infrastructure service for resilience context operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteResilienceContext implements ResilienceContext {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
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

/**
 * @llm-summary DefaultResilienceContext class for default resilience context operations
 * @llm-domain Infrastructure
 * @llm-complexity Expert
 *
 * @description
 * DefaultResilienceContext class implementing infrastructure service for default resilience context operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new DefaultResilienceContext();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new DefaultResilienceContext());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class DefaultResilienceContext implements ResilienceContext {
  private abortController: AbortController;
  private _metadata: Map<string, unknown>;

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

/**
 * @llm-summary TimeoutError class for timeout error operations
 * @llm-domain Infrastructure
 * @llm-complexity Medium
 *
 * @description
 * TimeoutError class implementing infrastructure service for timeout error operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new TimeoutError();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new TimeoutError());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

/**
 * @llm-summary OperationCancelledError class for operation cancelled error operations
 * @llm-domain Infrastructure
 * @llm-complexity Simple
 *
 * @description
 * OperationCancelledError class implementing infrastructure service for operation cancelled error operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new OperationCancelledError();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new OperationCancelledError());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class OperationCancelledError extends Error {
  constructor(message = 'Operation was cancelled') {
    super(message);
    this.name = 'OperationCancelledError';
  }
}
