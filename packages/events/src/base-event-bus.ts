/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { EventHandlerFn, IEventHandler, BaseEventBusOptions, EventBusMiddleware } from '@vytches-ddd/contracts';
import { IEventBus } from '@vytches-ddd/contracts';
import { isEventHandler } from '@vytches-ddd/contracts';


/**
 * Symbol for custom middleware
 * Used to mark middleware added by users
 */
export const CUSTOM_MIDDLEWARE_SYMBOL = Symbol('CUSTOM_MIDDLEWARE');

/**
 * Abstract base class for all event bus implementations
 * Provides common functionality for event bus variants
 */
export abstract class BaseEventBus<TEvent = any> extends IEventBus<TEvent> {
  /**
   * Map of event types to their handlers
   */
  protected handlers: Map<
    string,
    Set<EventHandlerFn<any> | IEventHandler<any>>
  > = new Map();

  /**
   * Configuration options for this event bus
   */
  protected options: BaseEventBusOptions;

  protected publishPipeline: (event: TEvent) => Promise<void>;

  /**
   * Creates a new event bus with the specified options
   */
  constructor(options: BaseEventBusOptions = {}) {
    super();
    this.options = {
      enableLogging: false,
      logger: console.log,
      ...options,
    };

    this.publishPipeline = this.buildPublishPipeline();
  }

  async publish(event: TEvent): Promise<void> {
    await this.publishPipeline(event);
  }

  async publishMany(events: TEvent[]): Promise<void> {
    if (events.length === 0) {
      this.log('publishMany called with empty events array');
      return;
    }

    this.log(`Publishing ${events.length} events`);

    // Publish all events in parallel for better performance
    const publishPromises = events.map(event => this.publish(event));
    
    try {
      await Promise.all(publishPromises);
      this.log(`Successfully published ${events.length} events`);
    } catch (error) {
      this.handleError(error as Error, 'publishMany');
      throw error; // Re-throw to let caller handle
    }
  }

  // Dodanie metody use w klasie bazowej
  use(middleware: EventBusMiddleware): this {
    // Tag the middleware with the custom symbol
    Object.defineProperty(middleware, CUSTOM_MIDDLEWARE_SYMBOL, {
      value: true,
    });

    // Add middleware to options and rebuild pipeline
    this.options.middlewares = [
      ...(this.options.middlewares || []),
      middleware,
    ];
    this.publishPipeline = this.buildPublishPipeline();

    return this;
  }

  // Implementacja buildPublishPipeline w klasie bazowej
  protected buildPublishPipeline(): (event: TEvent) => Promise<void> {
    // Base pipeline that handles the actual event publishing
    const basePipeline = async (event: TEvent): Promise<void> => {
      const eventName = this.getEventTypeName(event);
      const handlers = this.handlers.get(eventName);

      if (!handlers || handlers.size === 0) {
        this.log(`No handlers for ${eventName}`);
        return;
      }

      this.log(`Publishing ${eventName} to ${handlers.size} handlers`);

      // Execute handlers
      const promises: Promise<void>[] = [];

      for (const handler of handlers) {
        try {
          let result: void | Promise<void>;

          if (isEventHandler(handler)) {
            // Class-based handler
            result = handler.handle(event);
          } else {
            // Function handler
            result = handler(event);
          }

          if (result instanceof Promise) {
            promises.push(result);
          }
        } catch (error) {
          this.handleError(error as Error, eventName);
        }
      }

      // Wait for all async handlers to complete
      if (promises.length > 0) {
        try {
          await Promise.all(promises);
        } catch (error) {
          this.handleError(error as Error, eventName);
        }
      }
    };

    // Apply middleware in reverse order (last added, first executed)
    let pipeline = basePipeline;

    if (this.options.middlewares && this.options.middlewares.length > 0) {
      for (let i = this.options.middlewares.length - 1; i >= 0; i--) {
        pipeline = this.options.middlewares[i]!(pipeline);
      }
    }

    return pipeline;
  }

  /**
   * Subscribe a function to handle events of a specific type
   */
  subscribe<T extends TEvent>(
    eventType: string | (new (...args: any[]) => T),
    handler: (event: T) => Promise<void> | void,
  ): void {
    const eventName = this.getEventName(eventType);

    if (!this.handlers.has(eventName)) {
      this.handlers.set(eventName, new Set());
    }

    this.handlers.get(eventName)!.add(handler);

    this.log(`Subscribed function handler to ${eventName}`);
  }

  /**
   * Register a class-based handler for events of a specific type
   */
  registerHandler<T extends TEvent>(
    eventType: string | (new (...args: any[]) => T),
    handler: { handle(event: T): Promise<void> | void },
  ): void {
    const eventName = this.getEventName(eventType);

    if (!this.handlers.has(eventName)) {
      this.handlers.set(eventName, new Set());
    }

    this.handlers.get(eventName)!.add(handler);

    this.log(`Registered class handler to ${eventName}`);
  }

  /**
   * Unsubscribe a handler from events of a specific type
   */
  unsubscribe<T extends TEvent>(
    eventType: string | (new (...args: any[]) => T),
    handler:
      | ((event: T) => Promise<void> | void)
      | { handle(event: T): Promise<void> | void },
  ): void {
    const eventName = this.getEventName(eventType);
    const handlers = this.handlers.get(eventName);

    if (handlers) {
      handlers.delete(handler as any);

      // Clean up empty sets
      if (handlers.size === 0) {
        this.handlers.delete(eventName);
      }

      this.log(`Unsubscribed handler from ${eventName}`);
    }
  }

  /**
   * Logs a message if logging is enabled
   */
  protected log(message: string): void {
    if (this.options.enableLogging && this.options.logger) {
      this.options.logger(`[EventBus] ${message}`);
    }
  }

  /**
   * Handles errors during event processing
   */
  protected handleError(error: Error, eventType: string): void {
    if (this.options.onError) {
      this.options.onError(error, eventType);
    } else {
      console.error(`[EventBus] Error processing ${eventType}:`, error);
      throw error; // Re-throw by default
    }
  }

  /**
   * Extracts the event name from a constructor or string
   */
  protected getEventName<T extends TEvent>(
    eventType: string | (new (...args: any[]) => T),
  ): string {
    if (typeof eventType === 'string') {
      return eventType;
    }

    // Try to get eventType from prototype
    const prototype = eventType.prototype;
    if (prototype && 'eventType' in prototype) {
      return prototype.eventType;
    }

    // Fall back to constructor name
    return eventType.name;
  }

  /**
   * Extracts the event type name from an event object
   */
  protected getEventTypeName(event: TEvent): string {
    // First check for eventType property
    if ('eventType' in (event as any)) {
      return (event as any).eventType;
    }

    // Fall back to constructor name
    return (event as any).constructor.name;
  }

  /**
   * Gets the registered handlers for a specific event type
   * Useful for testing and debugging
   */
  getHandlers(
    eventType: string | (new (...args: any[]) => any),
  ): Set<EventHandlerFn<any> | IEventHandler<any>> | undefined {
    const eventName = this.getEventName(eventType);
    return this.handlers.get(eventName);
  }

  /**
   * Gets all registered event types
   * Useful for inspection and debugging
   */
  getRegisteredEventTypes(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Clears all registered handlers
   * Useful for testing
   */
  clearHandlers(): void {
    this.handlers.clear();
  }
}
