import type { Logger } from '../core/index';
import { DefaultLogger } from '../logger';

export interface ResultLoggingOptions {
  logger?: Logger;
  logLevel?: 'debug' | 'info';
  includeValue?: boolean;
  includeError?: boolean;
  contextName?: string;
}

// Generic interface for Result-like objects that support tap methods
export interface ResultLike<TValue, TError> {
  tap(fn: (value: TValue) => void): ResultLike<TValue, TError>;
  tapError(fn: (error: TError) => void): ResultLike<TValue, TError>;
}

/**
 * Pure function approach to adding logging to Result-like objects
 * No direct dependency on @vytches-ddd/utils package
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
