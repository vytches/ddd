import type { LogContext, LogEvent, LogProvider } from '../core/index';

export interface ConsoleProviderOptions {
  colorize?: boolean;
  prettyPrint?: boolean;
  includeStackTrace?: boolean;
}

export class ConsoleProvider implements LogProvider {
  readonly name = 'console';

  private readonly options: Required<ConsoleProviderOptions>;

  constructor(options: ConsoleProviderOptions = {}) {
    this.options = {
      colorize: options.colorize ?? true,
      prettyPrint: options.prettyPrint ?? true,
      includeStackTrace: options.includeStackTrace ?? false,
    };
  }

  write(event: LogEvent): void {
    const formatted = this.formatEvent(event);

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
