import type { Logger } from '../core/index';
import { DefaultLogger } from '../logger';

/**
 * @llm-summary Contract for c q r s logging options functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * CQRSLoggingOptions interface implementing infrastructure service for c q r s logging options operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteCQRSLoggingOptions implements CQRSLoggingOptions {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface CQRSLoggingOptions {
  includePayload?: boolean;
  maskSensitiveData?: boolean;
  logLevel?: 'debug' | 'info';
  contextName?: string;
}

/**
 * @llm-summary log commands function
 * @llm-domain Infrastructure
 * @llm-pure false
 *
 * @description
 * LogCommands function implementing infrastructure service for log commands operations.
 *
 *
 * @param {CQRSLoggingOptions = {}} options - options parameter
 * @throws {Error} When validation fails
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = LogCommands(options);
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, result] = safeRun(() => LogCommands(options));
 * ```
 *
 * @since 1.0.0
 * @public
 */
export function LogCommands(options: CQRSLoggingOptions = {}) {
  return function (target: new (...args: unknown[]) => unknown) {
    const originalMethods = Object.getOwnPropertyNames(target.prototype);

    for (const methodName of originalMethods) {
      if (methodName === 'constructor') continue;

      const originalMethod = target.prototype[methodName];
      if (typeof originalMethod !== 'function') continue;

      target.prototype[methodName] = createLoggingWrapper(
        originalMethod,
        methodName,
        'Command',
        options
      );
    }
  };
}

/**
 * @llm-summary log queries function
 * @llm-domain Infrastructure
 * @llm-pure false
 *
 * @description
 * LogQueries function implementing infrastructure service for log queries operations.
 *
 *
 * @param {CQRSLoggingOptions = {}} options - options parameter
 * @throws {Error} When validation fails
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = LogQueries(options);
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, result] = safeRun(() => LogQueries(options));
 * ```
 *
 * @since 1.0.0
 * @public
 */
export function LogQueries(options: CQRSLoggingOptions = {}) {
  return function (target: new (...args: unknown[]) => unknown) {
    const originalMethods = Object.getOwnPropertyNames(target.prototype);

    for (const methodName of originalMethods) {
      if (methodName === 'constructor') continue;

      const originalMethod = target.prototype[methodName];
      if (typeof originalMethod !== 'function') continue;

      target.prototype[methodName] = createLoggingWrapper(
        originalMethod,
        methodName,
        'Query',
        options
      );
    }
  };
}

/**
 * @llm-summary log c q r s function
 * @llm-domain Infrastructure
 * @llm-pure false
 *
 * @description
 * LogCQRS function implementing infrastructure service for log c q r s operations.
 *
 *
 * @param {CQRSLoggingOptions = {}} options - options parameter
 * @throws {Error} When validation fails
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = LogCQRS(options);
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, result] = safeRun(() => LogCQRS(options));
 * ```
 *
 * @since 1.0.0
 * @public
 */
export function LogCQRS(options: CQRSLoggingOptions = {}) {
  return function (target: new (...args: unknown[]) => unknown) {
    const originalMethods = Object.getOwnPropertyNames(target.prototype);

    for (const methodName of originalMethods) {
      if (methodName === 'constructor') continue;

      const originalMethod = target.prototype[methodName];
      if (typeof originalMethod !== 'function') continue;

      target.prototype[methodName] = createLoggingWrapper(
        originalMethod,
        methodName,
        'CQRS',
        options
      );
    }
  };
}

function createLoggingWrapper(
  originalMethod: (...args: unknown[]) => unknown,
  methodName: string,
  operationType: string,
  options: CQRSLoggingOptions
) {
  return async function (this: Record<string, unknown>, ...args: unknown[]) {
    const logger = getOrCreateLogger(this, options.contextName);
    const startTime = performance.now();

    const commandOrQuery = args[0] as { constructor?: { name?: string } };
    const operationName = commandOrQuery?.constructor?.name || 'Unknown';

    const logLevel = options.logLevel || 'info';
    const logData: Record<string, unknown> = {
      operation: operationType,
      handler: (this.constructor as { name: string }).name,
      method: methodName,
      operationName,
    };

    if (options.includePayload && commandOrQuery) {
      logData.payload = commandOrQuery;
    }

    logger[logLevel](`[${operationType}] Executing ${operationName}`, logData);

    try {
      const result = await originalMethod.apply(this, args);
      const duration = performance.now() - startTime;

      logger[logLevel](`[${operationType}] ${operationName} completed`, {
        ...logData,
        duration: `${duration.toFixed(2)}ms`,
        success: true,
      });

      return result;
    } catch (error) {
      const duration = performance.now() - startTime;

      logger.error(`[${operationType}] ${operationName} failed`, error as Error, {
        ...logData,
        duration: `${duration.toFixed(2)}ms`,
        success: false,
      });

      throw error;
    }
  };
}

function getOrCreateLogger(instance: Record<string, unknown>, contextName?: string): Logger {
  if (!instance._logger) {
    const name = contextName || (instance.constructor as { name: string }).name;
    instance._logger = DefaultLogger.forContext(name);
  }
  return instance._logger as Logger;
}
