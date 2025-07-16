import type { ISpecification } from '@vytches-ddd/contracts';

/**
 * @llm-summary CompositeSpecification class for composite specification operations
 * @llm-domain Pattern
 * @llm-complexity Medium
 *
 * @description
 * CompositeSpecification class implementing domain pattern implementation for composite specification operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new CompositeSpecification();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new CompositeSpecification());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export abstract class CompositeSpecification<T> implements ISpecification<T> {
  abstract isSatisfiedBy(candidate: T): boolean;

  and(other: ISpecification<T>): ISpecification<T> {
    return new AndSpecification<T>(this, other);
  }

  or(other: ISpecification<T>): ISpecification<T> {
    return new OrSpecification<T>(this, other);
  }

  not(): ISpecification<T> {
    return new NotSpecification<T>(this);
  }

  static create<T>(predicate: (candidate: T) => boolean): ISpecification<T> {
    return new PredicateSpecification<T>(predicate);
  }
}

class PredicateSpecification<T> extends CompositeSpecification<T> {
  constructor(private readonly predicate: (candidate: T) => boolean) {
    super();
  }

  isSatisfiedBy(candidate: T): boolean {
    return this.predicate(candidate);
  }
}

/**
 * @llm-summary AndSpecification class for and specification operations
 * @llm-domain Pattern
 * @llm-complexity Medium
 *
 * @description
 * AndSpecification class implementing domain pattern implementation for and specification operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new AndSpecification();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new AndSpecification());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class AndSpecification<T> extends CompositeSpecification<T> {
  constructor(
    private readonly left: ISpecification<T>,
    private readonly right: ISpecification<T>
  ) {
    super();
  }

  isSatisfiedBy(candidate: T): boolean {
    return this.left.isSatisfiedBy(candidate) && this.right.isSatisfiedBy(candidate);
  }
}

/**
 * @llm-summary OrSpecification class for or specification operations
 * @llm-domain Pattern
 * @llm-complexity Medium
 *
 * @description
 * OrSpecification class implementing domain pattern implementation for or specification operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new OrSpecification();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new OrSpecification());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class OrSpecification<T> extends CompositeSpecification<T> {
  constructor(
    private readonly left: ISpecification<T>,
    private readonly right: ISpecification<T>
  ) {
    super();
  }

  isSatisfiedBy(candidate: T): boolean {
    return this.left.isSatisfiedBy(candidate) || this.right.isSatisfiedBy(candidate);
  }
}

/**
 * @llm-summary NotSpecification class for not specification operations
 * @llm-domain Pattern
 * @llm-complexity Medium
 *
 * @description
 * NotSpecification class implementing domain pattern implementation for not specification operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new NotSpecification();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new NotSpecification());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class NotSpecification<T> extends CompositeSpecification<T> {
  constructor(private readonly spec: ISpecification<T>) {
    super();
  }

  isSatisfiedBy(candidate: T): boolean {
    return !this.spec.isSatisfiedBy(candidate);
  }
}
