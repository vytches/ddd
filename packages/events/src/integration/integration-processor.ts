import type { IDomainEvent } from '@vytches-ddd/contracts';
import type { EventBusRegistry } from '../event-bus-registry';
import type { IEventProcessor } from '../event-processor';
import type { IIntegrationEvent } from './integration-event-interfaces';
import type { IntegrationEventTransformerRegistry } from './integration-event-transformer-registry';

/**
 * Processor for transforming domain events to integration events
 */
export class IntegrationEventProcessor implements IEventProcessor {
  constructor(private readonly transformerRegistry: IntegrationEventTransformerRegistry) {}

  /**
   * Process a domain event by transforming it to an integration event
   * if a suitable transformer is registered
   */
  async process(event: IDomainEvent, registry: EventBusRegistry): Promise<void> {
    // Get integration event bus if registered
    const integrationBus = registry.get<IIntegrationEvent>('integration');
    if (!integrationBus) return;

    // Find transformer for this event type
    const transformer = this.transformerRegistry.find(event.eventType);
    if (!transformer) return;

    // Użycie transformToMultipleTargets zamiast transform
    const integrationEvents = transformer.transformToMultipleTargets(event);

    // Publikacja wszystkich wygenerowanych eventów
    for (const integrationEvent of integrationEvents) {
      await integrationBus.publish(integrationEvent);
    }
  }
}
