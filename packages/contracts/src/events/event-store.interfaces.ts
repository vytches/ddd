/* eslint-disable @typescript-eslint/no-explicit-any */
import type { IEventMetadata, IDomainEvent } from './domain-event-interfaces';

/**
 * Transforms an event payload from one schema version to another for forward compatibility.
 * @public
 * @stable
 * @since 0.22.0
 */
export interface IEventUpcaster<TInput = unknown, TOutput = unknown> {
  /**
   * Transforms an event payload from one version to another
   */
  upcast(payload: TInput, metadata?: IEventMetadata): TOutput;
}

/**
 * Represents an auditable event record capturing state change history.
 * @public
 * @stable
 * @since 0.22.0
 */
export interface IAuditEvent {
  eventId: string;
  timestamp: Date;
  aggregateId: unknown;
  aggregateType: string;
  aggregateVersion: number;
  eventName: string;
  payload?: unknown;
  metadata?: IEventMetadata;
  actor?: unknown;
  previousState?: unknown;
}

/**
 * Core event store interface for persisting and retrieving domain events by aggregate.
 * @public
 * @stable
 * @since 0.22.0
 */
export interface IEventStore {
  /**
   * Gets all events for an aggregate
   */
  getEvents(aggregateId: unknown): Promise<IDomainEvent[]>;

  /**
   * Saves events for an aggregate
   */
  saveEvents(aggregateId: unknown, events: IDomainEvent[], expectedVersion: number): Promise<void>;

  /**
   * Gets events after a specific version
   */
  getEventsAfterVersion(aggregateId: unknown, version: number): Promise<IDomainEvent[]>;
}
