import { IDomainError } from '@vytches-ddd/core';
import { Result } from '@vytches-ddd/utils';
import type { BusinessRuleValidator, ValidationErrors } from '@vytches-ddd/validation';

export interface IApplicationService {
  readonly serviceName: string;
}

export abstract class BaseApplicationService implements IApplicationService {
  constructor(public readonly serviceName: string) {}

  protected validateRequest<T>(
    request: T,
    validator: BusinessRuleValidator<T>,
  ): Result<void, Array<{ field: string; message: string }>> {
    const validationResult = validator.validate(request);

    if (validationResult.isFailure) {
      // Convert ValidationErrors to array format expected by tests
      const errorArray = validationResult.error.errors.map(error => ({
        field: error.property,
        message: error.message
      }));
      return Result.fail(errorArray);
    }

    return Result.ok();
  }

  protected handleDomainError(error: unknown): ApplicationError {
    const errorMessage = this.extractErrorMessage(error);
    return new ApplicationError(
      `Domain operation failed: ${errorMessage}`,
      error,
    );
  }

  private extractErrorMessage(error: unknown): string {
    if (error == null) {
      return String(error); // Will return 'null' or 'undefined'
    }
    
    if (typeof error === 'string') {
      return error;
    }
    
    if (error && typeof error === 'object' && 'message' in error && typeof (error as { message: unknown }).message === 'string') {
      return (error as { message: string }).message;
    }
    
    return String(error);
  }
}

export class ApplicationError extends IDomainError {
  constructor(
    message: string,
    public readonly innerError?: unknown,
  ) {
    super(message, { 
      data: { innerError },
      error: innerError instanceof Error ? innerError : undefined 
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
