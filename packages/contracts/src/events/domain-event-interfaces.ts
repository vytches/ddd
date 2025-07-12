/**
 * Metadata for domain events
 * Contains additional information about the event context
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
 * Base interface for domain events
 * Represents something that happened in the domain
 */
export interface IDomainEvent<P = unknown> {
  /** Type of the event */
  eventType: string;

  /** Payload (data) of the event */
  payload?: P | undefined;
}

/**
 * Extended domain event interface with metadata
 */
export interface IExtendedDomainEvent<P = unknown> extends IDomainEvent<P> {
  /** Event metadata */
  metadata?: IEventMetadata;
}
