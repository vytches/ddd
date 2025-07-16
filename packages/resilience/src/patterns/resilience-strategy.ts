/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type { ResilienceContext } from '../core/resilience-context';
import { TimeoutError } from '../core/resilience-context';
import type { CircuitBreakerConfig } from './circuit-breaker';
import { CircuitBreaker } from './circuit-breaker';
import type { RetryConfig } from './retry';
import { RetryPolicy } from './retry';
import type { BulkheadConfig } from './bulkhead';
import { Bulkhead } from './bulkhead';

/**
 * @llm-summary Contract for resilience strategy functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * ResilienceStrategy interface implementing infrastructure service for resilience strategy operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteResilienceStrategy implements ResilienceStrategy {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface ResilienceStrategy {
  execute<T>(
    operation: (context: ResilienceContext) => Promise<T>,
    context: ResilienceContext
  ): Promise<T>;
}

/**
 * @llm-summary CompositeResilienceStrategy class for composite resilience strategy operations
 * @llm-domain Infrastructure
 * @llm-complexity Expert
 *
 * @description
 * CompositeResilienceStrategy class implementing infrastructure service for composite resilience strategy operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new CompositeResilienceStrategy();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new CompositeResilienceStrategy());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class CompositeResilienceStrategy implements ResilienceStrategy {
  constructor(private readonly strategies: ResilienceStrategy[]) {}

  async execute<T>(
    operation: (context: ResilienceContext) => Promise<T>,
    context: ResilienceContext
  ): Promise<T> {
    let wrappedOperation = operation;

    for (let i = this.strategies.length - 1; i >= 0; i--) {
      const strategy = this.strategies[i];
      const currentOperation = wrappedOperation;

      wrappedOperation = (ctx: ResilienceContext) => strategy!.execute(currentOperation, ctx);
    }

    return wrappedOperation(context);
  }

  static combine(...strategies: ResilienceStrategy[]): CompositeResilienceStrategy {
    return new CompositeResilienceStrategy(strategies);
  }
}

/**
 * @llm-summary CircuitBreakerStrategy class for circuit breaker strategy operations
 * @llm-domain Infrastructure
 * @llm-complexity Expert
 *
 * @description
 * CircuitBreakerStrategy class implementing infrastructure service for circuit breaker strategy operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new CircuitBreakerStrategy();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new CircuitBreakerStrategy());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class CircuitBreakerStrategy implements ResilienceStrategy {
  private circuitBreaker: CircuitBreaker;

  constructor(config: CircuitBreakerConfig) {
    this.circuitBreaker = new CircuitBreaker(config);
  }

  async execute<T>(
    operation: (context: ResilienceContext) => Promise<T>,
    context: ResilienceContext
  ): Promise<T> {
    return this.circuitBreaker.execute(operation, context);
  }

  getMetrics() {
    return this.circuitBreaker.getMetrics();
  }
}

/**
 * @llm-summary RetryStrategy class for retry strategy operations
 * @llm-domain Infrastructure
 * @llm-complexity Medium
 *
 * @description
 * RetryStrategy class implementing infrastructure service for retry strategy operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new RetryStrategy();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new RetryStrategy());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class RetryStrategy implements ResilienceStrategy {
  private retryPolicy: RetryPolicy;

  constructor(config: RetryConfig) {
    this.retryPolicy = new RetryPolicy(config);
  }

  async execute<T>(
    operation: (context: ResilienceContext) => Promise<T>,
    context: ResilienceContext
  ): Promise<T> {
    return this.retryPolicy.execute(operation, context);
  }
}

/**
 * @llm-summary TimeoutStrategy class for timeout strategy operations
 * @llm-domain Infrastructure
 * @llm-complexity Medium
 *
 * @description
 * TimeoutStrategy class implementing infrastructure service for timeout strategy operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new TimeoutStrategy();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new TimeoutStrategy());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class TimeoutStrategy implements ResilienceStrategy {
  constructor(private readonly timeoutMs: number) {}

  async execute<T>(
    operation: (context: ResilienceContext) => Promise<T>,
    context: ResilienceContext
  ): Promise<T> {
    const timeoutContext = context.withTimeout(this.timeoutMs);

    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new TimeoutError(`Operation timed out after ${this.timeoutMs}ms`));
      }, this.timeoutMs);

      operation(timeoutContext)
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }
}

/**
 * @llm-summary BulkheadStrategy class for bulkhead strategy operations
 * @llm-domain Infrastructure
 * @llm-complexity Expert
 *
 * @description
 * BulkheadStrategy class implementing infrastructure service for bulkhead strategy operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new BulkheadStrategy();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new BulkheadStrategy());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class BulkheadStrategy implements ResilienceStrategy {
  private bulkhead: Bulkhead;

  constructor(config: BulkheadConfig) {
    this.bulkhead = new Bulkhead(config);
  }

  async execute<T>(
    operation: (context: ResilienceContext) => Promise<T>,
    context: ResilienceContext
  ): Promise<T> {
    return this.bulkhead.execute(operation, context);
  }

  getMetrics() {
    return this.bulkhead.getMetrics();
  }
}

/**
 * @llm-summary ResiliencePolicyBuilder class for resilience policy builder operations
 * @llm-domain Infrastructure
 * @llm-complexity Medium
 *
 * @description
 * ResiliencePolicyBuilder class implementing infrastructure service for resilience policy builder operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new ResiliencePolicyBuilder();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new ResiliencePolicyBuilder());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class ResiliencePolicyBuilder {
  private strategies: ResilienceStrategy[] = [];

  withCircuitBreaker(config: CircuitBreakerConfig): ResiliencePolicyBuilder {
    this.strategies.push(new CircuitBreakerStrategy(config));
    return this;
  }

  withRetry(config: RetryConfig): ResiliencePolicyBuilder {
    this.strategies.push(new RetryStrategy(config));
    return this;
  }

  withTimeout(timeoutMs: number): ResiliencePolicyBuilder {
    this.strategies.push(new TimeoutStrategy(timeoutMs));
    return this;
  }

  withBulkhead(config: BulkheadConfig): ResiliencePolicyBuilder {
    this.strategies.push(new BulkheadStrategy(config));
    return this;
  }

  build(): ResilienceStrategy {
    if (this.strategies.length === 0) {
      throw new Error('At least one resilience strategy must be configured');
    }

    if (this.strategies.length === 1) {
      return this.strategies[0]!;
    }

    return new CompositeResilienceStrategy([...this.strategies]);
  }

  static create(): ResiliencePolicyBuilder {
    return new ResiliencePolicyBuilder();
  }
}
