import type { IExtendedDomainEvent } from '@vytches-ddd/contracts';

import type { IProjectionCheckpointStore } from '../projection-interfaces';

import { BaseIntervalCapability } from './base-capability';

/**
 * @llm-summary CheckpointCapability class for checkpoint capability operations
 * @llm-domain Architecture
 * @llm-complexity Medium
 *
 * @description
 * CheckpointCapability class implementing architectural component for checkpoint capability operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new CheckpointCapability();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new CheckpointCapability());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class CheckpointCapability<TReadModel> extends BaseIntervalCapability<
  'checkpoint',
  TReadModel
> {
  override readonly type = 'checkpoint' as const;

  static override get capabilityType(): string {
    return 'checkpoint';
  }

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
