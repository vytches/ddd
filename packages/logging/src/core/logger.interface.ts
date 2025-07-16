import type { LogLevel } from './log-level';
import type { LogEvent } from './log-event';
import type { LogContext } from './log-context';

/**
 * @llm-summary Contract for logger functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * Logger interface implementing infrastructure service for logger operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteLogger implements Logger {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
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

/**
 * @llm-summary Contract for log provider functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * LogProvider interface implementing infrastructure service for log provider operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteLogProvider implements LogProvider {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface LogProvider {
  readonly name: string;
  write(event: LogEvent): void | Promise<void>;
  flush?(): void | Promise<void>;
  close?(): void | Promise<void>;
}

/**
 * @llm-summary Contract for logger configuration functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * LoggerConfiguration interface implementing infrastructure service for logger configuration operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteLoggerConfiguration implements LoggerConfiguration {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
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
