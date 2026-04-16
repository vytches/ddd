import type { IDomainEvent } from './domain-event-interfaces';

/**
 * Abstract base class for handling event persistence (e.g., writing events to a store).
 * @public
 * @stable
 * @since 0.22.0
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
  abstract getCurrentVersion(aggregateId: unknown): Promise<number | undefined>;
}
