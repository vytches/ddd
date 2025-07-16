/**
 * @llm-summary Contract for event metadata functionality
 * @llm-domain Core
 * @llm-contract Required
 *
 * @description
 * EventMetadata interface implementing core domain functionality for event metadata operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteEventMetadata implements IEventMetadata {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
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
 * @llm-summary Contract for domain event functionality
 * @llm-domain Core
 * @llm-contract Required
 *
 * @description
 * DomainEvent interface implementing core domain functionality for domain event operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteDomainEvent implements IDomainEvent {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface IDomainEvent<P = unknown> {
  /** Type of the event */
  eventType: string;

  /** Payload (data) of the event */
  payload?: P | undefined;
}

/**
 * @llm-summary Contract for extended domain event functionality
 * @llm-domain Core
 * @llm-contract Required
 *
 * @description
 * ExtendedDomainEvent interface implementing core domain functionality for extended domain event operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteExtendedDomainEvent implements IExtendedDomainEvent {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface IExtendedDomainEvent<P = unknown> extends IDomainEvent<P> {
  /** Event metadata */
  metadata?: IEventMetadata;
}
