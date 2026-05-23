import { Injectable, Inject, Optional } from '@nestjs/common';
import type { IAggregateWithEvents, IDomainEvent } from '@vytches/ddd-contracts';
import { IEventDispatcher } from '@vytches/ddd-contracts';
import { IEventBus } from '@vytches/ddd-contracts';
import { IntegrationEvent } from '@vytches/ddd-events';
import { Logger } from '@vytches/ddd-logging';
import { LOCAL_EVENT_BUS } from '../constants';

/**
 * NestJS-specific event dispatcher that routes events by base class type:
 *
 * - `IntegrationEvent` → global `IEventBus` (cross-context, outbox-compatible)
 * - Domain events (everything else) → per-context `LOCAL_EVENT_BUS`
 *
 * Provide this in a bounded-context module that imports
 * `VytchesDDDModule.forFeature()`. Both `IEventBus` and `LOCAL_EVENT_BUS` are
 * optional — missing buses are logged as warnings and events are silently dropped
 * rather than throwing, to keep startup resilient.
 *
 * @example Wiring in a repository
 * ```typescript
 * @Module({
 *   imports: [VytchesDDDModule.forFeature('orders')],
 *   providers: [OrderRepository],
 * })
 * export class OrdersModule {}
 *
 * @Injectable()
 * class OrderRepository {
 *   constructor(private readonly dispatcher: ContextAwareEventDispatcher) {}
 *
 *   async save(order: Order): Promise<void> {
 *     await this.db.save(order);
 *     await this.dispatcher.dispatchEventsForAggregate(order);
 *     // DomainEvents  → LOCAL_EVENT_BUS (per-context, sync)
 *     // IntegrationEvents → IEventBus   (global, outbox)
 *   }
 * }
 * ```
 *
 * @public
 * @since 0.28.0
 */
@Injectable()
export class ContextAwareEventDispatcher extends IEventDispatcher {
  private readonly logger = Logger.forContext('ContextAwareEventDispatcher');

  constructor(
    @Optional() @Inject(IEventBus) private readonly integrationBus: IEventBus | undefined,
    @Optional() @Inject(LOCAL_EVENT_BUS) private readonly localBus: IEventBus | undefined
  ) {
    super();
  }

  async dispatchEventsForAggregate(aggregate: IAggregateWithEvents): Promise<void> {
    const events = aggregate.getDomainEvents();
    if (events.length === 0) return;

    try {
      await this.dispatchEvents(...events);
      aggregate.commit();
    } catch (error) {
      this.logger.error(
        'Failed to dispatch aggregate events',
        error instanceof Error ? error : undefined,
        {
          aggregateType: aggregate.constructor.name,
          eventCount: events.length,
          error: error instanceof Error ? error.message : String(error),
        }
      );
      throw error;
    }
  }

  async dispatchEvent(event: IDomainEvent): Promise<void> {
    if (event instanceof IntegrationEvent) {
      if (!this.integrationBus) {
        this.logger.warn('No global IEventBus provided — IntegrationEvent dropped', {
          eventName: event.eventName,
        });
        return;
      }
      await this.integrationBus.publish(event);
    } else {
      if (!this.localBus) {
        this.logger.warn('No LOCAL_EVENT_BUS provided — DomainEvent dropped', {
          eventName: event.eventName,
        });
        return;
      }
      await this.localBus.publish(event);
    }
  }

  async dispatchEvents(...events: IDomainEvent[]): Promise<void> {
    for (const event of events) {
      await this.dispatchEvent(event);
    }
  }
}
