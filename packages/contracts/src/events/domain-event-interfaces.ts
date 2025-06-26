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
  aggregateId?: any;

  /** Type of the aggregate that generated the event */
  aggregateType?: string;

  /** Version of the aggregate after applying the event */
  aggregateVersion?: number;

  /** Version of the event structure (used for versioning) */
  eventVersion?: number;

  /** Actor who performed the action that led to this event */
  actor?: any;

  /** Owner of the resource affected by the event */
  owner?: any;

  /** Previous state captured for audit purposes */
  _previousState?: any;

  /** Additional application-specific metadata */
  [key: string]: any;
}

/**
 * Base interface for domain events
 * Represents something that happened in the domain
 */
export interface IDomainEvent<P = any> {
  /** Type of the event */
  eventType: string;

  /** Payload (data) of the event */
  payload?: P | undefined;
}

/**
 * Extended domain event interface with metadata
 */
export interface IExtendedDomainEvent<P = any> extends IDomainEvent<P> {
  /** Event metadata */
  metadata?: IEventMetadata;
}

