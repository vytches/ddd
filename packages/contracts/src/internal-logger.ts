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
 *
 * Since VS-014: delegates to the configured {@link DiagnosticsSink} instead
 * of writing directly to `console`. The active sink and level are controlled
 * by {@link configureDiagnostics}.
 */
import { _emitWarn, _emitError } from './diagnostics/diagnostics-sink';

export const internalLogger = {
  warn(message: string, data?: Record<string, unknown>): void {
    _emitWarn(message, data);
  },
  error(message: string, error?: Error, data?: Record<string, unknown>): void {
    _emitError(message, error, data);
  },
};
