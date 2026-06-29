/**
 * Public diagnostics control API for @vytches/ddd-* packages.
 *
 * Consumers call {@link configureDiagnostics} to silence or redirect the library's
 * own diagnostic output (misconfiguration warnings, unexpected failures).
 *
 * @module diagnostics
 */

/* eslint-disable no-console */

/**
 * Consumer-implemented sink that receives the library's own diagnostics.
 *
 * Implementation contract:
 * - May be called synchronously inside library operations.
 * - MUST NOT throw or block — the library wraps all sink calls defensively;
 *   a throwing sink is silenced after one fallback `console.error`.
 * - Receives library-internal metadata only (names, error messages). The `Error`
 *   object passed to `error()` may contain sensitive stack information — treat it
 *   as potentially sensitive and avoid logging it verbatim in shared/remote logs.
 * - MUST NOT call back into the library (e.g. via its own logger) — doing so
 *   risks reentrancy and infinite loops.
 */
export interface DiagnosticsSink {
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, error?: Error, context?: Record<string, unknown>): void;
}

/**
 * Verbosity level for library diagnostics.
 *
 * - `'silent'` — suppress all output.
 * - `'error'`  — emit only `error()` calls.
 * - `'warn'`   — emit both `warn()` and `error()` calls (most verbose; default).
 */
export type DiagnosticsLevel = 'silent' | 'error' | 'warn';

/** Options accepted by {@link configureDiagnostics}. */
export interface DiagnosticsOptions {
  /** Custom sink. Defaults to `console`. */
  sink?: DiagnosticsSink;
  /** Minimum verbosity level. Defaults to `'warn'`. */
  level?: DiagnosticsLevel;
}

// ---------------------------------------------------------------------------
// Module-private state — NOT exported (no monkeypatch surface).
// ---------------------------------------------------------------------------

const DEFAULT_SINK: DiagnosticsSink = {
  warn(message: string, context?: Record<string, unknown>): void {
    console.warn(message, context ?? {});
  },
  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    console.error(message, error ?? '', context ?? {});
  },
};

let currentSink: DiagnosticsSink = DEFAULT_SINK;
let currentLevel: DiagnosticsLevel = 'warn';

// ---------------------------------------------------------------------------
// Sink isolation helpers (R1)
// ---------------------------------------------------------------------------

/**
 * Calls `currentSink.warn` wrapped in a defensive try/catch (R1).
 * If the sink throws, falls back to `console.error` once and returns.
 * Never re-throws; never calls back into the sink on the fallback path.
 *
 * @internal
 */
export function _emitWarn(message: string, context?: Record<string, unknown>): void {
  if (currentLevel !== 'warn') {
    return;
  }
  try {
    currentSink.warn(message, context);
  } catch (sinkError) {
    // R1: sink threw — report the failure via console, then continue.
    // We deliberately do NOT call currentSink again to avoid infinite loops.
    console.error('[vytches-ddd] DiagnosticsSink.warn threw unexpectedly', sinkError);
  }
}

/**
 * Calls `currentSink.error` wrapped in a defensive try/catch (R1).
 * If the sink throws, falls back to `console.error` once and returns.
 * Never re-throws; never calls back into the sink on the fallback path.
 *
 * @internal
 */
export function _emitError(
  message: string,
  error?: Error,
  context?: Record<string, unknown>
): void {
  if (currentLevel === 'silent') {
    return;
  }
  try {
    currentSink.error(message, error, context);
  } catch (sinkError) {
    // R1: sink threw — report the failure via console, then continue.
    console.error('[vytches-ddd] DiagnosticsSink.error threw unexpectedly', sinkError);
  }
}

// ---------------------------------------------------------------------------
// Public control API
// ---------------------------------------------------------------------------

/**
 * Configure the library's internal diagnostics channel.
 *
 * Call this once at application startup (after importing `@vytches/ddd`).
 * This is a process-global setting; last writer wins in applications that
 * bundle multiple versions (document in library README).
 *
 * @example Silence all output (useful in tests or production):
 * ```ts
 * configureDiagnostics({ level: 'silent' });
 * ```
 *
 * @example Route to Pino:
 * ```ts
 * configureDiagnostics({
 *   sink: {
 *     warn: (m, c) => pino.warn(c, m),
 *     error: (m, e, c) => pino.error({ ...c, err: e }, m),
 *   },
 * });
 * ```
 */
export function configureDiagnostics(options: DiagnosticsOptions): void {
  if (options.sink !== undefined) {
    currentSink = options.sink;
  }
  if (options.level !== undefined) {
    currentLevel = options.level;
  }
}
