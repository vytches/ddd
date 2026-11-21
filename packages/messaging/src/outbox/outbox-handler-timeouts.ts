/** `setTimeout` fires immediately for delays above this (2^31 - 1). */
const MAX_TIMER_MS = 2_147_483_647;
const DEFAULT_CRASH_RECOVERY_FLOOR_MS = 300_000;

/**
 * Per-handler timeout overrides plus the crash-recovery threshold derived from
 * them: the threshold may never be below the largest timeout that can be in flight.
 */
export class HandlerTimeoutRegistry {
  private readonly byType = new Map<string, number>();
  private defaultHandlerMs: number | undefined;

  /**
   * @param defaultMs processor-wide `messageTimeout`
   * @param explicitThresholdMs user-supplied `crashRecoveryThresholdMs`
   *   (`undefined` = derive from the largest timeout)
   */
  constructor(
    private readonly defaultMs: number,
    private readonly explicitThresholdMs: number | undefined
  ) {}

  /**
   * Validates a timeout that will be used with `setTimeout`. Throws `RangeError`
   * for NaN, non-finite, non-positive or > 2^31-1 values (which `setTimeout`
   * would silently turn into ~1 ms).
   */
  static assertTimerMs(label: string, timeoutMs: number): void {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > MAX_TIMER_MS) {
      throw new RangeError(
        `OutboxProcessor: ${label} must be a positive number ≤ ${MAX_TIMER_MS}, got ${timeoutMs}`
      );
    }
  }

  /** Validates an override; returns it, or `undefined` when none was given. Throws `RangeError`. */
  validate(label: string, timeoutMs: number | undefined): number | undefined {
    if (timeoutMs === undefined) {
      return undefined;
    }
    HandlerTimeoutRegistry.assertTimerMs(`messageTimeoutMs for '${label}'`, timeoutMs);
    if (this.explicitThresholdMs !== undefined && this.explicitThresholdMs < timeoutMs) {
      throw new RangeError(
        `OutboxProcessor: crashRecoveryThresholdMs (${this.explicitThresholdMs}) must be ≥ messageTimeoutMs (${timeoutMs}) of '${label}' to avoid resetting in-flight messages`
      );
    }
    return timeoutMs;
  }

  /** Stores (or clears, when `timeoutMs` is undefined) the override of a type's handler. */
  setForType(messageType: string, timeoutMs: number | undefined): void {
    if (timeoutMs === undefined) {
      this.byType.delete(messageType);
    } else {
      this.byType.set(messageType, timeoutMs);
    }
  }

  setForDefaultHandler(timeoutMs: number | undefined): void {
    this.defaultHandlerMs = timeoutMs;
  }

  /** Timeout of the handler that will run `messageType` (type handler if any, else the default one). */
  resolve(messageType: string, hasTypeHandler: boolean): number {
    const override = hasTypeHandler ? this.byType.get(messageType) : this.defaultHandlerMs;
    return override ?? this.defaultMs;
  }

  largest(): number {
    let largest = Math.max(this.defaultMs, this.defaultHandlerMs ?? 0);
    for (const timeoutMs of this.byType.values()) {
      largest = Math.max(largest, timeoutMs);
    }
    return largest;
  }

  crashRecoveryThresholdMs(): number {
    return this.explicitThresholdMs ?? Math.max(DEFAULT_CRASH_RECOVERY_FLOOR_MS, this.largest());
  }
}
