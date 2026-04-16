import type { IDomainEvent, IEventPersistenceHandler } from '@vytches/ddd-contracts';

/**
 * Abstract base class for event persistence handlers.
 *
 * Provides a registry-based approach for handling event persistence,
 * where specific handlers can be registered for each event type.
 *
 * @example
 * ```typescript
 * class OrderEventPersistenceHandler extends GenericEventPersistenceHandler {
 *   constructor(private repository: OrderRepository) {
 *     super();
 *     this.registerHandler('OrderCreated', (payload) => this.handleOrderCreated(payload));
 *     this.registerHandler('OrderUpdated', (payload) => this.handleOrderUpdated(payload));
 *   }
 *
 *   private async handleOrderCreated(payload: OrderCreatedPayload): Promise<number> {
 *     await this.repository.create(payload);
 *     return 1;
 *   }
 *
 *   async getCurrentVersion(aggregateId: string): Promise<number | undefined> {
 *     return await this.repository.getVersion(aggregateId);
 *   }
 * }
 * ```
 * @public
 * @stable
 * @since 0.22.0
 */
export abstract class GenericEventPersistenceHandler implements IEventPersistenceHandler {
  private handlers = new Map<string, (payload: unknown) => Promise<number>>();

  /**
   * Register handler for specific event type
   */
  protected registerHandler<T = unknown>(
    eventName: string,
    handler: (payload: T) => Promise<number>
  ): void {
    this.handlers.set(eventName, handler as (payload: unknown) => Promise<number>);
  }

  /**
   * Handle event persistence
   */
  async handleEvent(event: IDomainEvent): Promise<number> {
    const handler = this.handlers.get(event.eventName);

    if (!handler) {
      throw new Error(
        `No handler registered for event type ${event.eventName} in ${this.constructor.name}`
      );
    }

    return await handler(event.payload);
  }

  /**
   * Get current version of an aggregate
   */
  abstract getCurrentVersion(aggregateId: string | number): Promise<number | undefined>;
}
