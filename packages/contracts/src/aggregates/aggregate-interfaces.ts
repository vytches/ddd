import type { IExtendedDomainEvent } from '../events';

/**
 * Interface for objects that can produce domain events
 */
export interface IAggregateWithEvents {
  /**
   * Get all uncommitted domain events from this aggregate
   */
  getDomainEvents(): ReadonlyArray<IExtendedDomainEvent>;

  /**
   * Clear all uncommitted domain events from this aggregate
   */
  commit(): void;

  /**
   * Check if this aggregate has uncommitted changes
   */
  hasChanges(): boolean;
}
