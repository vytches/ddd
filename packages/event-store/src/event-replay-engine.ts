import type {
  IAdvancedEventReplay,
  IAdvancedEventStore,
  IReplayConfig,
  IReplayFilter,
  IReplayProgress,
  IReplayResult,
  IReplaySession,
  IStoredEvent,
  ReplayErrorHandler,
  ReplayEventHandler,
  ReplayProgressHandler,
} from '@vytches/ddd-contracts';

import type { ILogger } from '@vytches/ddd-logging';
import { Logger } from '@vytches/ddd-logging';

/**
 * Default replay configuration
 */
const DEFAULT_REPLAY_CONFIG: Required<IReplayConfig> = {
  batchSize: 100,
  batchDelay: 0,
  parallel: false,
  maxWorkers: 4,
  skipErrors: false,
  eventTimeout: 30000,
  reportProgress: true,
  progressInterval: 1000,
};

export class EventReplayEngine implements IAdvancedEventReplay {
  private readonly logger: ILogger;
  private readonly activeSessions = new Map<string, ReplaySession>();

  constructor(private readonly eventStore: IAdvancedEventStore) {
    this.logger = Logger.forContext('EventReplayEngine');
  }

  /**
   * Replay events from a specific stream
   */
  async replayFromStream(
    streamId: string,
    handler: ReplayEventHandler,
    filter?: IReplayFilter,
    config?: IReplayConfig
  ): Promise<IReplayResult> {
    this.logger.info('Starting stream replay', { streamId, filter, config });

    const mergedConfig = { ...DEFAULT_REPLAY_CONFIG, ...config };
    const startTime = new Date();

    try {
      // Build stream-specific filter
      const streamFilter: IReplayFilter = {
        ...filter,
        streamPrefix: streamId,
      };

      const result = await this.executeReplay(handler, streamFilter, mergedConfig, startTime);

      this.logger.info('Stream replay completed', {
        streamId,
        eventsReplayed: result.eventsReplayed,
        duration: result.duration,
      });

      return result;
    } catch (error) {
      this.logger.error('Stream replay failed', undefined, { streamId });
      throw error;
    }
  }

  /**
   * Replay events from all streams
   */
  async replayAll(
    handler: ReplayEventHandler,
    filter?: IReplayFilter,
    config?: IReplayConfig
  ): Promise<IReplayResult> {
    this.logger.info('Starting full replay', { filter, config });

    const mergedConfig = { ...DEFAULT_REPLAY_CONFIG, ...config };
    const startTime = new Date();

    try {
      const result = await this.executeReplay(handler, filter, mergedConfig, startTime);

      this.logger.info('Full replay completed', {
        eventsReplayed: result.eventsReplayed,
        duration: result.duration,
      });

      return result;
    } catch (error: Error | any) {
      this.logger.error('Full replay failed', error);
      throw error;
    }
  }

  /**
   * Replay events with custom filter
   */
  async replayWithFilter(
    handler: ReplayEventHandler,
    filter: IReplayFilter,
    config?: IReplayConfig
  ): Promise<IReplayResult> {
    this.logger.info('Starting filtered replay', { filter, config });

    const mergedConfig = { ...DEFAULT_REPLAY_CONFIG, ...config };
    const startTime = new Date();

    try {
      const result = await this.executeReplay(handler, filter, mergedConfig, startTime);

      this.logger.info('Filtered replay completed', {
        eventsReplayed: result.eventsReplayed,
        duration: result.duration,
      });

      return result;
    } catch (error: Error | any) {
      this.logger.error('Filtered replay failed', error);
      throw error;
    }
  }

  /**
   * Get events as async iterable
   */
  async *getEventsAsIterable(filter?: IReplayFilter): AsyncIterable<IStoredEvent> {
    this.logger.debug('Creating events iterable', { filter });

    const readOptions = this.buildReadOptions(filter);
    let position = filter?.fromPosition || BigInt(0);
    let hasMore = true;

    while (hasMore) {
      const stream = await this.eventStore.readAll({
        ...readOptions,
        fromPosition: position,
        maxCount: 1000, // Read in chunks
      });

      if (stream.events.length === 0) {
        hasMore = false;
        break;
      }

      for (const event of stream.events) {
        if (this.matchesFilter(event, filter)) {
          yield event;
        }
        position = event.position + BigInt(1);
      }

      hasMore = !stream.isEndOfStream;
    }
  }

  /**
   * Count events matching filter
   */
  async countEvents(filter?: IReplayFilter): Promise<number> {
    this.logger.debug('Counting events', { filter });

    let count = 0;

    for await (const _ of this.getEventsAsIterable(filter)) {
      count++;
    }

    this.logger.debug('Event count completed', { count, filter });
    return count;
  }

