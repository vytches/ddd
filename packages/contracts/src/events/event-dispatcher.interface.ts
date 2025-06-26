import type { IDomainEvent } from './domain-event-interfaces';
import type { IAggregateWithEvents } from '../aggregates';

/**
 * Event middleware function signature
 * Enables creation of processing pipelines for events
 */
export type EventMiddleware = (
  event: IDomainEvent,
  next: (event: IDomainEvent) => Promise<void>,
) => Promise<void>;

/**
 * Interface for event processors
 * Used to handle specialized event processing logic
 */
export interface IEventProcessor {
  /**
   * Process an event
   */
  process(event: IDomainEvent): Promise<void>;

  /**
   * Check if this processor can handle the event
   */
  canProcess(event: IDomainEvent): boolean;
}

/**
 * Abstract class for event dispatchers
 * Responsible for dispatching events to appropriate buses
 * Uses abstract class for DI framework compatibility
 */
export abstract class IEventDispatcher {
  /**
   * Dispatch all events from an aggregate and clear them
   */
  abstract dispatchEventsForAggregate(
    aggregate: IAggregateWithEvents,
  ): Promise<void>;

  /**
   * Dispatch a single event
   */
  abstract dispatchEvent(event: IDomainEvent): Promise<void>;

  /**
   * Dispatch multiple events
   */
  abstract dispatchEvents(...events: IDomainEvent[]): Promise<void>;
}

/**
 * Enhanced event dispatcher with middleware support
 * Uses abstract class for DI framework compatibility
 */
export abstract class IEnhancedEventDispatcher extends IEventDispatcher {
  /**
   * Add middleware to the event pipeline
   */
  abstract use(middleware: EventMiddleware): this;

  /**
   * Register an event processor
   */
  abstract registerProcessor(processor: IEventProcessor): this;
}
