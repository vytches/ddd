// Core exports
export {
  DefaultLogContextBuilder,
  DefaultLogEventBuilder,
  isLogLevelEnabled,
  LOG_LEVELS,
  parseLogLevel,
} from './core';

export type {
  Logger as ILogger,
  LogContext,
  LogContextBuilder,
  LogEvent,
  LogEventBuilder,
  LoggerConfiguration,
  LogLevel,
  LogProvider,
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
  AggregateLoggingMixin,
  EnhancedLoggingMiddleware,
  LogCommands,
  LogCQRS,
  LogDomainEvents,
  LogQueries,
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
import type { LoggerConfiguration } from './core';
import { DefaultLogger } from './logger';

export const Logger = {
  create: (contextName?: string) => DefaultLogger.create(contextName),
  forContext: (contextName?: string) => DefaultLogger.forContext(contextName),
  configure: (config: LoggerConfiguration) => DefaultLogger.configure(config),
};
