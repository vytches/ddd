import type { IDomainEvent } from './domain-event-interfaces';

/**
 * @llm-summary EventPersistenceHandler class for event persistence handler operations
 * @llm-domain Core
 * @llm-complexity Simple
 *
 * @description
 * EventPersistenceHandler class implementing core domain functionality for event persistence handler operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new IEventPersistenceHandler();
 * ```
 * *
 * @since 1.0.0
 * @public
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
