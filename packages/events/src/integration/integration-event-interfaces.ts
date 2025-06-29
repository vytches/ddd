/* eslint-disable @typescript-eslint/no-explicit-any */
import type { IActor } from '@vytches-ddd/core';

/**
 * Metadata for integration events
 * Contains additional information relevant for inter-bounded context communication
 */
export interface IIntegrationEventMetadata {
  /** Unique identifier for the event */
  eventId?: string;

  /** When the event was created */
  timestamp?: Date;

  /** Correlation ID for related events */
  correlationId?: string;

  /** ID of the event that caused this event */
  causationId?: string;

  /** Version of the event schema (used for contract versioning) */
  schemaVersion?: number;

  /** Source bounded context */
  sourceContext?: string;

  /** Target bounded context (optional) */
  targetContext?: string;

  /** Routing path (e.g. topic/channel) */
  routingKey?: string;

  /** Actor who performed the action that led to this event */
  actor?: IActor;

  /** Owner of the resource affected by the event */
  owner?: IActor;

  /** Additional application-specific metadata */
  [key: string]: any;
}

/**
 * Base interface for integration events
 * Represents an event communicated between bounded contexts
 */
export interface IIntegrationEvent<P = any> {
  /** Type of the event */
  eventType: string;

  /** Payload (data) of the event */
  payload?: P | undefined;

  /** Metadata of the event */
  metadata?: IIntegrationEventMetadata;
}

/**
 * Interface for domain to integration event transformer
 * Responsible for transforming domain events to integration events
 */
export interface IDomainToIntegrationEventTransformer<D = any, I = any> {
  /**
   * Transformuje wydarzenie domenowe na wydarzenie integracyjne
   * @param domainEvent Wydarzenie domenowe do transformacji
   * @param additionalMetadata Opcjonalne dodatkowe metadane
   */
  transform(
    domainEvent: D,
    additionalMetadata?: Partial<IIntegrationEventMetadata>
  ): IIntegrationEvent<I>;

  /**
   * Transformuje wydarzenie domenowe na wydarzenia integracyjne dla wielu kontekstów
   * @param domainEvent Wydarzenie domenowe do transformacji
   * @param additionalMetadata Opcjonalne dodatkowe metadane
   */
  transformToMultipleTargets(
    domainEvent: D,
    additionalMetadata?: Partial<IIntegrationEventMetadata>
  ): IIntegrationEvent<I>[];
}
