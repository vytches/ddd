import type { IAggregateSnapshot } from '../capabilities';
import type { IExtendedDomainEvent } from './domain-event-interfaces';

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

export interface IAppendResult {
  streamId: string;
  fromVersion: number;
  toVersion: number;
  events: number;
  position: bigint;
}

export interface IStoredEvent<T = unknown> extends IStoredDomainEvent<T> {
  position: bigint;
  streamId: string;
  streamVersion: number;
  globalVersion: bigint;
  checksum?: string;
}

export interface IReadStreamOptions {
  fromVersion?: number;
  maxCount?: number;
  direction?: 'forward' | 'backward';
  resolveLinkTos?: boolean;
}

export interface IReadAllOptions {
  fromPosition?: bigint;
  maxCount?: number;
  direction?: 'forward' | 'backward';
  filterByEventType?: string[];
  filterByStreamPrefix?: string;
}

export interface IEventStream<T = unknown> {
  streamId: string;
  events: IStoredEvent<T>[];
  fromVersion: number;
  lastVersion: number;
  isEndOfStream: boolean;
  nextVersion: number;
}

export interface IGlobalEventStream<T = unknown> {
  events: IStoredEvent<T>[];
  fromPosition: bigint;
  nextPosition: bigint;
  isEndOfStream: boolean;
}

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

export interface IEventSerializer {
  serialize(event: IStoredDomainEvent): string;
  deserialize<T = unknown>(data: string): IStoredDomainEvent<T>;
  getContentType(): string;
}

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

export interface IEventStoreConfig {
  serializer?: IEventSerializer;
  enableSnapshots?: boolean;
  snapshotFrequency?: number;
  enableOptimisticConcurrency?: boolean;
  enableChecksums?: boolean;
  maxEventsPerStream?: number;
  eventRetentionDays?: number;
}

export interface IEventStoreAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  clear?(): Promise<void>;
}
