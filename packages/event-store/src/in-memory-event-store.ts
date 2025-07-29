import type {
  IEventStoreConfig,
  IAppendResult,
  IEventStream,
  IGlobalEventStream,
  IStoredEvent,
  IReadStreamOptions,
  IReadAllOptions,
  IStreamMetadata,
  IStoredDomainEvent,
  IAggregateSnapshot,
  IEventStoreAdapter,
} from '@vytches/ddd-contracts';

import { StreamNotFoundError, StreamDeletedError } from './errors';
import { BaseEventStore } from './base-event-store';

interface InMemoryStream {
  events: IStoredEvent[];
  metadata: IStreamMetadata;
  snapshot?: IAggregateSnapshot;
}

/**
 * @llm-summary InMemoryEventStore class for in memory event store operations
 * @llm-domain Infrastructure
 * @llm-complexity Medium
 *
 * @description
 * InMemoryEventStore class implementing infrastructure service for in memory event store operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new InMemoryEventStore();
 * ```
 * *
 * @since 1.0.0
 * @public
 */
export class InMemoryEventStore extends BaseEventStore implements IEventStoreAdapter {
  private streams: Map<string, InMemoryStream> = new Map();
  private globalEvents: IStoredEvent[] = [];
  private globalPosition = 0n;
  private connected = true;

  constructor(config: IEventStoreConfig = {}) {
    super(config);
    this.logger.info('InMemoryEventStore initialized');
  }

  /**
   * Append events to a stream
   */
  async appendToStream(
    streamId: string,
    events: IStoredDomainEvent[],
    expectedVersion?: number
  ): Promise<IAppendResult> {
    if (!this.connected) {
      throw new Error('Event store is not connected');
    }

    // Validate expected version
    const currentVersion = await this.validateExpectedVersion(streamId, expectedVersion);

    // Get or create stream
    let stream = this.streams.get(streamId);
    if (!stream) {
      stream = this.createStream(streamId);
      this.streams.set(streamId, stream);
    }

    // Check if stream is deleted
    if (stream.metadata.deleted) {
      throw new StreamDeletedError(streamId);
    }

    // Append events
    const fromVersion = currentVersion + 1;
    const storedEvents: IStoredEvent[] = [];

    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      if (!event) continue;

      const streamVersion = fromVersion + i;
      const position = this.globalPosition++;

      const storedEvent = this.createStoredEvent(event, streamId, streamVersion, position);

      stream.events.push(storedEvent);
      this.globalEvents.push(storedEvent);
      storedEvents.push(storedEvent);
    }

    // Update metadata
    stream.metadata.version = fromVersion + events.length - 1;
    stream.metadata.eventCount = stream.events.length;
    stream.metadata.updated = new Date();
    stream.metadata.lastEventPosition = this.globalPosition - 1n;

    const result: IAppendResult = {
      streamId,
      fromVersion,
      toVersion: stream.metadata.version,
      events: events.length,
      position: this.globalPosition - 1n,
    };

    this.logAppend(streamId, events.length, fromVersion, stream.metadata.version);

    // Auto-snapshot if enabled
    if (this.shouldSnapshot(stream)) {
      await this.createAutoSnapshot(streamId, stream);
    }

