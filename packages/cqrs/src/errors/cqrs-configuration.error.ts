import { BaseError } from '@vytches/ddd-core';

/**
 * @llm-summary CQRSConfigurationError class for c q r s configuration error operations
 * @llm-domain Architecture
 * @llm-complexity Medium
 *
 * @description
 * CQRSConfigurationError class implementing architectural component for c q r s configuration error operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new CQRSConfigurationError();
 * ```
 * *
 * @since 1.0.0
 * @public
 */
export class CQRSConfigurationError extends BaseError {
  constructor(
    message: string,
    public readonly component: string
  ) {
    super(`CQRS Configuration Error in ${component}: ${message}`);
  }
}
