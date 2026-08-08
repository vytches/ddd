/**
 * Metadata attached to domain events for tracing, correlation, and auditing.
 * @public
 * @stable
 * @since 0.22.0
 */
export interface IEventMetadata {
  /** Unique identifier for the event */
  eventId?: string;

  /** When the event occurred */
  timestamp?: Date;

  /** Correlation ID for related events */
  correlationId?: string;

  /** ID of the event that caused this event */
  causationId?: string;

  /** ID of the aggregate that generated the event */
  aggregateId?: unknown;

  /** Type of the aggregate that generated the event */
  aggregateType?: string;

  /** Version of the aggregate after applying the event */
  aggregateVersion?: number;

  /** Version of the event structure (used for versioning) */
  eventVersion?: number;

  /** Actor who performed the action that led to this event */
  actor?: unknown;

  /** Owner of the resource affected by the event */
  owner?: unknown;

  /** Previous state captured for audit purposes */
  _previousState?: unknown;

  /** Additional application-specific metadata */
  [key: string]: unknown;
}

/**
 * Base interface for all domain events in the system.
 * @public
 * @stable
 * @since 0.22.0
 */
export interface IDomainEvent<P = unknown> {
  /** Name of the event */
  eventName: string;

  /** Payload (data) of the event */
  payload?: P | undefined;

  /**
   * Identity of this event.
   *
   * Optional because the interface also describes events produced by the
   * string form of `AggregateRoot.apply()`, which are plain objects. Class
   * based events (`DomainEvent`) always carry it, and `createDomainEvent()`
   * sets it while mirroring it into `metadata.eventId`.
   */
  eventId?: string;

  /** When the event happened. Same optionality rationale as `eventId`. */
  occurredOn?: Date;

  /** Event metadata */
  metadata?: IEventMetadata;
}
