import type { Logger } from '../core/index';
import { DefaultLogger } from '../logger';

/**
 * @llm-summary Contract for result logging options functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * ResultLoggingOptions interface implementing infrastructure service for result logging options operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteResultLoggingOptions implements ResultLoggingOptions {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface ResultLoggingOptions {
  logger?: Logger;
  logLevel?: 'debug' | 'info';
  includeValue?: boolean;
  includeError?: boolean;
  contextName?: string;
}

// Generic interface for Result-like objects that support tap methods

/**
 * @llm-summary Contract for result like functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * ResultLike interface implementing infrastructure service for result like operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteResultLike implements ResultLike {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface ResultLike<TValue, TError> {
  tap(fn: (value: TValue) => void): ResultLike<TValue, TError>;
  tapError(fn: (error: TError) => void): ResultLike<TValue, TError>;
}

/**
 * @llm-summary ResultLoggingExtensions constant
 * @llm-domain Infrastructure
 *
 * @description
 * ResultLoggingExtensions constant implementing infrastructure service for result logging extensions operations.
 *
 * @example
 * ```typescript
 * // Usage example
 * console.log(ResultLoggingExtensions);
 * ```
 *
 * @since 1.0.0
 * @public
 */
export const ResultLoggingExtensions = {
  /**
   * Add success logging to any Result-like object
   */
  tapLog<TValue, TError>(
    result: ResultLike<TValue, TError>,
    message: string,
    options: ResultLoggingOptions = {}
  ): ResultLike<TValue, TError> {
    const logger = resolveLogger(options);
    const logLevel = options.logLevel || 'info';

    return result.tap((value: TValue) => {
      const logData: Record<string, unknown> = {};

      if (options.includeValue) {
        logData.value = value;
      }

      logger[logLevel](message, logData);
    });
  },

  /**
   * Add error logging to any Result-like object
   */
  tapLogError<TValue, TError>(
    result: ResultLike<TValue, TError>,
    message: string,
    options: ResultLoggingOptions = {}
  ): ResultLike<TValue, TError> {
    const logger = resolveLogger(options);

    return result.tapError((error: TError) => {
      const logData: Record<string, unknown> = {};

      if (options.includeError) {
        logData.errorDetails = error;
      }

      logger.error(message, error as Error, logData);
    });
  },

  /**
   * Add both success and error logging to any Result-like object
   */
  tapLogBoth<TValue, TError>(
    result: ResultLike<TValue, TError>,
    successMessage: string,
    errorMessage: string,
    options: ResultLoggingOptions = {}
  ): ResultLike<TValue, TError> {
    return this.tapLogError(this.tapLog(result, successMessage, options), errorMessage, options);
  },
};

function resolveLogger(options: ResultLoggingOptions): Logger {
  if (options.logger) {
    return options.logger;
  }

  const contextName = options.contextName || 'Result';
  return DefaultLogger.forContext(contextName);
}
