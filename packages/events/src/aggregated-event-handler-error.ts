/**
 * Error thrown by the event buses when one or more handlers fail during
 * fan-out and no `onError` hook is configured.
 *
 * Both {@link BaseEventBus} and {@link UnifiedEventBus} share one error
 * semantics: **every** handler registered for an event runs to completion,
 * failures are collected, and only after the full fan-out finishes are they
 * surfaced — either routed to `options.onError` (when configured) or thrown
 * as a single `AggregatedEventHandlerError` carrying all individual failures.
 *
 * @example Inspecting individual handler failures
 * ```typescript
 * try {
 *   await bus.publish(event);
 * } catch (error) {
 *   if (error instanceof AggregatedEventHandlerError) {
 *     for (const failure of error.errors) {
 *       logger.error('handler failed', failure);
 *     }
 *   }
 * }
 * ```
 *
 * @public
 * @since 0.26.0
 */
export class AggregatedEventHandlerError extends Error {
  /**
   * The individual handler failures, in fan-out completion order.
   */
  readonly errors: readonly Error[];

  /**
   * Name of the event whose fan-out produced the failures.
   */
  readonly eventName: string;

  constructor(eventName: string, errors: readonly Error[]) {
    super(
      `${errors.length} event handler(s) failed for "${eventName}": ${errors
        .map(error => error.message)
        .join('; ')}`
    );
    this.name = 'AggregatedEventHandlerError';
    this.eventName = eventName;
    this.errors = errors;
  }
}
