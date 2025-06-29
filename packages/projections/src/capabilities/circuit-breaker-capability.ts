/* eslint-disable @typescript-eslint/no-explicit-any */
import type { IExtendedDomainEvent } from '@vytches-ddd/contracts';

import { ProjectionError } from '../projection-errors';
import type {
  ICapabilityContext,
  ICircuitBreakerConfig,
  IProjectionLifecycleCapability,
} from '../projection-interfaces';
import { CircuitState } from '../projection-interfaces';

export class CircuitBreakerCapability<TReadModel>
  implements IProjectionLifecycleCapability<TReadModel>
{
  private state = CircuitState.CLOSED;
  private failureCount = 0;
  private lastFailureTime?: Date;
  private halfOpenAttempts = 0;
  private readonly context?: ICapabilityContext<TReadModel>;

  constructor(private readonly config: ICircuitBreakerConfig) {}

  attach(context: ICapabilityContext<TReadModel>): void {
    (this as any).context = context;
  }

  detach?(): void {
    (this as any).context = undefined;
  }

  readonly name = 'circuit-breaker';

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
