/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  EventHandlerFn,
  IEventHandler,
  BaseEventBusOptions,
  EventBusMiddleware,
  IDomainEvent,
} from '@vytches/ddd-contracts';
import { IEventBus, isEventHandler } from '@vytches/ddd-contracts';
import { internalLogger } from '@vytches/ddd-contracts';
import { AggregatedEventHandlerError } from './aggregated-event-handler-error';

/**
 * @internal
 */
export const CUSTOM_MIDDLEWARE_SYMBOL = Symbol('CUSTOM_MIDDLEWARE');

/**
 * Options for {@link BaseEventBus.publishMany}.
 *
 * @public
 * @since 0.26.0
 */
export interface PublishManyOptions {
  /**
   * When `true`, events are published one after another in array order —
   * event N+1 starts only after every handler of event N has completed.
   * Defaults to `false` (parallel `Promise.all`, no cross-event ordering).
   */
  sequential?: boolean;
}

/**
 * Concrete in-process event bus with middleware pipeline and per-event
 * handler caps. Subclasses (e.g. {@link UnifiedEventBus}) extend this with
 * multi-bus routing, integration-event shimming, or persistence hooks.
 *
 * Default behavior:
 *
 * - Synchronous fan-out — all subscribers for an event type run in
 *   parallel via `Promise.all` (use middleware to enforce ordering or
 *   serialization).
 * - Run-all error semantics — a failing handler never prevents the
 *   remaining handlers from running. Failures are collected during
 *   fan-out and surfaced only after all handlers complete: routed to
 *   `options.onError` when configured (publish resolves), otherwise
 *   thrown as a single {@link AggregatedEventHandlerError}.
 * - Hard cap — `MAX_HANDLERS_PER_EVENT = 100` per event name to catch
 *   leaks (forgetting to `unsubscribe`). Override the static in a
 *   subclass for projection-heavy apps.
 * - Pluggable middleware — wrap publish with logging, retry, dedupe,
 *   metrics. Configured via `options.middlewares`.
 *
 * @example Basic in-memory bus
 * ```typescript
 * import { BaseEventBus } from '@vytches/ddd-events';
 *
 * class InMemoryBus extends BaseEventBus {}  // expose protected as needed
 * const bus = new InMemoryBus({ enableLogging: true });
 *
 * bus.subscribe('OrderPaid', async event => {
 *   console.log('paid', event.payload);
 * });
 * await bus.publish({ eventName: 'OrderPaid', payload: { id: 'o-1' } });
 * ```
 *
 * @example With error handler and middleware
 * ```typescript
 * const bus = new UnifiedEventBus({
 *   enableLogging: true,
 *   onError: (err, type) => Sentry.captureException(err, { extra: { type } }),
 *   middlewares: [retryMiddleware(3), metricsMiddleware()],
 * });
 * ```
 *
 * @public
 * @stable
 * @since 0.22.0
 */
export abstract class BaseEventBus<
  TEvent extends IDomainEvent = IDomainEvent,
