/**
 * @llm-summary Logger instance from @vytches-ddd/logging for CLI operations
 * @llm-domain Infrastructure
 * @llm-complexity Simple
 *
 * @description
 * Re-export of Logger from @vytches-ddd/logging package with additional
 * success method for CLI operations.
 *
 * @example
 * ```typescript
 * import { logger } from './logger';
 *
 * logger.info('Processing started');
 * logger.error('An error occurred', error);
 * logger.success('Operation completed successfully');
 * ```
 *
 * @since 1.0.0
 * @public
 */

import { Logger } from '@vytches-ddd/logging';

// Create logger instance for CLI context
const cliLogger = Logger.forContext('CLI');

// Extend logger with success method for CLI operations
export const logger = {
  debug: (message: string, ...args: unknown[]) =>
    cliLogger.debug(message, ...args.map(arg => arg as Record<string, unknown>)),
  info: (message: string, ...args: unknown[]) =>
    cliLogger.info(message, ...args.map(arg => arg as Record<string, unknown>)),
  warn: (message: string, ...args: unknown[]) =>
    cliLogger.warn(message, ...args.map(arg => arg as Record<string, unknown>)),
  error: (message: string, ...args: unknown[]) =>
    cliLogger.error(message, args.length > 0 ? (args[0] as Error) : undefined),
  success: (message: string, ...args: unknown[]) =>
    cliLogger.info(`✅ ${message}`, ...args.map(arg => arg as Record<string, unknown>)),
};
