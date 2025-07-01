import type { ResilienceContext } from '../core/resilience-context';

export enum CircuitBreakerState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export interface CircuitBreakerConfig {
  readonly failureThreshold: number;
  readonly recoveryTimeout: number;
  readonly successThreshold: number;
  readonly timeout: number;
  readonly name?: string | undefined;
}

export interface CircuitBreakerMetrics {
  readonly state: CircuitBreakerState;
  readonly failureCount: number;
  readonly successCount: number;
  readonly lastFailureTime?: Date | undefined;
  readonly lastSuccessTime?: Date | undefined;
  readonly nextAttemptTime?: Date | undefined;
}

export class CircuitBreakerOpenError extends Error {
  constructor(circuitName: string, nextAttemptTime: Date) {
    super(`Circuit breaker '${circuitName}' is open. Next attempt at: ${nextAttemptTime.toISOString()}`);
    this.name = 'CircuitBreakerOpenError';
  }
}

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
      nextAttemptTime: this.nextAttemptTime
    };
  }

  getName(): string {
    return this.config.name ?? 'unnamed';
  }
}
