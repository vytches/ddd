import { BaseEventBus } from './base-event-bus';
import type { IEventBus, BaseEventBusOptions } from '@vytches-ddd/contracts';
import type { IDomainEvent } from '@vytches-ddd/contracts';
import type { IAuditEvent } from '@vytches-ddd/contracts';
import type { IIntegrationEvent } from './integration/integration-event-interfaces';
import { Logger } from '@vytches-ddd/logging';
import 'reflect-metadata';

/**
 * Constructor type for class references
 */
type Constructor<T = object> = new (...args: any[]) => T;

/**
 * Base event type for internal use
 */
type BaseEvent = IDomainEvent | IIntegrationEvent | IAuditEvent;

/**
 * Event with metadata (for events that might have contextId)
 */
type EventWithMetadata = BaseEvent & {
  metadata?: {
    contextId?: string;
    [key: string]: unknown;
  };
};

/**
 * DI handler info interface
 */
interface DIHandlerInfo {
  handler: Constructor<{ handle(event: BaseEvent): Promise<void> | void }>;
  [key: string]: unknown;
}

/**
 * Event handler function type
 */
export type UnifiedEventHandler<T extends BaseEvent = BaseEvent> = (
  event: T
) => Promise<void> | void;

/**
 * Handler registry entry with context filtering
 */
interface HandlerEntry {
  handler: UnifiedEventHandler<BaseEvent>;
  contexts?: string | string[] | undefined;
}

/**
 * Unified Event Bus - Single implementation for all event types
 *
 * Consolidates domain, integration, and audit event buses into one
 * implementation with context-aware routing and subscriptions.
 *
 * Features:
 * - Auto-routing based on event type
 * - Context-aware subscriptions
 * - Flexible subscription patterns (single context, multiple contexts, all contexts)
 * - Full DI integration with auto-discovery
 * - Backward compatibility with existing event bus interface
 */
export class UnifiedEventBus extends BaseEventBus<BaseEvent> implements IEventBus<BaseEvent> {
  private readonly handlerRegistry = new Map<string, HandlerEntry[]>();

  constructor(options?: BaseEventBusOptions) {
    super(options);
    const logger = Logger.forContext('UnifiedEventBus');
    logger.info('UnifiedEventBus initialized', {
      enableLogging: options?.enableLogging ?? true,
      middlewareCount: options?.middlewares?.length ?? 0,
    });

    // Auto-register discovered handlers on initialization
    this.autoRegisterHandlers();
  }

