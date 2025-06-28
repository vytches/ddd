/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Result } from '@vytches-ddd/utils';

/**
 * Validation error for a specific property
 */
export interface IValidationError {
  property: string;
  message: string;
  context?: Record<string, any> | undefined;
}

/**
 * Collection of validation errors
 */
export interface IValidationErrors {
  errors: IValidationError[];
  length: number;
}

/**
 * Interface for validators
 * Generic validator that can validate any type T
 */
export interface IValidator<T> {
  /**
   * Validates a value and returns Result with value or validation errors
   */
  validate(value: T): Result<T, IValidationErrors>;
}

/**
 * Validation rule interface
 * Defines a single validation rule that can be applied to a value
 */
export interface IValidationRule<T> {
  /** Property name or path */
  property: string;

  /** Function validation */
  validate: (value: T) => Result<true, IValidationError>;

  /** Condition for when to apply the rule */
  condition?: (value: T) => boolean;
}
