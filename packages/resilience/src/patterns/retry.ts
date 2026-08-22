import type { ResilienceContext } from '../core/resilience-context';
import { DefaultResilienceContext } from '../core/resilience-context';

export interface RetryConfig {
  readonly maxAttempts: number;
  readonly baseDelay: number;
  readonly maxDelay: number;
  readonly backoffMultiplier: number;
  /**
   * Jitter algorithm here is **Equal Jitter**: the computed exponential delay
   * is multiplied by a random factor in the 50%-100% band (see
   * {@link RetryPolicy.calculateDelay}). This is a different algorithm from
   * `@vytches/ddd-policies`' `PolicyRetryConfig.jitter` (+/-10% band around
   * the computed delay) — the two packages' retry jitter are not
   * interchangeable tuning knobs, docs-only note (SA-L5/D8, no behavior
   * change).
   */
  readonly jitter: boolean;
  /**
   * SA-L5: when omitted, {@link RetryPolicy.execute} retries **every**
   * thrown error, including ones that are unsafe to retry blindly (e.g. a
   * validation error from a non-idempotent operation). Set this to scope
   * retry to errors you know are transient/safe to retry (network timeouts,
   * `ECONNRESET`, etc.) — especially when wrapping anything that is not
   * provably idempotent.
   */
  readonly retryableErrors?: (error: Error) => boolean;
}

export interface RetryMetrics {
  readonly attempt: number;
  readonly totalAttempts: number;
  readonly totalDelay: number;
  readonly lastError?: Error;
}

export class MaxRetriesExceededError extends Error {
  constructor(
    public readonly attempts: number,
    public readonly lastError: Error
  ) {
    super(`Max retries (${attempts}) exceeded. Last error: ${lastError.message}`);
    this.name = 'MaxRetriesExceededError';
  }
}

export class RetryPolicy {
  constructor(private readonly config: RetryConfig) {}

  async execute<T>(
    operation: (context: ResilienceContext) => Promise<T>,
    context: ResilienceContext
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
      const attemptContext = DefaultResilienceContext.withAttempt(context, attempt);

      try {
        return await operation(attemptContext);
      } catch (error) {
        lastError = error as Error;

        if (!this.shouldRetry(error as Error, attempt)) {
          throw error;
        }

        if (attempt >= this.config.maxAttempts) {
          throw new MaxRetriesExceededError(this.config.maxAttempts, lastError);
        }

        const delay = this.calculateDelay(attempt);
        await this.delay(delay, attemptContext);
      }
    }

    throw new MaxRetriesExceededError(
      this.config.maxAttempts,
      lastError ?? new Error('Unknown error')
    );
  }

  private shouldRetry(error: Error, _attempt: number): boolean {
    if (this.config.retryableErrors) {
      return this.config.retryableErrors(error);
    }

    // SA-L5: no `retryableErrors` configured — retries ALL errors. See the
    // JSDoc on RetryConfig.retryableErrors.
    return true;
  }

  private calculateDelay(attempt: number): number {
    const exponentialDelay =
      this.config.baseDelay * Math.pow(this.config.backoffMultiplier, attempt - 1);
    let delay = Math.min(exponentialDelay, this.config.maxDelay);

    if (this.config.jitter) {
      delay = delay * (0.5 + Math.random() * 0.5);
    }

    return Math.floor(delay);
  }

  private async delay(ms: number, context: ResilienceContext): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(resolve, ms);

      context.signal.addEventListener(
        'abort',
        () => {
          clearTimeout(timeoutId);
          reject(context.signal.reason);
        },
        { once: true }
      );
    });
  }

  static defaultConfig(): RetryConfig {
    return {
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2,
      jitter: true,
    };
  }

  static withConfig(overrides: Partial<RetryConfig>): RetryPolicy {
    return new RetryPolicy({
      ...RetryPolicy.defaultConfig(),
      ...overrides,
    });
  }
}
