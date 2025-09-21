import { BaseError } from '@vytches/ddd-domain-primitives';

export class HandlerNotFoundError extends BaseError {
  constructor(
    public readonly handlerType: string,
    public readonly busType: 'command' | 'query'
  ) {
    super(`No ${busType} handler registered for: ${handlerType}`);
  }
}
