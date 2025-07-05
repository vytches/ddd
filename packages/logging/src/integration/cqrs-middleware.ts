import type { Logger } from '../core/index';
import { DefaultLogger } from '../logger';

export interface CQRSMiddlewareOptions {
  logger?: Logger;
  includePayload?: boolean;
  logLevel?: 'debug' | 'info';
}

export interface ExecutionContext {
  commandOrQuery: unknown;
  type: 'Command' | 'Query';
  handler?: unknown;
}

export interface ICQRSMiddleware {
  handle(context: ExecutionContext, next: () => Promise<unknown>): Promise<unknown>;
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

  async handle(context: ExecutionContext, next: () => Promise<unknown>): Promise<unknown> {
    const { commandOrQuery, type, handler } = context;
    const operationName = (commandOrQuery as { constructor: { name: string } }).constructor.name;
    const handlerName =
      (handler as { constructor?: { name: string } })?.constructor?.name || 'Unknown';

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
