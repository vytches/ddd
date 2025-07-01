/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Logger } from '../core/index.js';
import { DefaultLogger } from '../logger.js';

export interface CQRSMiddlewareOptions {
  logger?: Logger;
  includePayload?: boolean;
  logLevel?: 'debug' | 'info';
}

export interface ExecutionContext {
  commandOrQuery: any;
  type: 'Command' | 'Query';
  handler?: any;
}

export interface ICQRSMiddleware {
  handle(context: ExecutionContext, next: () => Promise<any>): Promise<any>;
}

export class EnhancedLoggingMiddleware implements ICQRSMiddleware {
  private readonly logger: Logger;
  private readonly options: CQRSMiddlewareOptions;

  constructor(options: CQRSMiddlewareOptions = {}) {
    this.options = {
      includePayload: false,
      logLevel: 'info',
      ...options,
    };

    this.logger = options.logger || DefaultLogger.forContext('CQRS');
  }

  async handle(
    context: ExecutionContext,
    next: () => Promise<any>,
  ): Promise<any> {
    const { commandOrQuery, type, handler } = context;
    const operationName = commandOrQuery.constructor.name;
    const handlerName = handler?.constructor?.name || 'Unknown';

    const startTime = performance.now();
    const logLevel = this.options.logLevel!;

    const logData: Record<string, unknown> = {
      operation: type,
      operationName,
      handler: handlerName,
    };

    if (this.options.includePayload) {
      logData.payload = commandOrQuery;
    }

    this.logger[logLevel](`[${type}] Executing ${operationName}`, logData);

    try {
      const result = await next();
      const duration = performance.now() - startTime;

      this.logger[logLevel](`[${type}] ${operationName} completed`, {
        ...logData,
        duration: `${duration.toFixed(2)}ms`,
        success: true,
      });

      return result;
    } catch (error) {
      const duration = performance.now() - startTime;

      this.logger.error(`[${type}] ${operationName} failed`, error as Error, {
        ...logData,
        duration: `${duration.toFixed(2)}ms`,
        success: false,
      });

      throw error;
    }
  }
}

export function createCQRSMiddleware(options?: CQRSMiddlewareOptions): EnhancedLoggingMiddleware {
  return new EnhancedLoggingMiddleware(options);
}
