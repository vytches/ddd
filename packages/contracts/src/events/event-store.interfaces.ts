/* eslint-disable @typescript-eslint/no-explicit-any */
import type { IEventMetadata, IDomainEvent } from './domain-event-interfaces';

export interface IEventUpcaster<TInput = unknown, TOutput = unknown> {
  /**
   * Transforms an event payload from one version to another
   */
  upcast(payload: TInput, metadata?: IEventMetadata): TOutput;
}

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
