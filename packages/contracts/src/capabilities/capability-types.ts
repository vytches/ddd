import type { IExtendedDomainEvent, IEventUpcaster, IAuditEvent, IEventStore } from '../events';
import type { IAggregateCapability, IProjectionCapability } from './capability-base';

/**
 * @llm-summary Contract for snapshot capability functionality
 * @llm-domain Core
 * @llm-contract Required
 *
 * @description
 * SnapshotCapability interface implementing core domain functionality for snapshot capability operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteSnapshotCapability implements ISnapshotCapability {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
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

/**
 * @llm-summary Contract for versioning capability functionality
 * @llm-domain Core
 * @llm-contract Required
 *
 * @description
 * VersioningCapability interface implementing core domain functionality for versioning capability operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteVersioningCapability implements IVersioningCapability {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
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

/**
 * @llm-summary Contract for event sourcing capability functionality
 * @llm-domain Core
 * @llm-contract Required
 *
 * @description
 * EventSourcingCapability interface implementing core domain functionality for event sourcing capability operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteEventSourcingCapability implements IEventSourcingCapability {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
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

/**
 * @llm-summary Contract for audit capability functionality
 * @llm-domain Core
 * @llm-contract Required
 *
 * @description
 * AuditCapability interface implementing core domain functionality for audit capability operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteAuditCapability implements IAuditCapability {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
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

/**
 * @llm-summary Contract for checkpoint capability functionality
 * @llm-domain Core
 * @llm-contract Required
 *
 * @description
 * CheckpointCapability interface implementing core domain functionality for checkpoint capability operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteCheckpointCapability implements ICheckpointCapability {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
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

/**
 * @llm-summary Contract for circuit breaker capability functionality
 * @llm-domain Core
 * @llm-contract Required
 *
 * @description
 * CircuitBreakerCapability interface implementing core domain functionality for circuit breaker capability operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteCircuitBreakerCapability implements ICircuitBreakerCapability {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
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

/**
 * @llm-summary Contract for dead letter capability functionality
 * @llm-domain Core
 * @llm-contract Required
 *
 * @description
 * DeadLetterCapability interface implementing core domain functionality for dead letter capability operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteDeadLetterCapability implements IDeadLetterCapability {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
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

/**
 * @llm-summary Contract for aggregate snapshot functionality
 * @llm-domain Core
 * @llm-contract Required
 *
 * @description
 * AggregateSnapshot interface implementing core domain functionality for aggregate snapshot operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteAggregateSnapshot implements IAggregateSnapshot {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
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
