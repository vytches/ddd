import { DomainErrorCode, IDomainError } from '@vytches/ddd-core';

/**
 * @llm-summary ProjectionError class for projection error operations
 * @llm-domain Architecture
 * @llm-complexity Expert
 *
 * @description
 * ProjectionError class implementing architectural component for projection error operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new ProjectionError();
 * ```
 * *
 * @since 1.0.0
 * @public
 */
export class ProjectionError extends IDomainError {
  static processingFailed(
    projectionName: string,
    eventType: string,
    originalError: Error
  ): ProjectionError {
    const message = `Failed to process event ${eventType} in projection ${projectionName}`;
    return new ProjectionError(message, {
      code: DomainErrorCode.InvalidFormat,
      data: { projectionName, eventType, originalError: originalError.message },
    });
  }

  static stateNotFound(projectionName: string): ProjectionError {
    const message = `No state found for projection ${projectionName}`;
    return new ProjectionError(message, {
      code: DomainErrorCode.NotFound,
      data: { projectionName },
    });
  }

  static capabilityNotAttached(capabilityName: string): ProjectionError {
    const message = `Capability '${capabilityName}' not attached to engine`;
    return new ProjectionError(message, {
      code: DomainErrorCode.InvalidState,
      data: { capabilityName },
    });
  }

  static invalidConfiguration(parameter: string, reason: string): ProjectionError {
    const message = `Invalid configuration for '${parameter}': ${reason}`;
    return new ProjectionError(message, {
      code: DomainErrorCode.InvalidParameter,
      data: { parameter, reason },
    });
  }
}
