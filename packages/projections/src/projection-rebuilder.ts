import type {
  CapabilityConstructor,
  IEventStore,
  IDomainEvent,
  IReplayConfig,
  IReplayFilter,
  IReplayResult,
} from '@vytches/ddd-contracts';
import { ProjectionError } from './projection-errors';
import { internalLogger } from '@vytches/ddd-contracts/internal';
import { CheckpointCapability } from './capabilities';
import type { IProjectionEngine, IProjectionStore } from './projection-interfaces';

export interface IProjectionRebuildConfig extends IReplayConfig {
  /**
   * Clear projection state before rebuilding
   */
  clearBeforeReplay?: boolean;

  /**
   * Resume replay from the last persisted checkpoint instead of replaying
   * from the beginning. Requires a `CheckpointCapability` to be registered
   * on the projection engine.
   *
   * If no checkpoint exists, or the checkpoint position is invalid, resume
   * is refused and a full rebuild runs instead (a warning is logged).
   *
   * @default false
   */
  resumeFromCheckpoint?: boolean;
}

/**
 * Reasons a `resumeFromCheckpoint` request can be refused.
 */
const RESUME_FROM_CHECKPOINT_REJECTED_REASON = {
  NO_CHECKPOINT: 'no checkpoint found',
  INVALID_POSITION: 'checkpoint position must be a positive safe integer',
} as const;

/**
 * Single source of truth for the resume-rejection warning text so it stays
 * grep-able across call sites and tests.
 */
function formatResumeFromCheckpointRejectedMessage(projectionName: string, reason: string): string {
  return `ProjectionRebuilder: resumeFromCheckpoint rejected for "${projectionName}" - ${reason}. Falling back to full rebuild.`;
}

export interface IProjectionRebuilder<TReadModel> {
  /**
   * Rebuild projection from event history
   */
  rebuild(filter?: IReplayFilter, config?: IProjectionRebuildConfig): Promise<IReplayResult>;

  /**
   * Rebuild projection from specific stream
   */
  rebuildFromStream(
    streamId: string,
    filter?: IReplayFilter,
    config?: IProjectionRebuildConfig
  ): Promise<IReplayResult>;

  /**
   * Rebuild multiple projections
   */
  rebuildMany(
    projections: IProjectionEngine<unknown>[],
    filter?: IReplayFilter,
    config?: IProjectionRebuildConfig
  ): Promise<IReplayResult[]>;

  /**
   * Clear projection state before rebuild
   */
  clearProjectionState(): Promise<void>;
}

interface IEventReplay {
  replayAll(
    handler: (event: IDomainEvent) => Promise<void>,
    filter?: IReplayFilter,
    config?: IProjectionRebuildConfig
  ): Promise<IReplayResult>;
  replayFromStream(
    streamId: string,
    handler: (event: IDomainEvent) => Promise<void>,
    filter?: IReplayFilter,
    config?: IProjectionRebuildConfig
  ): Promise<IReplayResult>;
}

export class ProjectionRebuilder<TReadModel> implements IProjectionRebuilder<TReadModel> {
  private cachedReplaySupport: boolean | undefined;

  constructor(
    private readonly eventStore: IEventStore,
    private readonly projectionEngine: IProjectionEngine<TReadModel>,
    private readonly projectionStore: IProjectionStore<TReadModel>
  ) {}

  private getReplay(): IEventReplay {
    if (this.cachedReplaySupport === false) {
      throw new ProjectionError('Event store does not support event replay');
    }

    const store = this.eventStore as unknown as Record<string, unknown>;
    const replay =
      (typeof store['createEventReplay'] === 'function'
        ? (store['createEventReplay'] as () => unknown)()
        : null) ||
      (typeof store['getReplayFactory'] === 'function'
        ? (
            (store['getReplayFactory'] as () => Record<string, unknown>)()?.[
              'createBasicReplay'
            ] as (() => unknown) | undefined
          )?.()
        : null);

    if (!replay) {
      this.cachedReplaySupport = false;
      throw new ProjectionError('Event store does not support event replay');
    }

    this.cachedReplaySupport = true;
    return replay as IEventReplay;
  }

