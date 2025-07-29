import { BaseError } from '@vytches/ddd-core';

/**
 * @llm-summary QueryExecutionError class for query execution error operations
 * @llm-domain Architecture
 * @llm-complexity Medium
 *
 * @description
 * QueryExecutionError class implementing architectural component for query execution error operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new QueryExecutionError();
 * ```
 * *
 * @since 1.0.0
 * @public
 */
export class QueryExecutionError extends BaseError {
  constructor(
    public readonly queryType: string,
    public readonly originalError: Error
  ) {
    super(`Query execution failed: ${queryType} - ${originalError.message}`);
    this.originalError = originalError;
  }
}
