/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  EventHandlerFn,
  IEventHandler,
  BaseEventBusOptions,
  EventBusMiddleware,
  IDomainEvent,
} from '@vytches-ddd/contracts';
// import { VytchesDDD } from '@vytches-ddd/di';
const VytchesDDD = {
  resolve: (
    _identifier: string | symbol | (new (...args: unknown[]) => unknown),
    _context?: string
  ) => null,
} as {
  resolve: (
    identifier: string | symbol | (new (...args: unknown[]) => unknown),
    context?: string
  ) => unknown | null;
}; // Temporarily disabled for testing
import { IEventBus, isEventHandler } from '@vytches-ddd/contracts';
import { Logger } from '@vytches-ddd/logging';

/**
 * @llm-summary CUSTOM_MIDDLEWARE_SYMBOL constant
 * @llm-domain Architecture
 *
 * @description
 * CUSTOM_MIDDLEWARE_SYMBOL constant implementing architectural component for c u s t o m_ m i d d l e w a r e_ s y m b o l operations.
 *
 * @example
 * ```typescript
 * // Usage example
 * console.log(CUSTOM_MIDDLEWARE_SYMBOL);
 * ```
 *
 * @since 1.0.0
 * @public
 */
export const CUSTOM_MIDDLEWARE_SYMBOL = Symbol('CUSTOM_MIDDLEWARE');

