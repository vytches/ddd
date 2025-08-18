import { BaseError } from '@vytches/ddd-domain-primitives';

export class ProcessManagerSecurityError extends BaseError {
  public readonly code: string;

  constructor(message: string, code = 'PROCESS_MANAGER_SECURITY_ERROR') {
    super(message);
    this.name = 'ProcessManagerSecurityError';
    this.code = code;
  }
}
