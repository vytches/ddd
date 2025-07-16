/* eslint-disable @typescript-eslint/no-explicit-any */
import type { IEventMetadata, IExtendedDomainEvent } from '@vytches-ddd/contracts';
import type { IActor } from '@vytches-ddd/core';
import type { IContextRouter } from './context-router';
import type {
  IIntegrationEvent,
  IIntegrationEventMetadata,
  IDomainToIntegrationEventTransformer,
} from './integration-event-interfaces';
import { createIntegrationEvent } from './integration-event.utils';

/**
 * @llm-summary DomainToIntegrationTransformer class for domain to integration transformer operations
 * @llm-domain Architecture
 * @llm-complexity Medium
 *
 * @description
 * DomainToIntegrationTransformer class implementing architectural component for domain to integration transformer operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new DomainToIntegrationTransformer();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new DomainToIntegrationTransformer());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export abstract class DomainToIntegrationTransformer<D = unknown, I = unknown>
  implements IDomainToIntegrationEventTransformer<IExtendedDomainEvent<D>, I>
{
  /**
   * Source bounded context
   */
  protected readonly sourceContext: string;

  /**
   * Target bounded context (optional)
   */
  private readonly contextRouter?: IContextRouter | undefined;

  /**
   * Creates a new transformer
   * @param sourceContext Name of the source bounded context
   * @param targetContext Optional name of the target bounded context
   */
  constructor(sourceContext: string, contextRouter?: IContextRouter) {
    this.sourceContext = sourceContext;
    this.contextRouter = contextRouter;
  }

  public transformToMultipleTargets(
    domainEvent: IExtendedDomainEvent<D>,
    additionalMetadata?: Partial<IIntegrationEventMetadata>
  ): IIntegrationEvent<I>[] {
    if (!this.contextRouter) {
      // Bez routera zwracamy pojedynczy event bez kontekstu docelowego
      return [this.transform(domainEvent, additionalMetadata)];
    }

    const targetContexts = this.contextRouter.determineTargetContexts(domainEvent);

    // Jeśli brak kontekstów docelowych, zwracamy pojedynczy event
    if (targetContexts.length === 0) {
      return [];
    }

    // Tworzymy event dla każdego kontekstu docelowego
    return targetContexts.map(targetContext =>
      this.transform(domainEvent, {
        ...additionalMetadata,
        targetContext,
      })
    );
  }

  /**
   * Transforms a domain event to an integration event
   * @param domainEvent Domain event to transform
   * @param additionalMetadata Optional additional metadata
   * @returns Transformed integration event
   */
  public transform(
    domainEvent: IExtendedDomainEvent<D>,
    additionalMetadata?: Partial<IIntegrationEventMetadata>
  ): IIntegrationEvent<I> {
    // Transform payload to integration format
    const transformedPayload = this.transformPayload(domainEvent.payload);

    // Create integration metadata from domain metadata
    const integrationMetadata = this.transformMetadata(
      domainEvent.metadata as IEventMetadata,
      additionalMetadata
    );

    // Create integration event with appropriate type (possibly mapped)
    const integrationEventType = this.getIntegrationEventType(domainEvent.eventType);

    return createIntegrationEvent<I>(integrationEventType, transformedPayload, integrationMetadata);
  }

  /**
   * Transforms domain event payload to integration event payload
   * This method should be overridden in derived classes
   * @param domainPayload Domain event payload
   * @returns Transformed integration event payload
   */
  protected abstract transformPayload(domainPayload?: D): I;

  /**
   * Transforms domain event metadata to integration metadata
   * @param domainMetadata Domain event metadata
   * @param additionalMetadata Additional metadata to add
   * @returns Metadata for integration event
   */
  protected transformMetadata(
    domainMetadata: IEventMetadata,
    additionalMetadata?: Partial<IIntegrationEventMetadata>
  ): Partial<IIntegrationEventMetadata> {
    const metadata: Partial<IIntegrationEventMetadata> = {
      // Add source and target context
      sourceContext: this.sourceContext,
      contextRouter: this.contextRouter,

      // Add schema version (default 1)
      schemaVersion: 1,

      // Add routing key (default is event type)
      routingKey: this.getRoutingKey(domainMetadata),

      // Add additional metadata
      ...additionalMetadata,
    };

    // Conditionally add optional metadata to avoid exact optional property type issues
    if (domainMetadata.correlationId !== undefined) {
      metadata.correlationId = domainMetadata.correlationId;
    }

    if (domainMetadata.eventId !== undefined) {
      metadata.causationId = domainMetadata.eventId; // Domain event ID becomes causationId
    }

    if (domainMetadata.actor !== undefined) {
      metadata.actor = domainMetadata.actor as IActor;
    }

    if (domainMetadata.owner !== undefined) {
      metadata.owner = domainMetadata.owner as IActor;
    }

    return metadata;
  }

  /**
   * Returns integration event type based on domain event type
   * Default returns the same type, but can be overridden in derived classes
   * @param domainEventType Domain event type
   * @returns Integration event type
   */
  protected getIntegrationEventType(domainEventType: string): string {
    return domainEventType;
  }

  /**
   * Generates routing key for integration event
   * Default uses event type or provides specific implementation
   * @param domainMetadata Domain event metadata
   * @returns Routing key for integration event
   */
  protected getRoutingKey(domainMetadata: IEventMetadata): string {
    return domainMetadata.aggregateType
      ? `${domainMetadata.aggregateType}.${domainMetadata.eventType}`
      : (domainMetadata.eventType as string) || '';
  }
}
