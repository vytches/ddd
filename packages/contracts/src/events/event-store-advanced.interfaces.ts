import type { IExtendedDomainEvent } from './domain-event-interfaces';
import type { IAggregateSnapshot } from '../capabilities';

/**
 * Extended domain event interface for Event Store
 * Requires additional fields for proper event sourcing
 */
export interface IStoredDomainEvent<P = unknown> extends IExtendedDomainEvent<P> {
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
 * Result of appending events to a stream
 */
export interface IAppendResult {
  streamId: string;
  fromVersion: number;
  toVersion: number;
  events: number;
  position: bigint;
}

/**
 * Event with global position
 */
export interface IStoredEvent<T = unknown> extends IStoredDomainEvent<T> {
  position: bigint;
  streamId: string;
  streamVersion: number;
  globalVersion: bigint;
  checksum?: string;
}

/**
 * Options for reading a stream
 */
export interface IReadStreamOptions {
  fromVersion?: number;
  maxCount?: number;
  direction?: 'forward' | 'backward';
  resolveLinkTos?: boolean;
}

/**
 * Options for reading all events
 */
export interface IReadAllOptions {
  fromPosition?: bigint;
  maxCount?: number;
  direction?: 'forward' | 'backward';
  filterByEventType?: string[];
  filterByStreamPrefix?: string;
}

/**
 * Event stream result
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
 * Global event stream result
 */
export interface IGlobalEventStream<T = unknown> {
  events: IStoredEvent<T>[];
  fromPosition: bigint;
  nextPosition: bigint;
  isEndOfStream: boolean;
}

/**
 * Stream metadata
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
 * Event serializer interface
 */
export interface IEventSerializer {
  serialize(event: IStoredDomainEvent): string;
  deserialize<T = unknown>(data: string): IStoredDomainEvent<T>;
  getContentType(): string;
}

/**
 * Advanced event store interface with enterprise features
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
 * Event store configuration
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

// Event Store errors are now defined in the @vytches-ddd/event-store package
// to follow the established error inheritance pattern

/**
 * Event store adapter interface for different backends
 */
export interface IEventStoreAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  clear?(): Promise<void>;
}
