import { IDomainError } from '@vytches/ddd-core';
import { Result } from '@vytches/ddd-utils';
import type { BusinessRuleValidator } from '@vytches/ddd-validation';

/**
 * @llm-summary Contract for application service functionality
 * @llm-domain Integration
 * @llm-contract Required
 *
 * @description
 * ApplicationService interface implementing integration layer component for application service operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteApplicationService implements IApplicationService {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface IApplicationService {
  readonly serviceName: string;
}

/**
 * @llm-summary BaseApplicationService class for base application service operations
 * @llm-domain Integration
 * @llm-complexity Medium
 *
 * @description
 * BaseApplicationService class implementing integration layer component for base application service operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new BaseApplicationService();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new BaseApplicationService());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export abstract class BaseApplicationService implements IApplicationService {
  constructor(public readonly serviceName: string) {}

  protected validateRequest<T>(
    request: T,
    validator: BusinessRuleValidator<T>
  ): Result<void, Array<{ field: string; message: string }>> {
    const validationResult = validator.validate(request);

    if (validationResult.isFailure) {
      // Convert ValidationErrors to array format expected by tests
      const errorArray = validationResult.error.errors.map(error => ({
        field: error.property,
        message: error.message,
      }));
      return Result.fail(errorArray);
    }

    return Result.ok();
  }

  protected handleDomainError(error: unknown): ApplicationError {
    const errorMessage = this.extractErrorMessage(error);
    return new ApplicationError(`Domain operation failed: ${errorMessage}`, error);
  }

  private extractErrorMessage(error: unknown): string {
    if (error == null) {
      return String(error); // Will return 'null' or 'undefined'
    }

    if (typeof error === 'string') {
      return error;
    }

    if (
      error &&
      typeof error === 'object' &&
      'message' in error &&
      typeof (error as { message: unknown }).message === 'string'
    ) {
      return (error as { message: string }).message;
    }

    return String(error);
  }
}

/**
 * @llm-summary ApplicationError class for application error operations
 * @llm-domain Integration
 * @llm-complexity Medium
 *
 * @description
 * ApplicationError class implementing integration layer component for application error operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new ApplicationError();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new ApplicationError());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class ApplicationError extends IDomainError {
  constructor(
    message: string,
    public readonly innerError?: unknown
  ) {
    super(message, {
      data: { innerError },
      error: innerError instanceof Error ? innerError : undefined,
    });

    // Set the error name to match what IDomainError expects
    this.name = 'IDomainError';

    // Ensure data is properly set with innerError
    if (!this.data) {
      this.data = {};
    }
    (this.data as Record<string, unknown>).innerError = innerError;
  }
}
