import type { IExtendedDomainEvent } from '@vytches-ddd/contracts';

import type {
  ICapabilityContext,
  IProjectionLifecycleCapability,
} from '../projection-interfaces';
import { ProjectionError } from '../projection-errors';

// base-capability.ts
export abstract class BaseIntervalCapability<TReadModel>
  implements IProjectionLifecycleCapability<TReadModel>
{
  protected eventCounter = 0;
  protected context?: ICapabilityContext<TReadModel> | undefined;

  constructor(
    public readonly name: string,
    protected readonly interval = 100,
  ) {
    if (interval <= 0) {
      throw new Error(`${name} capability: interval must be positive`);
    }
  }

  attach(context: ICapabilityContext<TReadModel>): void {
    this.context = context;
  }

  detach(): void {
    this.context = undefined;
  }

  async onAfterApply(
    state: TReadModel,
    event: IExtendedDomainEvent,
  ): Promise<void> {
    this.eventCounter++;

    if (this.eventCounter >= this.interval) {
      await this.handleInterval(state, event);
      this.eventCounter = 0;
    }
  }

  protected abstract handleInterval(
    state: TReadModel,
    event: IExtendedDomainEvent,
  ): Promise<void>;

  protected ensureAttached(): void {
    if (!this.context) {
      throw ProjectionError.capabilityNotAttached(this.name);
    }
  }
}
