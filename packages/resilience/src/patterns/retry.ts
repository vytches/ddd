import type { ResilienceContext } from '../core/resilience-context';
import { DefaultResilienceContext } from '../core/resilience-context';

/**
 * @llm-summary Contract for retry config functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * RetryConfig interface implementing infrastructure service for retry config operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteRetryConfig implements RetryConfig {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface RetryConfig {
  readonly maxAttempts: number;
  readonly baseDelay: number;
  readonly maxDelay: number;
  readonly backoffMultiplier: number;
  readonly jitter: boolean;
  readonly retryableErrors?: (error: Error) => boolean;
}

/**
 * @llm-summary Contract for retry metrics functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * RetryMetrics interface implementing infrastructure service for retry metrics operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteRetryMetrics implements RetryMetrics {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface RetryMetrics {
  readonly attempt: number;
  readonly totalAttempts: number;
  readonly totalDelay: number;
  readonly lastError?: Error;
}

/**
 * @llm-summary MaxRetriesExceededError class for max retries exceeded error operations
 * @llm-domain Infrastructure
 * @llm-complexity Medium
 *
 * @description
 * MaxRetriesExceededError class implementing infrastructure service for max retries exceeded error operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new MaxRetriesExceededError();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new MaxRetriesExceededError());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class MaxRetriesExceededError extends Error {
  constructor(
    public readonly attempts: number,
    public readonly lastError: Error
  ) {
    super(`Max retries (${attempts}) exceeded. Last error: ${lastError.message}`);
    this.name = 'MaxRetriesExceededError';
  }
}

/**
 * @llm-summary RetryPolicy class for retry policy operations
 * @llm-domain Infrastructure
 * @llm-complexity Medium
 *
 * @description
 * RetryPolicy class implementing infrastructure service for retry policy operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new RetryPolicy();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new RetryPolicy());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
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

      context.signal.addEventListener('abort', () => {
        clearTimeout(timeoutId);
        reject(context.signal.reason);
      });
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
