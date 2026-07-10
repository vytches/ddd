// F-C3 (VB-002): type-only import for reflect-metadata's ambient
// Reflect.getMetadata typings — no runtime side effect (see README).
import type {} from 'reflect-metadata';
import { BaseEventBus } from './base-event-bus';
import type { IEventBus, BaseEventBusOptions } from '@vytches/ddd-contracts';
import type { IDomainEvent } from '@vytches/ddd-contracts';
import type { IAuditEvent } from '@vytches/ddd-contracts';
import type { IIntegrationEvent } from './integration/integration-event-interfaces';
import { internalLogger } from '@vytches/ddd-contracts';

/**
 * Constructor type for class references
 */
type Constructor<T = object> = new (...args: any[]) => T;

/**
 * Base event type for internal use
 * Since both IAuditEvent and IIntegrationEvent extend IDomainEvent,
 * we can use IDomainEvent as the base type
 */
type BaseEvent = IDomainEvent;

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
 * @public
 * @stable
 * @since 0.22.0
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
 * Production event bus for systems that mix domain, integration, and audit
 * events under one publishing surface. Extends {@link BaseEventBus} with:
 *
 * - **Bounded context filtering** — register handlers scoped to one or
 *   more `contextId`s; events from other contexts are ignored. Lets a
 *   single shared bus carry traffic from many contexts without each
 *   handler defensively checking origin.
 * - **Decorator auto-discovery** — on construction, scans the global
 *   `VytchesDDD` registry for `@EventHandler`-decorated classes and wires
 *   them in. Plays nicely with `@vytches/ddd-di` and `EventDiscoveryPlugin`.
 * - **Heterogeneous event types** — handles `IDomainEvent`, `IAuditEvent`,
 *   and `IIntegrationEvent` through a common `BaseEvent` discriminator.
 *
 * Use this when you want one bus for the whole app. For tighter isolation
 * (per-context bus), construct multiple `BaseEventBus` instances instead.
 *
 * @example Basic usage with logging
 * ```typescript
 * import { UnifiedEventBus } from '@vytches/ddd-events';
 *
 * const bus = new UnifiedEventBus({ enableLogging: true });
 * bus.subscribe('OrderCreated', async event => {
 *   await analytics.track('order_created', event.payload);
 * });
 * await bus.publish({
 *   eventName: 'OrderCreated',
 *   payload: { id: 'o-1' },
 *   metadata: { contextId: 'sales' },
 * });
 * ```
 *
 * @example NestJS provider
 * ```typescript
 * @Module({
 *   providers: [
 *     {
 *       provide: IEventBus,
 *       useFactory: () => new UnifiedEventBus({ enableLogging: true }),
 *     },
 *   ],
 *   exports: [IEventBus],
 * })
 * class EventsModule {}
 * ```
 *
 * @public
 * @stable
 * @since 0.22.0
 */
export class UnifiedEventBus extends BaseEventBus<BaseEvent> implements IEventBus<BaseEvent> {
  private readonly handlerRegistry = new Map<string, HandlerEntry[]>();

  /**
   * Identity mapping for class-based handlers (UX-C8): original handler
   * object → (event name → wrapper function). Lets `unsubscribe` remove
   * exactly the requested handler instead of matching wrappers textually.
   */
  private readonly classHandlerWrappers = new Map<
    object,
    Map<string, UnifiedEventHandler<BaseEvent>>
  >();

