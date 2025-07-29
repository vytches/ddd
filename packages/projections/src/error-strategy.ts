import type { IProjectionErrorStrategy, IProjectionRetryConfig } from './projection-interfaces';

/**
 * @llm-summary ExponentialBackoffStrategy class for exponential backoff strategy operations
 * @llm-domain Architecture
 * @llm-complexity Medium
 *
 * @description
 * ExponentialBackoffStrategy class implementing architectural component for exponential backoff strategy operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new ExponentialBackoffStrategy();
 * ```
 * *
 * @since 1.0.0
 * @public
 */
export class ExponentialBackoffStrategy implements IProjectionErrorStrategy {
  shouldRetry(error: Error, attempt: number, config?: IProjectionRetryConfig): boolean {
    if (!config) {
      // Default retry logic - retry up to 3 times for transient errors
      return attempt < 3 && this.isTransientError(error);
    }
    return attempt < config.maxAttempts && this.isRetryableError(error, config);
  }

  getRetryDelay(attempt: number, config: IProjectionRetryConfig): number {
    const delay = config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt - 1);
    return Math.min(delay, config.maxDelayMs);
  }

  getDelay(attempt: number, config?: IProjectionRetryConfig): number {
    if (!config) {
      return Math.min(100 * Math.pow(2, attempt - 1), 5000);
    }
    return this.getRetryDelay(attempt, config);
  }

  isRetryableError(error: Error, config: IProjectionRetryConfig): boolean {
    const errorType = error.constructor.name;

    // Explicit non-retryable takes precedence
    if (config.nonRetryableErrors.includes(errorType)) {
      return false;
    }

    // If retryable list is specified, only those are retryable
    if (config.retryableErrors.length > 0) {
      return config.retryableErrors.includes(errorType);
    }

    // Default: retry network/db errors, don't retry validation errors
    const retryableByDefault = ['NetworkError', 'TimeoutError', 'DatabaseError'];
    const nonRetryableByDefault = ['ValidationError', 'ProjectionError'];

    if (nonRetryableByDefault.includes(errorType)) return false;
    return retryableByDefault.includes(errorType);
  }

  private isTransientError(error: Error): boolean {
    const message = error.message.toLowerCase();
    return (
      message.includes('transient') ||
      message.includes('timeout') ||
      message.includes('network') ||
      message.includes('temporary') ||
      message.includes('temporarily unavailable') ||
      message.includes('store temporarily unavailable')
    );
  }
}