> extends IEventBus<TEvent> {
  // Typed as `number` (not the literal `100`) so subclasses can override the
  // cap; assertHandlerCapacity resolves it via `this.constructor`.
  static readonly MAX_HANDLERS_PER_EVENT: number = 100;

  /**
   * Map of event types to their handlers
   */
  protected handlers: Map<string, Set<EventHandlerFn<TEvent> | IEventHandler<TEvent>>> = new Map();

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
      ...options,
    };

    this.publishPipeline = this.buildPublishPipeline();
  }

  async publish(event: TEvent): Promise<void> {
    // VP-NEW-001 (2026-05-09): early shortcircuit before middleware pipeline.
    // When no handlers are registered for this event type, skip the entire
    // middleware chain — saves the O(M) cost where M is the number of
    // middlewares (logging, tracing, validation, etc.). Significant for
    // tests + sparse subscription scenarios where many events have no
    // listeners.
    const handlers = this.handlers.get(this.getEventTypeName(event));
    if (!handlers || handlers.size === 0) {
      return;
    }
    await this.publishPipeline(event);
  }

  /**
   * Publish multiple events.
   *
   * **WARNING — no cross-event ordering by default.** Events are published
   * in parallel via `Promise.all`: handlers of `events[1]` may run before
   * handlers of `events[0]` have finished. For an aggregate's event batch
   * where projections depend on order (e.g. `OrderCreated` before
   * `ItemAdded`), pass `{ sequential: true }` to publish events strictly
   * one after another in array order.
   *
   * Error semantics follow {@link BaseEventBus.publish}: each event's
   * handler failures are routed to `onError` or thrown as an
   * {@link AggregatedEventHandlerError}. In sequential mode a throwing
   * event stops the remaining events from being published.
   */
  async publishMany(events: TEvent[], options?: PublishManyOptions): Promise<void> {
    if (events.length === 0) {
      return;
    }

    if (options?.sequential) {
      for (const event of events) {
        await this.publish(event);
      }
      return;
    }

    // Publish all events in parallel for better performance
    await Promise.all(events.map(event => this.publish(event)));
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
        return;
      }

      // Run-all fan-out (UX-C2): a throwing handler never aborts the loop.
      // Sync throws and async rejections are collected and surfaced together
      // after every handler has run.
      const errors: Error[] = [];
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
            promises.push(
              result.catch((error: unknown) => {
                errors.push(error instanceof Error ? error : new Error(String(error)));
              })
            );
          }
        } catch (error) {
          errors.push(error instanceof Error ? error : new Error(String(error)));
        }
      }

      // Wait for all async handlers to complete (rejections already captured)
      if (promises.length > 0) {
        await Promise.all(promises);
      }

      if (errors.length > 0) {
        this.handleErrors(errors, eventName);
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
    eventName: string | (new (...args: unknown[]) => T),
    handler: (event: T) => Promise<void> | void
  ): void {
    const resolvedEventName = this.getEventName(eventName);

    if (!this.handlers.has(resolvedEventName)) {
      this.handlers.set(resolvedEventName, new Set());
    }

    const handlers = this.handlers.get(resolvedEventName)!;
    this.assertHandlerCapacity(handlers.size, resolvedEventName);

    handlers.add(handler as EventHandlerFn<TEvent>);
  }

  /**
   * Register a class-based handler for events of a specific type
   */
  registerHandler<T extends TEvent>(
    eventName: string | (new (...args: unknown[]) => T),
    handler: { handle(event: T): Promise<void> | void }
  ): void {
    const resolvedEventName = this.getEventName(eventName);

    if (!this.handlers.has(resolvedEventName)) {
      this.handlers.set(resolvedEventName, new Set());
    }

    const handlers = this.handlers.get(resolvedEventName)!;
    this.assertHandlerCapacity(handlers.size, resolvedEventName);

    handlers.add(handler as IEventHandler<TEvent>);
  }

  /**
   * Unsubscribe a handler from events of a specific type
   */
  unsubscribe<T extends TEvent>(
    eventName: string | (new (...args: unknown[]) => T),
    handler: ((event: T) => Promise<void> | void) | { handle(event: T): Promise<void> | void }
  ): void {
    const resolvedEventName = this.getEventName(eventName);
    const handlers = this.handlers.get(resolvedEventName);

    if (handlers) {
      handlers.delete(handler as (event: TEvent) => Promise<void> | void);

      // Clean up empty sets
      if (handlers.size === 0) {
        this.handlers.delete(resolvedEventName);
      }
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
   * Enforces the per-event handler cap, resolving the static through
   * `this.constructor` so subclass overrides of `MAX_HANDLERS_PER_EVENT`
   * take effect.
   */
  protected assertHandlerCapacity(currentCount: number, eventName: string): void {
    const max = (this.constructor as typeof BaseEventBus).MAX_HANDLERS_PER_EVENT;
    if (currentCount >= max) {
      throw new Error(`Maximum handlers (${max}) exceeded for event "${eventName}"`);
    }
  }

  /**
   * Surfaces handler failures collected during a completed fan-out.
   *
   * - With `options.onError` configured: each error is routed to the hook
   *   and publish resolves (current contract — the hook owns the errors).
   * - Without: each error is logged and a single
   *   {@link AggregatedEventHandlerError} carrying all failures is thrown.
   */
  protected handleErrors(errors: readonly Error[], eventName: string): void {
    if (this.options.onError) {
      for (const error of errors) {
        this.options.onError(error, eventName);
      }
      return;
    }

    for (const error of errors) {
      internalLogger.error(`BaseEventBus: error processing ${eventName}`, error);
    }
    throw new AggregatedEventHandlerError(eventName, errors);
  }

  /**
   * Extracts the event name from a constructor or string
   */
  protected getEventName<T extends TEvent>(
    eventName: string | (new (...args: unknown[]) => T)
  ): string {
    if (typeof eventName === 'string') {
      return eventName;
    }

    // Try to get eventName from prototype
    const prototype = eventName.prototype;
    if (prototype && 'eventName' in prototype) {
      return prototype.eventName;
    }

    // Fall back to constructor name
    return eventName.name;
  }

  /**
   * Extracts the event type name from an event object
   */
  protected getEventTypeName(event: TEvent): string {
    // First check for eventName property
    if ('eventName' in (event as { eventName?: string })) {
      return (event as { eventName: string }).eventName;
    }

    // Fall back to constructor name
    return (event as { constructor: { name: string } }).constructor.name;
  }

  /**
   * Gets the registered handlers for a specific event type
   * Useful for testing and debugging
   */
  getHandlers(
    eventName: string | (new (...args: unknown[]) => TEvent)
  ): Set<EventHandlerFn<TEvent> | IEventHandler<TEvent>> | undefined {
    const resolvedEventName = this.getEventName(eventName);
    return this.handlers.get(resolvedEventName);
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
