/* eslint-disable @typescript-eslint/no-explicit-any */
import type { IExtendedDomainEvent, IEventMetadata } from './domain-event-interfaces';

/**
 * Interface for event upcaster
 * Transforms event payloads between versions
 */
export interface IEventUpcaster<TInput = any, TOutput = any> {
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
  aggregateId: any;
  aggregateType: string;
  aggregateVersion: number;
  eventType: string;
  payload?: any;
  metadata?: IEventMetadata;
  actor?: any;
  previousState?: any;
}

/**
 * Event store interface
 * Defines the contract for event storage and retrieval
 */
export interface IEventStore {
  /**
   * Gets all events for an aggregate
   */
  getEvents(aggregateId: any): Promise<IExtendedDomainEvent[]>;

  /**
   * Saves events for an aggregate
   */
  saveEvents(
    aggregateId: any,
    events: IExtendedDomainEvent[],
    expectedVersion: number
  ): Promise<void>;

  /**
   * Gets events after a specific version
   */
  getEventsAfterVersion(aggregateId: any, version: number): Promise<IExtendedDomainEvent[]>;
}
