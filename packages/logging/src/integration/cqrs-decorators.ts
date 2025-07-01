/* eslint-disable @typescript-eslint/no-unsafe-function-type */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Logger } from '../core/index.js';
import { DefaultLogger } from '../logger.js';

export interface CQRSLoggingOptions {
  includePayload?: boolean;
  maskSensitiveData?: boolean;
  logLevel?: 'debug' | 'info';
  contextName?: string;
}

export function LogCommands(options: CQRSLoggingOptions = {}): ClassDecorator {
  return function (target: any) {
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

export function LogQueries(options: CQRSLoggingOptions = {}): ClassDecorator {
  return function (target: any) {
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

export function LogCQRS(options: CQRSLoggingOptions = {}): ClassDecorator {
  return function (target: any) {
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
  originalMethod: Function,
  methodName: string,
  operationType: string,
  options: CQRSLoggingOptions
) {
  return async function (this: any, ...args: any[]) {
    const logger = getOrCreateLogger(this, options.contextName);
    const startTime = performance.now();

    const commandOrQuery = args[0];
    const operationName = commandOrQuery?.constructor?.name || 'Unknown';

    const logLevel = options.logLevel || 'info';
    const logData: Record<string, unknown> = {
      operation: operationType,
      handler: this.constructor.name,
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

function getOrCreateLogger(instance: any, contextName?: string): Logger {
  if (!instance._logger) {
    const name = contextName || instance.constructor.name;
    instance._logger = DefaultLogger.forContext(name);
  }
  return instance._logger;
}
