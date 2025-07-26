import type { IDomainEvent } from '@vytches/ddd-contracts';
import type { IEventProcessor } from '../event-processor';
import type { UnifiedEventBus } from '../unified-event-bus';
import type { IntegrationEventTransformerRegistry } from './integration-event-transformer-registry';

/**
 * @llm-summary IntegrationEventProcessor class for integration event processor operations
 * @llm-domain Architecture
 * @llm-complexity Complex
 *
 * @description
 * IntegrationEventProcessor class implementing architectural component for integration event processor operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new IntegrationEventProcessor();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new IntegrationEventProcessor());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
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
    const transformer = this.transformerRegistry.find(event.eventType);
    if (!transformer) return;

    // Transform to multiple integration events
    const integrationEvents = transformer.transformToMultipleTargets(event);

    // Publish all generated integration events
    await eventBus.publishMany(integrationEvents);
  }
}
