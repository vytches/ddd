import type { IExtendedDomainEvent } from '@vytches-ddd/contracts';

import type { IProjectionCheckpointStore } from '../projection-interfaces';

import { BaseIntervalCapability } from './base-capability';

export class CheckpointCapability<TReadModel> extends BaseIntervalCapability<TReadModel> {
  constructor(
    private readonly checkpointStore: IProjectionCheckpointStore,
    interval = 100
  ) {
    super('checkpoint', interval);
  }

  protected async handleInterval(state: TReadModel, event: IExtendedDomainEvent): Promise<void> {
    this.ensureAttached();

    const position: number =
      typeof event.metadata?.position === 'number' ? event.metadata.position : 0;
    await this.checkpointStore.save(this.context!.getProjectionName(), {
      state,
      position,
      timestamp: new Date(),
      eventCount: this.eventCounter,
    });
  }

  async loadCheckpoint(): Promise<{
    state: TReadModel;
    position: number;
  } | null> {
    this.ensureAttached();

    const checkpoint = await this.checkpointStore.load<TReadModel>(
      this.context!.getProjectionName()
    );

    return checkpoint ? { state: checkpoint.state, position: checkpoint.position } : null;
  }
}
