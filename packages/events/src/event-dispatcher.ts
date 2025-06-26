/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { AggregateRoot } from '@vytches-ddd/core';

import type { EventMiddleware, IDomainEvent, IEnhancedEventDispatcher, IEventBus } from '@vytches-ddd/contracts';
import { EventBusRegistry } from './event-bus-registry';
import type { IEventProcessor } from './event-processor';

/**
 * Universal event dispatcher with middleware and processor support
 * Coordinates the dispatching of events across different buses
 */
export class UniversalEventDispatcher implements IEnhancedEventDispatcher {
  private middlewares: EventMiddleware[] = [];
  private processors: IEventProcessor[] = [];
  private registry: EventBusRegistry;

  /**
   * Create a new universal event dispatcher
   */
  constructor() {
    this.registry = new EventBusRegistry();
  }

  /**
   * Register an additional event bus
   */
  registerEventBus<TEvent>(type: string, bus: IEventBus<TEvent>): this {
    this.registry.register(type, bus);
    return this;
  }

  /**
   * Register an event processor
   */
  registerProcessor(processor: IEventProcessor): this {
    this.processors.push(processor);
    return this;
  }

  /**
   * Add middleware to the event pipeline
   */
  use(middleware: EventMiddleware): this {
    this.middlewares.push(middleware);
    return this;
  }

  /**
   * Get the event bus registry
   */
  getRegistry(): EventBusRegistry {
    return this.registry;
  }

  /**
   * Dispatch all events from an aggregate and clear them
   */
  async dispatchEventsForAggregate(
    aggregate: AggregateRoot<any>,
  ): Promise<void> {
    const events = aggregate.getDomainEvents();
    if (events.length === 0) return;

    // Dispatch all events
    await this.dispatchEvents(...events);

    // Clear events from aggregate
    aggregate.commit();
  }

  /**
   * Dispatch a single event
   */
  async dispatchEvent(event: IDomainEvent): Promise<void> {
    // Build and execute the pipeline
    const pipeline = this.buildPipeline();
    await pipeline(event);

    // Process the event through all processors
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
   * Process an event through all registered processors
   */
  private async processEvent(event: IDomainEvent): Promise<void> {
    // Process through all processors
    for (const processor of this.processors) {
      await processor.process(event, this.registry);
    }
  }

  /**
   * Build the middleware pipeline for event processing
   */
  private buildPipeline(): (event: IDomainEvent) => Promise<void> {
    // Base function that publishes to domain event bus
    let pipeline = async (event: IDomainEvent): Promise<void> => {
      const domainBus = this.registry.get<IDomainEvent>('domain');
      if (domainBus) {
        await domainBus.publish(event);
      }
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
}
