import type { IDomainEvent } from '@vytches-ddd/contracts';
import type { UnifiedEventBus } from './unified-event-bus';

/**
 * @llm-summary Contract for event processor functionality
 * @llm-domain Architecture
 * @llm-contract Required
 *
 * @description
 * EventProcessor interface implementing architectural component for event processor operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteEventProcessor implements IEventProcessor {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
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