  /**
   * Auto-register handlers discovered through decorators
   */
  private autoRegisterHandlers(): void {
    try {
      // Try to integrate with DI system if available
      if (typeof globalThis !== 'undefined' && (globalThis as Record<string, unknown>).VytchesDDD) {
        const VytchesDDD = (globalThis as Record<string, unknown>).VytchesDDD as {
          discoverHandlers?: () => DIHandlerInfo[];
          resolve?: (handler: Constructor<{ handle(event: BaseEvent): Promise<void> | void }>) => {
            handle(event: BaseEvent): Promise<void> | void;
          };
        };

        // Check if discoverHandlers method exists
        if (typeof VytchesDDD.discoverHandlers === 'function') {
          const handlers = VytchesDDD.discoverHandlers();

          for (const handlerInfo of handlers) {
            this.registerDiscoveredHandler(handlerInfo);
          }

          const logger = Logger.forContext('UnifiedEventBus');
          logger.info('Auto-registered DI handlers', {
            handlerCount: handlers.length,
          });
        }
      }
    } catch (error) {
      const logger = Logger.forContext('UnifiedEventBus');
      logger.debug('DI auto-registration not available', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Register a handler discovered through DI system
   */
  private registerDiscoveredHandler(handlerInfo: DIHandlerInfo): void {
    try {
      const eventType = Reflect.getMetadata('event:type', handlerInfo.handler);
      const eventContext = Reflect.getMetadata('event:context', handlerInfo.handler);

      if (!eventType) {
        const logger = Logger.forContext('UnifiedEventBus');
        logger.warn('Handler without event type metadata', {
          handlerName: handlerInfo.handler.name,
        });
        return;
      }

      // Create DI-aware handler factory
      const handlerFactory: UnifiedEventHandler = async event => {
        try {
          // Resolve handler instance from DI
          const handlerInstance = (
            (globalThis as Record<string, unknown>).VytchesDDD as {
              resolve: (
                handler: Constructor<{ handle(event: BaseEvent): Promise<void> | void }>
              ) => { handle(event: BaseEvent): Promise<void> | void };
            }
          ).resolve(handlerInfo.handler);

          if (handlerInstance && typeof handlerInstance.handle === 'function') {
            await handlerInstance.handle(event);
          } else {
            const logger = Logger.forContext('UnifiedEventBus');
            logger.error('Invalid handler instance', undefined, {
              handlerName: handlerInfo.handler.name,
              hasHandleMethod: !!(handlerInstance && typeof handlerInstance.handle === 'function'),
            });
          }
        } catch (error) {
          const logger = Logger.forContext('UnifiedEventBus');
          logger.error('Handler execution failed', error instanceof Error ? error : undefined, {
            handlerName: handlerInfo.handler.name,
            errorMessage: error instanceof Error ? error.message : String(error),
          });
          throw error;
        }
      };

      // Register with context awareness
      this.registerHandlerWithContext(eventType.name, handlerFactory, eventContext);

      const logger = Logger.forContext('UnifiedEventBus');
      logger.debug('Registered DI handler', {
        eventType: eventType.name,
        handlerName: handlerInfo.handler.name,
        context: eventContext,
      });
    } catch (error) {
      const logger = Logger.forContext('UnifiedEventBus');
      logger.error(
        'Failed to register discovered handler',
        error instanceof Error ? error : undefined,
        {
          handlerName: handlerInfo.handler?.name || 'unknown',
          errorMessage: error instanceof Error ? error.message : String(error),
        }
      );
    }
  }

  /**
   * Publish an event with automatic routing to appropriate handlers
   */
  override async publish(event: IDomainEvent | IIntegrationEvent | IAuditEvent): Promise<void> {
    const logger = Logger.forContext('UnifiedEventBus');
    logger.debug('Publishing event', {
      eventType: event.eventType,
      contextId: (event as EventWithMetadata).metadata?.contextId,
      hasPayload: !!(event as { payload?: unknown }).payload,
    });

    // Get context-aware handlers
    const handlers = this.getHandlersForEvent(event);

    // Execute handlers using our custom execution logic
    await this.executeHandlers(event, handlers);
  }

  /**
   * Convenience method to publish all events from an aggregate and clear them
   * Simplifies the common pattern of dispatching aggregate events
   */
  async publishEventsForAggregate(aggregate: {
    getDomainEvents(): IDomainEvent[];
    commit(): void;
  }): Promise<void> {
    const events = aggregate.getDomainEvents();
    if (events.length === 0) return;

    const logger = Logger.forContext('UnifiedEventBus');
    logger.debug('Publishing aggregate events', {
      eventCount: events.length,
      aggregateType: aggregate.constructor.name,
    });

    // Use publishMany for optimized batch processing
    await this.publishMany(events);

    // Clear events from aggregate after successful publishing
    aggregate.commit();

    logger.debug('Aggregate events published and cleared', {
      eventCount: events.length,
      aggregateType: aggregate.constructor.name,
    });
  }

  /**
   * Subscribe to events with flexible context filtering
   *
   * @param eventType - Event constructor or string
   * @param handlerOrContext - Handler function, context string, or context array
   * @param handler - Handler function (when second param is context)
   */
  override subscribe<T extends IDomainEvent | IIntegrationEvent | IAuditEvent>(
    eventType: string | Constructor<T>,
    handlerOrContext?: UnifiedEventHandler<T> | string | string[],
    handler?: UnifiedEventHandler<T>
  ): void {
    const eventTypeName = typeof eventType === 'string' ? eventType : eventType.name;

    // Determine handler and context from overloaded parameters
    let actualHandler: UnifiedEventHandler<T>;
    let contexts: string | string[] | undefined;

    if (typeof handlerOrContext === 'function') {
      // subscribe(eventType, handler) - all contexts
      actualHandler = handlerOrContext;
      contexts = undefined;
    } else {
      // subscribe(eventType, context(s), handler)
      if (!handler) {
        throw new Error('Handler is required when context is specified');
      }
      actualHandler = handler;
      contexts = handlerOrContext;
    }

    // Register handler with context filtering
    this.registerHandlerWithContext(
      eventTypeName,
      actualHandler as UnifiedEventHandler<BaseEvent>,
      contexts
    );

    const logger = Logger.forContext('UnifiedEventBus');
    logger.debug('Subscribed to event', {
      eventType: eventTypeName,
      contexts,
      handlerName: actualHandler.name || 'anonymous',
    });
  }

  /**
   * Subscribe to events for specific context(s)
   */
  subscribeToContext<T extends IDomainEvent | IIntegrationEvent | IAuditEvent>(
    contextId: string | string[] | undefined,
    eventType: string | Constructor<T>,
    handler: UnifiedEventHandler<T>
  ): void {
    const eventTypeName = typeof eventType === 'string' ? eventType : eventType.name;
    this.registerHandlerWithContext(
      eventTypeName,
      handler as UnifiedEventHandler<BaseEvent>,
      contextId
    );

    const logger = Logger.forContext('UnifiedEventBus');
    logger.debug('Subscribed with context filter', {
      eventType: eventTypeName,
      contexts: contextId,
      handlerName: handler.name || 'anonymous',
    });
  }

  /**
   * Register a class-based handler
   */
  override registerHandler<T extends IDomainEvent | IIntegrationEvent | IAuditEvent>(
    eventType: string | Constructor<T>,
    handler: { handle(event: T): Promise<void> | void }
  ): void {
    const eventTypeName = typeof eventType === 'string' ? eventType : eventType.name;
    const handlerFunction: UnifiedEventHandler<BaseEvent> = event => handler.handle(event as T);

    this.registerHandlerWithContext(eventTypeName, handlerFunction, undefined);

    const logger = Logger.forContext('UnifiedEventBus');
    logger.debug('Registered class-based handler', {
      eventType: eventTypeName,
      handlerClass: handler.constructor.name,
    });
  }

  /**
   * Unsubscribe from events
   */
  override unsubscribe(
    eventType: string | Constructor<BaseEvent>,
    handler: UnifiedEventHandler<BaseEvent> | { handle(event: BaseEvent): Promise<void> | void }
  ): void {
    const eventTypeName = typeof eventType === 'string' ? eventType : eventType.name;
    const handlers = this.handlerRegistry.get(eventTypeName);

    if (!handlers) {
      return;
    }

    let targetHandler: UnifiedEventHandler<BaseEvent>;

    if (typeof handler === 'function') {
      targetHandler = handler;
    } else {
      // For class-based handlers, find by the original handler reference
      // We need to find the wrapper function that calls handler.handle()
      const index = handlers.findIndex(entry => {
        // Check if this entry's handler is a wrapper for the class handler
        return entry.handler.toString().includes('handler.handle(event)');
      });

      if (index !== -1) {
        handlers.splice(index, 1);
        const logger = Logger.forContext('UnifiedEventBus');
        logger.debug('Unsubscribed class-based handler from event', {
          eventType: eventTypeName,
          remainingHandlers: handlers.length,
        });
      }
      return;
    }

    const index = handlers.findIndex(entry => entry.handler === targetHandler);
    if (index !== -1) {
      handlers.splice(index, 1);
      const logger = Logger.forContext('UnifiedEventBus');
      logger.debug('Unsubscribed from event', {
        eventType: eventTypeName,
        remainingHandlers: handlers.length,
      });
    }
  }

  /**
   * Publish multiple events
   */
  override async publishMany(
    events: Array<IDomainEvent | IIntegrationEvent | IAuditEvent>
  ): Promise<void> {
    if (events.length === 0) return;

    const logger = Logger.forContext('UnifiedEventBus');
    logger.debug('Publishing multiple events', {
      eventCount: events.length,
      eventTypes: events.map(e => e.eventType),
    });

    // Process all events concurrently for better performance
    await Promise.all(events.map(event => this.publish(event)));

    logger.debug('Batch publishing completed', {
      eventCount: events.length,
    });
  }

  /**
   * Get handlers for a specific event with context filtering
   */
  protected getHandlersForEvent(event: BaseEvent): UnifiedEventHandler<BaseEvent>[] {
    const handlers = this.handlerRegistry.get(event.eventType) || [];
    const eventContext = (event as EventWithMetadata).metadata?.contextId;

    return handlers
      .filter(entry => this.shouldHandleEvent(entry, eventContext))
      .map(entry => entry.handler);
  }

  /**
   * Register handler with context filtering
   */
  private registerHandlerWithContext(
    eventType: string,
    handler: UnifiedEventHandler<BaseEvent>,
    contexts?: string | string[]
  ): void {
    const handlers = this.handlerRegistry.get(eventType) || [];
    handlers.push({ handler, contexts });
    this.handlerRegistry.set(eventType, handlers);
  }

  /**
   * Check if handler should receive event based on context filtering
   */
  private shouldHandleEvent(entry: HandlerEntry, eventContext?: string): boolean {
    // No context filter = handle all events
    if (entry.contexts === undefined) {
      return true;
    }

    // No event context but handler has context filter = don't handle
    if (!eventContext) {
      return false;
    }

    // Single context string
    if (typeof entry.contexts === 'string') {
      return entry.contexts === eventContext;
    }

    // Multiple contexts array
    if (Array.isArray(entry.contexts)) {
      return entry.contexts.includes(eventContext);
    }

    return false;
  }

  /**
   * Execute handlers for an event (overrides base class)
   */
  protected async executeHandlers(
    event: BaseEvent,
    handlers: UnifiedEventHandler<BaseEvent>[]
  ): Promise<void> {
    if (handlers.length === 0) {
      const logger = Logger.forContext('UnifiedEventBus');
      logger.debug('No handlers found for event', {
        eventType: event.eventType,
        contextId: (event as EventWithMetadata).metadata?.contextId,
      });
      return;
    }

    const logger = Logger.forContext('UnifiedEventBus');
    logger.debug('Executing handlers', {
      eventType: event.eventType,
      handlerCount: handlers.length,
      contextId: (event as EventWithMetadata).metadata?.contextId,
    });

    // Apply middleware if available
    const executeWithMiddleware = this.buildMiddlewarePipeline(handlers);

    let hasErrors = false;
    const errors: Error[] = [];

    // Execute all handlers concurrently
    const promises = handlers.map(async handler => {
      try {
        await executeWithMiddleware(event, handler);
      } catch (error) {
        hasErrors = true;
        const errorObj = error instanceof Error ? error : new Error(String(error));
        errors.push(errorObj);

        const logger = Logger.forContext('UnifiedEventBus');
        logger.error('Handler execution failed', errorObj, {
          eventType: event.eventType,
          handlerName: handler.name || 'anonymous',
        });

        // Call error handler if available
        if (this.options?.onError) {
          this.options.onError(errorObj, event.eventType);
        }
      }
    });

    await Promise.all(promises);

    // Always throw first error if any occurred (even if onError handler exists)
    // The onError handler is for logging/notification, not for swallowing errors
    if (hasErrors && errors.length > 0) {
      throw errors[0];
    }
  }

  /**
   * Build middleware pipeline for handler execution
   */
  private buildMiddlewarePipeline(
    _handlers: UnifiedEventHandler<BaseEvent>[]
  ): (event: BaseEvent, handler: UnifiedEventHandler<BaseEvent>) => Promise<void> {
    const middlewares = this.options?.middlewares || [];

    if (middlewares.length === 0) {
      return async (event: BaseEvent, handler: UnifiedEventHandler<BaseEvent>) => {
        await handler(event);
      };
    }

    return async (event: BaseEvent, handler: UnifiedEventHandler<BaseEvent>) => {
      const executeHandler = async (evt: BaseEvent) => {
        await handler(evt);
      };

      // Build middleware chain from right to left
      let pipeline = executeHandler;
      for (let i = middlewares.length - 1; i >= 0; i--) {
        const middleware = middlewares[i];
        if (middleware) {
          const next = pipeline;
          pipeline = middleware(next);
        }
      }

      await pipeline(event);
    };
  }
}
