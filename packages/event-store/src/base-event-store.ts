import type {
  IAdvancedEventStore,
  IEventStoreConfig,
  IAppendResult,
  IEventStream,
  IGlobalEventStream,
  IStoredEvent,
  IReadStreamOptions,
  IReadAllOptions,
  IStreamMetadata,
  IEventSerializer,
  IStoredDomainEvent,
  IAggregateSnapshot,
} from '@vytches-ddd/contracts';

import { EventStoreConcurrencyError } from './errors';

import { Logger } from '@vytches-ddd/logging';
import type { ILogger } from '@vytches-ddd/logging';

/**
 * Base abstract class for Event Store implementations
 * Provides common functionality and enforces consistent behavior
 */
export abstract class BaseEventStore implements IAdvancedEventStore {
  protected readonly logger: ILogger;
  protected readonly config: Required<IEventStoreConfig>;

  constructor(config: IEventStoreConfig = {}) {
    this.logger = Logger.forContext('EventStore');
    this.config = this.normalizeConfig(config);
  }

  // Abstract methods that must be implemented by concrete stores
  abstract appendToStream(
    streamId: string,
    events: IStoredDomainEvent[],
    expectedVersion?: number
  ): Promise<IAppendResult>;

  abstract readStream<T = unknown>(
    streamId: string,
    options?: IReadStreamOptions
  ): Promise<IEventStream<T>>;

  abstract readAll<T = unknown>(
    options?: IReadAllOptions
  ): Promise<IGlobalEventStream<T>>;

  abstract getStreamMetadata(streamId: string): Promise<IStreamMetadata | null>;

  abstract setStreamMetadata(
    streamId: string,
    metadata: Partial<IStreamMetadata>
  ): Promise<void>;

  abstract deleteStream(streamId: string, expectedVersion?: number): Promise<void>;

  abstract getSnapshot<T = unknown>(streamId: string): Promise<IAggregateSnapshot<T> | null>;

  abstract saveSnapshot<T = unknown>(
    streamId: string,
    snapshot: IAggregateSnapshot<T>
  ): Promise<void>;

  /**
   * Get the current version of a stream
   */
  async getStreamVersion(streamId: string): Promise<number> {
    const metadata = await this.getStreamMetadata(streamId);
    return metadata?.version ?? -1;
  }

  /**
   * Check if a stream exists
   */
  async streamExists(streamId: string): Promise<boolean> {
    const metadata = await this.getStreamMetadata(streamId);
    return metadata !== null && !metadata.deleted;
  }

  /**
   * Validate expected version against actual version
   */
  protected async validateExpectedVersion(
    streamId: string,
    expectedVersion?: number
  ): Promise<number> {
    if (expectedVersion === undefined) {
      return await this.getStreamVersion(streamId);
    }

    const actualVersion = await this.getStreamVersion(streamId);

    if (expectedVersion !== actualVersion) {
      this.logger.error('Concurrency conflict', undefined, {
        streamId,
        expectedVersion,
        actualVersion,
      });
      throw new EventStoreConcurrencyError(streamId, expectedVersion, actualVersion);
    }

    return actualVersion;
  }

  /**
   * Create a stored event from a domain event
   */
  protected createStoredEvent<T = unknown>(
    event: IStoredDomainEvent<T>,
    streamId: string,
    streamVersion: number,
    position: bigint
  ): IStoredEvent<T> {
    return {
      ...event,
      streamId,
      streamVersion,
      position,
      globalVersion: position,
    };
  }

  /**
   * Normalize configuration with defaults
   */
  private normalizeConfig(config: IEventStoreConfig): Required<IEventStoreConfig> {
    return {
      serializer: config.serializer ?? this.createDefaultSerializer(),
      enableSnapshots: config.enableSnapshots ?? true,
      snapshotFrequency: config.snapshotFrequency ?? 100,
      enableOptimisticConcurrency: config.enableOptimisticConcurrency ?? true,
      enableChecksums: config.enableChecksums ?? false,
      maxEventsPerStream: config.maxEventsPerStream ?? 10000,
      eventRetentionDays: config.eventRetentionDays ?? 365,
    };
  }

  /**
   * Create default JSON serializer
   */
  private createDefaultSerializer(): IEventSerializer {
    return {
      serialize: (event: IStoredDomainEvent) => JSON.stringify(event),
      deserialize: <T = unknown>(data: string): IStoredDomainEvent<T> => JSON.parse(data),
      getContentType: () => 'application/json',
    };
  }

  /**
   * Log append operation
   */
  protected logAppend(
    streamId: string,
    eventCount: number,
    fromVersion: number,
    toVersion: number
  ): void {
    this.logger.debug('Events appended to stream', {
      streamId,
      eventCount,
      fromVersion,
      toVersion,
    });
  }

  /**
   * Log read operation
   */
  protected logRead(
    streamId: string,
    eventCount: number,
    options?: IReadStreamOptions
  ): void {
    this.logger.debug('Events read from stream', {
      streamId,
      eventCount,
      options,
    });
  }
}
