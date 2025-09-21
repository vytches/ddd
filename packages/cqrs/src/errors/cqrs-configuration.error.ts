import { BaseError } from '@vytches/ddd-domain-primitives';

export class CQRSConfigurationError extends BaseError {
  constructor(
    message: string,
    public readonly component: string
  ) {
    super(`CQRS Configuration Error in ${component}: ${message}`);
  }
}
