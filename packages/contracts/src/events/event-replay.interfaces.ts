import type { IStoredEvent } from './event-store-advanced.interfaces';

/**
 * @llm-summary Contract for replay filter functionality
 * @llm-domain Core
 * @llm-contract Required
 *
 * @description
 * ReplayFilter interface implementing core domain functionality for replay filter operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteReplayFilter implements IReplayFilter {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
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
 * @llm-summary Contract for replay config functionality
 * @llm-domain Core
 * @llm-contract Required
 *
 * @description
 * ReplayConfig interface implementing core domain functionality for replay config operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteReplayConfig implements IReplayConfig {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
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
 * @llm-summary Contract for replay progress functionality
 * @llm-domain Core
 * @llm-contract Required
 *
 * @description
 * ReplayProgress interface implementing core domain functionality for replay progress operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteReplayProgress implements IReplayProgress {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
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
 * @llm-summary Contract for replay result functionality
 * @llm-domain Core
 * @llm-contract Required
 *
 * @description
 * ReplayResult interface implementing core domain functionality for replay result operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteReplayResult implements IReplayResult {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
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
 * @llm-summary Type definition for replay event handler
 * @llm-domain Core
 * @llm-usage Frequent
 *
 * @description
 * ReplayEventHandler type implementing core domain functionality for replay event handler operations.
 *
 * @example
 * ```typescript
 * // Usage example
 * const value: ReplayEventHandler = {} as ReplayEventHandler;
 * ```
 *
 * @since 1.0.0
 * @public
 */
export type ReplayEventHandler = (event: IStoredEvent) => Promise<void>;

/**
 * @llm-summary Type definition for replay progress handler
 * @llm-domain Core
 * @llm-usage Frequent
 *
 * @description
 * ReplayProgressHandler type implementing core domain functionality for replay progress handler operations.
 *
 * @example
 * ```typescript
 * // Usage example
 * const value: ReplayProgressHandler = {} as ReplayProgressHandler;
 * ```
 *
 * @since 1.0.0
 * @public
 */
export type ReplayProgressHandler = (progress: IReplayProgress) => void;

/**
 * @llm-summary Type definition for replay error handler
 * @llm-domain Core
 * @llm-usage Frequent
 *
 * @description
 * ReplayErrorHandler type implementing core domain functionality for replay error handler operations.
 *
 * @example
 * ```typescript
 * // Usage example
 * const value: ReplayErrorHandler = {} as ReplayErrorHandler;
 * ```
 *
 * @since 1.0.0
 * @public
 */
export type ReplayErrorHandler = (error: Error, event: IStoredEvent) => Promise<boolean>; // return true to continue

/**
 * @llm-summary Contract for event replay functionality
 * @llm-domain Core
 * @llm-contract Required
 *
 * @description
 * EventReplay interface implementing core domain functionality for event replay operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteEventReplay implements IEventReplay {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
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
 * @llm-summary Contract for advanced event replay functionality
 * @llm-domain Core
 * @llm-contract Required
 *
 * @description
 * AdvancedEventReplay interface implementing core domain functionality for advanced event replay operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteAdvancedEventReplay implements IAdvancedEventReplay {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
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
 * @llm-summary Contract for replay session functionality
 * @llm-domain Core
 * @llm-contract Required
 *
 * @description
 * ReplaySession interface implementing core domain functionality for replay session operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteReplaySession implements IReplaySession {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
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
 * @llm-summary Contract for event replay factory functionality
 * @llm-domain Core
 * @llm-contract Required
 *
 * @description
 * EventReplayFactory interface implementing core domain functionality for event replay factory operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteEventReplayFactory implements IEventReplayFactory {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
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
