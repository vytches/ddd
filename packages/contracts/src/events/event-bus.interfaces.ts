/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-function-type */
import type { IDomainEvent } from './domain-event-interfaces';

export abstract class IEventBus<TEvent = IDomainEvent> {
  /**
   * Publish an event to all subscribed handlers
   */
  abstract publish(event: TEvent): Promise<void>;

  /**
   * Subscribe a function to handle events of a specific type
   */
  abstract subscribe<T extends TEvent>(
    eventType: string | (new (...args: any[]) => T),
    handler: (event: T) => Promise<void> | void
  ): void;

  /**
   * Register a class-based handler for events of a specific type
   */
  abstract registerHandler<T extends TEvent>(
    eventType: string | (new (...args: any[]) => T),
    handler: {
      handle(event: T): Promise<void> | void;
    }
  ): void;

  /**
   * Unsubscribe from an event type
   */
  abstract unsubscribe(
    eventType: string | (new (...args: any[]) => TEvent),
    handler:
      | ((event: TEvent) => Promise<void> | void)
      | { handle(event: TEvent): Promise<void> | void }
  ): void;

  /**
   * Publish multiple events
   */
  abstract publishMany(events: TEvent[]): Promise<void>;
}

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

export type EventBusMiddleware = (
  next: (event: unknown) => Promise<void>
) => (event: unknown) => Promise<void>;
