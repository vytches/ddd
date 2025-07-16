/* eslint-disable @typescript-eslint/no-explicit-any */
import type { IExtendedDomainEvent, IEventMetadata } from './domain-event-interfaces';

/**
 * @llm-summary Contract for event upcaster functionality
 * @llm-domain Core
 * @llm-contract Required
 *
 * @description
 * EventUpcaster interface implementing core domain functionality for event upcaster operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteEventUpcaster implements IEventUpcaster {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface IEventUpcaster<TInput = unknown, TOutput = unknown> {
  /**
   * Transforms an event payload from one version to another
   */
  upcast(payload: TInput, metadata?: IEventMetadata): TOutput;
}

/**
 * @llm-summary Contract for audit event functionality
 * @llm-domain Core
 * @llm-contract Required
 *
 * @description
 * AuditEvent interface implementing core domain functionality for audit event operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteAuditEvent implements IAuditEvent {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface IAuditEvent {
  eventId: string;
  timestamp: Date;
  aggregateId: unknown;
  aggregateType: string;
  aggregateVersion: number;
  eventType: string;
  payload?: unknown;
  metadata?: IEventMetadata;
  actor?: unknown;
  previousState?: unknown;
}

/**
 * @llm-summary Contract for event store functionality
 * @llm-domain Core
 * @llm-contract Required
 *
 * @description
 * EventStore interface implementing core domain functionality for event store operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteEventStore implements IEventStore {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface IEventStore {
  /**
   * Gets all events for an aggregate
   */
  getEvents(aggregateId: unknown): Promise<IExtendedDomainEvent[]>;

  /**
   * Saves events for an aggregate
   */
  saveEvents(
    aggregateId: unknown,
    events: IExtendedDomainEvent[],
    expectedVersion: number
  ): Promise<void>;

  /**
   * Gets events after a specific version
   */
  getEventsAfterVersion(aggregateId: unknown, version: number): Promise<IExtendedDomainEvent[]>;
}
