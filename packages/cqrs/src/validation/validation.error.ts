import { BaseError } from '@vytches/ddd-domain-primitives';

export class CqrsValidationError extends BaseError {
  constructor(
    message: string,
    public readonly field?: string
  ) {
    super(message);
  }
}