  async rebuild(filter?: IReplayFilter, config?: IProjectionRebuildConfig): Promise<IReplayResult> {
    const context = {
      projectionName: this.projectionEngine.getProjectionName(),
      eventTypes: this.projectionEngine.getEventTypes(),
    };

    try {
      // Clear existing projection state if configured
      if (config?.clearBeforeReplay) {
        await this.clearProjectionState();
      }

      const resumeFromPosition = config?.resumeFromCheckpoint
        ? await this.resolveResumePosition(context.projectionName)
        : undefined;

      const replay = this.getReplay();

      // Create event handler for projection
      const handler = async (event: IDomainEvent) => {
        try {
          await this.projectionEngine.processEvent(event);
        } catch (error) {
          internalLogger.error(
            'ProjectionRebuilder: error processing event in projection',
            error instanceof Error ? error : new Error(String(error)),
            {
              ...context,
              eventType: event.eventName,
              eventId:
                ((event as unknown as Record<string, unknown>).eventId as string) || 'unknown',
            }
          );

          if (!config?.skipErrors) {
            throw error;
          }
        }
      };

      // Apply projection-specific filters
      const projectionFilter: IReplayFilter = {
        ...filter,
        eventTypes: filter?.eventTypes || this.projectionEngine.getEventTypes(),
        ...(resumeFromPosition !== undefined ? { fromPosition: resumeFromPosition } : {}),
      };

      // Start replay
      const result = await replay.replayAll(handler, projectionFilter, config);

      return result;
    } catch (error) {
      internalLogger.error(
        'ProjectionRebuilder: projection rebuild failed',
        error instanceof Error ? error : new Error(String(error)),
        {
          ...context,
        }
      );
      throw new ProjectionError(
        `Failed to rebuild projection ${this.projectionEngine.getProjectionName()}`,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  async rebuildFromStream(
    streamId: string,
    filter?: IReplayFilter,
    config?: IProjectionRebuildConfig
  ): Promise<IReplayResult> {
    const context = {
      projectionName: this.projectionEngine.getProjectionName(),
      streamId,
    };

    try {
      const replay = this.getReplay();

      const handler = async (event: IDomainEvent) => {
        try {
          await this.projectionEngine.processEvent(event);
        } catch (error) {
          internalLogger.error(
            'ProjectionRebuilder: error processing event in projection',
            error instanceof Error ? error : new Error(String(error)),
            {
              ...context,
              eventType: event.eventName,
              eventId:
                ((event as unknown as Record<string, unknown>).eventId as string) || 'unknown',
            }
          );

          if (!config?.skipErrors) {
            throw error;
          }
        }
      };

      const result = await replay.replayFromStream(streamId, handler, filter, config);

      return result;
    } catch (error) {
      internalLogger.error(
        'ProjectionRebuilder: projection rebuild from stream failed',
        error instanceof Error ? error : new Error(String(error)),
        {
          ...context,
        }
      );
      throw new ProjectionError(
        `Failed to rebuild projection ${this.projectionEngine.getProjectionName()} from stream ${streamId}`,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  async rebuildMany(
    projections: IProjectionEngine<unknown>[],
    filter?: IReplayFilter,
    config?: IProjectionRebuildConfig
  ): Promise<IReplayResult[]> {
    const context = {
      projectionCount: projections.length,
      projectionNames: projections.map(p => p.getProjectionName()),
    };

    const results: IReplayResult[] = [];

    for (const projection of projections) {
      try {
        const rebuilder = new ProjectionRebuilder(
          this.eventStore,
          projection,
          this.projectionStore
        );

        const result = await rebuilder.rebuild(filter, config);
        results.push(result);
      } catch (error) {
        internalLogger.error(
          'ProjectionRebuilder: failed to rebuild projection',
          error instanceof Error ? error : new Error(String(error)),
          {
            projectionName: projection.getProjectionName(),
          }
        );

        if (!config?.skipErrors) {
          throw error;
        }

        // Add failed result
        const now = new Date();
        results.push({
          eventsReplayed: 0,
          eventsFailed: 1,
          eventsSkipped: 0,
          duration: 0,
          averageSpeed: 0,
          errors: [error instanceof Error ? error : new Error(String(error))],
          finalProgress: {
            totalEvents: 0,
            processedEvents: 0,
            skippedEvents: 0,
            failedEvents: 1,
            currentPosition: 0n,
            percentComplete: 0,
            eventsPerSecond: 0,
            startTime: now,
            lastUpdate: now,
          },
          success: false,
        });
      }
    }

    return results;
  }

  /**
   * Look up the `CheckpointCapability` registered on this projection's
   * engine, if any. `CheckpointCapability` is generic over `TReadModel`
   * while `CapabilityConstructor` isn't, hence the explicit cast — the
   * registry itself is untyped storage, this just recovers the static type
   * for this rebuilder's `TReadModel`.
   */
  private getCheckpointCapability(): CheckpointCapability<TReadModel> | undefined {
    return this.projectionEngine.getCapability<CheckpointCapability<TReadModel>>(
      CheckpointCapability as CapabilityConstructor<CheckpointCapability<TReadModel>>
    );
  }

  /**
   * Validate and resolve the checkpoint to resume from, if any.
   *
   * Returns the checkpoint position as a replay `fromPosition` and seeds the
   * projection store with the checkpoint's state, so the caller's replay
   * only has to apply events that happened after the checkpoint.
   *
   * Returns `undefined` (and logs a warning) when there is no usable
   * checkpoint to resume from - callers should then run a full rebuild.
   */
  private async resolveResumePosition(projectionName: string): Promise<bigint | undefined> {
    const checkpointCapability = this.getCheckpointCapability();
    const checkpoint = checkpointCapability ? await checkpointCapability.loadCheckpoint() : null;

    if (!checkpoint) {
      internalLogger.warn(
        formatResumeFromCheckpointRejectedMessage(
          projectionName,
          RESUME_FROM_CHECKPOINT_REJECTED_REASON.NO_CHECKPOINT
        ),
        { projectionName }
      );
      return undefined;
    }

    if (checkpoint.position <= 0 || !Number.isSafeInteger(checkpoint.position)) {
      internalLogger.warn(
        formatResumeFromCheckpointRejectedMessage(
          projectionName,
          RESUME_FROM_CHECKPOINT_REJECTED_REASON.INVALID_POSITION
        ),
        { projectionName, checkpointPosition: checkpoint.position }
      );
      return undefined;
    }

    // Safe: guarded by Number.isSafeInteger above.
    const fromPosition = BigInt(checkpoint.position);

    // Seed projection state from the checkpoint so replay only has to apply
    // events that happened after it, instead of rebuilding from scratch.
    await this.projectionStore.save(projectionName, checkpoint.state);

    return fromPosition;
  }

  async clearProjectionState(): Promise<void> {
    const projectionName = this.projectionEngine.getProjectionName();

    try {
      // Clear all read models for this projection
      await this.projectionStore.delete(projectionName);

      // Reset checkpoint if projection has checkpoint capability
      const checkpointCapability = this.getCheckpointCapability();
      if (checkpointCapability) {
        await checkpointCapability.clearCheckpoint();
      }
    } catch (error) {
      internalLogger.error(
        'ProjectionRebuilder: failed to clear projection state',
        error instanceof Error ? error : new Error(String(error)),
        {
          projectionName,
        }
      );
      throw new ProjectionError(
        `Failed to clear state for projection ${projectionName}`,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }
}

export function createProjectionRebuilder<TReadModel>(
  eventStore: IEventStore,
  projectionEngine: IProjectionEngine<TReadModel>,
  projectionStore: IProjectionStore<TReadModel>
): IProjectionRebuilder<TReadModel> {
  return new ProjectionRebuilder(eventStore, projectionEngine, projectionStore);
}
