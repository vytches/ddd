/* eslint-disable @typescript-eslint/no-explicit-any */
import type { IDomainEvent, IEventMetadata } from '@vytches/ddd-contracts';
import type { IActor } from '@vytches/ddd-domain-primitives';

export interface IIntegrationEventMetadata extends IEventMetadata {
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

export interface IIntegrationEvent<P = unknown> extends IDomainEvent<P> {
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
