import { BaseError } from '@vytches-ddd/core';

/**
 * @llm-summary CqrsValidationError class for cqrs validation error operations
 * @llm-domain Architecture
 * @llm-complexity Medium
 *
 * @description
 * CqrsValidationError class implementing architectural component for cqrs validation error operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new CqrsValidationError();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new CqrsValidationError());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class CqrsValidationError extends BaseError {
  constructor(
    message: string,
    public readonly field?: string
  ) {
    super(message);
  }
}
