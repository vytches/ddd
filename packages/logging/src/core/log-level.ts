export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export const LOG_LEVELS: Record<LogLevel, number> = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
  fatal: 5,
} as const;

export function isLogLevelEnabled(level: LogLevel, minLevel: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[minLevel];
}

export function parseLogLevel(level: string): LogLevel {
  const normalizedLevel = level.toLowerCase() as LogLevel;
  if (normalizedLevel in LOG_LEVELS) {
    return normalizedLevel;
  }
  throw new Error(
    `Invalid log level: ${level}. Valid levels are: ${Object.keys(LOG_LEVELS).join(', ')}`
  );
}
