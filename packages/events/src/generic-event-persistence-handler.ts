import type { IDomainEvent, IEventPersistenceHandler } from '@vytches-ddd/contracts';

/**
 * @llm-summary GenericEventPersistenceHandler class for generic event persistence handler operations
 * @llm-domain Architecture
 * @llm-complexity Simple
 *
 * @description
 * GenericEventPersistenceHandler class implementing architectural component for generic event persistence handler operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new GenericEventPersistenceHandler();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new GenericEventPersistenceHandler());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
// TODO: dorobić testy
// TODO: zaktualizować HOW-TO
// TODO: zogbaczyć co można tutaj zrobić i czy jakoś się pozbyć tego mechanizmu

export abstract class GenericEventPersistenceHandler implements IEventPersistenceHandler {
  private handlers = new Map<string, (payload: unknown) => Promise<number>>();

  /**
   * Register handler for specific event type
   */
  protected registerHandler<T = unknown>(
    eventType: string,
    handler: (payload: T) => Promise<number>
  ): void {
    this.handlers.set(eventType, handler as (payload: unknown) => Promise<number>);
  }

  /**
   * Handle event persistence
   */
  async handleEvent(event: IDomainEvent): Promise<number> {
    const handler = this.handlers.get(event.eventType);

    if (!handler) {
      throw new Error(
        `No handler registered for event type ${event.eventType} in ${this.constructor.name}`
      );
    }

    return await handler(event.payload);
  }

  /**
   * Get current version of an aggregate
   */
  abstract getCurrentVersion(aggregateId: string | number): Promise<number | undefined>;
}
