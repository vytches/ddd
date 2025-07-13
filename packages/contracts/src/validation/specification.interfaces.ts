/**
 * Specification pattern interface
 * Defines a business rule that can be evaluated against a candidate
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
  readonly name?: string;

  /**
   * Optional description for debugging/logging
   */
  readonly description?: string;

  /**
   * Optional method to explain why specification failed
   */
  explainFailure?(candidate: T): string | null;
}

/**
 * Asynchronous specification pattern interface
 * Defines a business rule that can be evaluated against a candidate asynchronously
 * Used for specifications that require external services, database calls, or I/O operations
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
  readonly name?: string;

  /**
   * Optional description for debugging/logging
   */
  readonly description?: string;

  /**
   * Optional method to explain why specification failed
   */
  explainFailureAsync?(candidate: T, context?: Record<string, unknown>): Promise<string | null>;
}
