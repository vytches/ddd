/**
 * @description
 * Specification interface implementing core domain functionality for specification operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteSpecification implements ISpecification {
 *   // Implementation
 * }
 * ```
 */
export interface ISpecification<T> {
  /**
   * Check if the candidate satisfies this specification
   */
  isSatisfiedBy(candidate: T): boolean;

  /**
   * Combine with another specification using AND logic
   */
  and(other: ISpecification<T>): ISpecification<T>;

  /**
   * Combine with another specification using OR logic
   */
  or(other: ISpecification<T>): ISpecification<T>;

  /**
   * Negate this specification
   */
  not(): ISpecification<T>;

  /**
   * Optional name for debugging/logging
   */
  readonly name?: string | undefined;

  /**
   * Optional description for debugging/logging
   */
  readonly description?: string | undefined;

  /**
   * Optional method to explain why specification failed
   */
  explainFailure?(candidate: T): string | null;
}

/**
 * @description
 * AsyncSpecification interface implementing core domain functionality for async specification operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteAsyncSpecification implements IAsyncSpecification {
 *   // Implementation
 * }
 * ```
 */
export interface IAsyncSpecification<T> {
  /**
   * Check if the candidate satisfies this specification asynchronously
   * @param candidate The entity to evaluate
   * @param context Optional context for evaluation (e.g., user, tenant, environment)
   */
  isSatisfiedByAsync(candidate: T, context?: Record<string, unknown>): Promise<boolean>;

  /**
   * Combine with another async specification using AND logic
   */
  and(other: IAsyncSpecification<T>): IAsyncSpecification<T>;

  /**
   * Combine with another async specification using OR logic
   */
  or(other: IAsyncSpecification<T>): IAsyncSpecification<T>;

  /**
   * Negate this async specification
   */
  not(): IAsyncSpecification<T>;

  /**
   * Optional name for debugging/logging
   */
  readonly name?: string | undefined;

  /**
   * Optional description for debugging/logging
   */
  readonly description?: string | undefined;

  /**
   * Optional method to explain why specification failed
   */
  explainFailureAsync?(candidate: T, context?: Record<string, unknown>): Promise<string | null>;
}
