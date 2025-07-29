import type { IValidationError, IValidationErrors } from '@vytches/ddd-contracts';

/**
 * @llm-summary ValidationError class for validation error operations
 * @llm-domain Pattern
 * @llm-complexity Medium
 *
 * @description
 * ValidationError class implementing domain pattern implementation for validation error operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new ValidationError();
 * ```
 * *
 * @since 1.0.0
 * @public
 */
export class ValidationError implements IValidationError {
  constructor(
    public readonly property: string,
    public readonly message: string,
    public readonly context?: Record<string, unknown>
  ) {}

  toString(): string {
    return `${this.property}: ${this.message}`;
  }
}

/**
 * @llm-summary ValidationErrors class for validation errors operations
 * @llm-domain Pattern
 * @llm-complexity Medium
 *
 * @description
 * ValidationErrors class implementing domain pattern implementation for validation errors operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new ValidationErrors();
 * ```
 * *
 * @since 1.0.0
 * @public
 */
export class ValidationErrors extends Error implements IValidationErrors {
  public readonly errors: IValidationError[];

  constructor(errors: ValidationError[]) {
    super(
      `Validation failed with ${errors.length} error(s): ${errors.map(e => e.toString()).join('; ')}`
    );
    this.name = 'ValidationErrors';
    this.errors = errors;
  }

  get length(): number {
    return this.errors.length;
  }
}
