import { LibUtils } from '@vytches/ddd-utils';
import type { ExecutionContext, ICQRSMiddleware } from './middleware.interface';

/**
 * Minimal logger contract accepted by {@link LoggingMiddleware}.
 *
 * Any object with a `log` method that accepts a string — including `console`,
 * Pino, Winston, or a custom structured logger — satisfies this interface.
 * The variadic `...args` makes the type compatible with loggers whose `log`
 * accepts additional optional parameters without requiring callers to supply them.
 */
export interface IMiddlewareLogger {
  log(message: string, ...args: unknown[]): void;
}

export class LoggingMiddleware implements ICQRSMiddleware {
  private readonly _logger: IMiddlewareLogger;

  constructor(logger?: IMiddlewareLogger) {
    this._logger = logger ?? console;
  }

  async handle(context: ExecutionContext, next: () => Promise<unknown>): Promise<unknown> {
    const { commandOrQuery, type } = context;
    const name = (commandOrQuery as { constructor: { name: string } }).constructor.name;

    const startTime = Date.now();
    this._logger.log(`[CQRS] Executing ${type}: ${name}`);

    try {
      const result = await next();
      const duration = Date.now() - startTime;
      this._logger.log(`[CQRS] ${type} ${name} completed in ${duration}ms`);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      // VS-018: never blind-interpolate `${error}` — error.message conventionally
      // embeds the offending input value (e.g. "Invalid email: x@y.com"), an
      // indirect PII-to-log vector. Log only the error name plus a
      // control-char-sanitized message (log-injection guard).
      const errorName = error instanceof Error ? error.name : 'UnknownError';
      const errorMessage = LibUtils.sanitizeLogMessage(
        error instanceof Error ? error.message : String(error)
      );
      this._logger.log(
        `[CQRS] ${type} ${name} failed after ${duration}ms: ${errorName}: ${errorMessage}`
      );
      throw error;
    }
  }
}
