import type { IDomainEvent } from '../events';

export interface IAggregateWithEvents {
  /**
   * Get all uncommitted domain events from this aggregate
   */
  getDomainEvents(): ReadonlyArray<IDomainEvent>;

  /**
   * Clear all uncommitted domain events from this aggregate
   */
  commit(): void;

  /**
   * Check if this aggregate has uncommitted changes
   */
  hasChanges(): boolean;
}
