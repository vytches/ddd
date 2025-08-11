import type { IAuditEvent, IEventStore, IEventUpcaster, IExtendedDomainEvent } from '../events';
import type { IAggregateCapability, IProjectionCapability } from './capability-base';

export interface ISnapshotCapability<TState = unknown, TMeta = unknown>
  extends IAggregateCapability<'snapshot'> {
  /**
   * Creates a snapshot of the current aggregate state
   */
  createSnapshot(
    serializer: () => TState,
    metadataCreator?: () => TMeta
  ): IAggregateSnapshot<TState, TMeta>;

  /**
   * Restores aggregate state from a snapshot
   */
  restoreFromSnapshot(
    snapshot: IAggregateSnapshot<TState, TMeta>,
    deserializer: (state: TState) => void,
    metadataRestorer?: (metadata: TMeta) => void
  ): void;

  /**
   * Saves current state temporarily (for audit purposes)
   */
  saveTemporaryState?(state: TState): void;

  /**
   * Gets the last snapshot timestamp
   */
  getLastSnapshotTimestamp?(): Date | null;
}

export interface IVersioningCapability extends IAggregateCapability<'versioning'> {
  /**
   * Registers an event upcaster
   */
  registerUpcaster<TFrom = unknown, TTo = unknown>(
    eventType: string,
    sourceVersion: number,
    upcaster: IEventUpcaster<TFrom, TTo>
  ): void;

  /**
   * Handles versioned event processing
   */
  handleVersionedEvent(
    event: IExtendedDomainEvent,
    handlers: Map<string, (payload: unknown, metadata?: unknown) => void>
  ): void;

  /**
   * Gets registered event types
   */
  getRegisteredEventTypes(): string[];

  /**
   * Checks if an upcaster exists
   */
  hasUpcaster(eventType: string, version: number): boolean;
}

export interface IEventSourcingCapability extends IAggregateCapability<'eventSourcing'> {
  /**
   * Loads aggregate from event store
   */
  loadFromEventStore(aggregateId: unknown): Promise<void>;

  /**
   * Saves aggregate to event store
   */
  saveToEventStore(): Promise<void>;

  /**
   * Sets the event store instance
   */
  setEventStore(eventStore: IEventStore): void;

  /**
   * Gets the current event store
   */
  getEventStore(): IEventStore | null;
}

export interface IAuditCapability extends IAggregateCapability<'audit'> {
  /**
   * Gets the audit log
   */
  getAuditLog(): IAuditEvent[];

  /**
   * Clears the audit log
   */
  clearAuditLog(): void;

  /**
   * Gets audit statistics
   */
  getAuditStatistics?(): {
    totalEvents: number;
    eventsByType: Record<string, number>;
    averageTimeBetweenEvents: number;
  };
}

export interface ICheckpointCapability<TReadModel = unknown>
  extends IProjectionCapability<'checkpoint', TReadModel> {
  /**
   * Save a checkpoint
   */
  saveCheckpoint(
    projectionId: string,
    eventId: string,
    position: number,
    state: TReadModel
  ): Promise<void>;

  /**
   * Load the last checkpoint
   */
  loadCheckpoint(projectionId: string): Promise<{
    eventId: string;
    position: number;
    state: TReadModel;
  } | null>;

  /**
   * Get checkpoint interval
   */
  getInterval(): number;
}

export interface ICircuitBreakerCapability<TReadModel = unknown>
  extends IProjectionCapability<'circuitBreaker', TReadModel> {
  /**
   * Record a success
   */
  recordSuccess(): void;

  /**
   * Record a failure
   */
  recordFailure(): void;

  /**
   * Check if circuit is open
   */
  isOpen(): boolean;

  /**
   * Get current state
   */
  getState(): 'CLOSED' | 'OPEN' | 'HALF_OPEN';

  /**
   * Reset the circuit breaker
   */
  reset(): void;
}

export interface IDeadLetterCapability<TReadModel = unknown>
  extends IProjectionCapability<'deadLetter', TReadModel> {
  /**
   * Send event to dead letter queue
   */
  sendToDeadLetter(event: IExtendedDomainEvent, error: Error, projectionId: string): Promise<void>;

  /**
   * Get dead letter events
   */
  getDeadLetterEvents(projectionId: string): Promise<
    Array<{
      event: IExtendedDomainEvent;
      error: string;
      timestamp: Date;
    }>
  >;

  /**
   * Retry a dead letter event
   */
  retryDeadLetterEvent(projectionId: string, eventId: string): Promise<boolean>;

  /**
   * Clear dead letter queue
   */
  clearDeadLetterQueue(projectionId: string): Promise<void>;
}

export interface IAggregateSnapshot<TState = unknown, TMeta = unknown> {
  /** Aggregate ID */
  aggregateId: unknown;

  /** Aggregate version */
  version: number;

  /** Aggregate type */
  aggregateType: string;

  /** Aggregate state */
  state: TState;

  /** When the snapshot was created */
  timestamp: Date;

  /** Snapshot metadata (optional) */
  metadata?: TMeta | undefined;

  /** ID of the last event included in the snapshot (optional) */
  lastEventId?: string | undefined;
}
