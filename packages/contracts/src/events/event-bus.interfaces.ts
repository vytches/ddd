/* eslint-disable @typescript-eslint/no-unsafe-function-type */
import type { IDomainEvent } from './domain-event-interfaces';

/** Constructor type for event classes - uses `any[]` to allow typed constructor signatures (same pattern as TypeScript's built-in InstanceType) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EventConstructor<T> = new (...args: any[]) => T;

/**
 * Abstract base class for event bus implementations.
 * @public
 * @stable
 * @since 0.22.0
 */
export abstract class IEventBus<TEvent = IDomainEvent> {
  /**
   * Publish an event to all subscribed handlers
   */
  abstract publish(event: TEvent): Promise<void>;

  /**
   * Subscribe a function to handle events of a specific type
   */
  abstract subscribe<T extends TEvent>(
    eventType: string | EventConstructor<T>,
    handler: (event: T) => Promise<void> | void
  ): void;

  /**
   * Register a class-based handler for events of a specific type
   */
  abstract registerHandler<T extends TEvent>(
    eventType: string | EventConstructor<T>,
    handler: {
      handle(event: T): Promise<void> | void;
    }
  ): void;

  /**
   * Unsubscribe from an event type
   */
  abstract unsubscribe(
    eventType: string | EventConstructor<TEvent>,
    handler:
      | ((event: TEvent) => Promise<void> | void)
      | { handle(event: TEvent): Promise<void> | void }
  ): void;

  /**
   * Publish multiple events
   */
  abstract publishMany(events: TEvent[]): Promise<void>;
}

/**
 * Base configuration options for event bus implementations.
 * @public
 * @stable
 * @since 0.22.0
 */
export interface BaseEventBusOptions {
  /**
   * Enable or disable event processing logging
   */
  enableLogging?: boolean;

  /**
   * Custom error handler for event processing errors
   */
  onError?: (error: Error, eventType: string) => void;

  /**
   * Middleware pipeline to process events
   */
  middlewares?: EventBusMiddleware[];

  /**
   * Optional custom logger function
   */
  logger?: (message: string) => void;
}

/**
 * Middleware function for intercepting and transforming events in the event bus pipeline.
 * @public
 * @stable
 * @since 0.22.0
 */
export type EventBusMiddleware = (
  next: (event: unknown) => Promise<void>
) => (event: unknown) => Promise<void>;
