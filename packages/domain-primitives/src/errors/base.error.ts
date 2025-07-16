/**
 * @llm-summary BaseError class for base error operations
 * @llm-domain Core
 * @llm-complexity Medium
 *
 * @description
 * BaseError class implementing core domain functionality for base error operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new BaseError();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new BaseError());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export abstract class BaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * @llm-summary Contract for error options functionality
 * @llm-domain Core
 * @llm-contract Required
 *
 * @description
 * ErrorOptions interface implementing core domain functionality for error options operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteErrorOptions implements ErrorOptions {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface ErrorOptions {
  [key: string]: unknown;
}
