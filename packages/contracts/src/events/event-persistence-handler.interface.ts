import type { IDomainEvent } from './domain-event-interfaces';

export abstract class IEventPersistenceHandler {
  /**
   * Handle event persistence
   * @returns new version number after handling the event
   */
  abstract handleEvent(event: IDomainEvent): Promise<number>;

  /**
   * Get current version of an aggregate
   */
  abstract getCurrentVersion(aggregateId: unknown): Promise<number | undefined>;
}
