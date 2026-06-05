/**
 * Internal library diagnostics — NOT an application logging layer.
 *
 * Logs problems originating in the library itself (misconfiguration,
 * unexpected failures, "no handler found"). @vytches/ddd is NOT an application
 * logging layer — consumers use their own logger (Pino, etc.) for app logs.
 *
 * @internal Lives in the foundation package so every sibling @vytches/ddd-*
 * package shares a single implementation (they externalize
 * @vytches/ddd-contracts at build time). Not intended for consumer use.
 */
/* eslint-disable no-console */
export const internalLogger = {
  warn(message: string, data?: Record<string, unknown>): void {
    console.warn(message, data ?? {});
  },
  error(message: string, error?: Error, data?: Record<string, unknown>): void {
    console.error(message, error ?? '', data ?? {});
  },
};
