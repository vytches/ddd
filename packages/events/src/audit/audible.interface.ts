/**
 * Interface for components supporting state capture for audit purposes
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
