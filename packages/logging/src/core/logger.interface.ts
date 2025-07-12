import type { LogLevel } from './log-level';
import type { LogEvent } from './log-event';
import type { LogContext } from './log-context';

export interface Logger {
  readonly context: LogContext;
  readonly level: LogLevel;

  trace(message: string, data?: Record<string, unknown>): void;
  debug(message: string, data?: Record<string, unknown>): void;
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, error?: Error, data?: Record<string, unknown>): void;
  fatal(message: string, error?: Error, data?: Record<string, unknown>): void;

  log(level: LogLevel, message: string, data?: Record<string, unknown>, error?: Error): void;

  isLevelEnabled(level: LogLevel): boolean;

  child(contextName: string): Logger;
  withContext(context: Partial<LogContext>): Logger;
  withCorrelationId(correlationId: string): Logger;
  withUserId(userId: string): Logger;
  withTenantId(tenantId: string): Logger;
}

export interface LogProvider {
  readonly name: string;
  write(event: LogEvent): void | Promise<void>;
  flush?(): void | Promise<void>;
  close?(): void | Promise<void>;
}

export interface LoggerConfiguration {
  level?: LogLevel;
  provider?: LogProvider | 'console';
  contextDetection?: {
    enabled?: boolean;
    includeStackTrace?: boolean;
  };
  formatting?: {
    timestamp?: boolean;
    colorize?: boolean;
    prettyPrint?: boolean;
  };
  masking?: {
    enabled?: boolean;
    patterns?: string[];
    replacement?: string;
    sensitiveKeys?: string[];
  };
}
