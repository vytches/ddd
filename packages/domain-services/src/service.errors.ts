import { IDomainError, DomainErrorCode } from '@vytches/ddd-core';

import type { DomainErrorOptions } from '@vytches/ddd-core';

/**
 * @llm-summary ServiceDuplicateError class for service duplicate error operations
 * @llm-domain Pattern
 * @llm-complexity Medium
 *
 * @description
 * ServiceDuplicateError class implementing domain pattern implementation for service duplicate error operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new ServiceDuplicateError();
 * ```
 * *
 * @since 1.0.0
 * @public
 */
export class ServiceDuplicateError extends IDomainError {
  static withServiceId(serviceId: string, data?: DomainErrorOptions): ServiceDuplicateError {
    const message = `Service with id ${serviceId} already exists`;
    const options = {
      code: DomainErrorCode.DuplicateEntry,
      data,
    };
    return new ServiceDuplicateError(message, options);
  }
}

/**
 * @llm-summary ServiceNotFoundError class for service not found error operations
 * @llm-domain Pattern
 * @llm-complexity Medium
 *
 * @description
 * ServiceNotFoundError class implementing domain pattern implementation for service not found error operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new ServiceNotFoundError();
 * ```
 * *
 * @since 1.0.0
 * @public
 */
export class ServiceNotFoundError extends IDomainError {
  static withServiceId(serviceId: string, data?: DomainErrorOptions): ServiceNotFoundError {
    const message = `Service with id ${serviceId} not found`;
    const options = {
      code: DomainErrorCode.NotFound,
      data,
    };
    return new ServiceNotFoundError(message, options);
  }
}

/**
 * @llm-summary ServiceCircularError class for service circular error operations
 * @llm-domain Pattern
 * @llm-complexity Medium
 *
 * @description
 * ServiceCircularError class implementing domain pattern implementation for service circular error operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new ServiceCircularError();
 * ```
 * *
 * @since 1.0.0
 * @public
 */
export class ServiceCircularError extends IDomainError {
  static withServices(services: string[], data?: DomainErrorOptions): ServiceNotFoundError {
    const remaining = Array.from(services).join(', ');
    const message = `Circular dependency detected: ${remaining}`;
    const options = {
      code: DomainErrorCode.Default,
      data,
    };
    return new ServiceCircularError(message, options);
  }
}
