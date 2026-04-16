import type { IDomainEvent } from './domain-event-interfaces';

/**
 * Function type for event handlers.
 * @public
 * @stable
 * @since 0.22.0
 */
export type EventHandlerFn<T extends IDomainEvent> = (event: T) => Promise<void> | void;

/**
 * Interface for class-based event handlers.
 * @public
 * @stable
 * @since 0.22.0
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
 * @internal Symbol used for storing event handler metadata on decorated classes.
 */
export const EVENT_HANDLER_METADATA = Symbol('EVENT_HANDLER_METADATA');

/**
 * @internal Symbol used for storing event handler options on decorated classes.
 */
export const EVENT_HANDLER_OPTIONS = Symbol('EVENT_HANDLER_OPTIONS');

/**
 * Metadata structure for event handler decorators.
 * @public
 * @stable
 * @since 0.22.0
 */
export interface EventHandlerMetadata {
  /**
   * The event type this handler can process
   */
  eventType: new (...args: unknown[]) => IDomainEvent;
}

/**
 * Type guard to check if an object implements IEventHandler.
 * @public
 * @stable
 * @since 0.22.0
 */
export function isEventHandler(obj: unknown): obj is IEventHandler<IDomainEvent> {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    'handle' in obj &&
    typeof (obj as { handle: unknown }).handle === 'function'
  );
}
