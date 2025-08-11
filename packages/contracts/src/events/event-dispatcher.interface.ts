import type { IAggregateWithEvents } from '../aggregates';
import type { IDomainEvent } from './domain-event-interfaces';

export type EventMiddleware = (
  event: IDomainEvent,
  next: (event: IDomainEvent) => Promise<void>
) => Promise<void>;

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

export abstract class IEventDispatcher {
  /**
   * Dispatch all events from an aggregate and clear them
   */
  abstract dispatchEventsForAggregate(aggregate: IAggregateWithEvents): Promise<void>;

  /**
   * Dispatch a single event
   */
  abstract dispatchEvent(event: IDomainEvent): Promise<void>;

  /**
   * Dispatch multiple events
   */
  abstract dispatchEvents(...events: IDomainEvent[]): Promise<void>;
}

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
