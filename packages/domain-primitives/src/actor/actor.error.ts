import type { DomainErrorOptions } from '../errors';
import { DomainErrorCode, IDomainError } from '../errors';

/**
 * @llm-summary ActorError class for actor error operations
 * @llm-domain Core
 * @llm-complexity Medium
 *
 * @description
 * ActorError class implementing core domain functionality for actor error operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new ActorError();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new ActorError());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class ActorError extends IDomainError {
  static withType(type: string, data?: DomainErrorOptions): ActorError {
    const message = `Invalid actor type: ${type}`;
    const options = {
      code: DomainErrorCode.InvalidParameter,
      data,
    };
    return new ActorError(message, options);
  }

  static withMessage(message: string, data?: DomainErrorOptions): ActorError {
    const options = {
      code: DomainErrorCode.InvalidParameter,
      data,
    };
    return new ActorError(message, options);
  }
}
