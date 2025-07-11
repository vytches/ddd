// Core exports
export {
  LOG_LEVELS,
  isLogLevelEnabled,
  parseLogLevel,
  DefaultLogContextBuilder,
  DefaultLogEventBuilder,
} from './core';

export type {
  LogLevel,
  LogContext,
  LogContextBuilder,
  LogEvent,
  LogEventBuilder,
  LogProvider,
  Logger as ILogger,
  LoggerConfiguration,
} from './core';

// Main logger
export { DefaultLogger } from './logger';

// Providers
export { ConsoleProvider } from './providers';
export type { ConsoleProviderOptions } from './providers';

// Utils
export { ContextDetector, DataMasker } from './utils';
export type { ContextDetectionResult, MaskingOptions } from './utils';

// Integration
export {
  LogCQRS,
  LogCommands,
  LogQueries,
  EnhancedLoggingMiddleware,
  AggregateLoggingMixin,
  LogDomainEvents,
  LogStateChanges,
} from './integration';

export type {
  CQRSLoggingOptions,
  CQRSMiddlewareOptions,
  ExecutionContext,
  ICQRSMiddleware,
  StateChangeLoggingOptions,
} from './integration';

// Convenience exports
import { DefaultLogger } from './logger';
import type { LoggerConfiguration } from './core';

export const Logger = {
  create: (contextName?: string) => DefaultLogger.create(contextName),
  forContext: (contextName?: string) => DefaultLogger.forContext(contextName),
  configure: (config: LoggerConfiguration) => DefaultLogger.configure(config),
};
