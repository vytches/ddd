import type { IAsyncSpecification } from '@vytches/ddd-contracts';

export abstract class AsyncCompositeSpecification<T> implements IAsyncSpecification<T> {
  /**
   * Check if the candidate satisfies this specification asynchronously
   * @param candidate The entity to evaluate
   * @param context Optional context for evaluation (e.g., user, tenant, environment)
   */
  abstract isSatisfiedByAsync(candidate: T, context?: Record<string, unknown>): Promise<boolean>;

  /**
   * Optional name for debugging/logging
   */
  readonly name?: string | undefined;

  /**
   * Optional description for debugging/logging
   */
  readonly description?: string | undefined;

  /**
   * Combine with another async specification using AND logic
   */
  and(other: IAsyncSpecification<T>): IAsyncSpecification<T> {
    return new AndAsyncSpecification<T>(this, other);
  }

  /**
   * Combine with another async specification using OR logic
   */
  or(other: IAsyncSpecification<T>): IAsyncSpecification<T> {
    return new OrAsyncSpecification<T>(this, other);
  }

  /**
   * Negate this async specification
   */
  not(): IAsyncSpecification<T> {
    return new NotAsyncSpecification<T>(this);
  }

  /**
   * Create a specification from an async predicate function
   */
  static create<T>(
    predicate: (candidate: T, context?: Record<string, unknown>) => Promise<boolean>,
    name?: string,
    description?: string
  ): IAsyncSpecification<T> {
    return new PredicateAsyncSpecification<T>(predicate, name, description);
  }

  /**
   * Optional method to explain why specification failed
   */
  async explainFailureAsync?(
    _candidate: T,
    _context?: Record<string, unknown>
  ): Promise<string | null> {
    return null;
  }
}

/**
 * @since 0.4.2
 */
class PredicateAsyncSpecification<T> extends AsyncCompositeSpecification<T> {
  constructor(
    private readonly predicate: (
      candidate: T,
      context?: Record<string, unknown>
    ) => Promise<boolean>,
    override readonly name?: string | undefined,
    override readonly description?: string | undefined
  ) {
    super();
  }

  async isSatisfiedByAsync(candidate: T, context?: Record<string, unknown>): Promise<boolean> {
    return this.predicate(candidate, context);
  }
}

/**
 * @since 0.4.2
 */
export class AndAsyncSpecification<T> extends AsyncCompositeSpecification<T> {
  override readonly name: string;
  override readonly description: string;

  constructor(
    private readonly left: IAsyncSpecification<T>,
    private readonly right: IAsyncSpecification<T>
  ) {
    super();
    this.name = `(${this.left.name || 'spec'} AND ${this.right.name || 'spec'})`;
    this.description = `Both specifications must be satisfied`;
  }

  async isSatisfiedByAsync(candidate: T, context?: Record<string, unknown>): Promise<boolean> {
    // Execute both specifications in parallel for better performance
    const [leftResult, rightResult] = await Promise.all([
      this.left.isSatisfiedByAsync(candidate, context),
      this.right.isSatisfiedByAsync(candidate, context),
    ]);
    return leftResult && rightResult;
  }

  override async explainFailureAsync(
    candidate: T,
    context?: Record<string, unknown>
  ): Promise<string | null> {
    const [leftResult, rightResult] = await Promise.all([
      this.left.isSatisfiedByAsync(candidate, context),
      this.right.isSatisfiedByAsync(candidate, context),
    ]);

    const failures: string[] = [];

    if (!leftResult && this.left.explainFailureAsync) {
      const leftFailure = await this.left.explainFailureAsync(candidate, context);
      if (leftFailure) failures.push(leftFailure);
    }

    if (!rightResult && this.right.explainFailureAsync) {
      const rightFailure = await this.right.explainFailureAsync(candidate, context);
      if (rightFailure) failures.push(rightFailure);
    }

    return failures.length > 0 ? failures.join(' AND ') : null;
  }
}

/**
 * @since 0.4.2
 */
export class OrAsyncSpecification<T> extends AsyncCompositeSpecification<T> {
  override readonly name: string;
  override readonly description: string;

  constructor(
    private readonly left: IAsyncSpecification<T>,
    private readonly right: IAsyncSpecification<T>
  ) {
    super();
    this.name = `(${this.left.name || 'spec'} OR ${this.right.name || 'spec'})`;
    this.description = `At least one specification must be satisfied`;
  }

  async isSatisfiedByAsync(candidate: T, context?: Record<string, unknown>): Promise<boolean> {
    // Execute both specifications in parallel for better performance
    const [leftResult, rightResult] = await Promise.all([
      this.left.isSatisfiedByAsync(candidate, context),
      this.right.isSatisfiedByAsync(candidate, context),
    ]);
    return leftResult || rightResult;
  }

  override async explainFailureAsync(
    candidate: T,
    context?: Record<string, unknown>
  ): Promise<string | null> {
    const [leftResult, rightResult] = await Promise.all([
      this.left.isSatisfiedByAsync(candidate, context),
      this.right.isSatisfiedByAsync(candidate, context),
    ]);

    // Only explain failure if both specifications fail
    if (!leftResult && !rightResult) {
      const failures: string[] = [];

      if (this.left.explainFailureAsync) {
        const leftFailure = await this.left.explainFailureAsync(candidate, context);
        if (leftFailure) failures.push(leftFailure);
      }

      if (this.right.explainFailureAsync) {
        const rightFailure = await this.right.explainFailureAsync(candidate, context);
        if (rightFailure) failures.push(rightFailure);
      }

      return failures.length > 0 ? `(${failures.join(' OR ')})` : null;
    }

    return null;
  }
}

/**
 * @since 0.4.2
 */
export class NotAsyncSpecification<T> extends AsyncCompositeSpecification<T> {
  override readonly name: string;
  override readonly description: string;

  constructor(private readonly spec: IAsyncSpecification<T>) {
    super();
    this.name = `NOT(${this.spec.name || 'spec'})`;
    this.description = `The specification must NOT be satisfied`;
  }

  async isSatisfiedByAsync(candidate: T, context?: Record<string, unknown>): Promise<boolean> {
    return !(await this.spec.isSatisfiedByAsync(candidate, context));
  }

  override async explainFailureAsync(
    candidate: T,
    context?: Record<string, unknown>
  ): Promise<string | null> {
    const result = await this.spec.isSatisfiedByAsync(candidate, context);

    if (result) {
      // The wrapped specification succeeded, but we expected it to fail
      return `Expected specification to fail: ${this.spec.name || 'specification'}`;
    }

    return null;
  }
}
