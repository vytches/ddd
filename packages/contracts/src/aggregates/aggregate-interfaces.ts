import type { IExtendedDomainEvent } from '../events';

/**
 * @llm-summary Contract for aggregate with events functionality
 * @llm-domain Core
 * @llm-contract Required
 *
 * @description
 * AggregateWithEvents interface implementing core domain functionality for aggregate with events operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteAggregateWithEvents implements IAggregateWithEvents {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
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
