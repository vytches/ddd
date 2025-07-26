/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Result } from '@vytches/ddd-utils';

/**
 * @llm-summary Contract for validation error functionality
 * @llm-domain Core
 * @llm-contract Required
 *
 * @description
 * ValidationError interface implementing core domain functionality for validation error operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteValidationError implements IValidationError {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface IValidationError {
  property: string;
  message: string;
  context?: Record<string, unknown> | undefined;
}

/**
 * @llm-summary Contract for validation errors functionality
 * @llm-domain Core
 * @llm-contract Required
 *
 * @description
 * ValidationErrors interface implementing core domain functionality for validation errors operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteValidationErrors implements IValidationErrors {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface IValidationErrors {
  errors: IValidationError[];
  length: number;
}

/**
 * @llm-summary Contract for validator functionality
 * @llm-domain Core
 * @llm-contract Required
 *
 * @description
 * Validator interface implementing core domain functionality for validator operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteValidator implements IValidator {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface IValidator<T> {
  /**
   * Validates a value and returns Result with value or validation errors
   */
  validate(value: T): Result<T, IValidationErrors>;
}

/**
 * @llm-summary Contract for validation rule functionality
 * @llm-domain Core
 * @llm-contract Required
 *
 * @description
 * ValidationRule interface implementing core domain functionality for validation rule operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteValidationRule implements IValidationRule {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface IValidationRule<T> {
  /** Property name or path */
  property: string;

  /** Function validation */
  validate: (value: T) => Result<true, IValidationError>;

  /** Condition for when to apply the rule */
  condition?: (value: T) => boolean;
}
