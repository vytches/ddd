import { BaseError } from '@vytches-ddd/core';

/**
 * @llm-summary HandlerNotFoundError class for handler not found error operations
 * @llm-domain Architecture
 * @llm-complexity Complex
 *
 * @description
 * HandlerNotFoundError class implementing architectural component for handler not found error operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new HandlerNotFoundError();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new HandlerNotFoundError());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class HandlerNotFoundError extends BaseError {
  constructor(
    public readonly handlerType: string,
    public readonly busType: 'command' | 'query'
  ) {
    super(`No ${busType} handler registered for: ${handlerType}`);
  }
}
