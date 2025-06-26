import type { IDomainEvent } from '@vytches-ddd/contracts';
import type { EventBusRegistry } from './event-bus-registry';

/**
 * Interface for event processors
 * Processors handle domain events and may publish events to other buses
 */
export interface IEventProcessor {
  /**
   * Process a domain event
   * May result in publishing events to other buses
   *
   * @param event - The domain event to process
   * @param registry - Registry containing access to all event buses
   */
  process(event: IDomainEvent, registry?: EventBusRegistry): Promise<void>;
}
