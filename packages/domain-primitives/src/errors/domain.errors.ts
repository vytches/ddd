import { LibUtils } from '@vytches/ddd-utils';

import type { ErrorOptions } from './base.error';
import { BaseError } from './base.error';
import { DomainErrorCode } from './error.enum';

/**
 * @llm-summary Type definition for domain error options
 * @llm-domain Core
 * @llm-usage Frequent
 *
 * @description
 * DomainErrorOptions type implementing core domain functionality for domain error options operations.
 *
 * @example
 * ```typescript
 * // Usage example
 * const value: DomainErrorOptions = {} as DomainErrorOptions;
 * ```
 *
 * @since 1.0.0
 * @public
 */
export type DomainErrorOptions = ErrorOptions & {
  domain?: string | object | undefined;
  code?: DomainErrorCode;
  data?: unknown;
  error?: Error | undefined;
};

/**
 * @llm-summary DomainError class for domain error operations
 * @llm-domain Core
 * @llm-complexity Medium
 *
 * @description
 * DomainError class implementing core domain functionality for domain error operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new IDomainError();
 * ```
 * *
 * @since 1.0.0
 * @public
 */
export abstract class IDomainError extends BaseError implements DomainErrorOptions {
  domain?: string | object | undefined;

  code: DomainErrorCode = DomainErrorCode.Default;

  data?: unknown;

  timestamp?: Date;

  error?: Error;

  [key: string]: unknown;

  constructor(message: string, options: DomainErrorOptions | Error = {}) {
    super(message);

    if (options instanceof Error) {
      this.error = options;
    } else if (LibUtils.isNotEmpty(options)) {
      if ('code' in options) {
        this.domain = options?.domain;
        this.code = options?.code != null ? options?.code : DomainErrorCode.Default;
        this.data = options?.data ?? {};
        this.error = options?.error ?? new Error('__Defautl error__');
      } else {
        // Handle case where options is just data without code
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

/**
 * @llm-summary MissingValueError class for missing value error operations
 * @llm-domain Core
 * @llm-complexity Simple
 *
 * @description
 * MissingValueError class implementing core domain functionality for missing value error operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new MissingValueError();
 * ```
 * *
 * @since 1.0.0
 * @public
 */
export class MissingValueError extends IDomainError {
  /**
   * @description-inject
   * @business-context-inject
   * @example-inject
   */
  static withValue(msg: string, data?: DomainErrorOptions): MissingValueError {
    const message = msg ?? 'Missing value';
    const options = {
      code: DomainErrorCode.MissingValue,
      data,
    };
    return new MissingValueError(message, options);
  }
}

/**
 * @llm-summary InvalidParameterError class for invalid parameter error operations
 * @llm-domain Core
 * @llm-complexity Medium
 *
 * @description
 * InvalidParameterError class implementing core domain functionality for invalid parameter error operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new InvalidParameterError();
 * ```
 * *
 * @since 1.0.0
 * @public
 */
export class InvalidParameterError extends IDomainError {
  /**
   * @description-inject
   * @business-context-inject
   * @example-inject
   */
  static withParameter(
    parameter: string,
    msg?: string,
    data?: DomainErrorOptions
  ): InvalidParameterError {
    const message = msg ?? `Invalid ${parameter}`;
    const options: DomainErrorOptions = {
      code: DomainErrorCode.MissingValue,
      data,
    };

    return new InvalidParameterError(message, options);
  }
}

/**
 * @llm-summary DuplicateError class for duplicate error operations
 * @llm-domain Core
 * @llm-complexity Medium
 *
 * @description
 * DuplicateError class implementing core domain functionality for duplicate error operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new DuplicateError();
 * ```
 * *
 * @since 1.0.0
 * @public
 */
export class DuplicateError extends IDomainError {
  /**
   * @description-inject
   * @business-context-inject
   * @example-inject
   */
  static withEntityId(id: string, data?: DomainErrorOptions): DuplicateError {
    const message = `Entity with id ${id} already exists`;
    const options = {
      code: DomainErrorCode.DuplicateEntry,
      data,
    };
    return new DuplicateError(message, options);
  }
}

/**
 * @llm-summary NotFoundError class for not found error operations
 * @llm-domain Core
 * @llm-complexity Medium
 *
 * @description
 * NotFoundError class implementing core domain functionality for not found error operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new NotFoundError();
 * ```
 * *
 * @since 1.0.0
 * @public
 */
export class NotFoundError extends IDomainError {
  /**
   * @description-inject
   * @business-context-inject
   * @example-inject
   */
  static withEntityId(id: string, data?: DomainErrorOptions): NotFoundError {
    const message = `Entity with id ${id} not found`;
    const options = {
      code: DomainErrorCode.NotFound,
      data,
    };
    return new NotFoundError(message, options);
  }
}
