/**
 * @llm-summary Contract for auditable functionality
 * @llm-domain Architecture
 * @llm-contract Required
 *
 * @description
 * Auditable interface implementing architectural component for auditable operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteAuditable implements IAuditable {
 *   // Implementation
 * }
 * ```
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
