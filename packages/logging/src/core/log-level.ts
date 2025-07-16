/**
 * @llm-summary Type definition for log level
 * @llm-domain Infrastructure
 * @llm-usage Frequent
 *
 * @description
 * LogLevel type implementing infrastructure service for log level operations.
 *
 * @example
 * ```typescript
 * // Usage example
 * const value: LogLevel = {} as LogLevel;
 * ```
 *
 * @since 1.0.0
 * @public
 */
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/**
 * @llm-summary LOG_LEVELS constant
 * @llm-domain Infrastructure
 *
 * @description
 * LOG_LEVELS constant implementing infrastructure service for l o g_ l e v e l s operations.
 *
 * @example
 * ```typescript
 * // Usage example
 * console.log(LOG_LEVELS);
 * ```
 *
 * @since 1.0.0
 * @public
 */
export const LOG_LEVELS: Record<LogLevel, number> = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
  fatal: 5,
} as const;

/**
 * @llm-summary is log level enabled function
 * @llm-domain Infrastructure
 * @llm-pure true
 *
 * @description
 * isLogLevelEnabled function implementing infrastructure service for is log level enabled operations.
 *
 *
 * @param {LogLevel} level - level parameter
 * @param {LogLevel} minLevel - minLevel parameter
 * @returns {boolean} Returns boolean
 * @throws {Error} When validation fails
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = isLogLevelEnabled(level, minLevel);
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, result] = safeRun(() => isLogLevelEnabled(level, minLevel));
 * ```
 *
 * @since 1.0.0
 * @public
 */
export function isLogLevelEnabled(level: LogLevel, minLevel: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[minLevel];
}

/**
 * @llm-summary parse log level function
 * @llm-domain Infrastructure
 * @llm-pure true
 *
 * @description
 * parseLogLevel function implementing infrastructure service for parse log level operations.
 *
 *
 * @param {string} level - level parameter
 * @returns {LogLevel} Returns LogLevel
 * @throws {Error} When validation fails
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = parseLogLevel(level);
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, result] = safeRun(() => parseLogLevel(level));
 * ```
 *
 * @since 1.0.0
 * @public
 */
export function parseLogLevel(level: string): LogLevel {
  const normalizedLevel = level.toLowerCase() as LogLevel;
  if (normalizedLevel in LOG_LEVELS) {
    return normalizedLevel;
  }
  throw new Error(
    `Invalid log level: ${level}. Valid levels are: ${Object.keys(LOG_LEVELS).join(', ')}`
  );
}
