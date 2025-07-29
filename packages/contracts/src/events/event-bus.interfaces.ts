/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-function-type */
import type { IDomainEvent } from './domain-event-interfaces';

/**
 * @llm-summary EventBus class for event bus operations
 * @llm-domain Core
 * @llm-complexity Medium
 *
 * @description
 * EventBus class implementing core domain functionality for event bus operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new IEventBus();
 * ```
 * *
 * @since 1.0.0
 * @public
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

/**
 * @llm-summary Contract for base event bus options functionality
 * @llm-domain Core
 * @llm-contract Required
 *
 * @description
 * BaseEventBusOptions interface implementing core domain functionality for base event bus options operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteBaseEventBusOptions implements BaseEventBusOptions {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
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
 * @llm-summary Type definition for event bus middleware
 * @llm-domain Core
 * @llm-usage Frequent
 *
 * @description
 * EventBusMiddleware type implementing core domain functionality for event bus middleware operations.
 *
 * @example
 * ```typescript
 * // Usage example
 * const value: EventBusMiddleware = {} as EventBusMiddleware;
 * ```
 *
 * @since 1.0.0
 * @public
 */
export type EventBusMiddleware = (
  next: (event: unknown) => Promise<void>
) => (event: unknown) => Promise<void>;
