import type { IExtendedDomainEvent } from '@vytches-ddd/contracts';

import type { IProjectionSnapshotStore } from '../projection-interfaces';

import { BaseIntervalCapability } from './base-capability';

export class SnapshotProjectionCapability<TReadModel> extends BaseIntervalCapability<TReadModel> {
  private version = 0;

  constructor(
    private readonly snapshotStore: IProjectionSnapshotStore,
    interval = 1000
  ) {
    super('snapshot', interval);
  }

  protected async handleInterval(state: TReadModel, event: IExtendedDomainEvent): Promise<void> {
    this.ensureAttached();

    this.version++;
    const position: number = typeof event.metadata?.position === 'number' ? event.metadata.position : 0;

    await this.snapshotStore.save(this.context!.getProjectionName(), {
      state,
      position,
      timestamp: new Date(),
      version: this.version,
      metadata: {
        eventCount: this.eventCounter,
      },
    });
  }

  async loadLatestSnapshot(): Promise<{
    state: TReadModel;
    position: number;
  } | null> {
    this.ensureAttached();

    const snapshot = await this.snapshotStore.loadLatest<TReadModel>(
      this.context!.getProjectionName()
    );

    if (snapshot) {
      this.version = snapshot.version || 0;
      return {
        state: snapshot.state,
        position: snapshot.position,
      };
    }

    return null;
  }
}