  constructor(options?: BaseEventBusOptions) {
    super(options);
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
        }
      }
    } catch {
      // DI auto-registration not available — silent, not an error
    }
  }

  /**
   * Register a handler discovered through DI system
   */
  private registerDiscoveredHandler(handlerInfo: DIHandlerInfo): void {
    try {
      const eventName = Reflect.getMetadata('event:type', handlerInfo.handler);
      const eventContext = Reflect.getMetadata('event:context', handlerInfo.handler);

      if (!eventName) {
        internalLogger.warn('UnifiedEventBus: handler without event type metadata', {
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
            internalLogger.error('UnifiedEventBus: invalid handler instance', undefined, {
              handlerName: handlerInfo.handler.name,
              hasHandleMethod: !!(handlerInstance && typeof handlerInstance.handle === 'function'),
            });
          }
        } catch (error) {
          internalLogger.error(
            'UnifiedEventBus: handler execution failed',
            error instanceof Error ? error : undefined,
            {
              handlerName: handlerInfo.handler.name,
              errorMessage: error instanceof Error ? error.message : String(error),
            }
          );
          throw error;
        }
      };

      // Register with context awareness
      this.registerHandlerWithContext(eventName.name, handlerFactory, eventContext);
    } catch (error) {
      internalLogger.error(
        'UnifiedEventBus: failed to register discovered handler',
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
  override async publish(event: BaseEvent): Promise<void> {
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

    // Use publishMany for optimized batch processing
    await this.publishMany(events);

    // Clear events from aggregate after successful publishing
    aggregate.commit();
  }

  /**
   * Subscribe to events with flexible context filtering
   *
   * @param eventName - Event constructor or string
   * @param handlerOrContext - Handler function, context string, or context array
   * @param handler - Handler function (when second param is context)
   */
  override subscribe<T extends BaseEvent>(
    eventName: string | Constructor<T>,
    handlerOrContext?: UnifiedEventHandler<T> | string | string[],
    handler?: UnifiedEventHandler<T>
  ): void {
    const eventNameName = typeof eventName === 'string' ? eventName : eventName.name;

    // Determine handler and context from overloaded parameters
    let actualHandler: UnifiedEventHandler<T>;
    let contexts: string | string[] | undefined;

    if (typeof handlerOrContext === 'function') {
      // subscribe(eventName, handler) - all contexts
      actualHandler = handlerOrContext;
      contexts = undefined;
    } else {
      // subscribe(eventName, context(s), handler)
      if (!handler) {
        throw new Error('Handler is required when context is specified');
      }
      actualHandler = handler;
      contexts = handlerOrContext;
    }

    // Register handler with context filtering
    this.registerHandlerWithContext(
      eventNameName,
      actualHandler as UnifiedEventHandler<BaseEvent>,
      contexts
    );
  }

  /**
   * Subscribe to events for specific context(s)
   */
  subscribeToContext<T extends BaseEvent>(
    contextId: string | string[] | undefined,
    eventName: string | Constructor<T>,
    handler: UnifiedEventHandler<T>
  ): void {
    const eventNameName = typeof eventName === 'string' ? eventName : eventName.name;
    this.registerHandlerWithContext(
      eventNameName,
      handler as UnifiedEventHandler<BaseEvent>,
      contextId
    );
  }

  /**
   * Register a class-based handler
   */
  override registerHandler<T extends BaseEvent>(
    eventName: string | Constructor<T>,
    handler: { handle(event: T): Promise<void> | void }
  ): void {
    const eventNameName = typeof eventName === 'string' ? eventName : eventName.name;
    const handlerFunction: UnifiedEventHandler<BaseEvent> = event => handler.handle(event as T);

    // Track wrapper by identity so unsubscribe(eventName, handler) can
    // remove exactly this registration (UX-C8).
    const wrappersByEvent =
      this.classHandlerWrappers.get(handler) ?? new Map<string, UnifiedEventHandler<BaseEvent>>();
    wrappersByEvent.set(eventNameName, handlerFunction);
    this.classHandlerWrappers.set(handler, wrappersByEvent);

    this.registerHandlerWithContext(eventNameName, handlerFunction, undefined);
  }

  /**
   * Unsubscribe from events. Class-based handlers are removed by identity —
   * the exact wrapper created for this handler at registration time is
   * looked up in an identity map, so two textually identical class handlers
   * on the same event never collide (UX-C8).
   */
  override unsubscribe(
    eventName: string | Constructor<BaseEvent>,
    handler: UnifiedEventHandler<BaseEvent> | { handle(event: BaseEvent): Promise<void> | void }
  ): void {
    const eventNameName = typeof eventName === 'string' ? eventName : eventName.name;
    const handlers = this.handlerRegistry.get(eventNameName);

    if (!handlers) {
      return;
    }

    let targetHandler: UnifiedEventHandler<BaseEvent> | undefined;

    if (typeof handler === 'function') {
      targetHandler = handler;
    } else {
      // Class-based handler: resolve its wrapper via the identity map
      const wrappersByEvent = this.classHandlerWrappers.get(handler);
      targetHandler = wrappersByEvent?.get(eventNameName);

      if (wrappersByEvent) {
        wrappersByEvent.delete(eventNameName);
        if (wrappersByEvent.size === 0) {
          this.classHandlerWrappers.delete(handler);
        }
      }
    }

    if (!targetHandler) {
      return;
    }

    const index = handlers.findIndex(entry => entry.handler === targetHandler);
    if (index === -1) {
      return;
    }

    const remaining = [...handlers.slice(0, index), ...handlers.slice(index + 1)];
    if (remaining.length === 0) {
      // Clean up empty keys (parity with BaseEventBus.unsubscribe)
      this.handlerRegistry.delete(eventNameName);
    } else {
      this.handlerRegistry.set(eventNameName, remaining);
    }
  }

  // publishMany is inherited from BaseEventBus: parallel Promise.all by
  // default (no cross-event ordering), opt-in `{ sequential: true }` for
  // strict array-order processing. It dispatches through this.publish, so
  // context filtering and unified error semantics apply per event.

  /**
   * Get handlers for a specific event with context filtering
   */
  protected getHandlersForEvent(event: BaseEvent): UnifiedEventHandler<BaseEvent>[] {
    const eventContext = (event as EventWithMetadata).metadata?.contextId;

    // Look up handlers by domain event name (e.g., "user.registered")
    const handlersByName = this.handlerRegistry.get(event.eventName) || [];

    // Also look up by class name (e.g., "UserRegisteredEvent") for backward compatibility
    // registerHandler(EventClass, handler) stores under Constructor.name
    const className = event.constructor?.name;
    const handlersByClass =
      className && className !== event.eventName ? this.handlerRegistry.get(className) || [] : [];

    // Combine entries, avoiding duplicates
    const allEntries = [...handlersByName];
    for (const entry of handlersByClass) {
      if (!allEntries.includes(entry)) {
        allEntries.push(entry);
      }
    }

    return allEntries
      .filter(entry => this.shouldHandleEvent(entry, eventContext))
      .map(entry => entry.handler);
  }

  /**
   * Register handler with context filtering. Single funnel for all
   * registration paths (`subscribe`, `subscribeToContext`,
   * `registerHandler`, decorator auto-discovery) — enforces
   * `MAX_HANDLERS_PER_EVENT` here so no path can bypass the cap (UX-C9).
   */
  private registerHandlerWithContext(
    eventName: string,
    handler: UnifiedEventHandler<BaseEvent>,
    contexts?: string | string[]
  ): void {
    const handlers = this.handlerRegistry.get(eventName) || [];
    this.assertHandlerCapacity(handlers.length, eventName);
    this.handlerRegistry.set(eventName, [...handlers, { handler, contexts }]);
  }

  /**
   * Gets the registered handlers for a specific event type. Operates on
   * this bus's own registry (not the inherited `BaseEventBus` store, which
   * `UnifiedEventBus` does not use). Returns a snapshot `Set` of the
   * registered handler functions; class-based handlers appear as their
   * wrapper functions. Useful for testing and debugging.
   */
  override getHandlers(
    eventName: string | Constructor<BaseEvent>
  ): Set<UnifiedEventHandler<BaseEvent>> | undefined {
    const eventNameName = typeof eventName === 'string' ? eventName : eventName.name;
    const entries = this.handlerRegistry.get(eventNameName);
    if (!entries || entries.length === 0) {
      return undefined;
    }
    return new Set(entries.map(entry => entry.handler));
  }

  /**
   * Gets all event types with at least one registered handler. Operates on
   * this bus's own registry.
   */
  override getRegisteredEventTypes(): string[] {
    return Array.from(this.handlerRegistry.keys());
  }

  /**
   * Clears all registered handlers (including context-scoped ones and the
   * class-handler identity map). Useful for testing.
   */
  override clearHandlers(): void {
    super.clearHandlers();
    this.handlerRegistry.clear();
    this.classHandlerWrappers.clear();
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
   * Execute handlers for an event (overrides base class).
   *
   * Shares the unified run-all error semantics with {@link BaseEventBus}
   * (UX-C2): every handler runs to completion, failures are collected, and
   * only after the full fan-out are they surfaced via
   * {@link BaseEventBus.handleErrors} — routed to `options.onError` when
   * configured (publish resolves), otherwise thrown as a single
   * {@link AggregatedEventHandlerError}.
   */
  protected async executeHandlers(
    event: BaseEvent,
    handlers: UnifiedEventHandler<BaseEvent>[]
  ): Promise<void> {
    if (handlers.length === 0) {
      return;
    }

    // Apply middleware if available
    const executeWithMiddleware = this.buildMiddlewarePipeline(handlers);

    const errors: Error[] = [];

    // Execute all handlers concurrently
    const promises = handlers.map(async handler => {
      try {
        await executeWithMiddleware(event, handler);
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error(String(error));
        errors.push(errorObj);

        internalLogger.error('UnifiedEventBus: handler execution failed', errorObj, {
          eventName: event.eventName,
          handlerName: handler.name || 'anonymous',
        });
      }
    });

    await Promise.all(promises);

    if (errors.length > 0) {
      this.handleErrors(errors, event.eventName);
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
          pipeline = middleware(next as (event: unknown) => Promise<void>) as (
            event: BaseEvent
          ) => Promise<void>;
        }
      }

      await pipeline(event);
    };
  }
}
