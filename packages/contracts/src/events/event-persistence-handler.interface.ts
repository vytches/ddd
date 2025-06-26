import type { IDomainEvent } from './domain-event-interfaces';

/**
 * Abstract class for event persistence handlers
 * Uses abstract class for DI framework compatibility
 */
export abstract class IEventPersistenceHandler {
  /**
   * Handle event persistence
   * @returns new version number after handling the event
   */
  abstract handleEvent(event: IDomainEvent): Promise<number>;

  /**
   * Get current version of an aggregate
   */
  abstract getCurrentVersion(aggregateId: any): Promise<number | undefined>;
}
