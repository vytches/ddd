/**
 * Retry configuration shared by `EnhancedCommandBus` and `EnhancedQueryBus`
 * (AC1, D12). Deliberately a standalone, all-optional interface rather than a
 * reuse of `@vytches/ddd-resilience`'s `RetryConfig` — every field there is
 * required, which is the wrong shape for a bus option object where every
 * field (including `enabled`) has a bus-level default.
 */
export interface BusRetryOptions {
  /**
   * Enable retry for this bus. Retry is opt-in (REL-009) — most command
   * handlers are not idempotent, so automatic retry can duplicate side
   * effects (double charges, duplicate orders, ...). The object form
   * requires this to be explicitly `true`, exactly like the legacy boolean
   * form (`retry: true`) — `retry: { maxAttempts: 5 }` alone does NOT enable
   * retry.
   */
  enabled?: boolean;
  maxAttempts?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  /**
   * Add randomized jitter to retry delays (Equal Jitter, 50%-100% of the
   * computed delay — see `RetryPolicy` in `@vytches/ddd-resilience`).
   * Defaults to `true`, matching `RetryPolicy.defaultConfig()`.
   *
   * Both buses previously hardcoded `jitter: false` here regardless of any
   * setting (SA-H3) — retried calls all backed off on the exact same
   * schedule, which synchronizes retry storms instead of spreading them out.
   * That hardcoding is removed; this option now actually controls jitter.
   */
  jitter?: boolean;
}

/**
 * Normalizes the legacy boolean form (`retry: true`) and the object form
 * into a single `BusRetryOptions` shape. `retry: true` maps to
 * `{ enabled: true }`; `retry: false` maps to `{ enabled: false }`.
 *
 * @internal
 */
export function normalizeBusRetryOptions(
  retry: boolean | BusRetryOptions | undefined
): BusRetryOptions | undefined {
  if (retry === undefined) {
    return undefined;
  }
  if (typeof retry === 'boolean') {
    return { enabled: retry };
  }
  return retry;
}
