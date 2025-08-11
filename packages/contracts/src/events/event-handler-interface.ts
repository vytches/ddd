import type { IDomainEvent } from './domain-event-interfaces';

export type EventHandlerFn<T extends IDomainEvent> = (event: T) => Promise<void> | void;

export interface IEventHandler<T extends IDomainEvent> {
  /**
   * Handle a domain event
   *
   * @param event - The event to handle
   */
  handle(event: T): Promise<void> | void;
}

export const EVENT_HANDLER_METADATA = Symbol('EVENT_HANDLER_METADATA');

export const EVENT_HANDLER_OPTIONS = Symbol('EVENT_HANDLER_OPTIONS');

export interface EventHandlerMetadata {
  /**
   * The event type this handler can process
   */
  eventType: new (...args: unknown[]) => IDomainEvent;
}

export function isEventHandler(obj: unknown): obj is IEventHandler<IDomainEvent> {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    'handle' in obj &&
    typeof (obj as { handle: unknown }).handle === 'function'
  );
}
