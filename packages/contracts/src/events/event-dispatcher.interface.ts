import type { IDomainEvent } from './domain-event-interfaces';
import type { IAggregateWithEvents } from '../aggregates';

/**
 * @llm-summary Type definition for event middleware
 * @llm-domain Core
 * @llm-usage Frequent
 *
 * @description
 * EventMiddleware type implementing core domain functionality for event middleware operations.
 *
 * @example
 * ```typescript
 * // Usage example
 * const value: EventMiddleware = {} as EventMiddleware;
 * ```
 *
 * @since 1.0.0
 * @public
 */
export type EventMiddleware = (
  event: IDomainEvent,
  next: (event: IDomainEvent) => Promise<void>
) => Promise<void>;

/**
 * @llm-summary Contract for event processor functionality
 * @llm-domain Core
 * @llm-contract Required
 *
 * @description
 * EventProcessor interface implementing core domain functionality for event processor operations.
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
   * Process an event
   */
  process(event: IDomainEvent): Promise<void>;

  /**
   * Check if this processor can handle the event
   */
  canProcess(event: IDomainEvent): boolean;
}

/**
 * @llm-summary EventDispatcher class for event dispatcher operations
 * @llm-domain Core
 * @llm-complexity Simple
 *
 * @description
 * EventDispatcher class implementing core domain functionality for event dispatcher operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new IEventDispatcher();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new IEventDispatcher());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export abstract class IEventDispatcher {
  /**
   * Dispatch all events from an aggregate and clear them
   */
  abstract dispatchEventsForAggregate(aggregate: IAggregateWithEvents): Promise<void>;

  /**
   * Dispatch a single event
   */
  abstract dispatchEvent(event: IDomainEvent): Promise<void>;

  /**
   * Dispatch multiple events
   */
  abstract dispatchEvents(...events: IDomainEvent[]): Promise<void>;
}

/**
 * @llm-summary EnhancedEventDispatcher class for enhanced event dispatcher operations
 * @llm-domain Core
 * @llm-complexity Simple
 *
 * @description
 * EnhancedEventDispatcher class implementing core domain functionality for enhanced event dispatcher operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new IEnhancedEventDispatcher();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new IEnhancedEventDispatcher());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export abstract class IEnhancedEventDispatcher extends IEventDispatcher {
  /**
   * Add middleware to the event pipeline
   */
  abstract use(middleware: EventMiddleware): this;

  /**
   * Register an event processor
   */
  abstract registerProcessor(processor: IEventProcessor): this;
}
