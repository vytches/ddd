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
