import { BaseError } from '@vytches-ddd/core';

export class CqrsValidationError extends BaseError {
  constructor(
    message: string,
    public readonly field?: string
  ) {
    super(message);
  }
}
