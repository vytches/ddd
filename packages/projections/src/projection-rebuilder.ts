import type {
  IEventStore,
  IDomainEvent,
  IReplayConfig,
  IReplayFilter,
  IReplayResult,
} from '@vytches/ddd-contracts';
import { Logger } from '@vytches/ddd-logging';
import { ProjectionError } from './projection-errors';
import type { IProjectionEngine, IProjectionStore } from './projection-interfaces';

export interface IProjectionRebuildConfig extends IReplayConfig {
  /**
   * Clear projection state before rebuilding
   */
  clearBeforeReplay?: boolean;
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

export class ProjectionRebuilder<TReadModel> implements IProjectionRebuilder<TReadModel> {
  private logger = Logger.forContext(this.constructor.name);

  constructor(
    private readonly eventStore: IEventStore,
    private readonly projectionEngine: IProjectionEngine<TReadModel>,
    private readonly projectionStore: IProjectionStore<TReadModel>
  ) {}

  async rebuild(filter?: IReplayFilter, config?: IProjectionRebuildConfig): Promise<IReplayResult> {
    const context = {
      projectionName: this.projectionEngine.getProjectionName(),
      eventTypes: this.projectionEngine.getEventTypes(),
    };

    this.logger.info('Starting projection rebuild', context);

    try {
      // Clear existing projection state if configured
      if (config?.clearBeforeReplay) {
        await this.clearProjectionState();
      }

      // Get event replay from event store
      const replay =
        (this.eventStore as any).createEventReplay?.() ||
        (this.eventStore as any).getReplayFactory?.()?.createBasicReplay();

      if (!replay) {
        throw new ProjectionError('Event store does not support event replay');
      }

      // Create event handler for projection
      const handler = async (event: IDomainEvent) => {
        try {
          await this.projectionEngine.processEvent(event);
        } catch (error) {
          this.logger.error(
            'Error processing event in projection',
            error instanceof Error ? error : new Error(String(error)),
            {
              ...context,
              eventType: event.eventName,
              eventId: (event as any).eventId || 'unknown',
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
      };

      // Start replay
      const result = await replay.replayAll(handler, projectionFilter, config);

      this.logger.info('Projection rebuild completed', {
        ...context,
        eventsProcessed: result.eventsProcessed,
        eventsFailed: result.eventsFailed,
        duration: result.duration,
      });

      return result;
    } catch (error) {
      this.logger.error(
        'Projection rebuild failed',
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

    this.logger.info('Starting projection rebuild from stream', context);

    try {
      const replay =
        (this.eventStore as any).createEventReplay?.() ||
        (this.eventStore as any).getReplayFactory?.()?.createBasicReplay();

      if (!replay) {
        throw new ProjectionError('Event store does not support event replay');
      }

      const handler = async (event: IDomainEvent) => {
        try {
          await this.projectionEngine.processEvent(event);
        } catch (error) {
          this.logger.error(
            'Error processing event in projection',
            error instanceof Error ? error : new Error(String(error)),
            {
              ...context,
              eventType: event.eventName,
              eventId: (event as any).eventId || 'unknown',
            }
          );

          if (!config?.skipErrors) {
            throw error;
          }
        }
      };

      const result = await replay.replayFromStream(streamId, handler, filter, config);

      this.logger.info('Projection rebuild from stream completed', {
        ...context,
        eventsProcessed: result.eventsProcessed,
        eventsFailed: result.eventsFailed,
        duration: result.duration,
      });

      return result;
    } catch (error) {
      this.logger.error(
        'Projection rebuild from stream failed',
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

    this.logger.info('Starting rebuild of multiple projections', context);

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
        this.logger.error(
          'Failed to rebuild projection',
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

  async clearProjectionState(): Promise<void> {
    const projectionName = this.projectionEngine.getProjectionName();

    this.logger.info('Clearing projection state', { projectionName });

    try {
      // Clear all read models for this projection
      await this.projectionStore.deleteAll();

      // Reset checkpoint if projection has checkpoint capability
      // Note: This would require access to the capability through the projection engine
      // For now, we'll just clear the store state

      this.logger.info('Projection state cleared', { projectionName });
    } catch (error) {
      this.logger.error(
        'Failed to clear projection state',
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