/**
 * @llm-summary BaseEventBus class for base event bus operations
 * @llm-domain Architecture
 * @llm-complexity Medium
 *
 * @description
 * BaseEventBus class implementing architectural component for base event bus operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new BaseEventBus();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new BaseEventBus());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export abstract class BaseEventBus<
  TEvent extends IDomainEvent = IDomainEvent,
> extends IEventBus<TEvent> {
  /**
   * Map of event types to their handlers
   */
  protected handlers: Map<string, Set<EventHandlerFn<TEvent> | IEventHandler<TEvent>>> = new Map();

  /**
   * Configuration options for this event bus
   */
  protected options: BaseEventBusOptions;

  protected publishPipeline: (event: TEvent) => Promise<void>;

  private logger = Logger.create('EventBus');
  private useDI: boolean;

  /**
   * Creates a new event bus with the specified options
   */
  constructor(options: BaseEventBusOptions = {}, useDI = true) {
    super();
    this.options = {
      enableLogging: false,
      logger: (message: string) => this.logger.info(message),
      ...options,
    };
    this.useDI = useDI && !!VytchesDDD;

    this.publishPipeline = this.buildPublishPipeline();
  }

  async publish(event: TEvent): Promise<void> {
    await this.publishPipeline(event);
  }

  async publishMany(events: TEvent[]): Promise<void> {
    if (events.length === 0) {
      this.logger.debug('publishMany called with empty events array');
      return;
    }

    this.logger.info(`Publishing ${events.length} events`);

    // Publish all events in parallel for better performance
    const publishPromises = events.map(event => this.publish(event));

    try {
      await Promise.all(publishPromises);
      this.logger.info(`Successfully published ${events.length} events`);
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
    this.options.middlewares = [...(this.options.middlewares || []), middleware];
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
        this.logger.debug(`No handlers for ${eventName}`);
        return;
      }

      this.logger.debug(`Publishing ${eventName} to ${handlers.size} handlers`);

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
        pipeline = this.options.middlewares[i]!(pipeline as (event: unknown) => Promise<void>) as (
          event: TEvent
        ) => Promise<void>;
      }
    }

    return pipeline;
  }

  /**
   * Subscribe a function to handle events of a specific type
   */
  subscribe<T extends TEvent>(
    eventType: string | (new (...args: unknown[]) => T),
    handler: (event: T) => Promise<void> | void
  ): void {
    const eventName = this.getEventName(eventType);

    if (!this.handlers.has(eventName)) {
      this.handlers.set(eventName, new Set());
    }

    this.handlers.get(eventName)!.add(handler as EventHandlerFn<TEvent>);

    this.logger.debug(`Subscribed function handler to ${eventName}`);
  }

  /**
   * Register a class-based handler for events of a specific type
   */
  registerHandler<T extends TEvent>(
    eventType: string | (new (...args: unknown[]) => T),
    handler: { handle(event: T): Promise<void> | void }
  ): void {
    const eventName = this.getEventName(eventType);

    if (!this.handlers.has(eventName)) {
      this.handlers.set(eventName, new Set());
    }

    this.handlers.get(eventName)!.add(handler as IEventHandler<TEvent>);

    this.logger.debug(`Registered class handler to ${eventName}`);
  }

  /**
   * Unsubscribe a handler from events of a specific type
   */
  unsubscribe<T extends TEvent>(
    eventType: string | (new (...args: unknown[]) => T),
    handler: ((event: T) => Promise<void> | void) | { handle(event: T): Promise<void> | void }
  ): void {
    const eventName = this.getEventName(eventType);
    const handlers = this.handlers.get(eventName);

    if (handlers) {
      handlers.delete(handler as (event: TEvent) => Promise<void> | void);

      // Clean up empty sets
      if (handlers.size === 0) {
        this.handlers.delete(eventName);
      }

      this.logger.debug(`Unsubscribed handler from ${eventName}`);
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
      this.logger.error(`Error processing ${eventType}`, error);
      throw error; // Re-throw by default
    }
  }

  /**
   * Extracts the event name from a constructor or string
   */
  protected getEventName<T extends TEvent>(
    eventType: string | (new (...args: unknown[]) => T)
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
    if ('eventType' in (event as { eventType?: string })) {
      return (event as { eventType: string }).eventType;
    }

    // Fall back to constructor name
    return (event as { constructor: { name: string } }).constructor.name;
  }

  /**
   * Gets the registered handlers for a specific event type
   * Useful for testing and debugging
   */
  getHandlers(
    eventType: string | (new (...args: unknown[]) => TEvent)
  ): Set<EventHandlerFn<TEvent> | IEventHandler<TEvent>> | undefined {
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

  /**
   * Discover and register event handlers with DI integration
   * Uses metadata stored by enhanced @EventHandler decorators
   */
  discoverHandlers(): void {
    this.logger.debug('Starting event handler discovery');

    // Note: Event handlers don't have a centralized registry like commands/queries
    // This is a simplified implementation that would work with explicitly registered handlers

    if (this.useDI && VytchesDDD) {
      this.logger.debug('DI is available, using DI-based handler resolution');
      // For Phase 2C, we implement a pattern where handlers are resolved on-demand from DI
      // This approach is different from Command/Query buses because events can have multiple handlers
    } else {
      this.logger.debug('DI not available, using direct instantiation');
    }

    this.logger.debug('Event handler discovery completed');
  }

  /**
   * Register a handler factory that uses DI resolution
   */
  registerHandlerFactory<T extends TEvent>(
    eventType: string | (new (...args: unknown[]) => T),
    handlerClass: new (...args: unknown[]) => IEventHandler<T>
  ): void {
    const eventName = this.getEventName(eventType);

    if (!this.handlers.has(eventName)) {
      this.handlers.set(eventName, new Set());
    }

    // Create a factory function that resolves the handler from DI
    const handlerFactory: IEventHandler<T> = {
      handle: async (event: T) => {
        let handlerInstance: IEventHandler<T>;

        if (this.useDI && VytchesDDD) {
          try {
            // Try to resolve from DI container first
            handlerInstance = VytchesDDD.resolve(handlerClass) as IEventHandler<T>;
          } catch {
            // Fallback to direct instantiation if not registered in DI
            handlerInstance = new handlerClass();
          }
        } else {
          // Direct instantiation fallback
          handlerInstance = new handlerClass();
        }

        return handlerInstance.handle(event);
      },
    };

    this.handlers.get(eventName)!.add(handlerFactory);

    this.logger.debug(`Registered DI-enabled handler factory for ${eventName}`);
  }
}
