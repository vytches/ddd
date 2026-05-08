/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Result } from '../shared/result';

export interface IValidationError {
  property: string;
  message: string;
  context?: Record<string, unknown> | undefined;
}

export interface IValidationErrors {
  errors: IValidationError[];
  length: number;
}

export interface IValidator<T> {
  /**
   * Validates a value and returns Result with value or validation errors
   */
  validate(value: T): Result<T, IValidationErrors>;
}

export interface IValidationRule<T> {
  /** Property name or path */
  property: string;

  /** Function validation */
  validate: (value: T) => Result<true, IValidationError>;

  /** Condition for when to apply the rule */
  condition?: (value: T) => boolean;
}
