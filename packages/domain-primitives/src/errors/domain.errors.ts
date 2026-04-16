import { LibUtils } from '@vytches/ddd-utils';

import type { ErrorOptions } from './base.error';
import { BaseError } from './base.error';
import { DomainErrorCode } from './error.enum';

/**
 * Flexible error code type that accepts both enum values and string literals
 */
export type ErrorCode = DomainErrorCode | string;

export type DomainErrorOptions = ErrorOptions & {
  domain?: string | object | undefined;
  code?: ErrorCode;
  data?: unknown;
  error?: Error | undefined;
};

export abstract class IDomainError extends BaseError implements DomainErrorOptions {
  domain?: string | object | undefined;

  code: ErrorCode = DomainErrorCode.Default;

  data?: unknown;

  timestamp?: Date;

  error?: Error;

  [key: string]: unknown;

  constructor(message: string, options: DomainErrorOptions | Error = {}) {
    super(message);

    if (options instanceof Error) {
      this.error = options;
    } else if (LibUtils.isNotEmpty(options)) {
      if ('code' in options || 'domain' in options || 'error' in options || 'data' in options) {
        // Handle DomainErrorOptions
        this.domain = options?.domain;
        // Accept both string and enum codes
        this.code = options?.code != null ? options?.code : DomainErrorCode.Default;
        this.data = options?.data ?? {};
        this.error = options?.error ?? new Error('__Default error__');
      } else {
        // Handle case where options is just data without recognized fields
        this.data = options;
        this.code = DomainErrorCode.Default;
        this.error = new Error('__Default error__');
      }
    }

    this.timestamp = IDomainError.generateTimestamp();
  }

  private static generateTimestamp(): Date {
    return new Date();
  }
}

export class MissingValueError extends IDomainError {
  static withValue(msg: string, data?: DomainErrorOptions): MissingValueError {
    const message = msg ?? 'Missing value';
    const options = {
      code: DomainErrorCode.MissingValue,
      data,
    };
    return new MissingValueError(message, options);
  }
}

export class InvalidParameterError extends IDomainError {
  static withParameter(
    parameter: string,
    msg?: string,
    data?: DomainErrorOptions
  ): InvalidParameterError {
    const message = msg ?? `Invalid ${parameter}`;
    const options: DomainErrorOptions = {
      code: DomainErrorCode.InvalidParameter,
      data,
    };

    return new InvalidParameterError(message, options);
  }
}

export class DuplicateError extends IDomainError {
  static withEntityId(id: string, data?: DomainErrorOptions): DuplicateError {
    const message = `Entity with id ${id} already exists`;
    const options = {
      code: DomainErrorCode.DuplicateEntry,
      data,
    };
    return new DuplicateError(message, options);
  }
}

export class NotFoundError extends IDomainError {
  static withEntityId(id: string, data?: DomainErrorOptions): NotFoundError {
    const message = `Entity with id ${id} not found`;
    const options = {
      code: DomainErrorCode.NotFound,
      data,
    };
    return new NotFoundError(message, options);
  }
}
