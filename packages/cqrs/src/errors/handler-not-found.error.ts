import { BaseError } from '@vytches/ddd-core';

export class HandlerNotFoundError extends BaseError {
  constructor(
    public readonly handlerType: string,
    public readonly busType: 'command' | 'query'
  ) {
    super(`No ${busType} handler registered for: ${handlerType}`);
  }
}
