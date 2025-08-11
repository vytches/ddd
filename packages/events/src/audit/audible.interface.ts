/**
 * Interface for objects that can maintain audit state snapshots.
 * Used by audit decorators for automatic state change tracking.
 *
 * @since 1.0.0
 * @public
 */
export interface IAuditable {
  /**
   * Saves current state as a snapshot
   * Used internally by @captureState decorator
   */
  saveSnapshot(): void;

  /**
   * Gets previous state captured by saveSnapshot
   * Returns null if no snapshot exists
   */
  getPreviousState(): any | null;
}
