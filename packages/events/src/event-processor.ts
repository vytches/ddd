import type { IDomainEvent } from '@vytches-ddd/contracts';
import type { UnifiedEventBus } from './unified-event-bus';

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
   * @param eventBus - Unified event bus for publishing events
   */
  process(event: IDomainEvent, eventBus?: UnifiedEventBus): Promise<void>;
}
