import { IDomainError, DomainErrorCode, DomainErrorOptions } from '../core';

export class ActorError extends IDomainError {
  static withType(type: string, data?: DomainErrorOptions): ActorError {
    const message = `Invalid actor type: ${type}`;
    const options = {
      code: DomainErrorCode.InvalidParameter,
      data,
    };
    return new ActorError(message, options);
  }

  static withMessage(message: string, data?: DomainErrorOptions): ActorError {
    const options = {
      code: DomainErrorCode.InvalidParameter,
      data,
    };
    return new ActorError(message, options);
  }
}
