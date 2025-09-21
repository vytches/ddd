import type { DomainErrorOptions } from '@vytches/ddd-domain-primitives';
import { DomainErrorCode, IDomainError } from '@vytches/ddd-domain-primitives';

export class ServiceDuplicateError extends IDomainError {
  static withServiceId(serviceId: string, data?: DomainErrorOptions): ServiceDuplicateError {
    const message = `Service with id ${serviceId} already exists`;
    const options = {
      code: DomainErrorCode.DuplicateEntry,
      data,
    };
    return new ServiceDuplicateError(message, options);
  }
}

export class ServiceNotFoundError extends IDomainError {
  static withServiceId(serviceId: string, data?: DomainErrorOptions): ServiceNotFoundError {
    const message = `Service with id ${serviceId} not found`;
    const options = {
      code: DomainErrorCode.NotFound,
      data,
    };
    return new ServiceNotFoundError(message, options);
  }
}

export class ServiceCircularError extends IDomainError {
  static withServices(services: string[], data?: DomainErrorOptions): ServiceNotFoundError {
    const remaining = Array.from(services).join(', ');
    const message = `Circular dependency detected: ${remaining}`;
    const options = {
      code: DomainErrorCode.Default,
      data,
    };
    return new ServiceCircularError(message, options);
  }
}
