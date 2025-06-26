import type { IDomainEvent } from './domain-event-interfaces';

/**
 * Function type for handling domain events
 * This supports both synchronous and asynchronous handlers
 */
export type EventHandlerFn<T extends IDomainEvent> = (
  event: T,
) => Promise<void> | void;

/**
 * Interface for class-based event handlers
 * Provides a more structured approach to event handling
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
 * Symbol for event handler metadata
 * Used for reflection-based handler registration
 */
export const EVENT_HANDLER_METADATA = Symbol('EVENT_HANDLER_METADATA');

/**
 * Symbol for event handler options
 * Holds additional configuration for event handlers (activation, etc.)
 */
export const EVENT_HANDLER_OPTIONS = Symbol('EVENT_HANDLER_OPTIONS');

/**
 * Metadata for event handlers
 * Stores information about what event types a handler can process
 */
export interface EventHandlerMetadata {
  /**
   * The event type this handler can process
   */
  eventType: new (...args: any[]) => IDomainEvent;
}

/**
 * Check if an object is an event handler
 *
 * @param obj - The object to check
 * @returns True if the object implements IEventHandler
 */
export function isEventHandler(obj: any): obj is IEventHandler<any> {
  return (
    obj &&
    typeof obj === 'object' &&
    'handle' in obj &&
    typeof obj.handle === 'function'
  );
}
