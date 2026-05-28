import type { LogContext, LogEvent, LogProvider } from '../core/index';
import type { DataMasker } from '../utils/data-masker';

export interface ConsoleProviderOptions {
  colorize?: boolean;
  prettyPrint?: boolean;
  includeStackTrace?: boolean;
  /**
   * Optional DataMasker for standalone ConsoleProvider use (without DefaultLogger).
   *
   * **When used through DefaultLogger:** masking is already applied upstream before
   * the event reaches this provider. Setting `masker` here would cause double-masking.
   * Only provide this when using ConsoleProvider directly (e.g. custom logger wrappers).
   *
   * @example
   * ```typescript
   * import { ConsoleProvider, DataMasker } from '@vytches/ddd-logging';
   *
   * const provider = new ConsoleProvider({
   *   masker: new DataMasker({ sensitiveKeys: ['password', 'token'] }),
   * });
   * ```
   */
  masker?: DataMasker;
}

export class ConsoleProvider implements LogProvider {
  readonly name = 'console';

  private readonly options: Required<Omit<ConsoleProviderOptions, 'masker'>>;
  private readonly masker: DataMasker | undefined;

  constructor(options: ConsoleProviderOptions = {}) {
    this.options = {
      colorize: options.colorize ?? true,
      prettyPrint: options.prettyPrint ?? true,
      includeStackTrace: options.includeStackTrace ?? false,
    };
    this.masker = options.masker;
  }

  write(event: LogEvent): void {
    const effectiveEvent =
      this.masker !== undefined && event.data !== undefined
        ? { ...event, data: this.masker.maskData(event.data) as Record<string, unknown> }
        : event;

    const formatted = this.formatEvent(effectiveEvent);

    switch (event.level) {
      case 'trace':
      case 'debug':
        console.debug(formatted);
        break;
      case 'info':
        console.info(formatted);
        break;
      case 'warn':
        console.warn(formatted);
        break;
      case 'error':
      case 'fatal':
        console.error(formatted);
        if (
          event.error &&
          this.options.includeStackTrace &&
          process.env.NODE_ENV !== 'production'
        ) {
          console.error(event.error.stack);
        }
        break;
    }
  }

  private formatEvent(event: LogEvent): string {
    if (this.options.prettyPrint) {
      return this.formatPretty(event);
    }

    return this.formatStructured(event);
  }

  private formatPretty(event: LogEvent): string {
    const timestamp = event.timestamp.toISOString();
    const level = this.colorizeLevel(event.level.toUpperCase());
    const context = this.formatContext(event.context);
    const message = event.message;
    const data = event.data ? ` ${JSON.stringify(event.data)}` : '';
    const error = event.error ? ` Error: ${event.error.message}` : '';

    return `${timestamp} ${level} ${context} ${message}${data}${error}`;
  }

  private formatStructured(event: LogEvent): string {
    const logObject = {
      timestamp: event.timestamp.toISOString(),
      level: event.level,
      message: event.message,
      context: event.context,
      ...(event.data && { data: event.data }),
      ...(event.error && {
        error: {
          name: event.error.name,
          message: event.error.message,
          ...(this.options.includeStackTrace &&
            process.env.NODE_ENV !== 'production' && { stack: event.error.stack }),
        },
      }),
      ...(event.tags && event.tags.length > 0 && { tags: event.tags }),
    };

    return JSON.stringify(logObject);
  }

  private formatContext(context: LogContext): string {
    const parts: string[] = [];

    if (context.boundedContext) {
      parts.push(`[${context.boundedContext}]`);
    }

    parts.push(`[${context.name}]`);

    if (context.correlationId) {
      parts.push(`(${context.correlationId.slice(0, 8)})`);
    }

    return parts.join(' ');
  }

  private colorizeLevel(level: string): string {
    if (!this.options.colorize) {
      return level.padEnd(5);
    }

    const colors = {
      TRACE: '\x1b[90m', // gray
      DEBUG: '\x1b[36m', // cyan
      INFO: '\x1b[32m', // green
      WARN: '\x1b[33m', // yellow
      ERROR: '\x1b[31m', // red
      FATAL: '\x1b[35m', // magenta
    };

    const reset = '\x1b[0m';
    const color = colors[level as keyof typeof colors] || '';

    return `${color}${level.padEnd(5)}${reset}`;
  }
}
