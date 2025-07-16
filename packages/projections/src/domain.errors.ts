import type { DomainErrorOptions } from '@vytches-ddd/core';
import { DomainErrorCode, IDomainError } from '@vytches-ddd/core';

/**
 * @llm-summary VersionError class for version error operations
 * @llm-domain Architecture
 * @llm-complexity Medium
 *
 * @description
 * VersionError class implementing architectural component for version error operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new VersionError();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new VersionError());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class VersionError extends IDomainError {
  static withEntityIdAndVersions(
    id: unknown,
    dbVersion: unknown,
    newVersion: unknown,
    data?: DomainErrorOptions
  ): VersionError {
    const message = `Version mismatch for entity with id ${id}: expected [${dbVersion}], got [${newVersion}]`;
    const options = {
      code: DomainErrorCode.ValidationFailed,
      data,
    };
    return new VersionError(message, options);
  }
}
