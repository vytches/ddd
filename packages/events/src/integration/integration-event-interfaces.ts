/* eslint-disable @typescript-eslint/no-explicit-any */
import type { IActor } from '@vytches/ddd-domain-primitives';

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
  [key: string]: unknown;
}

export interface IIntegrationEvent<P = unknown> {
  /** Name of the event */
  eventName: string;

  /** Payload (data) of the event */
  payload?: P | undefined;

  /** Metadata of the event */
  metadata?: IIntegrationEventMetadata;
}

export interface IDomainToIntegrationEventTransformer<D = unknown, I = unknown> {
  /**
   * Transform domain event to integration event
   * @param domainEvent Domain event to transform
   * @param additionalMetadata Optional additional metadata
   */
  transform(
    domainEvent: D,
    additionalMetadata?: Partial<IIntegrationEventMetadata>
  ): IIntegrationEvent<I>;

  /**
   * Transform domain event to integration events for multiple contexts
   * @param domainEvent Domain event to transform
   * @param additionalMetadata Optional additional metadata
   */
  transformToMultipleTargets(
    domainEvent: D,
    additionalMetadata?: Partial<IIntegrationEventMetadata>
  ): IIntegrationEvent<I>[];
}
