import { BaseError } from '@vytches/ddd-core';

/**
 * @llm-summary CommandExecutionError class for command execution error operations
 * @llm-domain Architecture
 * @llm-complexity Medium
 *
 * @description
 * CommandExecutionError class implementing architectural component for command execution error operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new CommandExecutionError();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new CommandExecutionError());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class CommandExecutionError extends BaseError {
  constructor(
    public readonly commandType: string,
    public readonly originalError: Error
  ) {
    super(`Command execution failed: ${commandType} - ${originalError.message}`);
  }
}
