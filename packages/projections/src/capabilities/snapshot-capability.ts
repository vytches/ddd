import type { IExtendedDomainEvent } from '@vytches-ddd/contracts';

import type { IProjectionSnapshotStore } from '../projection-interfaces';

import { BaseIntervalCapability } from './base-capability';

/**
 * @llm-summary SnapshotProjectionCapability class for snapshot projection capability operations
 * @llm-domain Architecture
 * @llm-complexity Expert
 *
 * @description
 * SnapshotProjectionCapability class implementing architectural component for snapshot projection capability operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new SnapshotProjectionCapability();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new SnapshotProjectionCapability());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class SnapshotProjectionCapability<TReadModel> extends BaseIntervalCapability<
  'snapshot',
  TReadModel
> {
  override readonly type = 'snapshot' as const;

  static override get capabilityType(): string {
    return 'snapshot';
  }
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
    const position: number =
      typeof event.metadata?.position === 'number' ? event.metadata.position : 0;

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
