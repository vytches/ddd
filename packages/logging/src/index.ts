// Core exports
export * from './core/index.js';

// Main logger
export { DefaultLogger } from './logger.js';

// Providers
export * from './providers/index.js';

// Utils
export * from './utils/index.js';

// Integration
export * from './integration/index.js';

// Convenience exports
import { DefaultLogger } from './logger.js';
import type { LoggerConfiguration } from './core/index.js';

export const Logger = {
  create: (contextName?: string) => DefaultLogger.create(contextName),
  forContext: (contextName?: string) => DefaultLogger.forContext(contextName),
  configure: (config: LoggerConfiguration) => DefaultLogger.configure(config),
};