  /**
   * Estimate replay duration
   */
  async estimateReplayDuration(filter?: IReplayFilter, config?: IReplayConfig): Promise<number> {
    const mergedConfig = { ...DEFAULT_REPLAY_CONFIG, ...config };
    const eventCount = await this.countEvents(filter);

    // Estimate based on batch size and delay
    const batches = Math.ceil(eventCount / mergedConfig.batchSize);
    const processingTime = eventCount * 10; // 10ms per event estimate
    const delayTime = batches * mergedConfig.batchDelay;

    const estimated = processingTime + delayTime;

    this.logger.debug('Replay duration estimated', {
      eventCount,
      batches,
      estimated,
      filter,
      config: mergedConfig,
    });

    return estimated;
  }

  /**
   * Start controllable replay session
   */
  async startReplaySession(
    handler: ReplayEventHandler,
    filter?: IReplayFilter,
    config?: IReplayConfig
  ): Promise<IReplaySession> {
    const sessionId = `replay-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const mergedConfig = { ...DEFAULT_REPLAY_CONFIG, ...config };

    this.logger.info('Starting replay session', { sessionId, filter, config: mergedConfig });

    const session = new ReplaySession(
      sessionId,
      this.eventStore,
      handler,
      filter,
      mergedConfig,
      this.logger
    );

    this.activeSessions.set(sessionId, session);

    // Clean up session when completed
    session.waitForCompletion().finally(() => {
      this.activeSessions.delete(sessionId);
    });

    await session.start();
    return session;
  }

  /**
   * Execute replay with given parameters
   */
  private async executeReplay(
    handler: ReplayEventHandler,
    filter: IReplayFilter | undefined,
    config: Required<IReplayConfig>,
    startTime: Date
  ): Promise<IReplayResult> {
    const errors: Error[] = [];
    let eventsReplayed = 0;
    let eventsFailed = 0;
    const eventsSkipped = 0;
    let lastProgressUpdate = Date.now();

    const totalEvents = await this.countEvents(filter);

    const progress: IReplayProgress = {
      totalEvents,
      processedEvents: 0,
      failedEvents: 0,
      skippedEvents: 0,
      currentPosition: filter?.fromPosition || BigInt(0),
      percentComplete: 0,
      eventsPerSecond: 0,
      startTime,
      lastUpdate: new Date(),
    };

    const events: IStoredEvent[] = [];

    // Collect events
    for await (const event of this.getEventsAsIterable(filter)) {
      events.push(event);
    }

    // Process in batches
    for (let i = 0; i < events.length; i += config.batchSize) {
      const batch = events.slice(i, i + config.batchSize);

      for (const event of batch) {
        try {
          if (config.eventTimeout > 0) {
            await this.withTimeout(handler(event), config.eventTimeout);
          } else {
            await handler(event);
          }
          eventsReplayed++;
        } catch (error) {
          eventsFailed++;
          const err = error instanceof Error ? error : new Error(String(error));
          errors.push(err);

          if (!config.skipErrors) {
            throw err;
          }
        }

        progress.processedEvents = eventsReplayed + eventsFailed;
        progress.failedEvents = eventsFailed;
        progress.currentPosition = event.position;
        progress.percentComplete = (progress.processedEvents / totalEvents) * 100;
        progress.lastUpdate = new Date();

        // Calculate events per second
        const elapsed = progress.lastUpdate.getTime() - startTime.getTime();
        progress.eventsPerSecond = elapsed > 0 ? (progress.processedEvents / elapsed) * 1000 : 0;

        // Report progress
        if (config.reportProgress && Date.now() - lastProgressUpdate >= config.progressInterval) {
          this.logger.debug('Replay progress', {
            totalEvents: progress.totalEvents,
            processedEvents: progress.processedEvents,
            percentComplete: progress.percentComplete,
            eventsPerSecond: progress.eventsPerSecond,
          });
          lastProgressUpdate = Date.now();
        }
      }

      // Batch delay
      if (config.batchDelay > 0 && i + config.batchSize < events.length) {
        await this.delay(config.batchDelay);
      }
    }

    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();
    const averageSpeed = duration > 0 ? (eventsReplayed / duration) * 1000 : 0;

    return {
      eventsReplayed,
      eventsFailed,
      eventsSkipped,
      duration,
      averageSpeed,
      errors,
      finalProgress: progress,
      success: eventsFailed === 0,
    };
  }

  /**
   * Build read options from filter
   */
  private buildReadOptions(filter?: IReplayFilter) {
    const options: Record<string, unknown> = {
      direction: filter?.direction || 'forward',
    };

    if (filter?.fromPosition !== undefined) {
      options.fromPosition = filter.fromPosition;
    }

    if (filter?.maxEvents !== undefined) {
      options.maxCount = filter.maxEvents;
    }

    if (filter?.eventTypes !== undefined) {
      options.filterByEventType = filter.eventTypes;
    }

    if (filter?.streamPrefix !== undefined) {
      options.filterByStreamPrefix = filter.streamPrefix;
    }

    return options;
  }

  /**
   * Check if event matches filter criteria
   */
  private matchesFilter(event: IStoredEvent, filter?: IReplayFilter): boolean {
    if (!filter) return true;

    // Timestamp filters
    if (filter.fromTimestamp && event.timestamp < filter.fromTimestamp) return false;
    if (filter.toTimestamp && event.timestamp > filter.toTimestamp) return false;

    // Version filters
    if (filter.fromStreamVersion && event.streamVersion < filter.fromStreamVersion) return false;
    if (filter.toStreamVersion && event.streamVersion > filter.toStreamVersion) return false;

    // Event type filter
    if (filter.eventTypes && !filter.eventTypes.includes(event.eventType)) return false;

    // Aggregate type filter
    if (filter.aggregateTypes && !filter.aggregateTypes.includes(event.aggregateType)) return false;

    // Aggregate ID filter
    if (filter.aggregateIds && !filter.aggregateIds.includes(event.aggregateId)) return false;

    return true;
  }

  /**
   * Add timeout to promise
   */
  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]);
  }

  /**
   * Simple delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Controllable replay session implementation
 */
class ReplaySession implements IReplaySession {
  private _status: 'running' | 'paused' | 'completed' | 'failed' | 'cancelled' = 'paused';
  private _progress: IReplayProgress;
  private progressHandlers: ReplayProgressHandler[] = [];
  private errorHandlers: ReplayErrorHandler[] = [];
  private completionPromise: Promise<IReplayResult> | null = null;
  private completionResolve: ((result: IReplayResult) => void) | null = null;
  private completionReject: ((error: Error) => void) | null = null;
  private isPaused = false;
  private isCancelled = false;

  constructor(
    public readonly sessionId: string,
    private readonly eventStore: IAdvancedEventStore,
    private readonly handler: ReplayEventHandler,
    private readonly filter: IReplayFilter | undefined,
    private readonly config: Required<IReplayConfig>,
    private readonly logger: ILogger
  ) {
    this._progress = {
      totalEvents: 0,
      processedEvents: 0,
      failedEvents: 0,
      skippedEvents: 0,
      currentPosition: filter?.fromPosition || BigInt(0),
      percentComplete: 0,
      eventsPerSecond: 0,
      startTime: new Date(),
      lastUpdate: new Date(),
    };
  }

  get progress(): IReplayProgress {
    return { ...this._progress };
  }

  get status() {
    return this._status;
  }

  async start(): Promise<void> {
    this.logger.info('Starting replay session', { sessionId: this.sessionId });
    this._status = 'running';

    // Initialize completion promise
    this.completionPromise = new Promise<IReplayResult>((resolve, reject) => {
      this.completionResolve = resolve;
      this.completionReject = reject;
    });

    // Start replay in background
    this.executeReplay().catch(error => {
      this._status = 'failed';
      this.completionReject?.(error);
    });
  }

  async pause(): Promise<void> {
    this.logger.info('Pausing replay session', { sessionId: this.sessionId });
    this.isPaused = true;
    this._status = 'paused';
  }

  async resume(): Promise<void> {
    this.logger.info('Resuming replay session', { sessionId: this.sessionId });
    this.isPaused = false;
    this._status = 'running';
  }

  async cancel(): Promise<void> {
    this.logger.info('Cancelling replay session', { sessionId: this.sessionId });
    this.isCancelled = true;
    this._status = 'cancelled';
  }

  async waitForCompletion(): Promise<IReplayResult> {
    if (!this.completionPromise) {
      throw new Error('Session not started');
    }
    return this.completionPromise;
  }

  onProgress(handler: ReplayProgressHandler): () => void {
    this.progressHandlers.push(handler);
    return () => {
      const index = this.progressHandlers.indexOf(handler);
      if (index > -1) {
        this.progressHandlers.splice(index, 1);
      }
    };
  }

  onError(handler: ReplayErrorHandler): () => void {
    this.errorHandlers.push(handler);
    return () => {
      const index = this.errorHandlers.indexOf(handler);
      if (index > -1) {
        this.errorHandlers.splice(index, 1);
      }
    };
  }

  private async executeReplay(): Promise<void> {
    const replayEngine = new EventReplayEngine(this.eventStore);

    try {
      const result = await replayEngine.replayWithFilter(
        async event => {
          // Check for pause/cancellation
          while (this.isPaused && !this.isCancelled) {
            await this.delay(100);
          }

          if (this.isCancelled) {
            throw new Error('Replay cancelled');
          }

          try {
            await this.handler(event);
            this._progress.processedEvents++;
          } catch (error) {
            this._progress.failedEvents++;
            const err = error instanceof Error ? error : new Error(String(error));

            // Call error handlers
            for (const errorHandler of this.errorHandlers) {
              const shouldContinue = await errorHandler(err, event);
              if (!shouldContinue) {
                throw err;
              }
            }
          }

          // Update progress
          this._progress.lastUpdate = new Date();
          this._progress.percentComplete =
            this._progress.totalEvents > 0
              ? (this._progress.processedEvents / this._progress.totalEvents) * 100
              : 0;

          // Notify progress handlers
          for (const progressHandler of this.progressHandlers) {
            progressHandler(this.progress);
          }
        },
        this.filter || {},
        this.config
      );

      this._status = 'completed';
      this.completionResolve?.(result);
    } catch (error) {
      this._status = 'failed';
      this.completionReject?.(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
