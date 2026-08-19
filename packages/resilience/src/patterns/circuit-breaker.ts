import type { ResilienceContext } from '../core/resilience-context';

export enum CircuitBreakerState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerConfig {
  readonly failureThreshold: number;
  readonly recoveryTimeout: number;
  readonly successThreshold: number;
  readonly timeout: number;
  readonly name?: string | undefined;
  /**
   * Maximum number of HALF_OPEN probes allowed in flight at once. Once the
   * recovery timeout elapses, every caller sees the breaker as HALF_OPEN
   * (SA-M3) — without this gate, all of them reach the downstream
   * simultaneously instead of a single controlled probe. Extra callers over
   * the limit are rejected with {@link CircuitBreakerHalfOpenLimitError},
   * mirroring how OPEN rejects with {@link CircuitBreakerOpenError}.
   *
   * Defaults to `1`. Raise it deliberately if the downstream can safely
   * absorb more than one concurrent recovery probe.
   *
   * Note: a probe holds its slot for its *entire* execution, including any
   * `Retry` strategy composed inside this breaker (retry sits inside circuit
   * breaker in the composite resilience strategy) — so recovery can take
   * noticeably longer than `recoveryTimeout` alone would suggest when a probe
   * itself retries with backoff.
   */
  readonly halfOpenMaxProbes?: number | undefined;
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
    super(
      `Circuit breaker '${circuitName}' is open. Next attempt at: ${nextAttemptTime.toISOString()}`
    );
    this.name = 'CircuitBreakerOpenError';
  }
}

/**
 * Thrown when a HALF_OPEN circuit breaker already has its configured maximum
 * number of probes ({@link CircuitBreakerConfig.halfOpenMaxProbes}) in flight
 * and rejects an additional call (SA-M3, AC3).
 *
 * Extends {@link CircuitBreakerOpenError} (D5) so existing
 * `instanceof CircuitBreakerOpenError` catch handlers keep working — this is
 * a specialization of "not currently accepting calls", not an unrelated
 * error. It carries its own distinct `name` and message so callers that want
 * to distinguish "breaker is OPEN" from "breaker is recovering and already
 * probing" can do so with `instanceof CircuitBreakerHalfOpenLimitError`.
 */
export class CircuitBreakerHalfOpenLimitError extends CircuitBreakerOpenError {
  constructor(circuitName: string, nextAttemptTime: Date) {
    super(circuitName, nextAttemptTime);
    this.name = 'CircuitBreakerHalfOpenLimitError';
    this.message = `Circuit breaker '${circuitName}' is HALF_OPEN and already probing at its concurrency limit. Next attempt at: ${nextAttemptTime.toISOString()}`;
  }
}

export class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime?: Date | undefined;
  private lastSuccessTime?: Date | undefined;
  private nextAttemptTime?: Date | undefined;
  // AC3/SA-M3: number of HALF_OPEN probes currently executing. Checked and
  // incremented synchronously (no `await` in between) at the top of
  // execute(), so concurrent calls racing in after recoveryTimeout elapses
  // cannot both slip past the gate — JS has no interleaving between the
  // check and the increment.
  private halfOpenProbesInFlight = 0;

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

    // AC3: gate concurrent HALF_OPEN probes. Without this, every caller that
    // arrives once recoveryTimeout elapses reaches the downstream at once
    // (SA-M3) instead of a single controlled recovery probe.
    let isHalfOpenProbe = false;
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      const maxProbes = this.config.halfOpenMaxProbes ?? 1;
      if (this.halfOpenProbesInFlight >= maxProbes) {
        throw new CircuitBreakerHalfOpenLimitError(
          this.config.name ?? 'unnamed',
          this.nextAttemptTime ?? new Date()
        );
      }
      this.halfOpenProbesInFlight++;
      isHalfOpenProbe = true;
    }

    const operationContext = context.withTimeout(this.config.timeout);

    try {
      const result = await operation(operationContext);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    } finally {
      // VB-004: withTimeout() forks a context holding a timer + a parent
      // abort listener; dispose() releases both once this attempt settles.
      operationContext.dispose?.();
      if (isHalfOpenProbe) {
        this.halfOpenProbesInFlight--;
      }
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
