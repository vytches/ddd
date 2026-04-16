import type { IAggregateSnapshot } from '../shared';
import type { IDomainEvent } from './domain-event-interfaces';

/**
 * A domain event that has been persisted to the event store, enriched with storage metadata.
 * @public
 * @stable
 * @since 0.22.0
 */
export interface IStoredDomainEvent<P = unknown> extends IDomainEvent<P> {
  /** Unique identifier for the event */
  eventId: string;

  /** ID of the aggregate that generated the event */
  aggregateId: unknown;

  /** Type of the aggregate that generated the event */
  aggregateType: string;

  /** Version of the aggregate after applying the event */
  aggregateVersion: number;

  /** When the event occurred */
  timestamp: Date;
}

/**
 * Result returned after successfully appending events to a stream.
 * @public
 * @stable
 * @since 0.22.0
 */
export interface IAppendResult {
  streamId: string;
  fromVersion: number;
  toVersion: number;
  events: number;
  position: bigint;
}

/**
 * A stored domain event with stream position and global ordering information.
 * @public
 * @stable
 * @since 0.22.0
 */
export interface IStoredEvent<T = unknown> extends IStoredDomainEvent<T> {
  position: bigint;
  streamId: string;
  streamVersion: number;
  globalVersion: bigint;
  checksum?: string;
}

/**
 * Options for reading events from a specific stream.
 * @public
 * @stable
 * @since 0.22.0
 */
export interface IReadStreamOptions {
  fromVersion?: number;
  maxCount?: number;
  direction?: 'forward' | 'backward';
  resolveLinkTos?: boolean;
}

/**
 * Options for reading events from the global event log.
 * @public
 * @stable
 * @since 0.22.0
 */
export interface IReadAllOptions {
  fromPosition?: bigint;
  maxCount?: number;
  direction?: 'forward' | 'backward';
  filterByEventType?: string[];
  filterByStreamPrefix?: string;
}

/**
 * A page of events read from a specific stream.
 * @public
 * @stable
 * @since 0.22.0
 */
export interface IEventStream<T = unknown> {
  streamId: string;
  events: IStoredEvent<T>[];
  fromVersion: number;
  lastVersion: number;
  isEndOfStream: boolean;
  nextVersion: number;
}

/**
 * A page of events read from the global event log across all streams.
 * @public
 * @stable
 * @since 0.22.0
 */
export interface IGlobalEventStream<T = unknown> {
  events: IStoredEvent<T>[];
  fromPosition: bigint;
  nextPosition: bigint;
  isEndOfStream: boolean;
}

/**
 * Metadata describing a stream's properties and state.
 * @public
 * @stable
 * @since 0.22.0
 */
export interface IStreamMetadata {
  streamId: string;
  created: Date;
  updated: Date;
  version: number;
  eventCount: number;
  firstEventPosition?: bigint;
  lastEventPosition?: bigint;
  deleted?: boolean;
  customMetadata?: Record<string, unknown>;
}

/**
 * Handles serialization and deserialization of stored domain events.
 * @public
 * @stable
 * @since 0.22.0
 */
export interface IEventSerializer {
  serialize(event: IStoredDomainEvent): string;
  deserialize<T = unknown>(data: string): IStoredDomainEvent<T>;
  getContentType(): string;
}

/**
 * Full-featured event store with stream management, snapshots, and optional subscriptions.
 * @public
 * @experimental
 * @since 0.22.0
 */
export interface IAdvancedEventStore {
  // Stream operations
  appendToStream(
    streamId: string,
    events: IStoredDomainEvent[],
    expectedVersion?: number
  ): Promise<IAppendResult>;

  readStream<T = unknown>(streamId: string, options?: IReadStreamOptions): Promise<IEventStream<T>>;

  // Global event log
  readAll<T = unknown>(options?: IReadAllOptions): Promise<IGlobalEventStream<T>>;

  // Snapshots
  getSnapshot<T = unknown>(streamId: string): Promise<IAggregateSnapshot<T> | null>;
  saveSnapshot<T = unknown>(streamId: string, snapshot: IAggregateSnapshot<T>): Promise<void>;

  // Stream management
  deleteStream(streamId: string, expectedVersion?: number): Promise<void>;
  getStreamMetadata(streamId: string): Promise<IStreamMetadata | null>;
  setStreamMetadata(streamId: string, metadata: Partial<IStreamMetadata>): Promise<void>;

  // Subscriptions (for future event store subscriptions)
  subscribeToStream?(
    streamId: string,
    handler: (event: IStoredEvent) => Promise<void>,
    options?: IReadStreamOptions
  ): () => void;

  subscribeToAll?(
    handler: (event: IStoredEvent) => Promise<void>,
    options?: IReadAllOptions
  ): () => void;

  // Utilities
  getStreamVersion(streamId: string): Promise<number>;
  streamExists(streamId: string): Promise<boolean>;
}

/**
 * Configuration options for advanced event store implementations.
 * @public
 * @stable
 * @since 0.22.0
 */
export interface IEventStoreConfig {
  serializer?: IEventSerializer;
  enableSnapshots?: boolean;
  snapshotFrequency?: number;
  enableOptimisticConcurrency?: boolean;
  enableChecksums?: boolean;
  maxEventsPerStream?: number;
  eventRetentionDays?: number;
}

/**
 * Lifecycle adapter for managing event store connection state.
 * @public
 * @stable
 * @since 0.22.0
 */
export interface IEventStoreAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  clear?(): Promise<void>;
}
