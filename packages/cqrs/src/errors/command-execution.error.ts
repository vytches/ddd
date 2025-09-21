import { BaseError } from '@vytches/ddd-domain-primitives';

export class CommandExecutionError extends BaseError {
  constructor(
    public readonly commandType: string,
    public readonly originalError: Error
  ) {
    super(`Command execution failed: ${commandType} - ${originalError.message}`);
  }
}
