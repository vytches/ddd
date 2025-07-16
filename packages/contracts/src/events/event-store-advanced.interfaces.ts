import type { IExtendedDomainEvent } from './domain-event-interfaces';
import type { IAggregateSnapshot } from '../capabilities';

/**
 * @llm-summary Contract for stored domain event functionality
 * @llm-domain Core
 * @llm-contract Required
 *
 * @description
 * StoredDomainEvent interface implementing core domain functionality for stored domain event operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteStoredDomainEvent implements IStoredDomainEvent {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
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
 * @llm-summary Contract for append result functionality
 * @llm-domain Core
 * @llm-contract Required
 *
 * @description
 * AppendResult interface implementing core domain functionality for append result operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteAppendResult implements IAppendResult {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface IAppendResult {
  streamId: string;
  fromVersion: number;
  toVersion: number;
  events: number;
  position: bigint;
}

/**
 * @llm-summary Contract for stored event functionality
 * @llm-domain Core
 * @llm-contract Required
 *
 * @description
 * StoredEvent interface implementing core domain functionality for stored event operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteStoredEvent implements IStoredEvent {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface IStoredEvent<T = unknown> extends IStoredDomainEvent<T> {
  position: bigint;
  streamId: string;
  streamVersion: number;
  globalVersion: bigint;
  checksum?: string;
}

/**
 * @llm-summary Contract for read stream options functionality
 * @llm-domain Core
 * @llm-contract Required
 *
 * @description
 * ReadStreamOptions interface implementing core domain functionality for read stream options operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteReadStreamOptions implements IReadStreamOptions {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface IReadStreamOptions {
  fromVersion?: number;
  maxCount?: number;
  direction?: 'forward' | 'backward';
  resolveLinkTos?: boolean;
}

/**
 * @llm-summary Contract for read all options functionality
 * @llm-domain Core
 * @llm-contract Required
 *
 * @description
 * ReadAllOptions interface implementing core domain functionality for read all options operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteReadAllOptions implements IReadAllOptions {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface IReadAllOptions {
  fromPosition?: bigint;
  maxCount?: number;
  direction?: 'forward' | 'backward';
  filterByEventType?: string[];
  filterByStreamPrefix?: string;
}

/**
 * @llm-summary Contract for event stream functionality
 * @llm-domain Core
 * @llm-contract Required
 *
 * @description
 * EventStream interface implementing core domain functionality for event stream operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteEventStream implements IEventStream {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
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
 * @llm-summary Contract for global event stream functionality
 * @llm-domain Core
 * @llm-contract Required
 *
 * @description
 * GlobalEventStream interface implementing core domain functionality for global event stream operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteGlobalEventStream implements IGlobalEventStream {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface IGlobalEventStream<T = unknown> {
  events: IStoredEvent<T>[];
  fromPosition: bigint;
  nextPosition: bigint;
  isEndOfStream: boolean;
}

/**
 * @llm-summary Contract for stream metadata functionality
 * @llm-domain Core
 * @llm-contract Required
 *
 * @description
 * StreamMetadata interface implementing core domain functionality for stream metadata operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteStreamMetadata implements IStreamMetadata {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
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
 * @llm-summary Contract for event serializer functionality
 * @llm-domain Core
 * @llm-contract Required
 *
 * @description
 * EventSerializer interface implementing core domain functionality for event serializer operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteEventSerializer implements IEventSerializer {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface IEventSerializer {
  serialize(event: IStoredDomainEvent): string;
  deserialize<T = unknown>(data: string): IStoredDomainEvent<T>;
  getContentType(): string;
}

/**
 * @llm-summary Contract for advanced event store functionality
 * @llm-domain Core
 * @llm-contract Required
 *
 * @description
 * AdvancedEventStore interface implementing core domain functionality for advanced event store operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteAdvancedEventStore implements IAdvancedEventStore {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
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
 * @llm-summary Contract for event store config functionality
 * @llm-domain Core
 * @llm-contract Required
 *
 * @description
 * EventStoreConfig interface implementing core domain functionality for event store config operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteEventStoreConfig implements IEventStoreConfig {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
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
 * @llm-summary Contract for event store adapter functionality
 * @llm-domain Core
 * @llm-contract Required
 *
 * @description
 * EventStoreAdapter interface implementing core domain functionality for event store adapter operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteEventStoreAdapter implements IEventStoreAdapter {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface IEventStoreAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  clear?(): Promise<void>;
}
