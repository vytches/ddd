/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type {
  EventMiddleware,
  IDomainEvent,
  IEventProcessor,
  IAggregateWithEvents,
} from '@vytches-ddd/contracts';
import { IEnhancedEventDispatcher } from '@vytches-ddd/contracts';
import { UnifiedEventBus } from './unified-event-bus';
import { Logger } from '@vytches-ddd/logging';

/**
 * Universal Event Dispatcher - Repository-compatible implementation
 *
 * Integrates with IBaseRepository to provide complete event publishing pipeline:
 * - Middleware support for cross-cutting concerns
 * - Event processors for specialized handling
 * - Automatic aggregate commit after successful dispatch
 * - Integration with UnifiedEventBus for actual event routing
 */
export class UniversalEventDispatcher extends IEnhancedEventDispatcher {
  private middlewares: EventMiddleware[] = [];
  private processors: IEventProcessor[] = [];
  private unifiedBus: UnifiedEventBus;

  /**
   * Create a new universal event dispatcher
   * @param unifiedBus Optional unified event bus instance (creates new if not provided)
   */
  constructor(unifiedBus?: UnifiedEventBus) {
    super();
    this.unifiedBus = unifiedBus || new UnifiedEventBus();
  }

  /**
   * Add middleware to the event processing pipeline
   * Middleware runs before events are published to the UnifiedEventBus
   */
  use(middleware: EventMiddleware): this {
    this.middlewares.push(middleware);
    return this;
  }

  /**
   * Register an event processor for specialized event handling
   * Processors run after events are published but before aggregate commit
   */
  registerProcessor(processor: IEventProcessor): this {
    this.processors.push(processor);
    return this;
  }

  /**
   * Dispatch all events from an aggregate and clear them
   * This is the main method used by IBaseRepository.save()
   */
  async dispatchEventsForAggregate(aggregate: IAggregateWithEvents): Promise<void> {
    const events = aggregate.getDomainEvents();
    if (events.length === 0) return;

    const logger = Logger.forContext('UniversalEventDispatcher');

    // Try to get aggregate ID if available (for repository aggregates)
    const aggregateWithId = aggregate as { getId?: () => { getValue(): string | number } };
    const aggregateId = aggregateWithId.getId ? aggregateWithId.getId()?.getValue() : 'unknown';

    logger.debug('Dispatching events for aggregate', {
      aggregateId,
      aggregateType: aggregate.constructor.name,
      eventCount: events.length,
      eventTypes: events.map(e => e.eventType),
    });

    try {
      // Dispatch all events through the pipeline
      await this.dispatchEvents(...events);

      // Clear events from aggregate after successful dispatch
      aggregate.commit();

      logger.debug('Aggregate events dispatched and committed', {
        aggregateId,
        eventCount: events.length,
      });
    } catch (error) {
      logger.error(
        'Failed to dispatch aggregate events',
        error instanceof Error ? error : undefined,
        {
          aggregateId,
          aggregateType: aggregate.constructor.name,
          eventCount: events.length,
          errorMessage: error instanceof Error ? error.message : String(error),
        }
      );
      throw error;
    }
  }

  /**
   * Dispatch a single event through middleware pipeline
   */
  async dispatchEvent(event: IDomainEvent): Promise<void> {
    const pipeline = this.buildPipeline();
    await pipeline(event);
    await this.processEvent(event);
  }

  /**
   * Dispatch multiple events
   */
  async dispatchEvents(...events: IDomainEvent[]): Promise<void> {
    for (const event of events) {
      await this.dispatchEvent(event);
    }
  }

  /**
   * Get direct access to UnifiedEventBus for advanced scenarios
   */
  getUnifiedEventBus(): UnifiedEventBus {
    return this.unifiedBus;
  }

  /**
   * Replace the unified event bus (useful for testing)
   */
  setUnifiedEventBus(bus: UnifiedEventBus): void {
    this.unifiedBus = bus;
  }

  /**
   * Build the middleware pipeline for event processing
   */
  private buildPipeline(): (event: IDomainEvent) => Promise<void> {
    // Base function that publishes to UnifiedEventBus
    let pipeline = async (event: IDomainEvent): Promise<void> => {
      await this.unifiedBus.publish(event);
    };

    // Apply middleware in reverse order (last added, first executed)
    for (let i = this.middlewares.length - 1; i >= 0; i--) {
      const middleware = this.middlewares[i]!;
      const nextPipeline = pipeline;
      pipeline = async (event: IDomainEvent): Promise<void> => {
        await middleware(event, nextPipeline);
      };
    }

    return pipeline;
  }

  /**
   * Process an event through all registered processors
   */
  private async processEvent(event: IDomainEvent): Promise<void> {
    for (const processor of this.processors) {
      if (processor.canProcess(event)) {
        await processor.process(event);
      }
    }
  }
}
