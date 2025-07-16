import type { Logger } from '../core/index';
import { DefaultLogger } from '../logger';

/**
 * @llm-summary Contract for c q r s middleware options functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * CQRSMiddlewareOptions interface implementing infrastructure service for c q r s middleware options operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteCQRSMiddlewareOptions implements CQRSMiddlewareOptions {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface CQRSMiddlewareOptions {
  logger?: Logger;
  includePayload?: boolean;
  logLevel?: 'debug' | 'info';
}

/**
 * @llm-summary Contract for execution context functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * ExecutionContext interface implementing infrastructure service for execution context operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteExecutionContext implements ExecutionContext {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface ExecutionContext {
  commandOrQuery: unknown;
  type: 'Command' | 'Query';
  handler?: unknown;
}

/**
 * @llm-summary Contract for c q r s middleware functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * CQRSMiddleware interface implementing infrastructure service for c q r s middleware operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteCQRSMiddleware implements ICQRSMiddleware {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface ICQRSMiddleware {
  handle(context: ExecutionContext, next: () => Promise<unknown>): Promise<unknown>;
}

/**
 * @llm-summary EnhancedLoggingMiddleware class for enhanced logging middleware operations
 * @llm-domain Infrastructure
 * @llm-complexity Medium
 *
 * @description
 * EnhancedLoggingMiddleware class implementing infrastructure service for enhanced logging middleware operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new EnhancedLoggingMiddleware();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new EnhancedLoggingMiddleware());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
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

/**
 * @llm-summary create c q r s middleware function
 * @llm-domain Infrastructure
 * @llm-pure false
 *
 * @description
 * createCQRSMiddleware function implementing infrastructure service for create c q r s middleware operations.
 *
 *
 * @param {CQRSMiddlewareOptions} options? - options? parameter
 * @returns {EnhancedLoggingMiddleware} Returns EnhancedLoggingMiddleware
 * @throws {Error} When validation fails
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = createCQRSMiddleware(options?);
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, result] = safeRun(() => createCQRSMiddleware(options?));
 * ```
 *
 * @since 1.0.0
 * @public
 */
export function createCQRSMiddleware(options?: CQRSMiddlewareOptions): EnhancedLoggingMiddleware {
  return new EnhancedLoggingMiddleware(options);
}
