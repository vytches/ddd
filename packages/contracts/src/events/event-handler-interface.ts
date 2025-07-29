import type { IDomainEvent } from './domain-event-interfaces';

/**
 * @llm-summary Type definition for event handler fn
 * @llm-domain Core
 * @llm-usage Frequent
 *
 * @description
 * EventHandlerFn type implementing core domain functionality for event handler fn operations.
 *
 * @example
 * ```typescript
 * // Usage example
 * const value: EventHandlerFn = {} as EventHandlerFn;
 * ```
 *
 * @since 1.0.0
 * @public
 */
export type EventHandlerFn<T extends IDomainEvent> = (event: T) => Promise<void> | void;

/**
 * @llm-summary Contract for event handler functionality
 * @llm-domain Core
 * @llm-contract Required
 *
 * @description
 * EventHandler interface implementing core domain functionality for event handler operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteEventHandler implements IEventHandler {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface IEventHandler<T extends IDomainEvent> {
  /**
   * Handle a domain event
   *
   * @param event - The event to handle
   */
  handle(event: T): Promise<void> | void;
}

/**
 * @llm-summary EVENT_HANDLER_METADATA constant
 * @llm-domain Core
 *
 * @description
 * EVENT_HANDLER_METADATA constant implementing core domain functionality for e v e n t_ h a n d l e r_ m e t a d a t a operations.
 *
 * @example
 * ```typescript
 * // Usage example
 * console.log(EVENT_HANDLER_METADATA);
 * ```
 *
 * @since 1.0.0
 * @public
 */
export const EVENT_HANDLER_METADATA = Symbol('EVENT_HANDLER_METADATA');

/**
 * @llm-summary EVENT_HANDLER_OPTIONS constant
 * @llm-domain Core
 *
 * @description
 * EVENT_HANDLER_OPTIONS constant implementing core domain functionality for e v e n t_ h a n d l e r_ o p t i o n s operations.
 *
 * @example
 * ```typescript
 * // Usage example
 * console.log(EVENT_HANDLER_OPTIONS);
 * ```
 *
 * @since 1.0.0
 * @public
 */
export const EVENT_HANDLER_OPTIONS = Symbol('EVENT_HANDLER_OPTIONS');

/**
 * @llm-summary Contract for event handler metadata functionality
 * @llm-domain Core
 * @llm-contract Required
 *
 * @description
 * EventHandlerMetadata interface implementing core domain functionality for event handler metadata operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteEventHandlerMetadata implements EventHandlerMetadata {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface EventHandlerMetadata {
  /**
   * The event type this handler can process
   */
  eventType: new (...args: unknown[]) => IDomainEvent;
}

/**
 * @llm-summary is event handler function
 * @llm-domain Core
 * @llm-pure true
 *
 * @description
 * isEventHandler function implementing core domain functionality for is event handler operations.
 *
 * @param {unknown} obj - obj parameter
 * @returns {obj is IEventHandler<IDomainEvent>} Returns obj is IEventHandler<IDomainEvent>
 * @throws {Error} When validation fails
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = isEventHandler(obj);
 * ```
 * *
 * @since 1.0.0
 * @public
 */
export function isEventHandler(obj: unknown): obj is IEventHandler<IDomainEvent> {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    'handle' in obj &&
    typeof (obj as { handle: unknown }).handle === 'function'
  );
}
