import type { ResilienceContext } from '../core/resilience-context';

/**
 * @llm-summary Enumeration of circuit breaker state values
 * @llm-domain Infrastructure
 * @llm-usage Frequent
 *
 * @description
 * CircuitBreakerState enum implementing infrastructure service for circuit breaker state operations.
 *
 * @example
 * ```typescript
 * // Usage example
 * const value: CircuitBreakerState = CircuitBreakerState.VALUE;
 * ```
 *
 * @since 1.0.0
 * @public
 */
export enum CircuitBreakerState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

/**
 * @llm-summary Contract for circuit breaker config functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * CircuitBreakerConfig interface implementing infrastructure service for circuit breaker config operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteCircuitBreakerConfig implements CircuitBreakerConfig {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface CircuitBreakerConfig {
  readonly failureThreshold: number;
  readonly recoveryTimeout: number;
  readonly successThreshold: number;
  readonly timeout: number;
  readonly name?: string | undefined;
}

/**
 * @llm-summary Contract for circuit breaker metrics functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * CircuitBreakerMetrics interface implementing infrastructure service for circuit breaker metrics operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteCircuitBreakerMetrics implements CircuitBreakerMetrics {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface CircuitBreakerMetrics {
  readonly state: CircuitBreakerState;
  readonly failureCount: number;
  readonly successCount: number;
  readonly lastFailureTime?: Date | undefined;
  readonly lastSuccessTime?: Date | undefined;
  readonly nextAttemptTime?: Date | undefined;
}

/**
 * @llm-summary CircuitBreakerOpenError class for circuit breaker open error operations
 * @llm-domain Infrastructure
 * @llm-complexity Expert
 *
 * @description
 * CircuitBreakerOpenError class implementing infrastructure service for circuit breaker open error operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new CircuitBreakerOpenError();
 * ```
 * *
 * @since 1.0.0
 * @public
 */
export class CircuitBreakerOpenError extends Error {
  constructor(circuitName: string, nextAttemptTime: Date) {
    super(
      `Circuit breaker '${circuitName}' is open. Next attempt at: ${nextAttemptTime.toISOString()}`
    );
    this.name = 'CircuitBreakerOpenError';
  }
}

/**
 * @llm-summary CircuitBreaker class for circuit breaker operations
 * @llm-domain Infrastructure
 * @llm-complexity Expert
 *
 * @description
 * CircuitBreaker class implementing infrastructure service for circuit breaker operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new CircuitBreaker();
 * ```
 * *
 * @since 1.0.0
 * @public
 */
export class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime?: Date | undefined;
  private lastSuccessTime?: Date | undefined;
  private nextAttemptTime?: Date | undefined;

  constructor(private readonly config: CircuitBreakerConfig) {}

  async execute<T>(
    operation: (context: ResilienceContext) => Promise<T>,
    context: ResilienceContext
  ): Promise<T> {
    this.updateStateIfNeeded();

    if (this.state === CircuitBreakerState.OPEN) {
      throw new CircuitBreakerOpenError(
        this.config.name ?? 'unnamed',
        this.nextAttemptTime ?? new Date()
      );
    }

    const operationContext = context.withTimeout(this.config.timeout);

    try {
      const result = await operation(operationContext);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.lastSuccessTime = new Date();

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.config.successThreshold) {
        this.reset();
      }
    } else {
      this.failureCount = 0;
    }
  }

  private onFailure(): void {
    this.lastFailureTime = new Date();
    this.failureCount++;

    if (this.failureCount >= this.config.failureThreshold) {
      this.tripCircuit();
    }
  }

  private tripCircuit(): void {
    this.state = CircuitBreakerState.OPEN;
    this.nextAttemptTime = new Date(Date.now() + this.config.recoveryTimeout);
  }

  private reset(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttemptTime = undefined;
  }

  private updateStateIfNeeded(): void {
    if (this.state === CircuitBreakerState.OPEN && this.shouldAttemptReset()) {
      this.state = CircuitBreakerState.HALF_OPEN;
      this.successCount = 0;
    }
  }

  private shouldAttemptReset(): boolean {
    return this.nextAttemptTime ? new Date() >= this.nextAttemptTime : false;
  }

  getMetrics(): CircuitBreakerMetrics {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      nextAttemptTime: this.nextAttemptTime,
    };
  }

  getName(): string {
    return this.config.name ?? 'unnamed';
  }
}
