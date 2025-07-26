/* eslint-disable @typescript-eslint/no-explicit-any */
import type { IActor } from '@vytches/ddd-core';

/**
 * @llm-summary Contract for integration event metadata functionality
 * @llm-domain Architecture
 * @llm-contract Required
 *
 * @description
 * IntegrationEventMetadata interface implementing architectural component for integration event metadata operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteIntegrationEventMetadata implements IIntegrationEventMetadata {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
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
  [key: string]: unknown;
}

/**
 * @llm-summary Contract for integration event functionality
 * @llm-domain Architecture
 * @llm-contract Required
 *
 * @description
 * IntegrationEvent interface implementing architectural component for integration event operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteIntegrationEvent implements IIntegrationEvent {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface IIntegrationEvent<P = unknown> {
  /** Type of the event */
  eventType: string;

  /** Payload (data) of the event */
  payload?: P | undefined;

  /** Metadata of the event */
  metadata?: IIntegrationEventMetadata;
}

/**
 * @llm-summary Contract for domain to integration event transformer functionality
 * @llm-domain Architecture
 * @llm-contract Required
 *
 * @description
 * DomainToIntegrationEventTransformer interface implementing architectural component for domain to integration event transformer operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteDomainToIntegrationEventTransformer implements IDomainToIntegrationEventTransformer {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface IDomainToIntegrationEventTransformer<D = unknown, I = unknown> {
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
