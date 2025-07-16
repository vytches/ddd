/* eslint-disable @typescript-eslint/no-explicit-any */
import type { IExtendedDomainEvent, IProjectionCapability } from '@vytches-ddd/contracts';
import { Capability } from '@vytches-ddd/contracts';

import { ProjectionError } from '../projection-errors';
import type {
  ICapabilityContext,
  ICircuitBreakerConfig,
  IProjectionLifecycleCapability,
} from '../projection-interfaces';
import { CircuitState } from '../projection-interfaces';

/**
 * @llm-summary CircuitBreakerCapability class for circuit breaker capability operations
 * @llm-domain Architecture
 * @llm-complexity Expert
 *
 * @description
 * CircuitBreakerCapability class implementing architectural component for circuit breaker capability operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new CircuitBreakerCapability();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new CircuitBreakerCapability());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class CircuitBreakerCapability<TReadModel>
  extends Capability<'circuitBreaker'>
  implements IProjectionCapability, IProjectionLifecycleCapability<TReadModel>
{
  override readonly type = 'circuitBreaker' as const;

  static override get capabilityType(): string {
    return 'circuitBreaker';
  }
  private state = CircuitState.CLOSED;
  private failureCount = 0;
  private lastFailureTime?: Date;
  private halfOpenAttempts = 0;
  private readonly context?: ICapabilityContext<TReadModel>;

  constructor(private readonly config: ICircuitBreakerConfig) {
    super();
  }

  attach(context: ICapabilityContext<TReadModel>): void {
    (this as any).context = context;
  }

  detach?(): void {
    (this as any).context = undefined;
  }

  // readonly name = 'circuit-breaker'; // Replaced by type property

  async onBeforeApply(_state: TReadModel, _event: IExtendedDomainEvent): Promise<void> {
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitState.HALF_OPEN;
        this.halfOpenAttempts = 0;
      } else {
        const projectionName = this.context?.getProjectionName() || 'unknown';
        throw new ProjectionError(`Circuit breaker OPEN for projection ${projectionName}`);
      }
    }
  }

  async onAfterApply(_state: TReadModel, _event: IExtendedDomainEvent): Promise<void> {
    if (this.state === CircuitState.HALF_OPEN) {
      this.halfOpenAttempts++;
      if (this.halfOpenAttempts >= this.config.halfOpenMaxAttempts) {
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
      }
    } else if (this.state === CircuitState.CLOSED) {
      this.failureCount = 0; // Reset on success
    }
  }

  async onError(error: ProjectionError): Promise<void> {
    this.failureCount++;
    this.lastFailureTime = new Date();

    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.OPEN;
    } else if (this.failureCount >= this.config.failureThreshold) {
      this.state = CircuitState.OPEN;
    }
  }

  private shouldAttemptReset(): boolean {
    if (!this.lastFailureTime) return false;
    return Date.now() - this.lastFailureTime.getTime() > this.config.recoveryTimeoutMs;
  }

  getState(): CircuitState {
    return this.state;
  }
}