    return result;
  }

  /**
   * Read events from a stream
   */
  async readStream<T = unknown>(
    streamId: string,
    options: IReadStreamOptions = {}
  ): Promise<IEventStream<T>> {
    if (!this.connected) {
      throw new Error('Event store is not connected');
    }

    const stream = this.streams.get(streamId);
    if (!stream || stream.metadata.deleted) {
      throw new StreamNotFoundError(streamId);
    }

    const { fromVersion = 0, maxCount = 1000, direction = 'forward' } = options;

    let events = stream.events.filter(e => e.streamVersion >= fromVersion);

    if (direction === 'backward') {
      events = events.reverse();
    }

    if (maxCount > 0 && events.length > maxCount) {
      events = events.slice(0, maxCount);
    }

    const result: IEventStream<T> = {
      streamId,
      events: events as IStoredEvent<T>[],
      fromVersion,
      lastVersion: events.length > 0 ? (events[events.length - 1]?.streamVersion ?? -1) : -1,
      isEndOfStream: events.length < maxCount,
      nextVersion:
        events.length > 0 ? (events[events.length - 1]?.streamVersion ?? -1) + 1 : fromVersion,
    };

    this.logRead(streamId, events.length, options);
    return result;
  }

  /**
   * Read all events globally
   */
  async readAll<T = unknown>(options: IReadAllOptions = {}): Promise<IGlobalEventStream<T>> {
    if (!this.connected) {
      throw new Error('Event store is not connected');
    }

    const {
      fromPosition = 0n,
      maxCount = 1000,
      direction = 'forward',
      filterByEventType,
      filterByStreamPrefix,
    } = options;

    let events = this.globalEvents.filter(e => e.position >= fromPosition);

    // Apply filters
    if (filterByEventType && filterByEventType.length > 0) {
      events = events.filter(e => filterByEventType.includes(e.eventType));
    }

    if (filterByStreamPrefix) {
      events = events.filter(e => e.streamId.startsWith(filterByStreamPrefix));
    }

    if (direction === 'backward') {
      events = events.reverse();
    }

    if (maxCount > 0 && events.length > maxCount) {
      events = events.slice(0, maxCount);
    }

    const result: IGlobalEventStream<T> = {
      events: events as IStoredEvent<T>[],
      fromPosition,
      nextPosition:
        events.length > 0 ? (events[events.length - 1]?.position ?? 0n) + 1n : fromPosition,
      isEndOfStream: events.length < maxCount,
    };

    this.logger.debug('Read all events', {
      eventCount: events.length,
      fromPosition: fromPosition.toString(),
      options,
    });

    return result;
  }

  /**
   * Get stream metadata
   */
  async getStreamMetadata(streamId: string): Promise<IStreamMetadata | null> {
    const stream = this.streams.get(streamId);
    return stream ? { ...stream.metadata } : null;
  }

  /**
   * Set stream metadata
   */
  async setStreamMetadata(streamId: string, metadata: Partial<IStreamMetadata>): Promise<void> {
    let stream = this.streams.get(streamId);
    if (!stream) {
      stream = this.createStream(streamId);
      this.streams.set(streamId, stream);
    }

    stream.metadata = {
      ...stream.metadata,
      ...metadata,
      updated: new Date(),
    };

    this.logger.debug('Stream metadata updated', { streamId, metadata });
  }

  /**
   * Delete a stream
   */
  async deleteStream(streamId: string, expectedVersion?: number): Promise<void> {
    if (this.config.enableOptimisticConcurrency && expectedVersion !== undefined) {
      await this.validateExpectedVersion(streamId, expectedVersion);
    }

    const stream = this.streams.get(streamId);
    if (!stream) {
      throw new StreamNotFoundError(streamId);
    }

    stream.metadata.deleted = true;
    stream.metadata.updated = new Date();

    this.logger.info('Stream deleted', { streamId });
  }

  /**
   * Get snapshot for a stream
   */
  async getSnapshot<T = unknown>(streamId: string): Promise<IAggregateSnapshot<T> | null> {
    const stream = this.streams.get(streamId);
    return stream?.snapshot ? (stream.snapshot as IAggregateSnapshot<T>) : null;
  }

  /**
   * Save snapshot for a stream
   */
  async saveSnapshot<T = unknown>(
    streamId: string,
    snapshot: IAggregateSnapshot<T>
  ): Promise<void> {
    const stream = this.streams.get(streamId);
    if (!stream) {
      throw new StreamNotFoundError(streamId);
    }

    stream.snapshot = snapshot;

    this.logger.debug('Snapshot saved', {
      streamId,
      version: snapshot.version,
      timestamp: snapshot.timestamp,
    });
  }

  // IEventStoreAdapter implementation

  /**
   * Connect to the store (no-op for in-memory)
   */
  async connect(): Promise<void> {
    this.connected = true;
    this.logger.info('InMemoryEventStore connected');
  }

  /**
   * Disconnect from the store
   */
  async disconnect(): Promise<void> {
    this.connected = false;
    this.logger.info('InMemoryEventStore disconnected');
  }

  /**
   * Check connection status
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Clear all data
   */
  async clear(): Promise<void> {
    this.streams.clear();
    this.globalEvents = [];
    this.globalPosition = 0n;
    this.logger.info('InMemoryEventStore cleared');
  }

  // Private helper methods

  /**
   * Create a new stream
   */
  private createStream(streamId: string): InMemoryStream {
    return {
      events: [],
      metadata: {
        streamId,
        created: new Date(),
        updated: new Date(),
        version: -1,
        eventCount: 0,
      },
    };
  }

  /**
   * Check if stream should be auto-snapshotted
   */
  private shouldSnapshot(stream: InMemoryStream): boolean {
    if (!this.config.enableSnapshots) {
      return false;
    }

    const eventsSinceSnapshot = stream.snapshot
      ? stream.events.length -
        stream.events.findIndex(e => e.streamVersion === stream.snapshot?.version)
      : stream.events.length;

    return eventsSinceSnapshot >= this.config.snapshotFrequency;
  }

  /**
   * Create automatic snapshot (to be implemented by aggregates)
   */
  private async createAutoSnapshot(streamId: string, stream: InMemoryStream): Promise<void> {
    // This would typically be handled by the aggregate itself
    // For now, we just log it
    this.logger.debug('Auto-snapshot triggered', {
      streamId,
      eventCount: stream.events.length,
      frequency: this.config.snapshotFrequency,
    });
  }
}
