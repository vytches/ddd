import type { IDomainEvent } from '@vytches/ddd-contracts';
import type { IEventProcessor } from '../event-processor';
import type { UnifiedEventBus } from '../unified-event-bus';
import type { IntegrationEventTransformerRegistry } from './integration-event-transformer-registry';

/**
 * @public
 * @experimental
 * @since 0.23.0
 *
 * @remarks
 * VF-031 (D-4): Part of the low-priority integration event bridge
 * (`IntegrationEventProcessor` / `DomainToIntegrationTransformer` /
 * `ContextRouter`). Kept because it is re-exported from the public
 * `@vytches/ddd-enterprise` barrel, but the shape of this bridge may be
 * refactored in a future major release. Treat as stable-but-narrow API
 * surface, not a long-term architectural commitment.
 */
export class IntegrationEventProcessor implements IEventProcessor {
  constructor(private readonly transformerRegistry: IntegrationEventTransformerRegistry) {}

  /**
   * Process a domain event by transforming it to an integration event
   * if a suitable transformer is registered
   */
  async process(event: IDomainEvent, eventBus?: UnifiedEventBus): Promise<void> {
    if (!eventBus) return;

    // Find transformer for this event type
    const transformer = this.transformerRegistry.find(event.eventName);
    if (!transformer) return;

    // Transform to multiple integration events
    const integrationEvents = transformer.transformToMultipleTargets(event);

    // Publish all generated integration events
    await eventBus.publishMany(integrationEvents);
  }
}
