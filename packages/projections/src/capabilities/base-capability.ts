import type { IExtendedDomainEvent, IProjectionCapability } from '@vytches/ddd-contracts';
import { Capability } from '@vytches/ddd-contracts';

import type { ICapabilityContext, IProjectionLifecycleCapability } from '../projection-interfaces';
import { ProjectionError } from '../projection-errors';

// base-capability.ts

/**
 * @llm-summary BaseIntervalCapability class for base interval capability operations
 * @llm-domain Architecture
 * @llm-complexity Medium
 *
 * @description
 * BaseIntervalCapability class implementing architectural component for base interval capability operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new BaseIntervalCapability();
 * ```
 * *
 * @since 1.0.0
 * @public
 */
export abstract class BaseIntervalCapability<T extends string, TReadModel>
  extends Capability<T>
  implements IProjectionCapability, IProjectionLifecycleCapability<TReadModel>
{
  protected eventCounter = 0;
  protected context?: ICapabilityContext<TReadModel> | undefined;

  constructor(
    protected readonly capabilityType: T,
    protected readonly interval = 100
  ) {
    super();
    if (interval <= 0) {
      throw new Error(`${capabilityType} capability: interval must be positive`);
    }
  }

  abstract override readonly type: T;

  attach(context: ICapabilityContext<TReadModel>): void {
    this.context = context;
  }

  detach(): void {
    this.context = undefined;
  }

  async onAfterApply(state: TReadModel, event: IExtendedDomainEvent): Promise<void> {
    this.eventCounter++;

    if (this.eventCounter >= this.interval) {
      await this.handleInterval(state, event);
      this.eventCounter = 0;
    }
  }

  protected abstract handleInterval(state: TReadModel, event: IExtendedDomainEvent): Promise<void>;

  protected ensureAttached(): void {
    if (!this.context) {
      throw ProjectionError.capabilityNotAttached(this.capabilityType);
    }
  }
}
