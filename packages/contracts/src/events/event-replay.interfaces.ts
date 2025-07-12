import type { IStoredEvent } from './event-store-advanced.interfaces';

/**
 * Event replay filter criteria
 */
export interface IReplayFilter {
  /** Start from specific timestamp */
  fromTimestamp?: Date;

  /** End at specific timestamp */
  toTimestamp?: Date;

  /** Start from specific stream version */
  fromStreamVersion?: number;

  /** End at specific stream version */
  toStreamVersion?: number;

  /** Start from specific global position */
  fromPosition?: bigint;

  /** End at specific global position */
  toPosition?: bigint;

  /** Filter by event types */
  eventTypes?: string[];

  /** Filter by aggregate types */
  aggregateTypes?: string[];

  /** Filter by aggregate IDs */
  aggregateIds?: unknown[];

  /** Filter by stream prefix */
  streamPrefix?: string;

  /** Maximum number of events to replay */
  maxEvents?: number;

  /** Replay direction */
  direction?: 'forward' | 'backward';
}

/**
 * Event replay configuration
 */
export interface IReplayConfig {
  /** Batch size for processing events */
  batchSize?: number;

  /** Delay between batches (ms) */
  batchDelay?: number;

  /** Enable parallel processing */
  parallel?: boolean;

  /** Maximum parallel workers */
  maxWorkers?: number;

  /** Skip events that fail processing */
  skipErrors?: boolean;

  /** Timeout per event processing (ms) */
  eventTimeout?: number;

  /** Enable progress reporting */
  reportProgress?: boolean;

  /** Progress reporting interval */
  progressInterval?: number;
}

/**
 * Event replay progress information
 */
export interface IReplayProgress {
  /** Total events to replay */
  totalEvents: number;

  /** Events processed so far */
  processedEvents: number;

  /** Events that failed processing */
  failedEvents: number;

  /** Events skipped */
  skippedEvents: number;

  /** Current position in replay */
  currentPosition: bigint;

  /** Percentage complete */
  percentComplete: number;

  /** Estimated time remaining (ms) */
  estimatedTimeRemaining?: number;

  /** Events per second */
  eventsPerSecond: number;

  /** Start time */
  startTime: Date;

  /** Last update time */
  lastUpdate: Date;
}

/**
 * Event replay result
 */
export interface IReplayResult {
  /** Number of events replayed */
  eventsReplayed: number;

  /** Number of events that failed */
  eventsFailed: number;

  /** Number of events skipped */
  eventsSkipped: number;

  /** Total time taken (ms) */
  duration: number;

  /** Average events per second */
  averageSpeed: number;

  /** Errors encountered during replay */
  errors: Error[];

  /** Final progress state */
  finalProgress: IReplayProgress;

  /** Success indicator */
  success: boolean;
}

/**
 * Event replay handler function
 */
export type ReplayEventHandler = (event: IStoredEvent) => Promise<void>;

/**
 * Event replay progress handler function
 */
export type ReplayProgressHandler = (progress: IReplayProgress) => void;

/**
 * Event replay error handler function
 */
export type ReplayErrorHandler = (error: Error, event: IStoredEvent) => Promise<boolean>; // return true to continue

/**
 * Event replay capabilities interface
 */
export interface IEventReplay {
  /**
   * Replay events from a specific stream
   */
  replayFromStream(
    streamId: string,
    handler: ReplayEventHandler,
    filter?: IReplayFilter,
    config?: IReplayConfig
  ): Promise<IReplayResult>;

  /**
   * Replay events from all streams
   */
  replayAll(
    handler: ReplayEventHandler,
    filter?: IReplayFilter,
    config?: IReplayConfig
  ): Promise<IReplayResult>;

  /**
   * Replay events by criteria with custom filtering
   */
  replayWithFilter(
    handler: ReplayEventHandler,
    filter: IReplayFilter,
    config?: IReplayConfig
  ): Promise<IReplayResult>;

  /**
   * Get events as async iterable for custom replay logic
   */
  getEventsAsIterable(filter?: IReplayFilter): AsyncIterable<IStoredEvent>;

  /**
   * Count events that would be replayed with given filter
   */
  countEvents(filter?: IReplayFilter): Promise<number>;

  /**
   * Estimate replay duration based on filter and config
   */
  estimateReplayDuration(filter?: IReplayFilter, config?: IReplayConfig): Promise<number>;
}

/**
 * Advanced event replay interface with monitoring and control
 */
export interface IAdvancedEventReplay extends IEventReplay {
  /**
   * Start a replay session that can be controlled
   */
  startReplaySession(
    handler: ReplayEventHandler,
    filter?: IReplayFilter,
    config?: IReplayConfig
  ): Promise<IReplaySession>;
}

/**
 * Controllable replay session
 */
export interface IReplaySession {
  /** Session ID */
  readonly sessionId: string;

  /** Current progress */
  readonly progress: IReplayProgress;

  /** Session status */
  readonly status: 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

  /** Pause the replay */
  pause(): Promise<void>;

  /** Resume the replay */
  resume(): Promise<void>;

  /** Cancel the replay */
  cancel(): Promise<void>;

  /** Wait for completion */
  waitForCompletion(): Promise<IReplayResult>;

  /** Subscribe to progress updates */
  onProgress(handler: ReplayProgressHandler): () => void;

  /** Subscribe to errors */
  onError(handler: ReplayErrorHandler): () => void;
}

/**
 * Event replay factory for creating different replay strategies
 */
export interface IEventReplayFactory {
  /**
   * Create a basic event replay
   */
  createBasicReplay(): IEventReplay;

  /**
   * Create an advanced event replay with session control
   */
  createAdvancedReplay(): IAdvancedEventReplay;

  /**
   * Create a replay with custom strategy
   */
  createCustomReplay<T extends IEventReplay>(strategy: new () => T): T;
}
