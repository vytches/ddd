/* eslint-disable @typescript-eslint/no-explicit-any */
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
  ): Result<void, ValidationErrors> {
    const validationResult = validator.validate(request);

    if (validationResult.isFailure) {
      return Result.fail(validationResult.error);
    }

    return Result.ok();
  }

  protected handleDomainError(error: any): ApplicationError {
    const errorMessage = this.extractErrorMessage(error);
    return new ApplicationError(
      `Domain operation failed: ${errorMessage}`,
      error,
    );
  }

  private extractErrorMessage(error: any): string {
    if (error == null) {
      return String(error); // Will return 'null' or 'undefined'
    }
    
    if (typeof error === 'string') {
      return error;
    }
    
    if (error && typeof error.message === 'string') {
      return error.message;
    }
    
    return String(error);
  }
}

export class ApplicationError extends IDomainError {
  constructor(
    message: string,
    public readonly innerError?: any,
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
    (this.data as any).innerError = innerError;
  }
}
