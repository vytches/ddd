/* eslint-disable @typescript-eslint/no-explicit-any */
import type { IExtendedDomainEvent, IEventMetadata } from './domain-event-interfaces';

/**
 * Interface for event upcaster
 * Transforms event payloads between versions
 */
export interface IEventUpcaster<TInput = unknown, TOutput = unknown> {
  /**
   * Transforms an event payload from one version to another
   */
  upcast(payload: TInput, metadata?: IEventMetadata): TOutput;
}

/**
 * Audit event interface
 * Represents an audit log entry for domain events
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
 * Event store interface
 * Defines the contract for event storage and retrieval
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
