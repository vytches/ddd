/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type { ResilienceContext} from '../core/resilience-context';
import { TimeoutError } from '../core/resilience-context';
import type { CircuitBreakerConfig } from './circuit-breaker';
import { CircuitBreaker } from './circuit-breaker';
import type { RetryConfig } from './retry';
import { RetryPolicy } from './retry';
import type { BulkheadConfig } from './bulkhead';
import { Bulkhead } from './bulkhead';

export interface ResilienceStrategy {
  execute<T>(
    operation: (context: ResilienceContext) => Promise<T>,
    context: ResilienceContext
  ): Promise<T>;
}

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

      wrappedOperation = (ctx: ResilienceContext) =>
        strategy!.execute(currentOperation, ctx);
    }

    return wrappedOperation(context);
  }

  static combine(...strategies: ResilienceStrategy[]): CompositeResilienceStrategy {
    return new CompositeResilienceStrategy(strategies);
  }
}

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
